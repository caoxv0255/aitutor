/* ============================================================================
 * P11 · Learning Path · E2E 测试
 *
 * 守护 4 个核心状态流：
 *   Case 1: 正常路径渲染（normal.json）
 *   Case 2: 全部完成状态（completed.json）
 *   Case 3: 新用户空状态（empty.json）
 *   Case 4: 401 鉴权拦截
 *
 * 跑：npm run test:e2e -- learning-path
 *   或：npx playwright test tests/e2e/learning-path.spec.cjs
 *
 * 实现要点：
 *   - 启动本地 HTTP server（file:// 协议下 fetch 受 CORS 拦截）
 *   - 使用 page.route() 拦截 API 调用，**无需真实后端**
 *   - baseURL = http://localhost:3002/learning-path.html
 * ============================================================================ */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ====== 路径常量 ======
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const MOCK_DIR = path.resolve(__dirname, '../../docs/api/mock');
const TEST_PORT = 38901;  // 高位端口避免与 3001 (现有 webServer) 冲突
const BASE_URL = `http://localhost:${TEST_PORT}`;

const MOCK_NORMAL    = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, 'learning-path-current.normal.json'),    'utf8'));
const MOCK_COMPLETED = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, 'learning-path-current.completed.json'), 'utf8'));
const MOCK_EMPTY     = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, 'learning-path-current.empty.json'),     'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ====== 本地 HTTP server（test.beforeAll 启动）======
let server;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/learning-path.html';
      const filePath = path.join(FRONTEND_DIR, urlPath);
      // 防越界
      if (!filePath.startsWith(FRONTEND_DIR)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('Not Found'); return;
      }
      const ext = path.extname(filePath);
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch (err) {
      res.writeHead(500); res.end('Server Error: ' + err.message);
    }
  });
  // 端口冲突时尝试 38902-38910
  const tryPorts = [TEST_PORT, 38902, 38903, 38904, 38905, 38906, 38907, 38908, 38909, 38910];
  for (const p of tryPorts) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, () => { resolve(); });
      });
      if (p !== TEST_PORT) {
        console.warn(`[learning-path.e2e] 端口 ${TEST_PORT} 占用，回退到 ${p}`);
      }
      break;
    } catch (e) {
      if (e.code === 'EADDRINUSE') continue;
      throw e;
    }
  }
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ====== 共用 helper ======

async function injectAuthToken(context) {
  await context.addInitScript(() => {
    localStorage.setItem('token', 'mock-jwt-for-e2e');
    localStorage.setItem('user', JSON.stringify({ email: 'test@e2e.local' }));
  });
}

async function mockApi(page, mockOrStatus) {
  await page.route(`**/api/learning-path/current**`, async (route) => {
    if (typeof mockOrStatus === 'number') {
      await route.fulfill({
        status: mockOrStatus,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'AUTH_TOKEN_EXPIRED', message: 'unauthorized' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOrStatus),
      });
    }
  });
}

const PAGE_URL = `${BASE_URL}/learning-path.html`;

// ============================================================================
// Case 1: 正常路径渲染
// ============================================================================

test('Case 1: 正常路径渲染 — Info 推荐卡 / 阶段高亮 / 今日任务 glow', async ({ page, context }) => {
  await injectAuthToken(context);
  await mockApi(page, MOCK_NORMAL);

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForSelector('.lp-recommend', { state: 'visible', timeout: 8000 });

  // 1. Info 推荐理由卡可见 + 标题 + 含具体知识点
  const recommend = page.locator('.lp-recommend');
  await expect(recommend).toBeVisible();
  await expect(recommend).toContainText('为什么推荐这个路径？');
  await expect(recommend).toContainText('二次函数图像');

  // 2. 阶段时间轴：4 个阶段
  const stages = page.locator('.lp-stage');
  await expect(stages).toHaveCount(4);

  // 3. 状态映射：第 1 阶段 completed / 第 2 current / 3-4 locked
  await expect(stages.nth(0)).toHaveClass(/is-completed/);
  await expect(stages.nth(1)).toHaveClass(/is-current/);
  await expect(stages.nth(2)).toHaveClass(/is-locked/);
  await expect(stages.nth(3)).toHaveClass(/is-locked/);

  // 4. 今日任务卡可见 + 主 CTA 含 glow 阴影
  const today = page.locator('.lp-today');
  await expect(today).toBeVisible();
  const cta = today.locator('.lp-today__cta--primary');
  await expect(cta).toBeVisible();
  const ctaShadow = await cta.evaluate((el) => window.getComputedStyle(el).boxShadow);
  expect(ctaShadow).toContain('79, 125, 240');

  // 5. 学科 chips：数学高亮
  const activeSubject = page.locator('.lp-subject.is-active');
  await expect(activeSubject).toContainText('数学');

  // 6. 全局进度条 > 0
  const progressPct = await page.locator('.lp-global-progress__pct').textContent();
  expect(parseInt(progressPct)).toBeGreaterThan(0);

  // 7. EmptyState 不应出现
  await expect(page.locator('.es')).toHaveCount(0);
});

// ============================================================================
// Case 2: 全部完成状态
// ============================================================================

test('Case 2: 全部完成 — EmptyState("本周任务都完成啦") / 进度 100%', async ({ page, context }) => {
  await injectAuthToken(context);
  await mockApi(page, MOCK_COMPLETED);

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  // 100% 完成走 EmptyState 路径（mock 含 empty_state）
  await page.waitForSelector('.es', { state: 'visible', timeout: 8000 });

  // 1. EmptyState 可见
  const emptyState = page.locator('.es');
  await expect(emptyState).toBeVisible();
  // 标题含"完成"（mock 标题"本周任务都完成啦"）
  await expect(emptyState.locator('.es__title')).toContainText('完成');

  // 2. 主 CTA = 错题本
  await expect(emptyState.locator('.es-cta--primary')).toContainText('错题本');
});

// ============================================================================
// Case 3: 新用户空状态
// ============================================================================

test('Case 3: 新用户空状态 — EmptyState 渲染 / CTA 指向诊断或拍照', async ({ page, context }) => {
  await injectAuthToken(context);
  await mockApi(page, MOCK_EMPTY);

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForSelector('.es', { state: 'visible', timeout: 8000 });

  // 1. EmptyState 可见 + scenario 标识
  const emptyState = page.locator('.es');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveAttribute('data-es-scenario', 'newUser');

  // 2. 标题含"路径"或"准备"
  const titleText = await emptyState.locator('.es__title').textContent();
  expect(titleText).toMatch(/路径|准备/);

  // 3. 2 个 CTA
  const ctas = emptyState.locator('.es__cta-row > *');
  await expect(ctas).toHaveCount(2);

  // 4. 主 CTA 含"诊断"或"拍照"
  const primaryText = await emptyState.locator('.es-cta--primary').textContent();
  expect(primaryText).toMatch(/诊断|拍照/);
});

// ============================================================================
// Case 4: 401 鉴权拦截
// ============================================================================

test('Case 4: 401 鉴权 — authGuard 清除 token + 跳转 login.html', async ({ page, context }) => {
  // 拦截 401（不注入 token，验证纯 401 路径）
  await mockApi(page, 401);

  await page.goto(PAGE_URL, { waitUntil: 'load' });

  // 等待 redirect 到 login.html
  await page.waitForURL(/login\.html/, { timeout: 5000 });
  expect(page.url()).toContain('login.html');
});
