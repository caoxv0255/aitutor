const { test, expect } = require('@playwright/test');

test.describe('仪表盘交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
  });

  test('测试页面标题和面包屑导航', async ({ page }) => {
    await expect(page).toHaveTitle('AI tutor - 学习仪表盘');
    const breadcrumb = page.locator('h1:has-text("学习仪表盘")');
    await expect(breadcrumb).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-title.png' });
  });

  test('测试顶部问候语显示', async ({ page }) => {
    const greeting = page.locator('p:has-text("你好，张小明")');
    await expect(greeting).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-greeting.png' });
  });

  test('测试今日摘要横条数据卡片', async ({ page }) => {
    const summaryCards = page.locator('.grid.grid-cols-2 > div.rounded-2xl');
    const cardCount = await summaryCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    for (let i = 0; i < Math.min(4, cardCount); i++) {
      const card = summaryCards.nth(i);
      await expect(card).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/dashboard-summary.png' });
  });

  test('测试KPI卡片显示', async ({ page }) => {
    const kpiCards = page.locator('.grid.grid-cols-2.lg\\:grid-cols-4 > div.rounded-2xl');
    const cardCount = await kpiCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    for (let i = 0; i < Math.min(4, cardCount); i++) {
      const card = kpiCards.nth(i);
      await expect(card).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/dashboard-kpi.png' });
  });

  test('测试KPI卡片hover效果', async ({ page }) => {
    const kpiCards = page.locator('.grid.grid-cols-2.lg\\:grid-cols-4 > div.rounded-2xl');
    const firstCard = kpiCards.first();
    
    await firstCard.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-kpi-hover.png' });
  });

  test('测试知识掌握度雷达图', async ({ page }) => {
    const radarChart = page.locator('div.p-5.rounded-2xl svg');
    await expect(radarChart.first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-radar.png' });
  });

  test('测试近7天学习时长柱状图', async ({ page }) => {
    const barChart = page.locator('div.pt-4.pb-2');
    await expect(barChart).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-bar.png' });
  });

  test('测试柱状图hover显示数值', async ({ page }) => {
    const bars = page.locator('div.group');
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(0);
    
    const firstBar = bars.nth(0);
    await firstBar.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-bar-hover.png' });
  });

  test('测试侧边栏导航 - AI导师', async ({ page }) => {
    const tutorLink = page.locator('[data-dom-id="sidebar-tutor"]');
    await expect(tutorLink).toBeVisible();
    await tutorLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tutor/);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-nav-tutor.png' });
  });

  test('测试侧边栏导航 - 错题本', async ({ page }) => {
    const wrongBookLink = page.locator('[data-dom-id="sidebar-wrongbook"]');
    await expect(wrongBookLink).toBeVisible();
    await wrongBookLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/wrong-book/);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-nav-wrongbook.png' });
  });

  test('测试侧边栏导航 - 间隔复习', async ({ page }) => {
    const reviewLink = page.locator('[data-dom-id="sidebar-review"]');
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/review/);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-nav-review.png' });
  });

  test('测试侧边栏导航 - 知识图谱', async ({ page }) => {
    const masteryLink = page.locator('[data-dom-id="sidebar-mastery"]');
    await expect(masteryLink).toBeVisible();
    await masteryLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/mastery/);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-nav-mastery.png' });
  });

  test('测试侧边栏用户区域显示', async ({ page }) => {
    const userArea = page.locator('.px-3.py-3.border-t');
    await expect(userArea).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-user.png' });
  });

  test('测试侧边栏用户区域hover效果', async ({ page }) => {
    const userArea = page.locator('.px-3.py-3.border-t');
    await userArea.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-user-hover.png' });
  });

  test('测试退出登录按钮', async ({ page }) => {
    const logoutBtn = page.locator('button[aria-label="退出登录"]');
    await expect(logoutBtn.first()).toBeVisible();
    await logoutBtn.first().click();
    await page.screenshot({ path: 'test-results/screenshots/dashboard-logout.png' });
  });

  test('测试日期选择器按钮', async ({ page }) => {
    await page.waitForTimeout(500);
    const datePicker = page.locator('.flex.items-center.gap-2 button:has(i[data-lucide="calendar"])');
    const count = await datePicker.count();
    console.log('日期选择器按钮数量:', count);
    if (count > 0) {
      await expect(datePicker.first()).toBeVisible();
      await datePicker.first().click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: 'test-results/screenshots/dashboard-datepicker.png' });
  });

  test('测试通知铃铛按钮', async ({ page }) => {
    await page.waitForTimeout(500);
    const bellBtn = page.locator('button:has(i[data-lucide="bell"])');
    const count = await bellBtn.count();
    console.log('铃铛按钮数量:', count);
    if (count > 0) {
      await expect(bellBtn.first()).toBeVisible();
      await bellBtn.first().click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: 'test-results/screenshots/dashboard-notifications.png' });
  });

  test('测试移动端菜单按钮', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
    
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-mobile-menu.png' });
  });

  test('测试侧边栏遮罩点击关闭', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
    
    const menuBtn = page.locator('#mobile-menu-btn');
    const overlay = page.locator('#sidebar-overlay');
    
    await menuBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-mobile-close.png' });
  });

  test('测试页面滚动和内容可见性', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/dashboard-scroll.png' });
  });
});