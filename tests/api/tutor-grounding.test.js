// tests/api/tutor-grounding.test.js — F1 接地禁答(说明态 P1=B) + G4 引用强制 (2026-09-23)
//
// 覆盖契约 (/api/tutor/ask 与 /api/tutor/ask/stream 增量三字段):
//   grounded        : boolean  — 检索为空/未达阈值 → false
//   citations       : array    — 命中题号列表 [{question_id, similarity}]; 无命中 → []
//   groundingNotice : string|null — 未接地时给前端的原文说明; 已接地 → null
//
// 关键系统性行为 (P1=B vs P1=A): 检索为空时【仍然调用 LLM 作答】, 只是注入
//   "不得编造、须说明信息不足" 的强制约束。本套用 chatCompletion / streamChatCompletion
//   的【调用次数】证明这是说明态, 不是拒答。
//
// 全程 mock 检索与 LLM, 不触真实服务/外网/DB。
// 参考范式: api/handlers/essay/transcribeService.js:37-49 (Zod + 结构校验不跳过)。

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// 全局 mock: 禁触真实 embedding / LLM / DB / RAG
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

import { chatCompletion, streamChatCompletion } from '../../services/llm.js';
import { searchSimilarQuestions } from '../../api/routes/rag-search.js';
import tutorAgentRouter from '../../api/routes/tutor-agent.js';

const TEST_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
const studentToken = () => jwt.sign({ id: 2, userId: 2, role: 'student', email: 's@t.com' }, TEST_SECRET);

/** 合法 LLM 结构化输出 (供 safeParseLLMJson 解析, 证明结构校验未跳过) */
const VALID_LLM_JSON = JSON.stringify({
  response: '先求导，令导数为零，再判断极值点。',
  diagnosis: { summary: '学情正常', weak_points: [], strong_points: [], skip_allowed: true },
  learning_path: [{ step: 1, action: '解答', target: '函数极值', reason: '无薄弱前置' }],
  metadata: { teaching_depth: 'full_solution', weak_kp_ids: [], prerequisites_covered: [] },
});

const HIT_A = { id: 101, content: '题目A：求函数极值', knowledge_point_id: 'kp1', similarity: 0.82 };
const HIT_B = { id: 102, content: '题目B：导数应用', knowledge_point_id: 'kp1', similarity: 0.7712 };

/** G4: 三字段存在且类型正确 (citations 即使为空也必须存在) */
function expectGroundingShape(obj) {
  expect(obj).toHaveProperty('grounded');
  expect(typeof obj.grounded).toBe('boolean');
  expect(obj).toHaveProperty('citations');
  expect(Array.isArray(obj.citations)).toBe(true);
  expect(obj).toHaveProperty('groundingNotice');
  expect(obj.groundingNotice === null || typeof obj.groundingNotice === 'string').toBe(true);
}

/** 解析 SSE 原始文本 → [{ event, data }] */
function parseSSE(text) {
  return String(text)
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      let event = 'message';
      let data = null;
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = JSON.parse(line.slice(5).trim());
      }
      return { event, data };
    });
}

