// tests/api/vision-similar-by-text.test.js — P8 (2026-09-23)
//
// 端点: POST /api/vision/similar-by-text
// 拍板: photo-solve 先接「按题干文本查相似题」的纯检索端点, 再接 photo-solve.
//   此前要相似题只能走 POST /api/vision/search —— 它强制要 image, 会二次 OCR
//   (visionSearchService.js:189) + errorAnalysis LLM (:223) + learningPlan LLM (:269).
//
// 断言 (机械可复现):
//   1. 入参校验: 缺 text / 空 / 过短(<10) / 超长(>2000) → 400; 只给 image → 400
//   2. 低于阈值的结果由 SQL 层排除 (阈值谓词 + 参数), 不靠事后 JS 过滤
//   3. 无过阈值结果 → 诚实空态 (空数组 + similarNotice)
//   4. 该端点不触发任何 LLM/OCR: parseImageToQuestion / llm.chat / llm.visionChat /
//      ingestQuestion 零调用, 而 getEmbedding 恰好调用 1 次 (证明走的是真检索路径)
//   5. 无 token → 401
//   6. embedding 不可用 → 诚实空态 + notice, 且不触碰 DB
//   7. 返回字段与 /search 的相似题部分一致 (便于前端复用渲染)
//
// 跑: npm test -- vision-similar-by-text

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── mock 重依赖: embedding / db / OCR / ingest / LLM ──────────────────────
// 全部换成 spy, 既能给受控返回值, 又能断言"零调用"。
vi.mock('../../services/embedding.js', () => ({ getEmbedding: vi.fn() }));
vi.mock('../../api/core/db.js', () => ({ getDb: vi.fn() }));
vi.mock('../../api/routes/vision-parse.js', () => ({
  parseImageToQuestion: vi.fn(),
  // routes.js 以 default 形式挂载 vision-parse 子路由 —— 给个直通中间件,
  // 未命中的路径继续交给本模块的路由。
  default: (req, res, next) => next(),
}));
vi.mock('../../api/routes/rag-search.js', () => ({ ingestQuestion: vi.fn() }));
vi.mock('../../services/llm.js', () => ({
  llm: { chat: vi.fn(), visionChat: vi.fn() },
  MODELS: { QWEN_TURBO: 'qwen-turbo', QWEN_VL_PLUS: 'qwen-vl-plus' },
}));

import { getEmbedding } from '../../services/embedding.js';
import { getDb } from '../../api/core/db.js';
import { parseImageToQuestion } from '../../api/routes/vision-parse.js';
import { ingestQuestion } from '../../api/routes/rag-search.js';
import { llm } from '../../services/llm.js';
import visionRouter from '../../api/modules/vision/routes.js';

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
const studentToken = () =>
  jwt.sign({ id: 2, userId: 2, role: 'student', email: 'student@t.com' }, TEST_SECRET);

const LONG_TEXT = '已知二次函数 f(x) = x^2 - 2x + 1，求其在区间 [0, 2] 上的最大值与最小值';

const SAMPLE_ROW = {
  question_uid: 'q-uid-001',
  stem: '已知函数 f(x)=x^2, 求 f(2) 的值',
  options: null,
  answer: 'A',
  analysis: '直接代入即可',
  knowledge_points: 'kp_math_015',
  difficulty: 2,
  question_type: 'choice',
  subject_code: 'math',
  year: 2024,
  score: 5,
  similarity: 0.8234567,
};

function makePool(rows) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

let app;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
  app = express();
  app.use(express.json());
  app.use('/api/vision', visionRouter);
});

afterEach(() => {
  delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
});

