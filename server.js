import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { swaggerUI, swaggerSpec } from './api/core/swagger.js';
import { authMiddleware, validateJWTSecret } from './api/core/auth.js';
import { getDb } from './api/core/db.js';
import { startWorker } from './api/core/taskWorker.js';
import { ensureSeeds } from './api/core/ensureSeeds.js';
import { logger, loggerMiddleware } from './api/core/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { securityHeaders, xssSanitizer, xssDetector, csrfProtection, auditMiddleware } from './api/middleware/security.js';
import { versionMiddleware } from './api/middleware/versioning.js';
import { createSuccessResponse, createErrorResponse, ErrorCode } from './api/utils/errorCodes.js';
import modulesRouter from './api/modules/index.js';

import { getProvinces, getProvinceByCode, getProvinceStats } from './api/handlers/provinces.js';
import { getClassDetail } from './api/handlers/class-analysis.js';
import adaptiveDifficultyHandler from './api/handlers/adaptive-difficulty.js';
import { getProvinceTrends, getProvinceCompare } from './api/handlers/province-trends.js';
import { seedProvinces } from './api/handlers/seed-provinces.js';
import { generateExamPdf } from './api/handlers/exam-pdf.js';
import proxyHandler from './api/handlers/proxy.js';

dotenv.config();

validateJWTSecret();

// D067 (2026-08-17): DEV_AUTH_BYPASS 生产防护.
// 2026-08-17 incident: 旧进程环境变量残留 DEV_AUTH_BYPASS=1,
// 导致所有端点无 token 返回 200，用户数据泄露.
// 生产环境强制拒绝启动；开发环境输出醒目警告.
if (process.env.DEV_AUTH_BYPASS === '1') {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: DEV_AUTH_BYPASS=1 is set in production — refusing to start');
    process.exit(1);
  }
  console.warn('⚠️  WARNING: DEV_AUTH_BYPASS=1 — ALL AUTH GUARDS BYPASSED — NOT FOR PRODUCTION');
}

const app = express();
const PORT = process.env.PORT || 3002;

// Rate-limit policy:
//   - authLimiter   20 / 15min : unauth-heavy endpoints (login/register/etc.)
//   - proxyLimiter  10 / 1min  : per-user AI proxy (cost-controlled)
//   - apiLimiter    dynamic    : 120/min for authenticated users, 30/min for anon.
//                                Anonymous traffic gets the tighter bucket because
//                                we can't tie it to a stable user key for ban lists.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '请求过于频繁，请稍后再试' } });
const proxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: '请求过于频繁，请稍后再试' } });
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // express-rate-limit picks the key from req.ip by default; once authMiddleware
  // runs the request will have req.user, so we can use email as a more stable
  // key and bump the budget for known users.
  keyGenerator: (req /*, res */) => (req.user && req.user.email) ? `u:${req.user.email}` : `ip:${req.ip}`,
  max: (req /*, res */) => (req.user && req.user.email) ? 120 : 30,
  message: { error: '请求过于频繁，请稍后再试' },
});

// Trust-proxy configuration.
//   - Default: trust the loopback proxy only (Express docs recommend this for
//     single-tier reverse proxies).
//   - Override with TRUST_PROXY=<n|ip|loopback|...> in env if you sit behind
//     multiple tiers (e.g. CDN -> ALB -> app). Never set to `true` unless you
//     fully control every hop, otherwise rate-limit X-Forwarded-For will be
//     spoofable. See https://expressjs.com/en/guide/behind-proxies.html
const TRUST_PROXY = process.env.TRUST_PROXY ?? 'loopback';
app.set('trust proxy', TRUST_PROXY);
app.use(securityHeaders);
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002'], credentials: true }));
// Default JSON body limit is 1mb to mitigate DoS via large payloads.
// Endpoints that legitimately need bigger bodies (e.g. exam-paper generation,
// bulk imports) MUST install their own per-route body parser with an explicit,
// tighter limit documented at the call site.
app.use(express.json({ limit: '1mb' }));
app.use(xssSanitizer);
app.use(xssDetector);
app.use(csrfProtection);
app.use(loggerMiddleware);
app.use('/api/', versionMiddleware);

app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach((c) => {
      const idx = c.indexOf('=');
      if (idx > 0) {
        req.cookies[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
      }
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/aitutor')) {
    req.url = req.url.slice('/aitutor'.length) || '/';
  }
  next();
});

app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    res.sendFile('index.html', { root: 'frontend' });
  }
});

app.get('/index.html', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    res.sendFile('index.html', { root: 'frontend' });
  }
});

app.get('/app', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// P0.5 (2026-08-13): freeze legacy frontends, 301 -> F3
// legacy /frontend (frontend/) and /redesign (ai-tutor-redesign/) have been migrated to /f3.
// Preserve 30 days for backward links, then change to 410 Gone.
// NOTE: must be BEFORE any express.static() that would shadow it (e.g. /redesign path inside frontend/).
app.get(/^\/(frontend|redesign)(\/.*)?$/, (req, res) => {
  res.redirect(301, '/f3/pages/index.html');
});

app.use(express.static('public'));
app.use('/vendor', express.static('public/vendor'));
app.use(
  '/assets',
  express.static('frontend/assets', {
    setHeaders(res, path) {
      if (path.endsWith('.js') || path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use(express.static('frontend', {
  setHeaders(res, path) {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.use('/icons', express.static('public/icons'));
// SERVE_F3: prod off by default, opt-in with SERVE_F3=true.
// Dev/staging always on for frontend iteration.
// Cache-Control stays no-cache in dev to avoid ESM browser cache stickiness (P0.1).
const SERVE_F3 = process.env.NODE_ENV !== 'production' || process.env.SERVE_F3 === 'true';
if (SERVE_F3) {
  app.use(
    '/f3',
    express.static('ai-tutor-frontend', {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
          // P0.1: dev/staging force no-cache to fix ES module browser cache stickiness
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );
  logger.info(`[F3] /f3 preview enabled (NODE_ENV=${process.env.NODE_ENV || '<unset>'}, SERVE_F3=${process.env.SERVE_F3 || '<unset>'})`);
} else {
  logger.info(`[F3] /f3 preview disabled (NODE_ENV=production, SERVE_F3 not set)`);
}
app.use(
  '/src',
  express.static('public/src', {
    setHeaders(res, path) {
      if (path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use('/uploads', express.static('uploads'));

// wrapHandler: catch both sync throws and async rejections, and respect
// the case where the handler already started writing the response.
const wrapHandler = (handler) => async (req, res, next) => {
  try {
    // Express 4 only forwards rejections to error middleware when the handler
    // returns a promise; synchronous throws need an explicit try/catch.
    const ret = handler(req, res, next);
    if (ret && typeof ret.then === 'function') {
      await ret;
    }
  } catch (error) {
    logger.error('Handler error', { error });
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器内部错误' });
    } else {
      // Headers already flushed (streaming, etc.) — destroy the socket so the
      // client doesn't hang waiting for a body that's never coming.
      res.destroy(error);
    }
  }
};

app.get('/api/health', async (_req, res) => {
  let dbReady = false;
  let dbError = '';
  try {
    await getDb();
    dbReady = true;
  } catch (e) {
    dbError = e && e.message ? String(e.message) : 'db_error';
  }
  res.json(createSuccessResponse({ dbReady, dbError }, '服务运行正常'));
});

app.get('/api-docs', swaggerUI);
app.get('/api-docs.json', swaggerSpec);

app.get('/api/provinces', wrapHandler(getProvinces));
app.get('/api/provinces/:code', wrapHandler(getProvinceByCode));
app.get('/api/province-stats/:code', wrapHandler(getProvinceStats));
app.get('/api/province-trends/:code', wrapHandler(getProvinceTrends));
app.get('/api/province-compare', wrapHandler(getProvinceCompare));
app.post('/api/provinces/seed', async (req, res) => {
  try {
    const result = await seedProvinces();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '种子导入失败' });
  }
});

app.get('/api/exam-pdf/:paperId', generateExamPdf);
app.get('/api/adaptive-difficulty', authMiddleware, wrapHandler(adaptiveDifficultyHandler));
app.get('/api/class-detail', authMiddleware, wrapHandler(getClassDetail));
// /api/proxy — MUST stay behind a fixed endpoint whitelist.
// The handler (api/handlers/proxy.js) refuses any model not in API_CONFIGS,
// which means the upstream URL is hardcoded and not user-controllable, so
// the SSRF surface is limited to the two allow-listed hosts (DashScope /
// DeepSeek).  Do NOT extend this handler to accept arbitrary URLs.
app.post('/api/proxy', authMiddleware, proxyLimiter, wrapHandler(proxyHandler));

// Audit BEFORE auth: security-relevant events (failed auth, anonymous probing,
// repeat 401s from one IP) only show up in the audit log if auditMiddleware
// runs before authMiddleware rejects the request.
app.use('/api/', auditMiddleware, authMiddleware, apiLimiter, modulesRouter);

// 404 fallback. Message intentionally generic — leaking valid routes is
// info-disclosure. Attach request id so client can quote it in bug reports.
app.use((req, res) => {
  logger.warn(`404 ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    user: req.user?.email || 'anonymous',
  });
  const body = createErrorResponse(ErrorCode.INTERNAL_ERROR, 'API 端点不存在');
  if (req.requestId) body.requestId = req.requestId;
  res.status(404).json(body);
});

app.use(errorHandler);

async function start() {
  try {
    await getDb();
    // Phase 3: 幂等 seed (knowledge_points 为空时自动导入教材知识点)
    const seedResult = await ensureSeeds();
    if (seedResult.seeded) {
      logger.info(`[Seed] 自动导入完成: ${seedResult.count} 条知识点`);
    } else if (seedResult.reason) {
      logger.info(`[Seed] 跳过: ${seedResult.reason}`);
    }
    startWorker();
    app.listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('启动失败', { error });
    process.exit(1);
  }
}

start();
