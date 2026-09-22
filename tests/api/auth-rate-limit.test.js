// H1/H3 安全回归测试 (2026-09-22, 波次1 worker A)
//   H1-a: /api/provinces/seed 与 /api/cache/clear-provinces 加 authMiddleware + requireAdmin
//   H1-b: /api/health 响应体不回显 dbError (保留服务端日志)
//   H1-c: /api-docs 与 /api-docs.json 生产 404, 非 production 可访问
//   H3-a: authLimiter 挂预认证端点 (login/register/guest-login/reset-password 及 legacy 旧路径)
//   H3-b: /api/essay/grade 双键限流 (u:email 兜底 ip)
//
// 说明: server.js import 即启动 (getDb + listen), 无法直接 supertest.
// 行为类断言用 mini-app 复刻同一条中间件链; 接线类断言读 server.js 源码,
// 与 tests/api/user-api.test.js / security-traversal.test.js 风格一致.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, requireAdmin } from '../../api/core/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf-8');
const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';

describe('H3-a: auth 预认证端点限流', () => {
  // 行为: 复刻 server.js 的挂载语义 (limiter 在 handler 之前, 对未认证请求生效)
  const buildAuthApp = (max) => {
    const app = express();
    app.use(express.json());
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max,
      message: { error: '请求过于频繁，请稍后再试' },
    });
    app.use(['/api/auth/login'], limiter);
    app.post('/api/auth/login', (_req, res) => res.status(401).json({ error: 'bad credentials' }));
    return app;
  };

  it('限额内请求照常到达 handler (非 429)', async () => {
    const app = buildAuthApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: 'x' });
      expect(res.status).toBe(401); // 到达 handler, 不是 429
    }
  });

  it('超过限额 → 末次 429', async () => {
    const app = buildAuthApp(3);
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: 'x' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: 'x' });
    expect(res.status).toBe(429);
  });

  it('server.js 接线: authLimiter 挂在全局 authMiddleware 链之前且覆盖预认证端点', () => {
    const limiterMountIdx = serverSrc.indexOf("'/api/auth/login',");
    const globalChainIdx = serverSrc.indexOf("app.use('/api/', auditMiddleware, authMiddleware");
    expect(limiterMountIdx).toBeGreaterThan(-1);
    expect(globalChainIdx).toBeGreaterThan(-1);
    expect(limiterMountIdx).toBeLessThan(globalChainIdx);

    // 挂载块内必须含全部预认证端点 + legacy 旧路径
    const mountBlock = serverSrc.slice(serverSrc.lastIndexOf('app.use(', limiterMountIdx), globalChainIdx);
    for (const p of [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/guest',
      '/api/auth/guest-login',
      '/api/auth/reset-password',
      '/api/login',
      '/api/register',
      '/api/guest-login',
    ]) {
      expect(mountBlock).toContain(`'${p}'`);
    }
    expect(mountBlock).toContain('authLimiter');
  });
});

describe('H1-a: /api/provinces/seed 与 /api/cache/clear-provinces 加 auth + admin 门', () => {
  const originalSecret = process.env.JWT_SECRET;
  let app;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    app = express();
    app.use(express.json());
    const stub = (_req, res) => res.json({ ok: true });
    // 复刻 server.js 的中间件顺序
    app.post('/api/provinces/seed', authMiddleware, requireAdmin, stub);
    app.post('/api/cache/clear-provinces', authMiddleware, requireAdmin, stub);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('无 token → 401', async () => {
    expect((await request(app).post('/api/provinces/seed')).status).toBe(401);
    expect((await request(app).post('/api/cache/clear-provinces')).status).toBe(401);
  });

  it('普通用户 token (非 admin) → 403', async () => {
    const token = jwt.sign({ email: 'user@test.com', role: 'student' }, TEST_SECRET);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/provinces/seed').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/cache/clear-provinces').set(auth)).status).toBe(403);
  });

  it('admin token → 通过门到达 handler', async () => {
    const token = jwt.sign({ email: 'admin@test.com', role: 'admin' }, TEST_SECRET);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/provinces/seed').set(auth)).status).toBe(200);
    expect((await request(app).post('/api/cache/clear-provinces').set(auth)).status).toBe(200);
  });

  it('server.js 接线: 两个端点均挂 authMiddleware, requireAdmin', () => {
    expect(serverSrc).toContain("app.post('/api/provinces/seed', authMiddleware, requireAdmin,");
    expect(serverSrc).toContain("app.post('/api/cache/clear-provinces', authMiddleware, requireAdmin,");
  });
});

