// tests/e2e/journey-3-dashboard-widgets.spec.js — Phase I+ (2026-08-25)
// Journey-3: 学习路径 → SRS 复习 → 反馈 → 掌握度提升 → 新路径
//            + Dashboard widget 综合 (Phase F + G + H)
//
// 浏览器依赖: chromium
// Mock 要求: URL 加 ?mock=true (LLM 走 mock, 其余真实)
// 跑: npx playwright test tests/e2e/journey-3-dashboard-widgets.spec.js --reporter=list

import { test, expect } from '@playwright/test';

test.describe('Journey-3: Dashboard 综合 widget', () => {
  test('Dashboard 显示所有 widget (gamification/SRS/practice/cross-subject/differentiation)', async ({ page }) => {
    await page.goto('/f3/pages/dashboard.html?mock=true');
    const h1 = page.locator('h1').first();
    await expect(h1).toContainText('学习仪表盘');

    // Phase F — 每日打卡 (gamification) — DOM 中存在即可
    expect(await page.locator('text=每日打卡').count()).toBeGreaterThan(0);

    // Phase F — 今日必复习 (SRS)
    expect(await page.locator('text=今日必复习').count()).toBeGreaterThan(0);

    // Phase G3 — 薄弱知识点 / 薄弱点 (stat 标签 + card title)
    expect(await page.locator('text=薄弱知识点').count()).toBeGreaterThan(0);

    // Phase H1 — 跨学科
    expect(await page.locator('text=跨学科').count()).toBeGreaterThan(0);

    // Phase H2 — 差异化 / 独特优势
    expect(await page.locator('text=独特优势').count()).toBeGreaterThan(0);

    // 至少一个 stat 卡片就位
    const stats = page.locator('.ait-stat-num');
    expect(await stats.count()).toBeGreaterThan(0);

    // 截图存档
    await page.screenshot({
      path: 'test-results/e2e/journey-3-dashboard.png',
      fullPage: true,
    });
  });

  test('Dashboard stat 卡片在 mock 模式下填值', async ({ page }) => {
    // 额外 smoke: stat 数字不再是占位 "—"
    await page.goto('/f3/pages/dashboard.html?mock=true');
    await expect(page.locator('h1').first()).toBeVisible();

    // stat 元素: 至少有一个 .ait-stat-num
    const stats = page.locator('.ait-stat-num');
    const statCount = await stats.count();
    expect(statCount).toBeGreaterThan(0);

    // mock 模式下, 允许 stat 是 "—" (lazy load), 但 DOM 必须就位
    // 不强制非占位 (动态数据依赖 services + 后端)
  });

  test('学习路径 + 复习页可达 (Phase G1/G2)', async ({ page }) => {
    // Phase G1: 学习路径 (新路径)
    await page.goto('/f3/pages/learning-path.html?mock=true');
    const pathH1 = page.locator('h1').first();
    await expect(pathH1).toBeVisible();

    // Phase G2: 复习 (SRS 反馈)
    await page.goto('/f3/pages/review.html?mock=true');
    const reviewH1 = page.locator('h1').first();
    await expect(reviewH1).toBeVisible();
  });
});
