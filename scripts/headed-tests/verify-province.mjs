// scripts/headed-tests/verify-province.mjs
// 验证 D072: PWA 省份选择增强 (分组 + 搜索 + 空数据降级)
import { chromium } from 'playwright';

const BASE = 'http://localhost:3002';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
const guestJson = await guest.json();

// 进 PWA + 注入 PWA 风格的 token (authToken + currentUser + currentGrade 三键)
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((token) => {
  localStorage.setItem('authToken', token);
  localStorage.setItem('currentUser', 'guest@aitutor.local');
  localStorage.setItem('currentGrade', '高中');
}, guestJson.token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// 跳到省份选择页
await page.evaluate(() => document.getElementById('provinceSelectBtn')?.click());
await page.waitForTimeout(1500);

// 检查高考列表 + 分组 + 搜索
const gaokaoState = await page.evaluate(() => {
  const items = document.querySelectorAll('.province-item');
  const groups = document.querySelectorAll('.province-group');
  const search = document.getElementById('provinceSearch');
  return {
    itemCount: items.length,
    groupCount: groups.length,
    regions: Array.from(groups).map(g => g.dataset.region),
    hasSearch: !!search,
  };
});
console.log('=== gaokao state ===');
console.log(JSON.stringify(gaokaoState, null, 2));

// 测试搜索 "上海"
await page.evaluate(() => {
  const search = document.getElementById('provinceSearch');
  search.value = '上海';
  search.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(300);
const afterSearch = await page.evaluate(() => {
  const visible = Array.from(document.querySelectorAll('.province-item')).filter(i => i.style.display !== 'none');
  return { visibleCount: visible.length, names: visible.map(i => i.dataset.name) };
});
console.log('\n=== After search "上海" ===');
console.log(JSON.stringify(afterSearch, null, 2));

// 截图 gaokao
await page.evaluate(() => {
  const search = document.getElementById('provinceSearch');
  search.value = '';
  search.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/cx/aitutor/frontend/dev/screenshots/pwa-province-gaokao.png', fullPage: false });

// 切到中考
await page.evaluate(() => {
  const sel = document.getElementById('examLevelSelect');
  sel.value = 'zhongkao';
  sel.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(1500);

const zhongkaoState = await page.evaluate(() => {
  const items = document.querySelectorAll('.province-item');
  const groups = document.querySelectorAll('.province-group');
  return {
    itemCount: items.length,
    groupCount: groups.length,
    regions: Array.from(groups).map(g => g.dataset.region),
    firstItem: items[0]?.dataset.name,
  };
});
console.log('\n=== zhongkao state ===');
console.log(JSON.stringify(zhongkaoState, null, 2));

await page.screenshot({ path: '/home/cx/aitutor/frontend/dev/screenshots/pwa-province-zhongkao.png', fullPage: false });

// 测试选 + 确认
await page.evaluate(() => {
  const first = document.querySelector('.province-item');
  if (first) first.click();
});
await page.waitForTimeout(500);
await page.evaluate(() => document.getElementById('confirmProvinceBtn')?.click());
await page.waitForTimeout(2500);

const afterConfirm = await page.evaluate(() => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return {
    page: document.querySelector('h1')?.textContent || document.querySelector('h2')?.textContent,
    province: user.province,
    examLevel: user.exam_level,
  };
});
console.log('\n=== After confirm ===');
console.log(JSON.stringify(afterConfirm, null, 2));

console.log('\n=== Console errors ===');
console.log(errors.length ? errors.join('\n') : '  (none)');

await browser.close();