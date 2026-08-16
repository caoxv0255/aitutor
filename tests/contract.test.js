// tests/contract.test.js — 7 services × 37 端点 contract test
// 验证 services 函数签名 + mock 数据 schema 符合预期.
// 跑: node tests/contract.test.js

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOCK_DIR = resolve(__dirname, '../ai-tutor-frontend/assets/js/api/mock');

// Node 22 fetch 不支持 file://, monkey patch fetch 走 fs.readFileSync
globalThis.fetch = async (url) => {
  const u = new URL(url);
  const fname = u.pathname.split('/').pop();
  try {
    const data = readFileSync(resolve(MOCK_DIR, fname), 'utf8');
    return { ok: true, status: 200, text: async () => data, json: async () => JSON.parse(data) };
  } catch (e) {
    return { ok: false, status: 404, text: async () => '', json: async () => { throw e; } };
  }
};

// 必须先设 LS + URL, 否则 shouldUseMock() 返回 USE_MOCK 常量 (默认 false).
global.localStorage = {
  _data: { 'aitutor.useMock': 'true' },
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};
global.window = { location: { search: '?mock=true' } };
// client.js getApiBase() 在模块加载时读 document.querySelector('meta[name="api-base"]')
globalThis.document = { querySelector: () => null };

const services = await import('../ai-tutor-frontend/assets/js/api/services/index.js');
const { auth, user, exam, rag, knowledge, review, vision } = services;

