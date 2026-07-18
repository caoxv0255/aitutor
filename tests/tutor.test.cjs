const { test, expect } = require('@playwright/test');

test.describe('AI导师页面交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tutor.html');
    await page.waitForLoadState('networkidle');
  });

  test('测试页面标题和AI导师标识', async ({ page }) => {
    await expect(page).toHaveTitle('AI tutor - AI导师对话');
    const title = page.locator('h1:has-text("AI 导师")');
    await expect(title).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/tutor-title.png' });
  });

  test('测试返回按钮', async ({ page }) => {
    const backBtn = page.locator('[data-dom-id="back-from-tutor"]');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/tutor-back.png' });
  });

  test('测试学科选择按钮', async ({ page }) => {
    const subjectBtn = page.locator('#subject-select-btn');
    await expect(subjectBtn).toBeVisible();
    await expect(subjectBtn).toHaveText(/数学/);
    await subjectBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-subject-select.png' });
  });

  test('测试清空对话按钮', async ({ page }) => {
    const clearBtn = page.locator('#clear-chat-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-clear.png' });
  });

  test('测试新建对话按钮', async ({ page }) => {
    const newChatBtn = page.locator('button:has-text("新建对话")');
    await expect(newChatBtn).toBeVisible();
    await newChatBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-new-chat.png' });
  });

  test('测试历史对话列表显示', async ({ page }) => {
    const historyItems = page.locator('aside li');
    const itemCount = await historyItems.count();
    expect(itemCount).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/screenshots/tutor-history.png' });
  });

  test('测试历史对话点击切换', async ({ page }) => {
    const historyItems = page.locator('aside li');
    const itemCount = await historyItems.count();
    
    if (itemCount > 1) {
      const secondItem = historyItems.nth(1);
      await secondItem.click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: 'test-results/screenshots/tutor-history-click.png' });
  });

  test('测试消息区域显示', async ({ page }) => {
    const messages = page.locator('#messages');
    await expect(messages).toBeVisible();
    
    const messageItems = page.locator('.msg-enter');
    const count = await messageItems.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/screenshots/tutor-messages.png' });
  });

  test('测试AI欢迎消息', async ({ page }) => {
    const welcomeMsg = page.locator('.msg-enter');
    await expect(welcomeMsg.first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/tutor-welcome.png' });
  });

  test('测试诊断结果卡片', async ({ page }) => {
    const diagnosisCard = page.locator('.msg-enter:has-text("诊断结果")');
    await expect(diagnosisCard).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/tutor-diagnosis.png' });
  });

  test('测试查看知识图谱按钮', async ({ page }) => {
    const masteryBtn = page.locator('[data-dom-id="tutor-to-mastery"]');
    await expect(masteryBtn).toBeVisible();
    await masteryBtn.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/tutor-to-mastery.png' });
  });

  test('测试输入框焦点', async ({ page }) => {
    const input = page.locator('.chat-input');
    await input.click();
    await page.waitForTimeout(200);
    
    const hasFocus = await input.evaluate(el => document.activeElement === el);
    expect(hasFocus).toBe(true);
    await page.screenshot({ path: 'test-results/screenshots/tutor-input-focus.png' });
  });

  test('测试输入框输入', async ({ page }) => {
    const input = page.locator('.chat-input');
    await input.fill('这道题怎么做？');
    await page.waitForTimeout(200);
    
    const value = await input.inputValue();
    expect(value).toBe('这道题怎么做？');
    await page.screenshot({ path: 'test-results/screenshots/tutor-input-text.png' });
  });

  test('测试发送按钮', async ({ page }) => {
    const input = page.locator('.chat-input');
    const sendBtn = page.locator('button[aria-label="发送"]');
    
    await input.fill('测试消息');
    await sendBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/tutor-send.png' });
  });

  test('测试拍照搜题按钮', async ({ page }) => {
    const cameraBtn = page.locator('[data-dom-id="tutor-to-vision"]');
    await expect(cameraBtn).toBeVisible();
    await cameraBtn.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/tutor-camera.png' });
  });

  test('测试附件按钮', async ({ page }) => {
    const attachBtn = page.locator('button[title="添加附件"]');
    await expect(attachBtn).toBeVisible();
    await attachBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-attach.png' });
  });

  test('测试学科快捷标签 - 数学', async ({ page }) => {
    const mathTag = page.locator('.subject-tag-active');
    await expect(mathTag).toBeVisible();
    await expect(mathTag).toHaveText(/数学/);
    await page.screenshot({ path: 'test-results/screenshots/tutor-subject-math.png' });
  });

  test('测试学科快捷标签 - 切换物理', async ({ page }) => {
    const physicsTag = page.locator('button:has-text("物理")');
    await expect(physicsTag).toBeVisible();
    await physicsTag.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/tutor-subject-physics.png' });
  });

  test('测试学科快捷标签 - 切换化学', async ({ page }) => {
    const chemistryTag = page.locator('button:has-text("化学")');
    await expect(chemistryTag).toBeVisible();
    await chemistryTag.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/tutor-subject-chemistry.png' });
  });

  test('测试反馈按钮 - 有帮助', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const helpfulBtn = page.getByRole('button', { name: '有帮助' });
    await expect(helpfulBtn).toBeVisible();
    await helpfulBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-feedback-helpful.png' });
  });

  test('测试反馈按钮 - 没帮助', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const notHelpfulBtn = page.getByRole('button', { name: '没帮助' });
    await expect(notHelpfulBtn).toBeVisible();
    await notHelpfulBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-feedback-not-helpful.png' });
  });

  test('测试相似题目推荐列表', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const similarQuestions = page.locator('.rounded-2xl.p-4.bg-surface-secondary');
    await expect(similarQuestions.first()).toBeVisible();
    
    const questionItems = page.locator('.space-y-2 li');
    const count = await questionItems.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/screenshots/tutor-similar-questions.png' });
  });

  test('测试相似题目点击', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const questionItems = page.locator('.space-y-2 li');
    const firstItem = questionItems.first();
    await firstItem.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/tutor-similar-click.png' });
  });

  test('测试加入错题本按钮', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const addWrongBtn = page.getByRole('button', { name: '加入错题本' });
    await expect(addWrongBtn).toBeVisible();
    await addWrongBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-add-wrong.png' });
  });

  test('测试再讲一遍按钮', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const reexplainBtn = page.getByRole('button', { name: '再讲一遍' });
    await expect(reexplainBtn).toBeVisible();
    await reexplainBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-reexplain.png' });
  });

  test('测试分享按钮', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const shareBtn = page.getByRole('button', { name: '分享' });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/tutor-share.png' });
  });

  test('测试设置按钮', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const settingsBtn = page.locator('button:has(i[data-lucide="settings"])');
    const count = await settingsBtn.count();
    if (count > 0) {
      await expect(settingsBtn.first()).toBeVisible();
      await settingsBtn.first().click();
    }
    await page.screenshot({ path: 'test-results/screenshots/tutor-settings.png' });
  });

  test('测试页面滚动', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/tutor-scroll.png' });
  });

  test('测试消息区域滚动到底部', async ({ page }) => {
    const messages = page.locator('#messages');
    await messages.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/tutor-scroll-messages.png' });
  });
});