let app;
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
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. /api/tutor/ask — F1 说明态
// ─────────────────────────────────────────────────────────────────────────────
describe('F1 接地契约 — POST /api/tutor/ask', () => {
  it('检索空 → grounded=false / citations=[] / notice 非空, 且 LLM 确实被调用 (说明态非拒答)', async () => {
    searchSimilarQuestions.mockResolvedValue([]);
    chatCompletion.mockResolvedValue({ content: VALID_LLM_JSON, usage: { total_tokens: 42 } });

    const res = await request(app)
      .post('/api/tutor/ask')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ question: '如何求函数的极值？', knowledge_point_id: null, subject: 'math' });

    expect(res.status).toBe(200);
    const data = res.body.data;

    // G4 契约字段存在
    expectGroundingShape(data);

    // 未接地语义
    expect(data.grounded).toBe(false);
    expect(data.citations).toEqual([]);
    expect(typeof data.groundingNotice).toBe('string');
    expect(data.groundingNotice.length).toBeGreaterThan(0);

    // 系统性行为: 仍然作答 (既有字段照旧)
    expect(data.response).toBe('先求导，令导数为零，再判断极值点。');
    // 证据: LLM 被调用一次 → 说明态, 不是拒答 (P1=A 会 0 次)
    expect(chatCompletion).toHaveBeenCalledTimes(1);

    // 强制约束确已注入系统提示
    const [systemPrompt] = chatCompletion.mock.calls[0];
    expect(systemPrompt).toContain('接地约束');
    expect(systemPrompt).toContain('不得编造');
  });

  it('检索有命中 → grounded=true / citations 与命中一致 / notice=null', async () => {
    searchSimilarQuestions.mockResolvedValue([HIT_A, HIT_B]);
    chatCompletion.mockResolvedValue({ content: VALID_LLM_JSON, usage: { total_tokens: 42 } });

    const res = await request(app)
      .post('/api/tutor/ask')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ question: '如何求函数的极值？', knowledge_point_id: null, subject: 'math' });

    expect(res.status).toBe(200);
    const data = res.body.data;

    expectGroundingShape(data);
    expect(data.grounded).toBe(true);
    expect(data.citations).toEqual([
      { question_id: 101, similarity: 0.82 },
      { question_id: 102, similarity: 0.7712 },
    ]);
    expect(data.groundingNotice).toBeNull();

    // 已接地 → 不应注入"未接地"约束
    const [systemPrompt] = chatCompletion.mock.calls[0];
    expect(systemPrompt).not.toContain('接地约束');
  });

  it('检索空 + LLM 输出非法 JSON → 仍过结构校验(容错), 契约三字段照旧存在', async () => {
    searchSimilarQuestions.mockResolvedValue([]);
    // 非 JSON: safeParseLLMJson 会抛错 → 走 fallback, 证明未跳过结构校验
    chatCompletion.mockResolvedValue({ content: '这不是 JSON，只是一段文字', usage: { total_tokens: 7 } });

    const res = await request(app)
      .post('/api/tutor/ask')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ question: '随便问问', knowledge_point_id: null });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expectGroundingShape(data);
    expect(data.grounded).toBe(false);
    expect(data.response).toBe('这不是 JSON，只是一段文字'); // fallback 保留原文
    expect(data.diagnosis.skip_allowed).toBe(false); // fallback 诊断
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. /api/tutor/ask/stream — 末尾 meta 事件约定
// ─────────────────────────────────────────────────────────────────────────────
describe('F1 接地契约 — POST /api/tutor/ask/stream (末尾 meta 事件)', () => {
  function mockStream(chunks) {
    streamChatCompletion.mockImplementation(async function* () {
      for (const c of chunks) yield c;
    });
  }

  it('检索空 → meta 事件 { grounded:false, citations:[], notice 非空 }, 且流式 LLM 确实被调用', async () => {
    searchSimilarQuestions.mockResolvedValue([]);
    mockStream(['先', '求导。']);

    const res = await request(app)
      .post('/api/tutor/ask/stream')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ question: '如何求函数的极值？', knowledge_point_id: null, subject: 'math' });

    expect(res.status).toBe(200);
    const events = parseSSE(res.text);
    const names = events.map((e) => e.event);

    // 流式仍作答
    expect(names).toContain('content');
    expect(names).toContain('done');
    expect(streamChatCompletion).toHaveBeenCalledTimes(1);

    const meta = events.find((e) => e.event === 'meta');
    expect(meta, '缺少末尾 meta 事件').toBeTruthy();
    expectGroundingShape(meta.data);
    expect(meta.data.grounded).toBe(false);
    expect(meta.data.citations).toEqual([]);
    expect(typeof meta.data.groundingNotice).toBe('string');
    expect(meta.data.groundingNotice.length).toBeGreaterThan(0);

    // meta 必须在 done 之前 (末尾 meta 约定)
    expect(names.indexOf('meta')).toBeLessThan(names.indexOf('done'));
  });

  it('检索有命中 → meta.grounded=true / citations 与命中一致 / notice=null', async () => {
    searchSimilarQuestions.mockResolvedValue([HIT_A, HIT_B]);
    mockStream(['答案见下。']);

    const res = await request(app)
      .post('/api/tutor/ask/stream')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send({ question: '如何求函数的极值？', knowledge_point_id: null, subject: 'math' });

    expect(res.status).toBe(200);
    const events = parseSSE(res.text);
    const meta = events.find((e) => e.event === 'meta');
    expect(meta).toBeTruthy();
    expectGroundingShape(meta.data);
    expect(meta.data.grounded).toBe(true);
    expect(meta.data.citations).toEqual([
      { question_id: 101, similarity: 0.82 },
      { question_id: 102, similarity: 0.7712 },
    ]);
    expect(meta.data.groundingNotice).toBeNull();

    // 已接地 → 流式系统提示不含"未接地"约束
    const [systemPrompt] = streamChatCompletion.mock.calls[0];
    expect(systemPrompt).not.toContain('接地约束');
  });
});
