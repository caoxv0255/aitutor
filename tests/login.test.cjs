const { test, expect } = require('@playwright/test');

test.describe('登录页交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.waitForLoadState('networkidle');
  });

  test('测试页面标题和返回首页链接', async ({ page }) => {
    await expect(page).toHaveTitle('AI tutor - 登录');
    const backLink = page.locator('[data-dom-id="back-home"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveText('返回首页');
    await page.screenshot({ path: 'test-results/screenshots/login-title.png' });
  });

  test('测试标签切换 - 手机号登录', async ({ page }) => {
    const phoneTab = page.locator('#tab-phone');
    const passwordTab = page.locator('#tab-password');
    const phonePanel = page.locator('#panel-phone');
    const passwordPanel = page.locator('#panel-password');

    await expect(phoneTab).toBeVisible();
    await expect(passwordTab).toBeVisible();
    await expect(phonePanel).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/login-tab-phone.png' });
  });

  test('测试标签切换 - 账号密码登录', async ({ page }) => {
    const passwordTab = page.locator('#tab-password');
    const passwordPanel = page.locator('#panel-password');

    await passwordTab.click();
    await page.waitForTimeout(300);

    await expect(passwordPanel).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/login-tab-password.png' });
  });

  test('测试标签切换回手机号登录', async ({ page }) => {
    const phoneTab = page.locator('#tab-phone');
    const passwordTab = page.locator('#tab-password');

    await passwordTab.click();
    await page.waitForTimeout(200);
    await phoneTab.click();
    await page.waitForTimeout(200);

    await expect(phoneTab).toHaveAttribute('aria-selected', 'true');
    await expect(passwordTab).toHaveAttribute('aria-selected', 'false');
  });

  test('测试手机号输入框验证 - 空输入', async ({ page }) => {
    const loginBtn = page.locator('.login-btn[data-panel="phone"]');
    await loginBtn.click();
    await page.waitForTimeout(200);

    const phoneError = page.locator('#phone-error');
    await expect(phoneError).not.toHaveClass('hidden');
    await page.screenshot({ path: 'test-results/screenshots/login-phone-empty.png' });
  });

  test('测试手机号输入框验证 - 格式错误', async ({ page }) => {
    const phoneInput = page.locator('#phone-input');
    const loginBtn = page.locator('.login-btn[data-panel="phone"]');

    await phoneInput.fill('123456');
    await loginBtn.click();
    await page.waitForTimeout(200);

    const phoneError = page.locator('#phone-error');
    await expect(phoneError).not.toHaveClass('hidden');
    await page.screenshot({ path: 'test-results/screenshots/login-phone-invalid.png' });
  });

  test('测试验证码输入框验证 - 空输入', async ({ page }) => {
    const phoneInput = page.locator('#phone-input');
    const loginBtn = page.locator('.login-btn[data-panel="phone"]');

    await phoneInput.fill('13800138000');
    await loginBtn.click();
    await page.waitForTimeout(200);

    const codeError = page.locator('#code-error');
    await expect(codeError).not.toHaveClass('hidden');
    await page.screenshot({ path: 'test-results/screenshots/login-code-empty.png' });
  });

  test('测试获取验证码按钮 - 格式错误', async ({ page }) => {
    const phoneInput = page.locator('#phone-input');
    const getCodeBtn = page.locator('#get-code-btn');

    await phoneInput.fill('123456');
    await getCodeBtn.click();
    await page.waitForTimeout(200);

    const phoneError = page.locator('#phone-error');
    await expect(phoneError).not.toHaveClass('hidden');
    await expect(getCodeBtn).not.toBeDisabled();
    await page.screenshot({ path: 'test-results/screenshots/login-getcode-invalid.png' });
  });

  test('测试获取验证码按钮 - 格式正确', async ({ page }) => {
    const phoneInput = page.locator('#phone-input');
    const getCodeBtn = page.locator('#get-code-btn');

    await phoneInput.fill('13800138000');
    await getCodeBtn.click();
    await page.waitForTimeout(1000);

    await expect(getCodeBtn).toBeDisabled();
    await expect(getCodeBtn).toHaveText(/\d+s 后重发/);
    await page.screenshot({ path: 'test-results/screenshots/login-getcode-countdown.png' });
  });

  test('测试账号密码登录 - 空输入', async ({ page }) => {
    const passwordTab = page.locator('#tab-password');
    const loginBtn = page.locator('.login-btn[data-panel="password"]');

    await passwordTab.click();
    await page.waitForTimeout(200);
    await loginBtn.click();
    await page.waitForTimeout(200);

    const accountError = page.locator('#account-error');
    const passwordError = page.locator('#password-error');
    await expect(accountError).not.toHaveClass('hidden');
    await expect(passwordError).not.toHaveClass('hidden');
    await page.screenshot({ path: 'test-results/screenshots/login-password-empty.png' });
  });

  test('测试密码可见性切换', async ({ page }) => {
    const passwordTab = page.locator('#tab-password');
    const passwordInput = page.locator('#password-input');
    const toggleBtn = page.locator('#toggle-password');

    await passwordTab.click();
    await page.waitForTimeout(200);

    await expect(passwordInput).toBeVisible();
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();
    await page.waitForTimeout(200);

    await page.screenshot({ path: 'test-results/screenshots/login-password-toggle.png' });
  });

  test('测试记住我复选框', async ({ page }) => {
    const passwordTab = page.locator('#tab-password');
    const rememberMe = page.locator('#remember-me');

    await passwordTab.click();
    await page.waitForTimeout(200);

    await expect(rememberMe).not.toBeChecked();
    await rememberMe.click();
    await expect(rememberMe).toBeChecked();
    await page.screenshot({ path: 'test-results/screenshots/login-remember-me.png' });
  });

  test('测试登录成功跳转', async ({ page }) => {
    const phoneInput = page.locator('#phone-input');
    const codeInput = page.locator('#code-input');
    const loginBtn = page.locator('.login-btn[data-panel="phone"]');

    await phoneInput.fill('13800138000');
    await codeInput.fill('1234');
    await loginBtn.click();
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/dashboard/);
    await page.screenshot({ path: 'test-results/screenshots/login-success.png' });
  });

  test('测试第三方登录按钮', async ({ page }) => {
    const wechatBtn = page.locator('button[aria-label="微信登录"]');
    const qqBtn = page.locator('button[aria-label="QQ登录"]');

    await expect(wechatBtn).toBeVisible();
    await expect(qqBtn).toBeVisible();

    await wechatBtn.click();
    await page.screenshot({ path: 'test-results/screenshots/login-wechat.png' });
  });

  test('测试注册链接', async ({ page }) => {
    const registerLink = page.locator('a:has-text("立即注册")');
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await page.screenshot({ path: 'test-results/screenshots/login-register.png' });
  });

  test('测试忘记密码链接', async ({ page }) => {
    const passwordTab = page.locator('#tab-password');
    const forgotLink = page.locator('a:has-text("忘记密码？")');

    await passwordTab.click();
    await page.waitForTimeout(200);
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await page.screenshot({ path: 'test-results/screenshots/login-forgot.png' });
  });
});