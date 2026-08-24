// tests/e2e/demo.spec.js — F2.5 1 E2E demo: Service Layer + Mock 验证
// 跑: npx playwright test tests/e2e/demo.spec.js
//
// Phase I+ (2026-08-25): 旧 demo 测试 F2.5 (#service-log / #btn-load / #s0..#s3)
// 用的页面已被 F3 迁移改造, 元素 id 不再存在. 真实 E2E 改由 3 条 Journey spec
// 覆盖: journey-1-photo-wrong / journey-2-cross-subject / journey-3-dashboard-widgets.
// 此文件保留为占位 skip, 旧注释归档.

import { test, expect } from '@playwright/test';

test.describe('AI Tutor v2 Demo (Service Layer + Mock) — Phase I+ 占位', () => {
  // 2026-08-25: 旧 demo 元素 id 已被 F3 重构. 留 test.skip 占位, 避免误跑失败.
  test.skip('旧 demo (F2.5 #service-log / #btn-load / #s0..#s3) — F3 重构后元素不存在, 见 journey-*.spec.js', async () => {
    // 占位 noop — 真实 E2E 已迁到 tests/e2e/journey-{1,2,3}-*.spec.js
  });

  // Phase I+: demo.spec.js 不再承担断言职责, 3 条 Journey spec 才是 E2E 入口.
  // 真实 API 模式 (无 mock) 测试在当前 webServer 场景下不成立 — 触发 auth service
  // 跳 /f3/pages/login.html, 需 server.js + 登录态 cookie + nginx 反代, 属 integration scope.
  test.skip('真实 API 模式 (无 mock): 需 server.js + 登录态, 见 docs/test-report.md', async () => {
    // 空 body — 跳过时不执行; 后续替换为 server.js 端到端流程
  });
});