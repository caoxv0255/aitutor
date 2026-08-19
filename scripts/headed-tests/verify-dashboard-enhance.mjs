// scripts/headed-tests/verify-dashboard-enhance.mjs
// headed 验证 F3 dashboard 增强
import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: false,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
         '--enable-features=UseOzonePlatform','--ozone-platform=wayland'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE-ERR:', e.message));
page.on('console', m => {
  if (m.type() === 'error') console.log('CON-ERR:', m.text());
  if (m.text().includes('[enhance]')) console.log('LOG:', m.text());
});

const OUT = '/home/cx/aitutor/scripts/headed-tests/screenshots';
const url = 'http://localhost:3002/f3/pages/dashboard.html';

// 1. 注入 token + 访问 dashboard
await page.goto('http://localhost:3002/f3/pages/index.html');
const guest = await page.request.post('http://localhost:3002/api/auth/guest-login', { data: {} });
const guestJson = await guest.json();
await page.evaluate(({ t, j }) => {
  localStorage.setItem('aitutor.token', t);
  if (j?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(j.data.user));
}, { t: guestJson.token, j: guestJson });

await page.goto(url, { waitUntil: 'networkidle' });
console.log('Loaded:', page.url(), 'h1:', await page.locator('h1').first().textContent());

// 2. 等 count-up 完成 + stagger
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/enhance-01-dashboard.png`, fullPage: true });
console.log('📸 enhance-01-dashboard.png');

// 3. hover 一个 summary 卡 (看抬升 + arrow)
const summary = page.locator('main .grid.grid-cols-2').first().locator('> div').first();
await summary.hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/enhance-02-summary-hover.png`, fullPage: false });
console.log('📸 enhance-02-summary-hover.png');

// 4. hover KPI trend badge (看 tooltip)
const trendBadge = page.locator('main .grid.grid-cols-2').nth(1).locator('> div').first()
  .locator('.inline-flex.items-center.gap-0\\.5.px-2');
await trendBadge.hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/enhance-03-trend-tooltip.png`, fullPage: false });
console.log('📸 enhance-03-trend-tooltip.png');

// 5. hover 柱状图柱 (看日期 tooltip + 今日标签)
const bars = page.locator('main .rounded-t-md');
const barCount = await bars.count();
console.log('柱数:', barCount);
if (barCount > 0) {
  // 找今天的那一柱(周六索引5)
  await bars.nth(5).hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/enhance-04-bar-hover.png`, fullPage: false });
  console.log('📸 enhance-04-bar-hover.png');
}

// 6. 热力图 cell hover
const heatCells = page.locator('main .aspect-square');
const hcCount = await heatCells.count();
console.log('热力图 cell 数:', hcCount);
if (hcCount > 0) {
  await heatCells.nth(15).hover();  // 选一个中间位置的cell
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/enhance-05-heatmap-tooltip.png`, fullPage: false });
  console.log('📸 enhance-05-heatmap-tooltip.png');
}

await browser.close();
console.log('done');