// H2 安全回归测试 (2026-09-22): 题库/向量库写端点加 requireAdmin, 防内容投毒
//   POST /api/exam/questions        → requireAdmin
//   POST /api/exam/questions/batch  → requireAdmin
//   POST /api/rag/ingest            → requireAdmin
// 业务层一律不发真实写库: db 全部 mock; admin 用例只走到参数校验层 (400),
// 断言「非 401/403」即证明角色门已放行且未依赖真实 DB/网络.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })) }))
}));

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';

const studentToken = () =>
  jwt.sign({ id: 2, userId: 2, role: 'student', email: 's@t.com' }, TEST_SECRET);
const adminToken = () =>
  jwt.sign({ id: 1, userId: 1, role: 'admin', email: 'a@t.com' }, TEST_SECRET);

describe('H2: 题库/向量库写端点角色门', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalBypass = process.env.DEV_AUTH_BYPASS;
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.DEV_AUTH_BYPASS;
    const { authMiddleware } = await import('../../api/core/auth.js');
    const { default: examRouter } = await import('../../api/modules/exam/routes.js');
    const { default: ragSearchRouter } = await import('../../api/routes/rag-search.js');

    // 镜像 server.js:483 — authMiddleware 全局挂在 /api 前缀下
    app = express();
    app.use(express.json());
    app.use('/api', authMiddleware);
    app.use('/api/exam', examRouter);
    app.use('/api/rag', ragSearchRouter);
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
    if (originalBypass === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = originalBypass;
  });

  const WRITE_ENDPOINTS = [
    { method: 'post', path: '/api/exam/questions', body: {} },
    { method: 'post', path: '/api/exam/questions/batch', body: {} },
    { method: 'post', path: '/api/rag/ingest', body: {} }
  ];

  for (const ep of WRITE_ENDPOINTS) {
    it(`无 token POST ${ep.path} → 401`, async () => {
      const res = await request(app).post(ep.path).send(ep.body);
      expect(res.status).toBe(401);
    });

    it(`普通用户 (student) POST ${ep.path} → 403`, async () => {
      const res = await request(app)
        .post(ep.path)
        .set('Authorization', `Bearer ${studentToken()}`)
        .send(ep.body);
      expect(res.status).toBe(403);
    });

    it(`admin POST ${ep.path} → 非 401/403 (业务层 stub, 不落库)`, async () => {
      const res = await request(app)
        .post(ep.path)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(ep.body);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      // 空 body 应在参数校验层返回 400, 证明未触达真实写库
      expect(res.status).toBe(400);
    });
  }

  it('同文件 GET 端点不受影响: student GET /api/exam/papers 不被角色门拦截', async () => {
    const res = await request(app)
      .get('/api/exam/papers')
      .set('Authorization', `Bearer ${studentToken()}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
