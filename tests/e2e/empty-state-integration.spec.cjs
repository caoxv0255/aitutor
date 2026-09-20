/* ============================================================================
 * V1.0 · EmptyState 全局集成 E2E
 *
 * 守护 3 个核心页面在空数据态下正确渲染 EmptyState：
 *   Case 1: wrong-book.html (scenario='wrongBook')
 *   Case 2: review.html     (scenario='reviewDone')
 *   Case 3: mastery.html   (scenario='abilityMap')
 *
 * 跑：npx playwright test tests/e2e/empty-state-integration.spec.cjs
 * ============================================================================ */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

// 本地 server（端口 38920-38930 兜底）
let server;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/learning-path.html';
      const fp = path.join(FRONTEND_DIR, p);
      if (!fp.startsWith(FRONTEND_DIR)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp);
      const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json' };
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
      res.end(fs.readFileSync(fp));
    } catch (e) { res.writeHead(500); res.end('Server Error'); }
  });
  const tryPorts = [38920, 38921, 38922, 38923, 38924, 38925, 38926, 38927, 38928, 38929, 38930];
  for (const p of tryPorts) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, () => resolve());
      });
      global.TEST_BASE_URL = `http://localhost:${p}`;
      break;
    } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

async function setup(context, apiPath, mockBody) {
  await context.addInitScript(() => {
    localStorage.setItem('token', 'mock-jwt');
    localStorage.setItem('user', JSON.stringify({ email: 'e2e@local' }));
  });
  // 注意：尾部加 ** 是为了匹配 ?subject=... & 其他 query string
  await context.route('**' + apiPath + '**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: typeof mockBody === 'string' ? mockBody : JSON.stringify(mockBody)
    });
  });
}

// ============================================================================
// Case 1: wrong-book.html 空数据 → EmptyState("wrongBook")
// ============================================================================
test('Case 1: 错题本空 → EmptyState 渲染 + 标题含"错题"', async ({ page, context }) => {
  await setup(context, '/api/questions', '[]');
  await page.goto(global.TEST_BASE_URL + '/wrong-book.html', { waitUntil: 'load' });
  await page.waitForSelector('.es', { state: 'visible', timeout: 8000 });

  const es = page.locator('.es');
  await expect(es).toBeVisible();
  await expect(es).toHaveAttribute('data-es-scenario', 'wrongBook');
  // 标题含"错题"
  const title = await es.locator('.es__title').textContent();
  expect(title).toMatch(/错题/);
  // 主 CTA = 拍一道题
  await expect(es.locator('.es-cta--primary')).toContainText('拍一道题');
});

// ============================================================================
// Case 2: review.html SRS 队列空 → EmptyState("reviewDone")
// ============================================================================
test('Case 2: 复习队列空 → EmptyState 渲染 + 标题含"完成"', async ({ page, context }) => {
  // SRS 队列空 → API 返回 data.cards=[]
  await setup(context, '/api/reviews/today', { success: true, data: { cards: [] } });
  await page.goto(global.TEST_BASE_URL + '/review.html', { waitUntil: 'load' });
  await page.waitForSelector('.es', { state: 'visible', timeout: 8000 });

  const es = page.locator('.es');
  await expect(es).toBeVisible();
  await expect(es).toHaveAttribute('data-es-scenario', 'reviewDone');
  // 标题含"完成"
  const title = await es.locator('.es__title').textContent();
  expect(title).toMatch(/完成/);
  // 主 CTA = 返回首页
  await expect(es.locator('.es-cta--primary')).toContainText('首页');
});

// ============================================================================
// Case 3: mastery.html 图谱为空 → EmptyState("abilityMap")
// ============================================================================
test('Case 3: 能力图谱空 → EmptyState 渲染 + 标题含"图谱"', async ({ page, context }) => {
  // mastery-graph API 返回 data.nodes=[]
  await setup(context, '/api/mastery/graph', { success: true, data: { nodes: [] } });
  await page.goto(global.TEST_BASE_URL + '/mastery.html', { waitUntil: 'load' });
  await page.waitForSelector('.es', { state: 'visible', timeout: 8000 });

  const es = page.locator('.es');
  await expect(es).toBeVisible();
  await expect(es).toHaveAttribute('data-es-scenario', 'abilityMap');
  // 标题含"图谱"
  const title = await es.locator('.es__title').textContent();
  expect(title).toMatch(/图谱|星空/);
  // 主 CTA = 去做几道题
  await expect(es.locator('.es-cta--primary')).toContainText(/几道题|诊断/);
});
