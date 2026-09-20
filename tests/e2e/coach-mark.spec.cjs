/* ============================================================================
 * aitutor V1.0 · Coach Mark E2E（修复 test isolation）
 *
 * 修复要点：
 *   1. 每个 test 拥有独立 Playwright BrowserContext（默认行为）
 *   2. test.beforeEach 显式清理 localStorage（防御性 + 隔离保证）
 *   3. 使用 addInitScript **函数形式**（不是 content: 字符串）—— debug 验证可用
 *   4. fixture 改名为 coach-mark-host.html，放在 frontend/tests-fixtures/ 下
 *   5. test 内部用 `addInitScript` 一次性注入 user + V1_DATE（避免重复 setup）
 *
 * 5 个 Case：
 *   1. 已引导过 → 不展示
 *   2. 新用户（注册晚于 V1）→ 不展示 + 自动标记
 *   3. 老用户（注册早于 V1）→ 展示 + 文案校验
 *   4. 点击 CTA → 跳 /learning-path.html + 标记
 *   5. 点击关闭 → 移除元素 + 标记
 * ============================================================================ */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const COACH_URL = '/tests-fixtures/coach-mark-host.html';

// ====== 本地 HTTP server（端口 39040-39049 兜底）======
let server;
let baseURL = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/learning-path.html';
      const fp = path.join(FRONTEND_DIR, p);
      if (!fp.startsWith(FRONTEND_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': {'.html':'text/html','.js':'application/javascript'}[path.extname(fp)] || 'text/plain' });
      res.end(fs.readFileSync(fp));
    } catch (e) { res.writeHead(500); res.end(); }
  });
  for (const port of [39040,39041,39042,39043,39044,39045,39046,39047,39048,39049]) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => resolve());
      });
      baseURL = `http://localhost:${port}`;
      break;
    } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// ====== 关键修复：每个 test 都用 beforeEach 显式清 localStorage ======
test.beforeEach(async ({ context }) => {
  // 防御性：清空所有 V1 相关 localStorage（避免跨 test 污染）
  await context.addInitScript(() => {
    try {
      localStorage.removeItem('aitutor.v1_onboarded');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('aitutor.is_old_user');
    } catch (_) { /* 隐私模式可能抛错，忽略 */ }
  });
});

// ====== 关键修复：使用函数形式 addInitScript（已 debug 验证）======
/**
 * 函数形式 addInitScript：Playwright 会在每个页面加载前调用该函数
 * @param {import('@playwright/test').BrowserContext} context
 * @param {object} data - { user, v1Date, token, preOnboarded }
 */
async function inject(context, data) {
  await context.addInitScript((d) => {
    try {
      if (d.v1Date) window.AITUTOR_V1_RELEASE_DATE = d.v1Date;
      if (d.user) localStorage.setItem('user', JSON.stringify(d.user));
      if (d.token) localStorage.setItem('token', d.token);
      if (d.preOnboarded) localStorage.setItem('aitutor.v1_onboarded', '1');
    } catch (e) {
      console.error('[test-inject] failed:', e);
    }
  }, data);
}

// ============================================================================
// Case 1: 已引导过 → 不展示
// ============================================================================
test('Case 1: 已标记 onboarded=1 → 不展示', async ({ page, context }) => {
  await inject(context, {
    user: { email: 'old@e2e', createdAt: '2025-01-01' },
    v1Date: '2026-09-15',
    preOnboarded: true,
  });
  await page.goto(baseURL + COACH_URL, { waitUntil: 'load' });
  await page.waitForSelector('#aitutor-v1-coach-mark', { state: 'detached', timeout: 3000 });
  await expect(page.locator('#aitutor-v1-coach-mark')).toHaveCount(0);
});

