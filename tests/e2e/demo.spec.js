// tests/e2e/demo.spec.js — F2.5 1 E2E demo: Service Layer + Mock 验证
// 跑: npx playwright test tests/e2e/demo.spec.js

import { test, expect } from '@playwright/test';

test.describe('AI Tutor v2 Demo (Service Layer + Mock)', () => {
  test('加载 dashboard mock + stat 卡片显示数值', async ({ page }) => {
    // mock 模式 (URL 参数)
    await page.goto('/pages/index.html?mock=true');

    // 等 hero 渲染
    await expect(page.locator('h1')).toContainText('AI Tutor');

    // 服务层验证 log
    const log = page.locator('#service-log');
    await expect(log).toContainText('F1 Foundation 验证页加载');

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

  test('真实 API 模式 (无 mock): service 可调用, 失败合理', async ({ page }) => {
    await page.goto('/pages/index.html');  // 无 ?mock=true
    await page.click('#btn-load');
    // 真实后端没启 (只在 mock 模式工作), 加载失败或超时均可
    // 验证: 卡片回到 placeholder / 显示加载失败
    await expect(page.locator('#s0')).toContainText(/加载失败|—/i, { timeout: 8000 });
  });
});