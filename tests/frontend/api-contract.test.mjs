// ============================================================================
// api.js 契约回归闸门（G-API —— api.js 解锁的前置）
//
// ⚠️ 此后任何 api.js 改动都必须先过这个契约测试：
//     node tests/frontend/api-contract.test.mjs   （或 npm run test:frontend）
//     URL 路径 / HTTP method / header（含 Bearer 取 token 的方式）/ payload 形状
//     任一漂移 → 本测试必须变红。
//
// 实现方式：jsdom 内联加载 api.js（IIFE 挂 global.AIAPI），mock fetch 捕获
// (url, init)，对 AIAPI 的每个公开方法做数据驱动断言；另含「漂移自检」meta
// 用例，验证错误预期确实会被 harness 抓住（否则本闸门形同虚设）。
// ============================================================================
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body><script>${apiJs}</script></body></html>`,
  { runScripts: 'dangerously', url: 'https://x.dev/' }
);
const { window } = dom;
const AIAPI = window.AIAPI;

// ── mock fetch：捕获调用，返回成功 envelope ────────────────────────────────
let lastCall = null;
window.fetch = (url, init) => {
  lastCall = { url, init };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: { ok: true } }) });
};

async function capture(fn) {
  lastCall = null;
  await fn();
  if (!lastCall) throw new Error('fetch 未被调用');
  const { url, init } = lastCall;
  return {
    url,
    method: init.method,
    headers: init.headers,
    credentials: init.credentials,
    body: init.body === undefined ? undefined : JSON.parse(init.body),
    signal: init.signal,
  };
}

const results = [];
const check = (name, got, want) => results.push({ ok: isDeepStrictEqual(got, want), name, got, want });
const T = 'contract-test-token';

// ── 漂移自检（meta）：错误预期必须被 harness 抓住 ──────────────────────────
{
  const assertEq = (name, got, want) => {
    if (!isDeepStrictEqual(got, want)) {
      throw new Error(`${name}: 实际=${JSON.stringify(got)} 期望=${JSON.stringify(want)}`);
    }
  };
  window.localStorage.setItem('authToken', T);
  let driftCaught = false;
  try {
    const cd = await capture(() => AIAPI.batchParse([{ data: 'x' }], {}));
    assertEq('漂移探针 method（故意错）', cd.method, 'GET'); // 真实是 POST
  } catch {
    driftCaught = true;
  }
  check('漂移自检：错误 method 会被抓住', driftCaught, true);
}

// ── 数据驱动：每个公开 fetch 方法的契约 ───────────────────────────────────
window.localStorage.setItem('authToken', T);

const cases = [
  { name: 'batchParse', fn: () => AIAPI.batchParse([{ data: 'abc' }], { default_subject: 'math' }),
    method: 'POST', url: '/api/vision/batch-parse',
    body: { images: [{ data: 'abc' }], user_hint: { default_subject: 'math' }, options: { concurrency: 3 } } },

  { name: 'similarByText', fn: () => AIAPI.similarByText('已知函数 f(x)=x^2，求 f(2) 的值', { subject: 'math', limit: 5 }),
    method: 'POST', url: '/api/vision/similar-by-text',
    body: { text: '已知函数 f(x)=x^2，求 f(2) 的值', subject: 'math', limit: 5 } },

  { name: 'similarByText(仅文本)', fn: () => AIAPI.similarByText('已知二次函数求最值'),
    method: 'POST', url: '/api/vision/similar-by-text', body: { text: '已知二次函数求最值' } },

  { name: 'addWrongQuestion', fn: () => AIAPI.addWrongQuestion({ content: '1+1', subject_code: 'math' }),
    method: 'POST', url: '/api/user/wrong-questions', body: { content: '1+1', subject_code: 'math' } },

  { name: 'login', fn: () => AIAPI.login('a@b.c', 'secret'),
    method: 'POST', url: '/api/auth/login', body: { email: 'a@b.c', password: 'secret' } },

  { name: 'register', fn: () => AIAPI.register({ email: 'a@b.c', password: 'secret' }),
    method: 'POST', url: '/api/auth/register', body: { email: 'a@b.c', password: 'secret' } },

  { name: 'guestLogin', fn: () => AIAPI.guestLogin(), method: 'POST', url: '/api/auth/guest-login', body: {} },

  { name: 'me', fn: () => AIAPI.me(), method: 'GET', url: '/api/auth/me' },

  { name: 'logout', fn: () => AIAPI.logout(), method: 'POST', url: '/api/auth/logout', body: {} },

  { name: 'srsQueue(limit)', fn: () => AIAPI.srsQueue(10), method: 'GET', url: '/api/srs/engine/queue?limit=10' },

  { name: 'srsReview', fn: () => AIAPI.srsReview({ wrong_id: 1, quality: 4 }),
    method: 'POST', url: '/api/srs/engine/review', body: { wrong_id: 1, quality: 4 } },

  { name: 'srsStats', fn: () => AIAPI.srsStats(), method: 'GET', url: '/api/srs/engine/stats' },

  { name: 'learningPath(subject)', fn: () => AIAPI.learningPath('math'), method: 'GET', url: '/api/learning-path/current?subject=math' },

  { name: 'uploadImage', fn: () => AIAPI.uploadImage('data:image/png;base64,xx', 'essay'),
    method: 'POST', url: '/api/upload/image', body: { image: 'data:image/png;base64,xx', purpose: 'essay' } },

  { name: 'gradeEssay', fn: () => AIAPI.gradeEssay({ images: ['https://x.dev/a.jpg'] }),
    method: 'POST', url: '/api/essay/grade', body: { images: ['https://x.dev/a.jpg'] } },

  { name: 'listEssays(limit)', fn: () => AIAPI.listEssays(5), method: 'GET', url: '/api/essay?limit=5' },

  { name: 'getEssay(id)', fn: () => AIAPI.getEssay('abc'), method: 'GET', url: '/api/essay/abc' },

  { name: 'startPractice', fn: () => AIAPI.startPractice({ subject: 'math', question_count: 20 }),
    method: 'POST', url: '/api/exam/session/start', body: { subject: 'math', question_count: 20 } },

  { name: 'submitPractice', fn: () => AIAPI.submitPractice({ sessionId: 's1', answers: [] }),
    method: 'POST', url: '/api/exam/session/submit', body: { sessionId: 's1', answers: [] } },

  { name: 'practiceHistory', fn: () => AIAPI.practiceHistory({ page: 2 }),
    method: 'GET', url: '/api/exam/session/history?page=2' },

  { name: 'userDashboard', fn: () => AIAPI.userDashboard(), method: 'GET', url: '/api/user/dashboard' },

  { name: 'todayTasks', fn: () => AIAPI.todayTasks(), method: 'GET', url: '/api/user/today' },

  { name: 'checkinStatus', fn: () => AIAPI.checkinStatus(), method: 'GET', url: '/api/gamification/checkin/status' },

  { name: 'knowledgeMastery(subject)', fn: () => AIAPI.knowledgeMastery('physics'), method: 'GET', url: '/api/knowledge/mastery?subject=physics' },

  { name: 'getWrongQuestions', fn: () => AIAPI.getWrongQuestions({ page: 1, page_size: 10 }),
    method: 'GET', url: '/api/user/wrong-questions?page=1&page_size=10' },

  { name: 'getWrongQuestionStats', fn: () => AIAPI.getWrongQuestionStats(), method: 'GET', url: '/api/user/wrong-questions/stats' },

  { name: 'updateWrongQuestion', fn: () => AIAPI.updateWrongQuestion(7, { reviewed: 1 }),
    method: 'PUT', url: '/api/user/wrong-questions/7', body: { reviewed: 1 } },

  { name: 'deleteWrongQuestion', fn: () => AIAPI.deleteWrongQuestion(7), method: 'DELETE', url: '/api/user/wrong-questions/7' },
];

for (const tc of cases) {
  const c = await capture(tc.fn);
  check(`${tc.name} URL`, c.url, tc.url);
  check(`${tc.name} method`, c.method, tc.method);
  check(`${tc.name} Authorization`, c.headers.Authorization, 'Bearer ' + T);
  check(`${tc.name} Content-Type`, c.headers['Content-Type'], 'application/json');
  check(`${tc.name} credentials`, c.credentials, 'same-origin');
  check(`${tc.name} payload`, c.body, tc.body === undefined ? undefined : tc.body);
}

// ── 无 token 时：不附加 Authorization 头（Bearer 取 token 的方式） ─────────
window.localStorage.removeItem('authToken');
{
  const c = await capture(() => AIAPI.me());
  check('无 token 不附 Authorization', c.headers.Authorization, undefined);
  check('无 token 仍带 Content-Type', c.headers['Content-Type'], 'application/json');
}

// ── signal 透传 ────────────────────────────────────────────────────────────
{
  const sig = { marker: true };
  const c = await capture(() => AIAPI.batchParse([{ data: 'x' }], {}, sig));
  check('batchParse signal 透传', c.signal, sig);

  const c2 = await capture(() => AIAPI.similarByText('题干文本至少十个字', { subject: 'math' }, sig));
  check('similarByText signal 透传', c2.signal, sig);
}

// ── 非 fetch 公开方法：token 真相源 / session 落盘 / 错误分类 ──────────────
window.localStorage.setItem('authToken', 'abc-token');
check('getToken 读 authToken 键', AIAPI.getToken(), 'abc-token');

AIAPI.saveSession({ token: 'tok', user: { email: 'a@b.c' } });
check('saveSession 写 token', window.localStorage.getItem('authToken'), 'tok');
check('saveSession 写 user', JSON.parse(window.localStorage.getItem('user')).email, 'a@b.c');

AIAPI.clearSession();
check('clearSession 清 token', window.localStorage.getItem('authToken'), null);
check('clearSession 清 user', window.localStorage.getItem('user'), null);

{
  const httpErr = AIAPI.ApiError('msg', { status: 404 });
  check('ApiError http kind', httpErr.kind, 'http');
  check('ApiError status', httpErr.status, 404);
  const netErr = AIAPI.ApiError('net', { kind: 'network' });
  check('ApiError network kind', netErr.kind, 'network');
  check('ApiError name', netErr.name, 'ApiError');
}

check('request 为公开方法', typeof AIAPI.request, 'function');

// ── 汇总 ───────────────────────────────────────────────────────────────────
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