// ============================================================================
// Case 2: 新用户（user.createdAt > V1_RELEASE_DATE）→ 不展示但标记
// ============================================================================
test('Case 2: 新用户（注册晚于 V1）→ 不展示 + 自动标记', async ({ page, context }) => {
  await inject(context, {
    user: { email: 'new@e2e', createdAt: '2026-12-01' },
    v1Date: '2026-09-15',
  });
  await page.goto(baseURL + COACH_URL, { waitUntil: 'load' });
  // 等待脚本执行（load + 600ms setTimeout）
  await page.waitForTimeout(2000);
  // 验证不展示
  await expect(page.locator('#aitutor-v1-coach-mark')).toHaveCount(0);
  // 验证已标记
  const flag = await page.evaluate(() => localStorage.getItem('aitutor.v1_onboarded'));
  expect(flag).toBe('1');
});

// ============================================================================
// Case 3: 老用户（user.createdAt < V1_RELEASE_DATE）→ 展示 + 文案
// ============================================================================
test('Case 3: 老用户（注册早于 V1）→ 展示 + 标题含"欢迎"', async ({ page, context }) => {
  await inject(context, {
    user: { email: 'old@e2e', createdAt: '2025-01-01' },
    v1Date: '2026-09-15',
  });
  await page.goto(baseURL + COACH_URL, { waitUntil: 'load' });
  await page.waitForSelector('#aitutor-v1-coach-mark', { state: 'visible', timeout: 8000 });
  const cm = page.locator('#aitutor-v1-coach-mark');
  await expect(cm).toBeVisible();
  // 标题含"欢迎"
  await expect(cm.locator('.cmv1-title')).toContainText('欢迎');
  // 正文含"开始复习"
  await expect(cm.locator('.cmv1-body')).toContainText('开始复习');
  // 主 CTA 可见且文案正确
  await expect(cm.locator('.cmv1-btn-primary')).toBeVisible();
  await expect(cm.locator('.cmv1-btn-primary')).toContainText('开始复习');
  // 关闭按钮可见且文案正确
  await expect(cm.locator('.cmv1-btn-secondary')).toContainText('下次再说');
});

// ============================================================================// Case 4: 点击 CTA → 跳转 /learning-path.html + 标记
// ============================================================================
test('Case 4: 点击 CTA → 跳转 /learning-path.html + 标记', async ({ page, context }) => {
  await inject(context, {
    user: { email: 'old@e2e', createdAt: '2025-01-01' },
    v1Date: '2026-09-15',
    token: 'mock-jwt-token-for-e2e',  // 防止 /learning-path.html 重定向到 login
  });
  await page.goto(baseURL + COACH_URL, { waitUntil: 'load' });
  await page.waitForSelector('#aitutor-v1-coach-mark', { state: 'visible', timeout: 8000 });

  // 关键修复：在 page 上下文中同步执行 click + 检查 flag
  // 原因：click 后立即 navigate，page.evaluate 异步，flag 在新页面
  //       addInitScript 清除后已不可读。必须同步捕获。
  const result = await page.evaluate(() => {
    const btn = document.querySelector('[data-cmv1-cta]');
    if (!btn) return { flag: 'NO_BTN', url: location.href };
    btn.click();  // 同步触发 click handler（包含 markOnboarded + location.href）
    // click handler 已同步执行完，flag 已写入
    return { flag: localStorage.getItem('aitutor.v1_onboarded'), url: location.href };
  });
  // 验证 flag 已写入
  expect(result.flag).toBe('1');

  // 验证跳转目标
  await page.waitForURL(/\/learning-path\.html/, { timeout: 8000 });
  expect(page.url()).toContain('learning-path.html');
});

// ============================================================================
// Case 5: 点击关闭 → 移除元素 + 标记
// ============================================================================
test('Case 5: 点击关闭 → 移除元素 + 标记', async ({ page, context }) => {
  await inject(context, {
    user: { email: 'old@e2e', createdAt: '2025-01-01' },
    v1Date: '2026-09-15',
  });
  await page.goto(baseURL + COACH_URL, { waitUntil: 'load' });
  await page.waitForSelector('#aitutor-v1-coach-mark', { state: 'visible', timeout: 8000 });
  // 点击关闭按钮
  await page.click('[data-cmv1-close]');
  // 元素应被移除
  await expect(page.locator('#aitutor-v1-coach-mark')).toHaveCount(0);
  // 标记已设置
  const flag = await page.evaluate(() => localStorage.getItem('aitutor.v1_onboarded'));
  expect(flag).toBe('1');
});
