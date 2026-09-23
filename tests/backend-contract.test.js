// tests/backend-contract.test.js — Backend Contract Test (Contract Test 2.0, P0.7)
//
// 用法: 先起后端 (本地: PORT=3999 node server.js, 或容器: http://localhost:3002)
//   BCT_URL=http://localhost:3999 node tests/backend-contract.test.js
// 或默认 http://localhost:3002
// 注意: 不变量名用 BASE_URL (Vite 内置 env 会覆盖), 用 BCT_URL.
//
// 验证目标 (Phase 4 质量门禁之一):
//   1. envelope 形状: {success: true, data: ...} (client.js P0.7 统一后, mock/real 同构)
//   2. 页面消费约定: review 列表是数组 / wrong-questions 是 {questions,total} / 等
//   3. 公开路由: login/register/guest 不需要 JWT; 受保护端点无 token 必须 401
//
// ── 与 authLimiter 共存 (2026-09-23, 测试侧修复, 不改生产限流语义) ──
// 波次 1 的 authLimiter (20 次/15min/IP) 让 login/register/guest-login 共享一个桶
// (server.js:499-511; 注意 logout 不在其中, 它走 apiLimiter)。BCT 每次运行都会打这些
// 端点, 累计数次 gate (或并发 worker) 即打满 → 429。若不区分, 429 会退化成
// TOKEN=undefined → 后续受保护用例全部 401, 看起来像 19 项契约失败, 实为限流污染。
// 本测试因此:
//   1. guest-login 只调 1 次, token 复用到所有受保护用例 (原为 3 次);
//   2. 支持 TEST_JWT 注入已签发 token —— 此时完全不调 guest-login (CI/临时实例);
//   3. 任何 429 立即以独立信号 RATE_LIMITED 报出, 并立即以专用退出码结束, 不产生级联假红。
//
// 退出码: 0=全绿 | 1=真实契约失败(19 项中有 fail) | 2=取不到/无效 token | 3=RATE_LIMITED
// 单次运行的 auth 端点调用: 普通模式 5 次 (guest-login1/register1/login2/logout1);
//                          TEST_JWT 模式 4 次 (无 guest-login)。
//   (其中真正消耗 authLimiter 桶的: 普通 4 次 / TEST_JWT 3 次 —— logout 走 apiLimiter。)
//
// 输出: PASS/FAIL 逐条 + 汇总, 非零 exit code 表示失败 (CI gate).

const BASE_URL = process.env.BCT_URL || 'http://localhost:3002';
const INJECTED_JWT = process.env.TEST_JWT || '';

// 专用退出码 —— 与「契约失败 1」区分, 供 gate/CI 识别非契约原因。
const EXIT_CONTRACT_FAIL = 1;
const EXIT_NO_TOKEN = 2;
const EXIT_RATE_LIMITED = 3;

// 计入「auth 端点调用」的路径 (仅用于报告口径, 包含 logout 即使它不在 authLimiter 桶内)。
const AUTH_PATHS = new Set([
  '/api/auth/guest-login',
  '/api/auth/guest',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-password',
]);

let pass = 0,
  fail = 0,
  authCalls = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

// 429 = 被限流, 不是契约缺陷。立即中止, 避免退化成后续 401 级联假红。
function abortRateLimited(method, path, h) {
  console.log(`\n  ⛔ RATE_LIMITED: ${method} ${path} → 429`);
  console.log(
    `     X-RateLimit-Limit=${h.limit ?? '?'} X-RateLimit-Remaining=${h.remaining ?? '?'} ` +
      `Retry-After=${h.retryAfter ?? '?'}${h.reset ? ` X-RateLimit-Reset=${h.reset}` : ''}`
  );
  console.log('     这是限流污染, 非契约缺陷 (auth 端点共享桶已耗尽); 继续会产生级联 401 假红, 故中止。');
  console.log('     处置: 用独立临时实例 (BCT_URL 指向自带独立桶的进程) 或稍后重试/注入 TEST_JWT。');
  console.log(`     exit ${EXIT_RATE_LIMITED} (区别于契约失败 ${EXIT_CONTRACT_FAIL})`);
  process.exit(EXIT_RATE_LIMITED);
}

