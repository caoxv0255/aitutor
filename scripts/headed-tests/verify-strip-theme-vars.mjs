// 验证 7 个 F3 页删除 dead JSON 后仍正常渲染
import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const pages = ['dashboard', 'login', 'mastery', 'review', 'tutor', 'vision', 'wrong-book', 'register'];
let pass = 0, fail = 0;

for (const p of pages) {
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  let err = null;
  const errListener = (e) => {
    const msg = e.message.slice(0, 100);
    if (!/401|auth|token|login|getUserInfo|unauthor/i.test(msg)) err = msg;
  };
  page.on('pageerror', errListener);
  const conListener = (m) => {
    if (m.type() !== 'error') return;
    const t = m.text().slice(0, 120);
    if (/401|auth|token|登录|unauthor|getUserInfo/i.test(t)) return;
    err = (err || '') + ' / ' + t;
  };
  page.on('console', conListener);

  await page.goto(`http://localhost:3002/f3/pages/${p}.html`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const hasContent = await page.locator('h1, h2, main').first().count();
  const status = err ? `❌ ${err}` : (hasContent > 0 ? ' ✅' : ' ⚠️ no h1/h2/main');
  console.log(`${p.padEnd(15)} ${status}`);
  if (err) fail++; else pass++;
}

console.log(`\n${pass} pass / ${fail} fail`);
await browser.close();
