// tests/api/wrong-questions-crud.test.js — G1 错题闭环契约测试
//
// 用法:  BCT_URL=http://localhost:3002 node tests/api/wrong-questions-crud.test.js
//
// 验证目标 (docs/spec/SPEC-DATA.md G1):
//   1. PUT  /api/user/wrong-questions/:id   路由已挂载且返回统一 envelope
//   2. DELETE /api/user/wrong-questions/:id 同上
//   3. 越权/不存在 → 404 + success:false (handler 的 user_email 兜底生效)
//
// 安全性: 只用不可能存在的 id (0 / 999999999) 发请求, 不碰任何真实数据。
// 未挂载路由时 Express 会回退成 HTML 404 —— 这两种响应必须区分开。

const BASE_URL = process.env.BCT_URL || 'http://localhost:3002';

let pass = 0;
let fail = 0;

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
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main() {
  console.log(`\nG1 错题闭环契约测试 → ${BASE_URL}\n`);

  // 无 token 也要能证明"路由存在": 用一个假 token, 期望走到 handler 的 404 分支
  // (若路由未挂载, Express 返回 HTML, json 解析失败)
  const token = process.env.BCT_TOKEN || 'g1-probe-token';

  const put = await call('PUT', '/api/user/wrong-questions/0', { token, body: { reviewed: 1 } });
  ok('PUT 返回 JSON envelope', put.json !== null, `实际 body 前 80 字: ${put.text.slice(0, 80)}`);
  ok('PUT 不存在 → 404', put.status === 404, `status=${put.status}`);
  ok('PUT 404 带 success:false', put.json && put.json.success === false, JSON.stringify(put.json));
  ok(
    'PUT 404 文案来自 handler',
    put.json && /错题不存在或无权访问/.test(put.json.message || ''),
    JSON.stringify(put.json && put.json.message)
  );

  const del = await call('DELETE', '/api/user/wrong-questions/0', { token });
  ok('DELETE 返回 JSON envelope', del.json !== null, `实际 body 前 80 字: ${del.text.slice(0, 80)}`);
  ok('DELETE 不存在 → 404', del.status === 404, `status=${del.status}`);
  ok(
    'DELETE 404 文案来自 handler',
    del.json && /错题不存在或无权访问/.test(del.json.message || ''),
    JSON.stringify(del.json && del.json.message)
  );

  // 路由未被 /stats 之类的 GET 抢先: 确认 stats 仍是 200 或 401(鉴权), 而不是被 :id 吞掉
  const stats = await call('GET', '/api/user/wrong-questions/stats', { token });
  ok('/stats 未被 :id 路由吞掉', [200, 401, 403].includes(stats.status), `status=${stats.status}`);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('测试异常:', err.message);
  process.exit(1);
});