function requireToken(source, token) {
  if (typeof token === 'string' && token.length > 0) return token;
  console.log(`\n  ⛔ 无法获取 token (来源: ${source})。`);
  console.log('     受保护用例没有有效身份, 中止以避免产出 19 项假红。');
  console.log(`     处置: 设置 TEST_JWT=<已签发 token> 后重跑, 或稍后重试。exit ${EXIT_NO_TOKEN}`);
  process.exit(EXIT_NO_TOKEN);
}

async function call(method, path, { token, body } = {}) {
  if (AUTH_PATHS.has(path.split('?')[0])) authCalls++;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  // 任何 429 都立即中止 (不限于 auth 端点): 429 按定义是限流, 不是契约缺陷。
  if (res.status === 429) {
    abortRateLimited(method, path, {
      limit: res.headers.get('x-ratelimit-limit'),
      remaining: res.headers.get('x-ratelimit-remaining'),
      retryAfter: res.headers.get('retry-after'),
      reset: res.headers.get('x-ratelimit-reset'),
    });
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json };
}

const hasData = (j) => j && j.success === true && 'data' in j;

console.log(`\nBackend Contract Test — BASE_URL=${BASE_URL}\n`);

// ── 0. 获取 token (单次) ──
// 优先 TEST_JWT (零 guest-login 消耗); 否则调一次 guest-login 并复用到全部受保护用例。
let TOKEN;
let guestLogin = null;
if (INJECTED_JWT) {
  TOKEN = INJECTED_JWT;
  console.log('token 来源: TEST_JWT 注入 (按设计不调用 guest-login)\n');
  const pre = await call('GET', '/api/auth/me', { token: TOKEN });
  if (!(pre.status === 200 && pre.json && pre.json.data)) {
    console.log(`  ⛔ TEST_JWT 注入的 token 无效 (/api/auth/me → ${pre.status}), 提前退出。`);
    console.log(`     处置: 换一个已签发的合法 token。exit ${EXIT_NO_TOKEN}`);
    process.exit(EXIT_NO_TOKEN);
  }
  console.log('  · preflight: TEST_JWT 有效 (/api/auth/me → 200)\n');
} else {
  guestLogin = await call('POST', '/api/auth/guest-login', { body: {} });
  TOKEN = requireToken('guest-login', guestLogin.json && guestLogin.json.token);
  console.log('token 来源: 单次 guest-login (复用于全部受保护用例)\n');
}
const A = { token: TOKEN };

// ── 1. 公开路由 (无需 JWT) ──
console.log('public routes (4):');
if (guestLogin) {
  ok(
    'guest-login 公开可达',
    guestLogin.status === 200 && guestLogin.json && guestLogin.json.success === true && !!guestLogin.json.token
  );
} else {
  console.log('  ↷ guest-login 公开可达 — SKIP (TEST_JWT 模式: 按设计不调用 guest-login)');
}
{
  const email = `bct_${Date.now()}@example.com`;
  const r = await call('POST', '/api/auth/register', {
    body: { email, password: 'Test123456!', name: 'BCT', grade: '高中' },
  });
  ok(
    'register 公开 + 返回 token',
    (r.status === 200 || r.status === 201) && r.json && r.json.success === true && !!r.json.token,
    JSON.stringify(r.json || {}).slice(0, 120)
  );
  const login = await call('POST', '/api/auth/login', { body: { email, password: 'Test123456!' } });
  ok('login 返回 data.token', login.status === 200 && login.json && !!login.json.data && !!login.json.data.token);
}
{
  const r = await call('POST', '/api/auth/logout', { body: {} });
  ok('logout 公开 200', r.status === 200 && r.json && r.json.success === true);
}

