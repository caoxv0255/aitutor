/* ============================================================================
 * k6 压测脚本 · V1.0 Code Freeze
 *
 * 目标接口：
 *   - GET /api/learning-path/current  (Stage E · 今日学习页)
 *   - GET /api/home/today              (Stage C · Dashboard)
 *
 * SLA 验收：
 *   - P95 < 200ms
 *   - P99 < 500ms
 *   - Error Rate < 0.1%
 *   - DB 连接池无死锁
 *
 * 跑：
 *   k6 run --duration 1m --vus 10 tests/load/learning-path-load.js   # Baseline
 *   k6 run --duration 3m --vus 100 tests/load/learning-path-load.js  # Load
 *   k6 run --duration 3m --vus 500 tests/load/learning-path-load.js  # Stress
 *
 * 输出：JSON + 摘要，写入 ./load-test-results/
 * ============================================================================ */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { uuid } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ====== 自定义指标 ======
const errorRate   = new Rate('errors');
const p95         = new Trend('learning_path_duration', true);
const p99         = new Trend('learning_path_duration_p99', true);
const dbTimeouts  = new Counter('db_connection_timeouts');

// ====== 配置：3 档压测场景 ======
export const options = {
  // 默认 Load 档（100 并发 / 3 分钟）
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      tags: { scenario: 'baseline' },
    },
    load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '3m',
      startTime: '1m30s',  // 等 baseline 跑完
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 500 },
        { duration: '1m',  target: 1000 },  // 找拐点
        { duration: '30s', target: 0 },
      ],
      startTime: '5m',
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    'http_req_duration{endpoint:learning_path}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{endpoint:home_today}':     ['p(95)<200', 'p(99)<500'],
    'errors':                                       ['rate<0.001'],  // 0.1%
    'http_req_failed':                              ['rate<0.001'],
  },
};

// ====== 测试数据：100 个虚拟用户邮箱（mock JWT） ======
const users = new SharedArray('users', function() {
  const arr = [];
  for (let i = 0; i < 1000; i++) {
    arr.push({ email: `loadtest_${i}@e2e.local`, token: `mock-jwt-${uuid()}` });
  }
  return arr;
});

// ====== 端点配置 ======
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SUBJECTS  = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

function pickSubject() {
  return SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
}

function getHeaders(user) {
  return {
    headers: {
      'Authorization': `Bearer ${user.token}`,
      'Content-Type':  'application/json',
    },
  };
}

// ====== 主场景 ======
export default function() {
  const user = users[Math.floor(Math.random() * users.length)];
  const subject = pickSubject();

  // 1) 模拟真实用户路径：Dashboard → Learning Path
  const homeRes = http.get(`${BASE_URL}/api/home/today?subject=${subject}`, {
    ...getHeaders(user),
    tags: { endpoint: 'home_today' },
  });

  const homeOk = check(homeRes, {
    'home/today status 200':         (r) => r.status === 200,
    'home/today response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!homeOk);

  // 短暂间隔（模拟用户切换 tab）
  sleep(Math.random() * 0.5 + 0.2);

  // 2) Learning Path 接口
  const lpRes = http.get(`${BASE_URL}/api/learning-path/current?subject=${subject}`, {
    ...getHeaders(user),
    tags: { endpoint: 'learning_path' },
  });

  const lpOk = check(lpRes, {
    'learning-path/current status 200': (r) => r.status === 200,
    'learning-path/current success=true': (r) => {
      try { return r.json('success') === true; } catch (e) { return false; }
    },
    'learning-path/current response < 200ms': (r) => r.timings.duration < 200,
    'learning-path/current has stages':     (r) => {
      try { return Array.isArray(r.json('data.stages')); } catch (e) { return false; }
    },
  });
  errorRate.add(!lpOk);
  p95.add(lpRes.timings.duration);
  p99.add(lpRes.timings.duration);

  // 3) 模拟错误检测
  if (lpRes.status === 500) {
    dbTimeouts.add(1);
    console.error(`[500 ERROR] email=${user.email} body=${lpRes.body.substring(0, 200)}`);
  }
}

// ====== 优雅退出钩子：打印摘要 ======
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration_s: data.state.testRunDurationMs / 1000,
    total_requests: data.metrics.http_reqs.values.count,
    p50_ms: data.metrics.http_req_duration.values.p(50),
    p95_ms: data.metrics.http_req_duration.values.p(95),
    p99_ms: data.metrics.http_req_duration.values.p(99),
    error_rate: data.metrics.errors.values.rate,
    thresholds_passed: Object.keys(data.root_group.checks || {}).length === 0,
  };

  console.log('═══════ LOAD TEST SUMMARY ═══════');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'stdout': textSummary(data),
    'load-test-results/summary.json': JSON.stringify(summary, null, 2),
    'load-test-results/full.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return `
═══════ k6 LOAD TEST RESULT ═══════
Total Requests : ${m.http_reqs.values.count}
P50 Latency    : ${m.http_req_duration.values.p(50).toFixed(2)}ms
P95 Latency    : ${m.http_req_duration.values.p(95).toFixed(2)}ms
P99 Latency    : ${m.http_req_duration.values.p(99).toFixed(2)}ms
Error Rate     : ${(m.errors.values.rate * 100).toFixed(3)}%
Failed Requests: ${m.http_req_failed?.values?.passes || 0} passed / ${m.http_req_failed?.values?.fails || 0} failed
DB Timeouts    : ${m.db_connection_timeouts?.values?.count || 0}
`;
}
