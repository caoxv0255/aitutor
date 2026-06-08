import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { errorResponse } from '../utils/response.js';

const window = new JSDOM('').window;
const purify = createDOMPurify(window);

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
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