describe('POST /api/vision/similar-by-text — 纯检索, 禁 LLM', () => {
  it('1. 无 token → 401 (走既有 authMiddleware)', async () => {
    const res = await request(app).post('/api/vision/similar-by-text').send({ text: LONG_TEXT });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(getEmbedding).not.toHaveBeenCalled();
  });

  it('2. 入参校验: 缺/空/过短/超长 text → 400, 只给 image 也 → 400', async () => {
    const token = studentToken();
    const bad = [
      {}, // 缺 text
      { text: '' }, // 空
      { text: '太短了' }, // <10
      { text: 'x'.repeat(2001) }, // >2000
      { image: 'data:image/png;base64,AAAA' }, // 只给 image（本端点不接受也不要求）
    ];
    for (const body of bad) {
      const res = await request(app)
        .post('/api/vision/similar-by-text')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
    // 校验先于任何副作用: 不查库 / 不算向量 / 不跑 OCR
    expect(getDb).not.toHaveBeenCalled();
    expect(getEmbedding).not.toHaveBeenCalled();
    expect(parseImageToQuestion).not.toHaveBeenCalled();
  });

  it('3. 正常检索: 返回契约与 /search 相似题部分一致, 阈值谓词进 SQL', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([SAMPLE_ROW]);
    getDb.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/vision/similar-by-text')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ text: LONG_TEXT, subject: 'math', limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.similarQuestions)).toBe(true);
    expect(res.body.data.similarQuestions).toHaveLength(1);
    expect(res.body.data.similarNotice).toBeNull();

    // 字段口径: 与 findSimilarQuestions 一致, similarity 为增量字段
    expect(Object.keys(res.body.data.similarQuestions[0]).sort()).toEqual(
      [
        'answer', 'content', 'difficulty', 'explanation', 'id', 'knowledge_points',
        'options', 'question_type', 'score', 'similarity', 'subject_code', 'year',
      ].sort()
    );
    expect(res.body.data.similarQuestions[0]).toMatchObject({
      id: 'q-uid-001',
      content: SAMPLE_ROW.stem,
      answer: 'A',
      explanation: '直接代入即可',
      subject_code: 'math',
    });
    expect(res.body.data.similarQuestions[0].similarity).toBeCloseTo(0.8235, 4);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('1 - (qv.q_embedding <=> $1) >= $3'); // 阈值谓词 (低相似度行不出库)
    expect(params[2]).toBeCloseTo(0.60, 5); // 默认阈值 0.60
    expect(params[3]).toBe('math'); // subject 过滤
    expect(params[4]).toBe(5); // top-N
  });

  it('4. 低于阈值 / 无过阈值结果 → 诚实空态 + notice', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([]); // DB 端遵守 WHERE → 低相似度行根本不返回
    getDb.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/vision/similar-by-text')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ text: LONG_TEXT });

    expect(res.status).toBe(200);
    expect(res.body.data.similarQuestions).toEqual([]);
    expect(res.body.data.similarNotice).toBeTruthy();
    expect(res.body.data.similarNotice).toContain('阈值');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('>= $3'); // 过滤在 SQL 层
  });

  it('5. 不触发任何 LLM/OCR: OCR/errorAnalysis/learningPlan/ingest 零调用', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    getDb.mockResolvedValue(makePool([SAMPLE_ROW]));

    const res = await request(app)
      .post('/api/vision/similar-by-text')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ text: LONG_TEXT, subject: 'math' });

    expect(res.status).toBe(200);
    // 核心拍板: 纯检索, 不碰生成管线
    expect(parseImageToQuestion).not.toHaveBeenCalled(); // 无 OCR
    expect(llm.chat).not.toHaveBeenCalled(); // 无 errorAnalysis / learningPlan
    expect(llm.visionChat).not.toHaveBeenCalled(); // 无多模态分析
    expect(ingestQuestion).not.toHaveBeenCalled(); // 无自动入库
    // 证明确实走了真检索路径 (而非直接空返回)
    expect(getEmbedding).toHaveBeenCalledTimes(1);
    expect(getDb).toHaveBeenCalledTimes(1);
  });

  it('6. embedding 不可用 → 诚实空态 + notice, 且不触碰 DB', async () => {
    getEmbedding.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:11434'));
    const pool = makePool([SAMPLE_ROW]); // 即使有题也绝不能被查到
    getDb.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/vision/similar-by-text')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ text: LONG_TEXT, subject: 'math' });

    expect(res.status).toBe(200);
    expect(res.body.data.similarQuestions).toEqual([]);
    expect(res.body.data.similarNotice).toContain('暂不可用');
    expect(pool.query).not.toHaveBeenCalled(); // 禁止随机/兜底回退
    expect(llm.chat).not.toHaveBeenCalled();
  });
});
