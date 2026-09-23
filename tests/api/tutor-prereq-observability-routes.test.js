/**
 * tests/api/tutor-prereq-observability-routes.test.js — 防跳跃观测「真的接到两条入口上」
 *
 * 为什么还需要这一层（与 tests/tutor-prereq-observability.test.js 分工）：
 *   那份测的是探针/指纹/命中场景本身；这份测的是 **接线** —— 前端 payload 只有
 *   {question, subject}，两条入口（POST /api/tutor/ask 与 SSE /api/tutor/ask/stream）
 *   进到 Step 2 时必须各自打出一行带 route= 的跳过 warn。
 *   尤其 SSE：新树前端 askTutorStream 优先、'/ask' 只作降级，漏埋 SSE 等于
 *   大部分真实流量照样静默。
 *
 * 全程 mock embedding / LLM / DB / RAG，不触真实服务与外网（范式同 tutor-grounding.test.js）。
 *
 * 跑: npx vitest run tests/api/tutor-prereq-observability-routes.test.js
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// 全局 mock：禁触真实 embedding / LLM / DB / RAG
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../services/embedding.js', () => ({
  getEmbedding: vi.fn(),
  getBatchEmbeddings: vi.fn(async () => []),
  getEmbeddingProvenance: vi.fn(() => ({ provider: 'remote', model: 'text-embedding-v3', dim: 1024 })),
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
    QWEN_PLUS: 'qwen-plus',
    QWEN_MAX: 'qwen-max',
    QWEN_TURBO: 'qwen-turbo',
    QWEN_VL_MAX: 'qwen-vl-max',
    QWEN_VL_PLUS: 'qwen-vl-plus',
    DEEPSEEK_CHAT: 'deepseek-chat',
  },
  default: {},
}));

// 假 pool：探针（probeKpInference）走这里，返回空 → inferred=false，不碰真库
const fakePool = { query: vi.fn(async () => ({ rows: [] })) };

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => fakePool),
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

import { chatCompletion, streamChatCompletion } from '../../services/llm.js';
import { searchSimilarQuestions } from '../../api/routes/rag-search.js';
import tutorAgentRouter from '../../api/routes/tutor-agent.js';
import { logger } from '../../api/core/logger.js';
import { questionFingerprint } from '../../api/routes/tutor-agent.js';

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
const studentToken = () => jwt.sign({ id: 2, userId: 2, role: 'student', email: 'student@example.com' }, TEST_SECRET);

const VALID_LLM_JSON = JSON.stringify({
  response: '先复习前置再作答。',
  diagnosis: { summary: '学情正常', weak_points: [], strong_points: [], skip_allowed: true },
  learning_path: [{ step: 1, action: '解答', target: '函数极值', reason: '无薄弱前置' }],
  metadata: { teaching_depth: 'full_solution', weak_kp_ids: [], prerequisites_covered: [] },
});

const OBS_SKIP = '[TutorAgent][防跳跃] Step2 跳过';
/** 前端真实 payload：只有 question / subject，没有 knowledge_point_id */
const FRONTEND_PAYLOAD = { question: '如何求函数的极值？', subject: 'math' };

let app;
let warnSpy;
let infoSpy;
const originalSecret = process.env.JWT_SECRET;

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

beforeEach(() => {
  vi.restoreAllMocks();
  // 观测日志：不许落盘也不许刷屏，靠 spy 断言
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {}); // 正常路径 mock 池缺 connect 会进 error 兜底
  chatCompletion.mockResolvedValue({ content: VALID_LLM_JSON, usage: { total_tokens: 42 } });
  streamChatCompletion.mockImplementation(async function* () {
    yield '先复习前置';
    yield '再作答';
  });
  searchSimilarQuestions.mockResolvedValue([]);
  fakePool.query.mockClear();
  fakePool.query.mockResolvedValue({ rows: [] });
});

/** 等探针那次 fire-and-forget 查询落地 */
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

function skipLines(spy) {
  return spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith(OBS_SKIP));
}

describe('防跳跃观测接线 — 两条入口都不许静默', () => {
  it('POST /api/tutor/ask 不传 knowledge_point_id → 打 route=ask 的跳过 warn', async () => {
    const res = await request(app)
      .post('/api/tutor/ask')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(FRONTEND_PAYLOAD);

    expect(res.status).toBe(200);
    // 行为不变：缺 kp 时仍是空前置，且不影响既有响应字段
    expect(res.body.data.context.prerequisites_count).toBe(0);

    const lines = skipLines(warnSpy);
    expect(lines, `应打出一行「${OBS_SKIP}」，实际 warn: ${JSON.stringify(warnSpy.mock.calls)}`).toHaveLength(1);
    expect(lines[0]).toContain('route=ask');
    expect(lines[0]).toContain(`q_sha256_12=${questionFingerprint(FRONTEND_PAYLOAD.question).q_sha256_12}`);
    expect(lines[0]).toContain('subject=math');
    expect(lines[0]).not.toContain(FRONTEND_PAYLOAD.question); // 题面原文不上日志

    await flushMicrotasks();
    const probeLines = infoSpy.mock.calls.map((c) => String(c[0]));
    expect(probeLines.some((l) => l.includes('kp推断探针') && l.includes('route=ask'))).toBe(true);
    // 探针确实走了一次只读查询
    expect(fakePool.query).toHaveBeenCalledTimes(1);
    expect(fakePool.query.mock.calls[0][1]).toEqual([FRONTEND_PAYLOAD.question]);
  });

  it('POST /api/tutor/ask/stream（SSE）不传 knowledge_point_id → 打 route=ask_stream 的跳过 warn', async () => {
    const res = await request(app)
      .post('/api/tutor/ask/stream')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(FRONTEND_PAYLOAD);

    // SSE 本身不受埋点影响：正常返回 done 事件
    expect(res.status).toBe(200);
    expect(res.text).toContain('event: done');

    const lines = skipLines(warnSpy);
    expect(lines, 'SSE 入口也必须打跳过 warn（前端默认走这条）').toHaveLength(1);
    expect(lines[0]).toContain('route=ask_stream');
    expect(lines[0]).toContain(`q_sha256_12=${questionFingerprint(FRONTEND_PAYLOAD.question).q_sha256_12}`);

    await flushMicrotasks();
    expect(fakePool.query).toHaveBeenCalledTimes(1);
  });

  it('传了 knowledge_point_id 就不许再打跳过 warn（正常路径不被埋点污染）', async () => {
    const res = await request(app)
      .post('/api/tutor/ask')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ ...FRONTEND_PAYLOAD, knowledge_point_id: 'MATH-B1-001' });

    expect(res.status).toBe(200);
    expect(skipLines(warnSpy)).toHaveLength(0);
    await flushMicrotasks();
    // 探针也不该跑
    expect(fakePool.query).not.toHaveBeenCalled();
  });
});
