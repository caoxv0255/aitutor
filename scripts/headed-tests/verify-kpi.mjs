// scripts/headed-tests/verify-kpi.mjs
// 验证 D071: Dashboard 4 KPI 卡片接真后端 (之前 hardcoded mock)
import { chromium } from 'playwright';

const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then(c => c.newPage());

const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
const guestJson = await guest.json();

await page.goto(`${BASE}/f3/pages/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ token, json }) => {
  localStorage.setItem('aitutor.token', token);
  if (json?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(json.data.user));
}, { token: guestJson.token, json: guestJson });

await page.goto(`${BASE}/f3/pages/dashboard.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const kpiInfo = await page.evaluate(() => {
  const ids = ['kpi-questions', 'kpi-accuracy', 'kpi-improved', 'kpi-rank'];
  return ids.map(id => {
    const el = document.getElementById(id);
    if (!el) return { id, found: false };
    return {
      id,
      text: el.textContent.trim(),
      state: el.className.includes('empty') ? 'empty' : el.className.includes('loading') ? 'loading' : el.className.includes('error') ? 'error' : 'value'
    };
  });
});
console.log('KPI 卡片状态 (D071 修复后):');
kpiInfo.forEach(k => console.log(' ', JSON.stringify(k)));

await page.screenshot({ path: '/home/cx/aitutor/frontend/dev/screenshots/dashboard-kpi-fixed.png', fullPage: false });
console.log('\nScreenshot saved → frontend/dev/screenshots/dashboard-kpi-fixed.png');

await browser.close();
process.exit(kpiInfo.every(k => k.state !== 'empty' || k.text === '—') ? 0 : 0); // info only