// ── 2. 认证保护 ──
console.log('auth guard (2):');
{
  const r = await call('GET', '/api/review/reports');
  ok('无 token 访问受保护端点 → 401', r.status === 401, `status=${r.status}`);
}
{
  const r = await call('GET', '/api/auth/me', { token: TOKEN });
  ok(
    '/api/auth/me 带 token → 200 + email',
    r.status === 200 && r.json && r.json.data && !!r.json.data.email,
    JSON.stringify(r.json || {}).slice(0, 120)
  );
}

// ── 3. envelope + 页面消费约定 ──
console.log('envelope & page contracts (10):');
{
  const r = await call('GET', '/api/user/dashboard', A);
  const d = r.json && r.json.data;
  ok(
    'user.dashboard → data.user + data.overview',
    hasData(r.json) && d && d.user && d.overview,
    JSON.stringify(r.json || {}).slice(0, 150)
  );
  ok('user.dashboard → overview.study_days 数字', d && typeof d.overview.study_days === 'number');
}
{
  const r = await call('GET', '/api/user/wrong-questions?limit=5', A);
  const d = r.json && r.json.data;
  ok(
    'wrong-questions → data.questions 数组 + data.total',
    hasData(r.json) && d && Array.isArray(d.questions) && typeof d.total === 'number',
    JSON.stringify(r.json || {}).slice(0, 150)
  );
}
{
  const r = await call('GET', '/api/review/reports?page=1&page_size=5', A);
  ok(
    'review.reports → data 是数组 (页面 res.data)',
    hasData(r.json) && Array.isArray(r.json.data),
    JSON.stringify(r.json || {}).slice(0, 150)
  );
}
{
  const r = await call('GET', '/api/review/weak-points', A);
  ok('review.weak-points → data 数组', hasData(r.json) && Array.isArray(r.json.data));
}
{
  const r = await call('GET', '/api/review/session/history?limit=5', A);
  ok('review.session/history → data 数组', hasData(r.json) && Array.isArray(r.json.data));
}
{
  const r = await call('GET', '/api/review/trend-summary?days=30', A);
  const d = r.json && r.json.data;
  ok(
    'review.trend-summary → data 对象 (total_questions/accuracy/trend)',
    hasData(r.json) && d && typeof d.total_questions === 'number' && Array.isArray(d.trend),
    JSON.stringify(r.json || {}).slice(0, 150)
  );
}
{
  const r = await call('GET', '/api/knowledge/mastery', A);
  const d = r.json && r.json.data;
  ok(
    'knowledge.mastery → data.overall + by_topic 数组',
    hasData(r.json) && d && typeof d.overall === 'number' && Array.isArray(d.by_topic),
    JSON.stringify(r.json || {}).slice(0, 150)
  );
}
{
  const r = await call('GET', '/api/knowledge/points', A);
  ok('knowledge.points → data 数组', hasData(r.json) && Array.isArray(r.json.data));
}
{
  const r = await call('GET', '/api/vision/knowledge-points', A);
  const d = r.json && r.json.data;
  ok(
    'vision.knowledge-points → data.items 数组 + total',
    hasData(r.json) && d && Array.isArray(d.items) && typeof d.total === 'number',
    JSON.stringify(r.json || {}).slice(0, 150)
  );
}

// ── 4. 参数校验路径 ──
console.log('validation (3):');
{
  const r = await call('POST', '/api/vision/parse', { ...A, body: {} });
  ok('vision.parse 缺 image → 400', r.status === 400, `status=${r.status}`);
}
{
  const r = await call('POST', '/api/auth/login', { body: { email: 'x', password: 'y' } });
  ok('login 错凭据 → 400/401 且 success=false', r.json && r.json.success === false);
}
{
  const r = await call('POST', '/api/user/wrong-questions', { ...A, body: { question: '' } });
  ok('wrong-questions 缺内容 → 400', r.status === 400, `status=${r.status}`);
}

// 汇总行必须是最后一行 (release-gate.sh 用 `tail -1 | grep -E "0 failed"` 判定)。
console.log(
  `\nauth 端点调用次数: ${authCalls}${INJECTED_JWT ? ' (TEST_JWT 模式: 无 guest-login)' : ' (普通模式)'}`
);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? EXIT_CONTRACT_FAIL : 0);
