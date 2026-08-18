import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { errorResponse } from '../utils/response.js';
import { logger } from '../core/logger.js';

const window = new JSDOM('').window;
const purify = createDOMPurify(window);

const MAX_BODY_SIZE = {
  default: 1 * 1024 * 1024,
  vision: 50 * 1024 * 1024,
  batch: 5 * 1024 * 1024,
};

const AUDIT_ACTIONS = [
  'login',
  'register',
  'generate_paper',
  'submit_exam',
  'update_prefs',
  'change_password',
];

export function bodySizeLimiter(req, res, next) {
  let limit = MAX_BODY_SIZE.default;
  
  if (req.path.includes('/vision/')) {
    limit = MAX_BODY_SIZE.vision;
  } else if (req.path.includes('/batch') || req.path.includes('/generate')) {
    limit = MAX_BODY_SIZE.batch;
  }
  
  let received = 0;
  const chunks = [];
  
  req.on('data', (chunk) => {
    received += chunk.length;
    chunks.push(chunk);
    
    if (received > limit) {
      req.destroy();
    }
  });
  
  req.on('end', () => {
    req.body = Buffer.concat(chunks);
    next();
  });
  
  req.on('error', () => {
    res.status(413).json(errorResponse('请求体大小超过限制'));
  });
}

export function auditMiddleware(req, res, next) {
  const action = extractAction(req);
  
  if (AUDIT_ACTIONS.includes(action)) {
    const user = req.user?.email || 'anonymous';
    const details = {
      method: req.method,
      path: req.path,
      ip: req.ip,
    };
    
    logger.audit(action, user, details);
  }
  
  next();
}

function extractAction(req) {
  const { path } = req;
  
  if (path.includes('/login')) return 'login';
  if (path.includes('/register')) return 'register';
  if (path.includes('/generate-paper')) return 'generate_paper';
  if (path.includes('/exam-session/submit')) return 'submit_exam';
  if (path.includes('/user-prefs')) return 'update_prefs';
  if (path.includes('/reset-password') || path.includes('/change-password')) return 'change_password';
  
  return null;
}

export function sanitizeInput(obj) {
  if (typeof obj === 'string') {
    return purify.sanitize(obj, { ALLOWED_TAGS: [] });
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeInput(item));
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeInput(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

export function xssSanitizer(req, res, next) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
}

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi
];

export function detectXSS(value) {
  if (typeof value !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(value));
}

export function xssDetector(req, res, next) {
  const check = (obj) => {
    if (!obj) return false;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (typeof val === 'string' && detectXSS(val)) {
          return true;
        }
        if (typeof val === 'object' && check(val)) {
          return true;
        }
      }
    }
    return false;
  };

  if (check(req.body) || check(req.query)) {
    return res.status(400).json(errorResponse('请求包含不安全内容'));
  }
  next();
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP: development-only 允许 inline styles/scripts (F3 Tailwind CDN 需要); production收紧
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://dashscope.aliyuncs.com; font-src 'self' https://cdn.jsdelivr.net");
  } else {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data: blob:; connect-src 'self' https://dashscope.aliyuncs.com; font-src 'self' https://cdn.jsdelivr.net");
  }
  res.removeHeader('X-Powered-By');
  next();
}

const SAFE_ORIGINS = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    return next();
  }

  const originUrl = new URL(origin);
  const isAllowed = SAFE_ORIGINS.some(safe => {
    try {
      const safeUrl = new URL(safe);
      return originUrl.origin === safeUrl.origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    return res.status(403).json(errorResponse('请求来源不被允许'));
  }
  next();
}