describe('H1-b: /api/health 不回显 dbError', () => {
  it('响应体不含 dbError 键 (源码级)', () => {
    expect(serverSrc).toContain('createSuccessResponse({ dbReady }');
    expect(serverSrc).not.toContain('{ dbReady, dbError }');
  });

  it('db 失败仍保留服务端日志 (console.error)', () => {
    const healthIdx = serverSrc.indexOf("app.get('/api/health'");
    const block = serverSrc.slice(healthIdx, serverSrc.indexOf('});', healthIdx));
    expect(block).toContain('console.error');
  });
});

describe('H1-c: /api-docs 生产 404', () => {
  // 行为: 复刻 server.js 的条件挂载 (生产不注册 → 落入 404 fallback)
  const buildDocsApp = (nodeEnv) => {
    const app = express();
    if (nodeEnv !== 'production') {
      app.get('/api-docs', (_req, res) => res.status(200).send('swagger-ui'));
      app.get('/api-docs.json', (_req, res) => res.status(200).json({ openapi: '3.0.0' }));
    }
    app.use((_req, res) => res.status(404).json({ error: 'API 端点不存在' }));
    return app;
  };

  it('NODE_ENV=production → 404', async () => {
    const app = buildDocsApp('production');
    expect((await request(app).get('/api-docs')).status).toBe(404);
    expect((await request(app).get('/api-docs.json')).status).toBe(404);
  });

  it('非 production → 200', async () => {
    const app = buildDocsApp('development');
    expect((await request(app).get('/api-docs')).status).toBe(200);
    expect((await request(app).get('/api-docs.json')).status).toBe(200);
  });

  it('server.js 接线: api-docs 注册被 NODE_ENV 条件包裹', () => {
    expect(serverSrc).toContain("process.env.NODE_ENV !== 'production'");
    const gateIdx = serverSrc.indexOf("process.env.NODE_ENV !== 'production'");
    const docsIdx = serverSrc.indexOf("app.get('/api-docs', swaggerUI)");
    const docsJsonIdx = serverSrc.indexOf("app.get('/api-docs.json', swaggerSpec)");
    expect(docsIdx).toBeGreaterThan(gateIdx);
    expect(docsJsonIdx).toBeGreaterThan(gateIdx);
  });
});

describe('H3-b: /api/essay/grade 双键限流', () => {
  // 行为: 复刻 server.js 语义 (auth 之后按 u:email 兜底 ip, 5/min)
  const buildEssayApp = (max) => {
    const app = express();
    app.use(express.json());
    // fake auth: 从 header 注入 user
    app.use((req, _res, next) => {
      if (req.headers['x-test-email']) req.user = { email: req.headers['x-test-email'] };
      next();
    });
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max,
      keyGenerator: (req) => (req.user && req.user.email) ? `u:${req.user.email}` : `ip:${req.ip}`,
      message: { error: '请求过于频繁，请稍后再试' },
    });
    app.post('/api/essay/grade', limiter, (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('同一 email 限额内非 429, 超限额 → 末次 429', async () => {
    const app = buildEssayApp(5);
    const h = { 'x-test-email': 'stu@test.com' };
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/essay/grade').set(h).send({});
      expect(res.status).not.toBe(429);
    }
    const res = await request(app).post('/api/essay/grade').set(h).send({});
    expect(res.status).toBe(429);
  });

  it('不同 email 独立桶, 不互相挤占', async () => {
    const app = buildEssayApp(2);
    await request(app).post('/api/essay/grade').set('x-test-email', 'a@test.com').send({});
    await request(app).post('/api/essay/grade').set('x-test-email', 'a@test.com').send({});
    expect((await request(app).post('/api/essay/grade').set('x-test-email', 'a@test.com').send({})).status).toBe(429);
    expect((await request(app).post('/api/essay/grade').set('x-test-email', 'b@test.com').send({})).status).not.toBe(429);
  });

  it('server.js 接线: essayLimiter 双键 keyGenerator 且挂在 authMiddleware 之后', () => {
    expect(serverSrc).toContain(
      "app.post ('/api/essay/grade', authMiddleware, essayLimiter, wrapHandler(gradeEssayHandler))"
    );
    const defIdx = serverSrc.indexOf('const essayLimiter = rateLimit({');
    expect(defIdx).toBeGreaterThan(-1);
    const defBlock = serverSrc.slice(defIdx, serverSrc.indexOf('});', defIdx));
    expect(defBlock).toContain('`u:${req.user.email}`');
    expect(defBlock).toContain('`ip:${req.ip}`');
    expect(defBlock).toContain('max: 5');
  });
});
