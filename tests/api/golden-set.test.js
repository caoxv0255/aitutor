// tests/api/golden-set.test.js — G2 golden-set 回归 (首版, 2026-09-23)
//
// 幻觉评审提案 G2: 黄金用例数据 (tests/golden/*.json) 与断言分离,
//   每条用例写明 输入 / 预期 / 依据代码位置 / 登记日期.
//
// 本套只编码【今天已存在】的确定性行为, 绝不调用真实 LLM / embedding / 外部 API:
//   1. F3 相似题管线  — mock embedding + mock DB, 断言阈值过滤 / 4 位小数 / 诚实空态
//   2. tutor /ask 响应 — mock 检索 + mock chatCompletion, 断言既有契约字段
//   3. 安全契约抽检    — 无 token 401 / student 403 (波次 1 已修项, 防回退)
//
// 不测 grounded / citations (F1 未实施, 属波次 2) — 用 test.todo 留档.
// harness 自检: 见文末 "harness 自检" describe — 证明改坏契约会让断言变红.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(__dirname, '../golden');
const loadGolden = (f) => JSON.parse(readFileSync(resolve(GOLDEN_DIR, f), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// 全局 mock: 禁触真实 embedding / LLM / DB / RAG
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../services/embedding.js', () => ({
  getEmbedding: vi.fn(),
  getBatchEmbeddings: vi.fn(async () => []),
  EMBEDDING_MODEL: 'bge-m3',
  EMBEDDING_DIMS: 1024,
  EMBEDDING_PROVIDER: 'local',
}));

vi.mock('../../services/llm.js', () => ({
  MODEL_CONFIGS: {},
  DEFAULT_MODEL: 'qwen-plus',
  FEATURE_BUDGETS: {},
  chatCompletion: vi.fn(),
  safeParseLLMJson: (c) => JSON.parse(c),
  streamChatCompletion: vi.fn(),
  visionChatCompletion: vi.fn(),
  getBudgetStats: vi.fn(() => ({})),
  llm: { chat: vi.fn(), streamChat: vi.fn(), visionChat: vi.fn(), getBudgetStats: vi.fn() },
  MODELS: {
    QWEN_PLUS: 'qwen-plus', QWEN_MAX: 'qwen-max', QWEN_TURBO: 'qwen-turbo',
    QWEN_VL_MAX: 'qwen-vl-max', QWEN_VL_PLUS: 'qwen-vl-plus', DEEPSEEK_CHAT: 'deepseek-chat',
  },
  default: {},
}));

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })) })),
}));

vi.mock('../../api/routes/rag-search.js', () => ({
  ingestQuestion: vi.fn(async () => ({})),
  searchSimilarQuestions: vi.fn(async () => []),
  deleteQuestion: vi.fn(async () => ({})),
  upsertQuestionVectors: vi.fn(async () => ({})),
  searchMultiVector: vi.fn(async () => []),
  getQuestionVectors: vi.fn(async () => []),
  deleteQuestionVectors: vi.fn(async () => ({})),
  getQuestionVectorsStats: vi.fn(async () => ({})),
  getIngestStats: vi.fn(async () => ({})),
  default: {},
}));

import { getEmbedding } from '../../services/embedding.js';
import { chatCompletion } from '../../services/llm.js';
import { searchSimilarQuestions } from '../../api/routes/rag-search.js';
import { authMiddleware } from '../../api/core/auth.js';
import { VisionSearchService } from '../../api/services/visionSearchService.js';
import tutorAgentRouter from '../../api/routes/tutor-agent.js';
import examRouter from '../../api/modules/exam/routes.js';

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
const studentToken = () => jwt.sign({ id: 2, userId: 2, role: 'student', email: 's@t.com' }, TEST_SECRET);

const LONG_TEXT =
  '已知二次函数 f(x)=x^2-2x+1，求其在区间[0,2]上的最大值与最小值';

// ─────────────────────────────────────────────────────────────────────────────
// 断言 helper (被 runner 与 harness 自检共用 — 保证「非空转」)
// ─────────────────────────────────────────────────────────────────────────────
function assertSimilarityRounded(actual, expected) {
  if (typeof actual !== 'number') throw new Error(`similarity 非 number: ${actual}`);
  if (Math.abs(actual - expected) > 0.00005) {
    throw new Error(`similarity ${actual} 与黄金期望 ${expected} 不符 (4 位小数契约被破坏)`);
  }
}

