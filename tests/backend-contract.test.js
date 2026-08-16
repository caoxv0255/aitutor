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
// 输出: PASS/FAIL 逐条 + 汇总, 非零 exit code 表示失败 (CI gate).

const BASE_URL = process.env.BCT_URL || 'http://localhost:3002';

let pass = 0,
  fail = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
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

// ── 1. 公开路由 (无需 JWT) ──
console.log('public routes (5):');
{
  const r = await call('POST', '/api/auth/guest-login', { body: {} });
  ok('guest-login 公开可达', r.status === 200 && r.json && r.json.success === true && !!r.json.token);
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
  const g = await call('POST', '/api/auth/guest-login', { body: {} });
  const token = g.json.token;
  const r = await call('GET', '/api/auth/me', { token });
  ok(
    '/api/auth/me 带 token → 200 + email',
    r.status === 200 && r.json && r.json.data && !!r.json.data.email,
    JSON.stringify(r.json || {}).slice(0, 120)
  );
}

// ── 3. envelope + 页面消费约定 ──
console.log('envelope & page contracts (9):');
const g2 = await call('POST', '/api/auth/guest-login', { body: {} });
const TOKEN = g2.json.token;
const A = { token: TOKEN };

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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
