// H4 回归测试 (2026-09-22): admin 判定统一为 requireAdmin (role-based),
//   清除 api/routes/graphrag.js 与 api/routes/knowledge-graph.js 中
//   硬编码邮箱 admin@uibe.edu.cn 的自定义判定块.
// 覆盖端点:
//   GET  /api/rag/graphrag/admin/jobs
//   GET  /api/rag/graphrag/admin/stats
//   POST /api/rag/graphrag/admin/reindex
//   POST /api/tutor/graph/reindex
// 顺带 C1 回归保护: GET /api/tutor/graph/file?file_path=../../../../etc/passwd → 400.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// GraphRAG 内部服务本机未运行; mock axios 使转发层快速走 503/500,
// 认证层断言不依赖真实服务. (命名导出与 default 同对象, 兼容
// knowledge-graph.js 的 `await import('axios')` 动态引入写法.)
vi.mock('axios', () => {
  const m = {
    post: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8100')),
    get: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8100')),
  };
  return { default: m, ...m };
});

// 避免 admin 用例触发真实文件扫描/写盘副作用.
vi.mock('../../api/services/obsidian-sync.js', () => ({
  default: {
    syncKnowledgeToGraphRAG: vi.fn().mockResolvedValue({ status: 'success' }),
    extractFrontmatter: vi.fn().mockReturnValue({}),
  },
}));

import graphragRouter from '../../api/routes/graphrag.js';
import knowledgeGraphRouter from '../../api/routes/knowledge-graph.js';

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';

// 注意: admin 邮箱刻意不用 admin@uibe.edu.cn — 证明判定已改为 role-based.
const studentToken = () =>
  jwt.sign({ id: 2, userId: 2, role: 'student', email: 'student@t.com' }, TEST_SECRET);
const adminToken = () =>
  jwt.sign({ id: 1, userId: 1, role: 'admin', email: 'admin-role@t.com' }, TEST_SECRET);

describe('H4: admin 端点统一 requireAdmin', () => {
  const originalSecret = process.env.JWT_SECRET;
  let app;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    app = express();
    app.use(express.json());
    app.use('/api/rag/graphrag', graphragRouter);
    app.use('/api/tutor/graph', knowledgeGraphRouter);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // [方法, 路径, body]
  const adminEndpoints = [
    ['get', '/api/rag/graphrag/admin/jobs', null],
    ['get', '/api/rag/graphrag/admin/stats', null],
    ['post', '/api/rag/graphrag/admin/reindex', { index_name: 'gaokao_all' }],
    ['post', '/api/tutor/graph/reindex', {}],
  ];

  for (const [method, url, body] of adminEndpoints) {
    it(`${method.toUpperCase()} ${url} — student token → 403`, async () => {
      let r = request(app)[method](url).set('Authorization', `Bearer ${studentToken()}`);
      if (body) r = r.send(body);
      const res = await r;
      expect(res.status).toBe(403);
    });

    it(`${method.toUpperCase()} ${url} — 无 token → 401`, async () => {
      let r = request(app)[method](url);
      if (body) r = r.send(body);
      const res = await r;
      expect(res.status).toBe(401);
    });

    it(`${method.toUpperCase()} ${url} — admin token → 非 401/403 (业务层不苛求)`, async () => {
      let r = request(app)[method](url).set('Authorization', `Bearer ${adminToken()}`);
      if (body) r = r.send(body);
      const res = await r;
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  }

  it('C1 回归保护: file_path=../../../../etc/passwd → 400', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file')
      .query({ file_path: '../../../../etc/passwd' })
      .set('Authorization', `Bearer ${studentToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