function makePool(rows) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. F3 相似题管线
// ─────────────────────────────────────────────────────────────────────────────
describe('G2 golden: F3 相似题管线', () => {
  const golden = loadGolden('f3-similar-questions.golden.json');

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
  });

  afterEach(() => {
    delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
  });

  for (const c of golden.cases) {
    it(`${c.id} ${c.name}`, async () => {
      const input = c.input;

      // env 覆盖
      if (input.env) Object.assign(process.env, input.env);

      // embedding
      if (input.embedding === 'fail') {
        getEmbedding.mockRejectedValue(new Error('Embedding API 请求失败 [NETWORK]'));
      } else {
        getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
      }

      const pool = makePool(input.rows || []);

      const r = await VisionSearchService.findSimilarQuestions(Promise.resolve(pool), input.queryText, {
        subjectCode: input.subjectCode,
        limit: input.limit ?? 5,
      });

      const exp = c.expected;

      if (exp.questionsLength !== undefined) {
        expect(r.questions).toHaveLength(exp.questionsLength);
      }

      if (exp.notice !== undefined) {
        expect(r.notice).toBe(exp.notice);
      }
      if (exp.noticeContains) {
        expect(r.notice).toBeTruthy();
        expect(r.notice).toContain(exp.noticeContains);
      }

      if (exp.question0) {
        const q0 = r.questions[0];
        if (exp.question0.similarity !== undefined) {
          assertSimilarityRounded(q0.similarity, exp.question0.similarity);
        }
        for (const f of exp.question0.fields || []) {
          expect(q0, `question[0] 缺字段 ${f}`).toHaveProperty(f);
        }
      }

      if (exp.embeddingNotCalled) {
        expect(getEmbedding).not.toHaveBeenCalled();
      }
      if (exp.dbNotCalled) {
        expect(pool.query).not.toHaveBeenCalled();
      }

      if (exp.thresholdParam !== undefined) {
        const [, params] = pool.query.mock.calls[0];
        expect(params[2]).toBeCloseTo(exp.thresholdParam, 5);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. tutor /ask 响应 schema
// ─────────────────────────────────────────────────────────────────────────────
describe('G2 golden: tutor /ask 响应 schema', () => {
  const golden = loadGolden('tutor-ask.golden.json');
  const originalSecret = process.env.JWT_SECRET;
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    app = express();
    app.use(express.json());
    app.use('/api/tutor', tutorAgentRouter);
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  for (const c of golden.cases) {
    it(`${c.id} ${c.name}`, async () => {
      const input = c.input;
      searchSimilarQuestions.mockResolvedValue(input.similarQuestions || []);
      chatCompletion.mockResolvedValue({ content: input.llm.content, usage: input.llm.usage });

      const res = await request(app)
        .post('/api/tutor/ask')
        .set('Authorization', `Bearer ${studentToken()}`)
        .send({ question: input.question, knowledge_point_id: input.knowledge_point_id, subject: input.subject });

      const exp = c.expected;
      expect(res.status).toBe(exp.status);

      const body = res.body;
      expect(body.success).toBe(exp.body.success);
      expect(body.message).toBe(exp.body.message);

      for (const k of exp.body.dataKeys) {
        expect(body.data, `data 缺字段 ${k}`).toHaveProperty(k);
      }
      expect(body.data.response).toBe(exp.body.response);
      expect(body.data.context).toMatchObject(exp.body.context);
      expect(body.data.usage).toMatchObject(exp.body.usage);
      expect(typeof body.data.duration_ms).toBe('number');
    });
  }

  // F1 未实施: grounded / citations 契约断言留待波次 2.
  test.todo('F1 落地后启用: 断言 /api/tutor/ask 响应含 grounded 与 citations 契约字段');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 安全契约抽检
// ─────────────────────────────────────────────────────────────────────────────
describe('G2 golden: 安全契约抽检', () => {
  const golden = loadGolden('security-contract.golden.json');
  const originalSecret = process.env.JWT_SECRET;
  const originalBypass = process.env.DEV_AUTH_BYPASS;
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.DEV_AUTH_BYPASS;
    app = express();
    app.use(express.json());
    // 镜像 server.js:513 — authMiddleware 全局挂在 /api 前缀下,
    // 使无 token 请求在进入 router 的 requireAdmin 前即被 401 拦截.
    app.use('/api', authMiddleware);
    app.use('/api/tutor', tutorAgentRouter);
    app.use('/api/exam', examRouter);
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalBypass === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = originalBypass;
  });

  for (const c of golden.cases) {
    it(`${c.id} ${c.name}`, async () => {
      const input = c.input;
      let req = request(app)[input.method](input.path);
      if (input.token) req = req.set('Authorization', `Bearer ${studentToken()}`);
      req = req.send(input.body);
      const res = await req;

      expect(res.status).toBe(c.expected.status);
      expect(res.body.success).toBe(c.expected.success);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// harness 自检 (meta): 证明断言逻辑非空转 — 改坏契约会红
// ─────────────────────────────────────────────────────────────────────────────
describe('G2 golden: harness 自检 (改坏契约会红)', () => {
  it('similarity 4 位小数断言: 正确值通过, 破坏值抛错', () => {
    expect(() => assertSimilarityRounded(0.8235, 0.8235)).not.toThrow();
    // 人为把黄金期望改成错误值 → 同一 helper 必须抛错 (等价于改坏契约 → 红)
    expect(() => assertSimilarityRounded(0.8235, 0.9999)).toThrow();
  });

  it('黄金数据文件可加载且每条含必要元信息', () => {
    const files = [
      'f3-similar-questions.golden.json',
      'tutor-ask.golden.json',
      'security-contract.golden.json',
    ];
    for (const f of files) {
      const g = loadGolden(f);
      expect(g.suite, f).toBeTruthy();
      expect(g.basis, f).toBeTruthy();
      expect(g.registered, f).toBeTruthy();
      expect(Array.isArray(g.cases), f).toBe(true);
      for (const c of g.cases) {
        expect(c.id, `${f}/${c.id}`).toBeTruthy();
        expect(c.basis, `${f}/${c.id}`).toBeTruthy();
        expect(c.input, `${f}/${c.id}`).toBeTruthy();
        expect(c.expected, `${f}/${c.id}`).toBeTruthy();
      }
    }
  });
});