// ===== helpers =====
let pass = 0, fail = 0;
const TEST = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name}\n      ${e.message}`);
    fail++;
  }
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ===== auth (4) =====
console.log('auth (4):');
await TEST('auth.login', async () => {
  const r = await auth.login({ phone: '13800138000', password: 'p' });
  assert(isObject(r), 'r 必须是 object');
});
await TEST('auth.register', async () => {
  const r = await auth.register({ phone: '13800138000', password: 'p' });
  assert(isObject(r), 'r 必须是 object');
});
await TEST('auth.guestLogin', async () => {
  const r = await auth.guestLogin();
  assert(isObject(r), 'r 必须是 object');
  // mock auth_guest.json data 是 null (演示场景: guest 登录后需设 token)
  assert('data' in r || 'token' in r, 'guest 必须有 data 或 token 字段');
});
await TEST('auth.getCurrentUser', async () => {
  const r = await auth.getCurrentUser();
  assert(isObject(r), 'r 必须是 object');
});

// ===== user (6) =====
console.log('user (6):');
await TEST('user.getDashboard', async () => {
  const r = await user.getDashboard();
  assert(r.data?.stats?.questions_solved !== undefined, '必须有 stats');
});
await TEST('user.getProfile', async () => {
  const r = await user.getProfile();
  assert(isObject(r), 'r 必须是 object');
});
await TEST('user.getProvinces', async () => {
  const r = await user.getProvinces();
  assert(Array.isArray(r.data), 'provinces 必须直接是 data 数组');
});
await TEST('user.getUserProvince', async () => {
  const r = await user.getUserProvince();
  assert(isObject(r), 'r 必须是 object');
});
await TEST('user.setUserProvince', async () => {
  const r = await user.setUserProvince({ province: '北京' });
  assert(isObject(r), 'r 必须是 object');
});
await TEST('user.getUserSubjects', async () => {
  const r = await user.getUserSubjects();
  assert(Array.isArray(r.data), 'subjects 必须直接是 data 数组');
});

// ===== exam (6) =====
console.log('exam (6):');
await TEST('exam.getQuestions', async () => {
  const r = await exam.getQuestions({ subject: 'math', year: 2024 });
  assert(Array.isArray(r.data), 'questions 必须直接是 data 数组');
});
await TEST('exam.getQuestion', async () => {
  const r = await exam.getQuestion(1);
  assert(r.data?.id, '必须有 id');
});
await TEST('exam.startSession', async () => {
  const r = await exam.startSession({ subject: 'math', mode: 'exam' });
  assert(r.data?.session_id, '必须有 session_id');
});
await TEST('exam.submitSession', async () => {
  const r = await exam.submitSession({ sessionId: 's1', answers: [] });
  assert(r.data?.score !== undefined, '必须有 score');
});
await TEST('exam.getExamPdf', async () => {
  const r = await exam.getExamPdf(1);
  assert(isObject(r), 'r 必须是 object');
});
await TEST('exam.getPapers', async () => {
  const r = await exam.getPapers({ subject: 'math' });
  assert(Array.isArray(r.data), 'papers 必须直接是 data 数组');
});

// ===== rag (7) =====
console.log('rag (7):');
await TEST('rag.search', async () => {
  const r = await rag.search({ query: '导数定义' });
  assert(Array.isArray(r.data), 'results 必须直接是 data 数组');
});
await TEST('rag.multiSearch', async () => {
  const r = await rag.multiSearch({ query: '导数', sources: ['exam', 'review'] });
  assert(isObject(r), 'r 必须是 object');
});
await TEST('rag.similarQuestions', async () => {
  const r = await rag.similarQuestions({ question_id: 1 });
  assert(Array.isArray(r.data), 'questions 必须直接是 data 数组');
});
await TEST('rag.explain', async () => {
  const r = await rag.explain({ question_id: 1 });
  assert(r.data?.explanation, '必须有 explanation');
});
await TEST('rag.ask', async () => {
  const r = await rag.ask({ question: '怎么求极值?' });
  assert(r.data?.answer, '必须有 answer');
});
await TEST('rag.ingestQuestion', async () => {
  const r = await rag.ingestQuestion({ question: '求极限', subject: 'math' });
  assert(isObject(r), 'r 必须是 object');
});
await TEST('rag.getStats', async () => {
  const r = await rag.getStats();
  assert(isObject(r), 'r 必须是 object');
});

// ===== knowledge (6) =====
console.log('knowledge (6):');
await TEST('knowledge.getMastery', async () => {
  const r = await knowledge.getMastery();
  assert(isObject(r), 'r 必须是 object');
});
await TEST('knowledge.getKpDetail', async () => {
  const r = await knowledge.getKpDetail({ kp_id: 'kp_1' });
  assert(r.data?.id, '必须有 id');
});
await TEST('knowledge.getKnowledgeMap', async () => {
  const r = await knowledge.getKnowledgeMap({ subject: 'math' });
  assert(r.data?.nodes && r.data?.edges, '必须有 nodes + edges');
});
await TEST('knowledge.getKnowledgePoints', async () => {
  const r = await knowledge.getKnowledgePoints({ subject: 'math' });
  assert(Array.isArray(r.data), 'points 必须直接是 data 数组');
});
await TEST('knowledge.getSuggestions', async () => {
  const r = await knowledge.getSuggestions();
  assert(Array.isArray(r.data), 'suggestions 必须直接是 data 数组');
});
await TEST('knowledge.getProfile', async () => {
  const r = await knowledge.getProfile();
  assert(isObject(r), 'r 必须是 object');
});

// ===== review (5) =====
console.log('review (5):');
await TEST('review.getReports', async () => {
  const r = await review.getReports();
  assert(Array.isArray(r.data), 'reports 必须直接是 data 数组');
});
await TEST('review.getReport', async () => {
  const r = await review.getReport(1);
  assert(isObject(r), 'r 必须是 object');
});
await TEST('review.getSessionHistory', async () => {
  const r = await review.getSessionHistory();
  assert(Array.isArray(r.data), 'sessions 必须直接是 data 数组');
});
await TEST('review.getWeakPoints', async () => {
  const r = await review.getWeakPoints();
  assert(Array.isArray(r.data), 'weak_points 必须直接是 data 数组');
});
await TEST('review.getTrendSummary', async () => {
  const r = await review.getTrendSummary();
  assert(isObject(r), 'r 必须是 object');
});

// ===== vision (2) =====
console.log('vision (2):');
await TEST('vision.parse', async () => {
  const r = await vision.parse({ image: 'data:image/jpeg;base64,xxx' });
  assert(r.data?.parse?.raw_text, '必须有 data.parse.raw_text');
  assert(r.data?.parse?.subject_code, '必须有 parse.subject_code');
  assert(r.data?.ingest, '必须有 data.ingest (拍照即入库)');
});
await TEST('vision.getKnowledgePoints', async () => {
  const r = await vision.getKnowledgePoints({ subject: 'math' });
  assert(Array.isArray(r.data?.items), '必须有 data.items 数组');
});

// ===== 错误处理 (2) =====
console.log('error (2):');
await TEST('silent opt 不抛 toast 抛 ApiError', async () => {
  // mock fetch 返回 500
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 500,
    text: async () => JSON.stringify({ message: 'server error' }),
    json: async () => ({ message: 'server error' }),
  });
  // 强制不走 mock
  const oldLS = { ...global.localStorage._data };
  global.localStorage._data = {};
  global.window = { location: { search: '' } };
  try {
    const { request } = await import('../ai-tutor-frontend/assets/js/api/client.js?v=' + Date.now());
    await request('GET', '/api/test', null, { silent: true, retry: 0 });
    throw new Error('应该抛错');
  } catch (e) {
    assert(e.name === 'ApiError', '必须抛 ApiError, 实际: ' + e.name);
    assert(e.status === 500, 'status 必须 500, 实际: ' + e.status);
  } finally {
    globalThis.fetch = origFetch;
    global.localStorage._data = oldLS;
    global.window = { location: { search: '?mock=true' } };
  }
});
await TEST('timeout 默认 30s', async () => {
  const { DEFAULT_TIMEOUT_MS } = await import('../ai-tutor-frontend/assets/js/api/client.js?v=' + Date.now());
  assert(DEFAULT_TIMEOUT_MS === 30000, '默认 timeout 必须 30s (bge 1024 慢), 实际: ' + DEFAULT_TIMEOUT_MS);
});

// ===== 总结 =====
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);