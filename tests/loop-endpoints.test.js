// tests/loop-endpoints.test.js — Round 8 后端真实接入契约测试
//
// 验证: Loop Hub 聚合端点 + D082 today lifecycle 端点的契约
// 运行: node tests/loop-endpoints.test.js
//
// 注: 这是 contract test (不需要 server 启动), 验证:
//   1. 端点 URL 正确
//   2. 响应 envelope (D062) 字段完整
//   3. 关键字段类型正确

import { strict as assert } from 'node:assert';

const BASE = process.env.BASE_URL || 'http://localhost:3002';

let token = null;
const tests = [];
let passed = 0, failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  // 1. 健康检查
  test('GET /api/health returns success', async () => {
    const r = await fetch(`${BASE}/api/health`);
    const j = await r.json();
    assert.equal(j.success, true);
    assert.equal(j.data.dbReady, true);
  });

  // 2. 注册/登录
  test('Auth: register or login', async () => {
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'contract_test@aitutor.cn', password: 'Test1234', grade: '高三' })
    });
    let j = await reg.json();
    if (!j.success && j.message?.includes('已注册')) {
      const login = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'contract_test@aitutor.cn', password: 'Test1234' })
      });
      j = await login.json();
    }
    // D062 envelope: token 在 data.token 或根 token
    const t = j.data?.token || j.token;
    assert.ok(t, 'token should exist in data.token or root');
    token = t;
  });

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 3. Loop Hub 端点
  test('GET /api/loop/summary returns expected shape', async () => {
    const r = await fetch(`${BASE}/api/loop/summary`, { headers: authHeaders });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.ok(j.data, 'data should exist');
    assert.ok(j.data.date, 'date should be set');
    assert.ok(typeof j.data.streak_days === 'number');
    assert.ok(j.data.stats, 'stats should exist');
    assert.equal(typeof j.data.stats.overall_score, 'number');
    assert.equal(typeof j.data.stats.weak_points_total, 'number');
    assert.ok(Array.isArray(j.data.next_actions), 'next_actions should be array');
    assert.equal(j.data.next_actions.length, 8, 'should have 8 actions');
    assert.ok(j.data.next_actions[0].href, 'action should have href');
    // X-Cache header
    const cache = r.headers.get('X-Cache');
    assert.ok(['HIT', 'MISS'].includes(cache), `X-Cache should be HIT or MISS, got ${cache}`);
  });

  test('GET /api/loop/actions returns 8 actions', async () => {
    const r = await fetch(`${BASE}/api/loop/actions`, { headers: authHeaders });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.equal(j.data.length, 8);
    // Each action has required fields
    for (const a of j.data) {
      assert.ok(a.id, 'id');
      assert.ok(a.kind, 'kind');
      assert.ok(a.title, 'title');
      assert.ok(a.href, 'href');
    }
  });

  test('GET /api/loop/feed returns items array', async () => {
    const r = await fetch(`${BASE}/api/loop/feed`, { headers: authHeaders });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.ok(Array.isArray(j.data.items));
  });

  // 4. D082 today lifecycle
  test('GET /api/user/today auto-generates tasks', async () => {
    const r = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.ok(Array.isArray(j.data.tasks));
    assert.ok(j.data.tasks.length >= 1, 'should auto-generate at least 1 task');
    // Each task has required fields
    const t = j.data.tasks[0];
    assert.ok(t.id, 'task id');
    assert.ok(t.kind, 'task kind');
    assert.ok(t.title, 'task title');
    assert.ok(t.start_url, 'task start_url');
    assert.ok(['pending', 'started', 'completed', 'skipped'].includes(t.status));
  });

  test('GET /api/user/today is idempotent', async () => {
    const r1 = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const j1 = await r1.json();
    const r2 = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const j2 = await r2.json();
    assert.equal(j1.data.tasks.length, j2.data.tasks.length, 'same day should return same task count');
  });

  test('POST /api/user/today/:id/start transitions status', async () => {
    const today = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const todayJ = await today.json();
    const task = todayJ.data.tasks.find(t => t.status === 'pending');
    if (!task) return; // 跳过: 无 pending 任务
    const r = await fetch(`${BASE}/api/user/today/${task.id}/start`, {
      method: 'POST', headers: authHeaders, body: '{}'
    });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.equal(j.data.status, 'started');
  });

  test('POST /api/user/today/:id/complete with score', async () => {
    const today = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const todayJ = await today.json();
    const task = todayJ.data.tasks.find(t => t.status !== 'completed' && t.status !== 'skipped');
    if (!task) return;
    const r = await fetch(`${BASE}/api/user/today/${task.id}/complete`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ score: 85, time_spent_ms: 480000 })
    });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.equal(j.data.status, 'completed');
    assert.equal(j.data.score, 85);
  });

  test('POST /api/user/today/:id/skip with reason', async () => {
    const today = await fetch(`${BASE}/api/user/today`, { headers: authHeaders });
    const todayJ = await today.json();
    const task = todayJ.data.tasks.find(t => t.status === 'pending');
    if (!task) return;
    const r = await fetch(`${BASE}/api/user/today/${task.id}/skip`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ reason: 'too_tired' })
    });
    const j = await r.json();
    assert.equal(j.success, true);
    assert.equal(j.data.status, 'skipped');
    assert.equal(j.data.skip_reason, 'too_tired');
  });

  // 5. 鉴权
  test('Unauth /api/loop/summary returns 401', async () => {
    const r = await fetch(`${BASE}/api/loop/summary`);
    assert.equal(r.status, 401);
  });

  // 6. D062 envelope 校验
  test('All responses follow D062 envelope', async () => {
    const urls = ['/api/loop/summary', '/api/loop/actions', '/api/loop/feed', '/api/user/today'];
    for (const url of urls) {
      const r = await fetch(`${BASE}${url}`, { headers: authHeaders });
      const j = await r.json();
      assert.equal(typeof j.success, 'boolean', `${url} should have success:boolean`);
      assert.ok('message' in j, `${url} should have message`);
      assert.ok('data' in j, `${url} should have data`);
    }
  });

  // 运行测试
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${t.name}`);
      console.log(`    ${err.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${tests.length} total)`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });