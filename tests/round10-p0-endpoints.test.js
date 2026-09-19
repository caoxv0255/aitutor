// tests/round10-p0-endpoints.test.js
// Round 10 后端补齐合同测试 (3 个 P0 缺口)
//
// 测试: SRS review + queue + knowledge star-map + essay upload
// 验证: 端点存在 + 返回 envelope + 关键字段

import { test, expect, describe, beforeAll } from 'vitest';

// 注意: 不能用 BASE_URL — Vite 内置 env 会把它覆盖成 '/' (同 tests/backend-contract.test.js:6),
// 否则 fetch 收到 '//api/srs/engine/review' 直接 TypeError.
const BASE = process.env.BCT_URL || 'http://localhost:3002';
// demo-jwt-token 过不了 authMiddleware, 校验类断言会拿到 401 而不是 400.
// 取真实 guest token, 让「拒绝非法入参」这类用例能真正走到参数校验.
let JWT = process.env.TEST_JWT || 'demo-jwt-token';
beforeAll(async () => {
  if (process.env.TEST_JWT) return;
  try {
    const res = await fetch(`${BASE}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.ok) {
      const j = await res.json();
      JWT = j.data?.token || j.token || JWT;
    }
  } catch { /* 无后端时沿用 demo token */ }
});

async function fetchPath(path, opts = {}) {
  const url = `${BASE}${path}`;
  const { headers, ...rest } = opts;
  const res = await fetch(url, {
    ...rest,
    // headers 必须最后合并: 旧写法 `...opts` 在后面, 会用 opts.headers 整体覆盖掉 Authorization
    headers: { ...(headers || {}), 'Authorization': `Bearer ${JWT}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe('Round 10 P0: SRS /review (PM §F.2 + §F.14)', () => {
  test('POST /api/srs/engine/review 接收 wrong_id + quality 0-5', async () => {
    const r = await fetchPath('/api/srs/engine/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // wrong_questions.id 是 integer; 传 UUID 会撞 "invalid input syntax for type integer" → 500
      body: JSON.stringify({
        wrong_id: 1,
        quality: 4,
        time_spent_ms: 18000,
        group_results: [
          { card_index: 1, correct: true },
          { card_index: 2, correct: true },
          { card_index: 3, correct: false },
          { card_index: 4, correct: true },
        ],
      }),
    });
    // 401/404 都接受 (无真实用户), 但端点必须注册
    expect([200, 400, 401, 404]).toContain(r.status);
    // 若 200: 验证 envelope
    if (r.status === 200) {
      expect(r.body).toHaveProperty('success');
    }
  });

  test('拒绝非法 quality (非 0-5)', async () => {
    const r = await fetchPath('/api/srs/engine/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrong_id: 'fake', quality: 7 }),
    });
    expect(r.status).toBe(400);
  });

  test('GET /api/srs/engine/queue 返回 group (1 错题 + 3 相似题)', async () => {
    const r = await fetchPath('/api/srs/engine/queue');
    expect([200, 401]).toContain(r.status);
    if (r.status === 200) {
      expect(r.body).toHaveProperty('data');
      const queue = r.body.data?.queue || [];
      if (queue.length > 0) {
        const first = queue[0];
        expect(first).toHaveProperty('wrong_id');
        expect(first).toHaveProperty('group');
        expect(first.group_size).toBe(4); // 1 错题 + 3 相似题 (PM §F.9)
        expect(first.group[0].kind).toBe('wrong');
        expect(first.group[1].kind).toBe('similar');
      }
    }
  });
});

describe('Round 10 P0: Knowledge /star-map (PM §F.2)', () => {
  test('GET /api/knowledge/star-map 返回 9 学科 + 节点 + 边 + 热力', async () => {
    const r = await fetchPath('/api/knowledge/star-map');
    expect([200, 401]).toContain(r.status);
    if (r.status === 200) {
      const d = r.body.data;
      expect(d).toHaveProperty('subjects');
      expect(d).toHaveProperty('nodes');
      expect(d).toHaveProperty('edges');
      expect(d).toHaveProperty('heatmap');
      // 9 学科严格顺序
      const codes = (d.subjects || []).map(s => s.code);
      expect(codes).toEqual(['chinese','math','english','physics','chemistry','biology','history','geography','politics']);
    }
  });
});

describe('Round 10 P0: Essay /upload', () => {
  test('POST /api/essay/upload 端点已注册', async () => {
    // 上传端点要求 multipart, 这里仅验证端点存在
    const r = await fetchPath('/api/essay/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'fake-image-bytes',
    });
    // 401 (no auth) / 400 (no file) / 413 (too large) 都接受
    expect([200, 400, 401, 413, 415]).toContain(r.status);
  });
});

describe('Round 10: 全 13 P0 端点注册检查', () => {
  const P0_ENDPOINTS = [
    // P0 原有 (Stage 1 阶段已实装)
    { path: '/api/loop/summary', method: 'GET' },
    { path: '/api/loop/actions', method: 'GET' },
    { path: '/api/loop/feed', method: 'GET' },
    { path: '/api/user/today', method: 'GET' }, // today 是 user 子模块 (api/modules/index.js:36), 不是 /api/today
    { path: '/api/vision/search', method: 'POST' },
    { path: '/api/user/wrong-questions', method: 'GET' },
    { path: '/api/user/wrong-questions', method: 'POST' },
    { path: '/api/knowledge/mastery', method: 'GET' },
    { path: '/api/analytics/learning-path', method: 'GET' },
    { path: '/api/exam/session/submit', method: 'POST' },
    { path: '/api/essay/grade', method: 'POST' },
    // Round 10 新增
    { path: '/api/srs/engine/review', method: 'POST' },
    { path: '/api/srs/engine/queue', method: 'GET' },
    { path: '/api/knowledge/star-map', method: 'GET' },
    { path: '/api/essay/upload', method: 'POST' },
  ];

  test.each(P0_ENDPOINTS)('$method $path 已注册', async ({ path, method }) => {
    const r = await fetchPath(path, {
      method,
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: method !== 'GET' ? '{}' : undefined,
    });
    // 必须不是 404 (端点未注册)
    expect(r.status).not.toBe(404);
  });
});
