import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { swaggerUI, swaggerSpec } from './api/core/swagger.js';
import { authMiddleware, validateJWTSecret } from './api/core/auth.js';
import { getDb } from './api/core/db.js';
import { startWorker } from './api/core/taskWorker.js';
import { logger, loggerMiddleware } from './api/core/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { securityHeaders, xssSanitizer, xssDetector, csrfProtection, auditMiddleware } from './api/middleware/security.js';
import { versionMiddleware } from './api/middleware/versioning.js';
import { createSuccessResponse, createErrorResponse, ErrorCode } from './api/utils/errorCodes.js';
import modulesRouter from './api/modules/index.js';

import { getProvinces, getProvinceByCode, getProvinceStats } from './api/handlers/provinces.js';
import { getProvinceTrends, getProvinceCompare } from './api/handlers/province-trends.js';
import { seedProvinces } from './api/handlers/seed-provinces.js';
import { generateExamPdf } from './api/handlers/exam-pdf.js';
import proxyHandler from './api/handlers/proxy.js';

dotenv.config();

validateJWTSecret();

const app = express();
const PORT = process.env.PORT || 3002;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '请求过于频繁，请稍后再试' } });
const proxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: '请求过于频繁，请稍后再试' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求过于频繁，请稍后再试' } });

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
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
app.use('/frontend', express.static('frontend'));
app.use('/icons', express.static('public/icons'));
app.use('/redesign', express.static('ai-tutor-redesign'));
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

const wrapHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    logger.error('Handler error', { error });
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器内部错误' });
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
app.post('/api/proxy', authMiddleware, proxyLimiter, wrapHandler(proxyHandler));

app.use('/api/', authMiddleware, auditMiddleware, apiLimiter, modulesRouter);

app.use((req, res) => {
  res.status(404).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, 'API 端点不存在'));
});

app.use(errorHandler);

async function start() {
  try {
    await getDb();
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
