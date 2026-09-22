// C1/C2 安全回归测试 (2026-09-22 止血修复)
//   C1: GET /api/tutor/graph/file 任意文件读取 (路径穿越)
//   C2: POST /api/exam/papers 缺角色门 + exam-pdf paper_file_path 路径穿越
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../../api/core/auth.js';

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn()
}));

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
}

describe('C1: /api/tutor/graph/file 路径穿越', () => {
  const originalSecret = process.env.JWT_SECRET;
  let app;

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    const { default: router } = await import('../../api/routes/knowledge-graph.js');
    app = express();
    app.use('/api/tutor/graph', router);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  const token = () =>
    jwt.sign({ id: 1, userId: 1, role: 'student', email: 's@t.com' }, TEST_SECRET);

  it('file_path=../../../../etc/passwd → 400', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file')
      .query({ file_path: '../../../../etc/passwd' })
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('..%2f 编码变体 → 400', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file?file_path=..%2f..%2f..%2fetc%2fpasswd')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
  });

  it('绝对路径 /etc/passwd → 400', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file')
      .query({ file_path: '/etc/passwd' })
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
  });

  it('合法路径 → 200 且响应结构不变', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file')
      .query({ file_path: '数学/MATH-001_集合与函数概念.md' })
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('content');
    expect(res.body.data).toHaveProperty('frontmatter');
    expect(res.body.data.path).toBe('数学/MATH-001_集合与函数概念.md');
  });

  it('合法但不存在的路径 → 404 (不被误判为 400)', async () => {
    const res = await request(app)
      .get('/api/tutor/graph/file')
      .query({ file_path: '数学/不存在的文件.md' })
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
  });
});

describe('C2: requireAdmin 角色门 (POST /api/exam/papers)', () => {
  it('非 admin (student) → 403', () => {
    const req = { user: { id: 2, role: 'student', email: 's@t.com' } };
    const res = createMockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('无 user → 403', () => {
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('admin → next()', () => {
    const req = { user: { id: 1, role: 'admin', email: 'a@t.com' } };
    const res = createMockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('C2: exam-pdf paper_file_path 路径穿越', () => {
  let getDb;
  let generateExamPdf;

  beforeEach(async () => {
    ({ getDb } = await import('../../api/core/db.js'));
    ({ generateExamPdf } = await import('../../api/handlers/exam-pdf.js'));
  });

  function mockDbWithPaper(paper, questions = []) {
    getDb.mockResolvedValue({
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM exam_papers')) return { rows: [paper] };
        return { rows: questions }; // exam_questions
      })
    });
  }

  it('paper_file_path 含 .. → 400', async () => {
    mockDbWithPaper({
      id: 1, subject: 'math', year: 2024, province_code: 'beijing',
      paper_file_path: '../../../../etc/passwd'
    });
    const req = { params: { paperId: '1' }, query: {} };
    const res = createMockRes();

    await generateExamPdf(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('非法文件路径');
  });

  it('paper_file_path 为绝对路径 → 400', async () => {
    mockDbWithPaper({
      id: 1, subject: 'math', year: 2024, province_code: 'beijing',
      paper_file_path: '/etc/passwd'
    });
    const req = { params: { paperId: '1' }, query: {} };
    const res = createMockRes();

    await generateExamPdf(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('逃逸到允许目录外的相对路径 (直读兜底变体) → 400', async () => {
    mockDbWithPaper({
      id: 1, subject: 'math', year: 2024, province_code: 'beijing',
      paper_file_path: 'database/../../etc/passwd'
    });
    const req = { params: { paperId: '1' }, query: {} };
    const res = createMockRes();

    await generateExamPdf(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('合法相对路径 (文件不存在) → 不判 400, 走 DB 生成回退 (404 无题目)', async () => {
    mockDbWithPaper({
      id: 1, subject: 'math', year: 2024, province_code: 'beijing',
      paper_file_path: '高考真题/北京高考/不存在的试卷.pdf'
    }, []);
    const req = { params: { paperId: '1' }, query: {} };
    const res = createMockRes();

    await generateExamPdf(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toContain('试卷没有题目数据');
  });
});
