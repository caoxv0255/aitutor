// tests/e2e/demo.spec.js — F2.5 1 E2E demo: Service Layer + Mock 验证
// 跑: npx playwright test tests/e2e/demo.spec.js
//
// 2026-08-18 同步: 页面 JS 已迭代到 D1 v0.7.1-dev,期望文案随之更新.
// 期望匹配改用稳定子串 "Service Layer",跟版本号脱钩 (D1/D2/D3 都成立).

import { test, expect } from '@playwright/test';

test.describe('AI Tutor v2 Demo (Service Layer + Mock)', () => {
  test('加载 dashboard mock + stat 卡片显示数值', async ({ page }) => {
    // mock 模式 (URL 参数)
    await page.goto('/pages/index.html?mock=true');

    // 等 hero 渲染
    await expect(page.locator('h1')).toContainText('AI Tutor');

    // 服务层验证 log — 匹配稳定的 "Service Layer" 子串 (D1+ 通用)
    const log = page.locator('#service-log');
    await expect(log).toContainText('Service Layer');

    // 点加载 dashboard
    await page.click('#btn-load');

    // 等 stat 数字变化 (不再是 "—")
    await expect(page.locator('#s0')).not.toHaveText('—', { timeout: 5000 });
    await expect(page.locator('#s1')).not.toHaveText('—', { timeout: 5000 });
    await expect(page.locator('#s2')).not.toHaveText('—', { timeout: 5000 });
    await expect(page.locator('#s3')).not.toHaveText('—', { timeout: 5000 });

    // dashboard mock 数据: questions_solved=248, accuracy=76.2%
    await expect(page.locator('#s0')).toContainText('248');
    await expect(page.locator('#s1')).toContainText('76');

    // 暗色主题切换
    await page.click('#btn-theme');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 截图存档
    await page.screenshot({ path: 'test-results/screenshots/demo-dashboard.png', fullPage: true });
  });

  // 2026-08-18 备注: 真实 API 模式 (无 mock) 测试在当前静态 webServer 场景下
  // 不成立 — 触发 auth service 跳 /f3/pages/login.html, 该路径不在 ai-tutor-frontend/
  // 子树里, 浏览器拿到 404 后整个 DOM 被替换. 真实"无 mock"模式 E2E 需配合完整
  // server.js + 登录态 cookie + nginx 反代, 属于 integration scope, 非 demo.
  // 此处用 test.skip(name, fn) 显式跳过, body 留可执行 noop, 后续切片在
  // tests/integration/ 落实 (见 docs/test-report.md).
  test.skip('真实 API 模式 (无 mock): 需 server.js + 登录态, 见 docs/test-report.md', async () => {
    // 空 body — 跳过时不执行; 后续替换为 server.js 端到端流程
  });
});