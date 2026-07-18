const { test, expect } = require('@playwright/test');

test.describe('首页交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('测试页面标题和Logo显示', async ({ page }) => {
    await expect(page).toHaveTitle('AI tutor - 首页');
    const logo = page.locator('a[href="#"][class*="flex items-center"]');
    await expect(logo.first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/index-logo.png' });
  });

  test('测试导航栏链接跳转 - 考试练习', async ({ page }) => {
    const examLink = page.locator('a[href="./exam-simulation.html"]');
    await expect(examLink).toBeVisible();
    await examLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/exam-simulation/);
    await page.screenshot({ path: 'test-results/screenshots/index-nav-exam.png' });
  });

  test('测试导航栏链接跳转 - AI导师', async ({ page }) => {
    const tutorLink = page.locator('a[href="./tutor.html"]');
    await expect(tutorLink).toBeVisible();
    await tutorLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tutor/);
    await page.screenshot({ path: 'test-results/screenshots/index-nav-tutor.png' });
  });

  test('测试导航栏链接跳转 - 学情分析', async ({ page }) => {
    const dashboardLink = page.locator('a[href="./dashboard.html"]');
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/dashboard/);
    await page.screenshot({ path: 'test-results/screenshots/index-nav-dashboard.png' });
  });

  test('测试导航栏链接跳转 - 登录', async ({ page }) => {
    const loginLink = page.locator('[data-dom-id="nav-login"]');
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/login/);
    await page.screenshot({ path: 'test-results/screenshots/index-nav-login.png' });
  });

  test('测试Hero区域CTA按钮 - 开始学习', async ({ page }) => {
    const startBtn = page.locator('[data-dom-id="hero-cta"]');
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/login/);
    await page.screenshot({ path: 'test-results/screenshots/index-hero-start.png' });
  });

  test('测试Hero区域CTA按钮 - 了解更多', async ({ page }) => {
    const learnBtn = page.locator('a:has-text("了解更多")');
    await expect(learnBtn).toBeVisible();
    await learnBtn.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/index-hero-learn.png' });
  });

  test('测试核心功能卡片hover效果', async ({ page }) => {
    const cards = page.locator('div.group');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    for (let i = 0; i < Math.min(3, cardCount); i++) {
      const card = cards.nth(i);
      await card.hover();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: 'test-results/screenshots/index-cards-hover.png' });
  });

  test('测试学科入口卡片点击', async ({ page }) => {
    const subjectCards = page.locator('.grid-cols-2 a.group');
    const cardCount = await subjectCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    const firstCard = subjectCards.first();
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/index-subject-click.png' });
  });

  test('测试底部CTA按钮', async ({ page }) => {
    const footerBtn = page.locator('section.bg-surface-dark a.bg-primary-500');
    await expect(footerBtn.first()).toBeVisible();
    await footerBtn.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/index-footer-cta.png' });
  });

  test('测试移动端菜单按钮', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const menuBtn = page.locator('button[aria-label="菜单"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/index-mobile-menu.png' });
  });

  test('测试页面滚动和内容可见性', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/index-scroll-bottom.png' });
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});