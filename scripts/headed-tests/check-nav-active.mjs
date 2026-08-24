// scripts/headed-tests/check-nav-active.mjs
// 验证 P0 修复: navator.js 在 28 个 F3 页面的 active 高亮是否生效
import { chromium } from 'playwright';

const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// 拿 token
const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
const guestJson = await guest.json();

// 注入 token
await page.goto(`${BASE}/f3/pages/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ token, json }) => {
  localStorage.setItem('aitutor.token', token);
  if (json?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(json.data.user));
}, { token: guestJson.token, json: guestJson });

const PAGES = [
  { file: 'index.html',                expect: 'home' },
  { file: 'dashboard.html',            expect: 'dash' },
  { file: 'mastery.html',              expect: 'mastery' },
  { file: 'tutor.html',                expect: 'tutor' },
  { file: 'wrong-book.html',           expect: 'wrong' },
  { file: 'review.html',               expect: 'review' },
  { file: 'vision.html',               expect: 'vision' },
  { file: 'exam-simulation.html',      expect: 'exam' },
  { file: 'learning-path.html',        expect: 'home' }, // 内容页默认 home
  { file: 'my-weak-points.html',       expect: 'home' },
  { file: 'methodology.html',          expect: 'home' },
];

console.log('F3 页面 nav active 高亮验证 (P0 修复后)\n');
console.log('页面'.padEnd(28), '期望'.padEnd(10), '实际'.padEnd(10), '状态');
console.log('─'.repeat(60));

let passed = 0;
let failed = 0;

for (const p of PAGES) {
  try {
    await page.goto(`${BASE}/f3/pages/${p.file}`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('nav#ait-topnav a[data-nav-key]'));
      const active = links.find(a => a.className.includes('bg-primary-50'));
      return {
        hasNav: links.length > 0,
        activeKey: active ? active.dataset.navKey : null,
      };
    });
    const ok = result.activeKey === p.expect;
    console.log(
      `${p.file.padEnd(26)} ${p.expect.padEnd(10)} ${(result.activeKey || 'NONE').padEnd(10)} ${ok ? '✓' : '✗'}`
    );
    if (ok) passed++; else failed++;
  } catch (e) {
    console.log(`${p.file.padEnd(26)} ${p.expect.padEnd(10)} ERROR     ✗ ${e.message.slice(0, 30)}`);
    failed++;
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`通过 ${passed}/${PAGES.length}  失败 ${failed}`);

await browser.close();
process.exit(failed > 0 ? 1 : 0);