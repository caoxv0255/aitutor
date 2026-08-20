// scripts/headed-tests/verify-all-nav-buttons.mjs
// 2026-08-20: 扫描所有 F3 页的导航/返回按钮, 检测"点了跳错页 / 跳回 login / 卡死"问题
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const results = [];
let totalButtons = 0, totalErrors = 0;

const TEST_CASES = [
  // 入口页 (未登录)
  { url: 'register', mode: 'anon', selectors: [
    { sel: '[data-dom-id="back-home"]', desc: '返回首页', expectContains: '/f3/pages/index.html' },
    { sel: 'a[href*="login"]', desc: '立即登录链接', expectContains: '/f3/pages/login.html' },
  ]},
  { url: 'login', mode: 'anon', selectors: [
    { sel: '[data-dom-id="back-home"]', desc: '返回首页', expectContains: '/f3/pages/index.html' },
    { sel: 'a[href*="register"]', desc: '立即注册', expectContains: '/f3/pages/register.html' },
  ]},
  { url: 'index', mode: 'anon', selectors: [] },
  // 内部页 (已登录)
  { url: 'dashboard', mode: 'auth', selectors: [
    { sel: 'a[href="index.html"]', desc: '面包屑-首页', expectContains: '/f3/pages/index.html' },
  ]},
  { url: 'tutor', mode: 'auth', selectors: [] },
  { url: 'wrong-book', mode: 'auth', selectors: [] },
  { url: 'mastery', mode: 'auth', selectors: [] },
  { url: 'review', mode: 'auth', selectors: [] },
  { url: 'vision', mode: 'auth', selectors: [] },
];

async function ensureLoggedIn() {
  // 调用 guest-login API 拿 token
  const r = await ctx.request.post('http://localhost:3002/api/auth/guest-login', { data: {} });
  const j = await r.json();
  // 写入所有 source (index.html 会读 localStorage)
  await page.goto('http://localhost:3002/f3/pages/index.html');
  await page.evaluate(t => localStorage.setItem('aitutor.token', t), j.token);
}

for (const tc of TEST_CASES) {
  const targetUrl = `http://localhost:3002/f3/pages/${tc.url}.html`;
  // 1. 准备 (登录 / 清 token)
  if (tc.mode === 'auth') {
    await ensureLoggedIn();
  } else {
    // 清掉 token, 保证 anon
    await page.goto('http://localhost:3002/f3/pages/index.html', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('aitutor.token'));
  }
  // 2. 访问目标
  page.removeAllListeners('framenavigated');
  const navs = [];
  page.on('framenavigated', f => navs.push(f.url().replace('http://localhost:3002', '')));
  try {
    await page.goto(targetUrl, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
  } catch (e) {
    results.push({ url: tc.url, status: `❌ goto 失败: ${e.message.slice(0, 80)}` });
    totalErrors++;
    continue;
  }
  // 3. anon 模式: 检查"页面是否被自动重定向到 login"
  if (tc.mode === 'anon' && page.url().includes('login.html') && !targetUrl.includes('login')) {
    results.push({ url: tc.url, status: '❌ 页面被自动重定向到 login (未登录守卫误触发)' });
    totalErrors++;
    continue;
  }
  // 4. 测每个 selector
  for (const sel of tc.selectors) {
    totalButtons++;
    const el = page.locator(sel.sel).first();
    const exists = await el.count();
    if (exists === 0) {
      results.push({ url: tc.url, btn: sel.desc, status: '⚠️ selector 不存在' });
      continue;
    }
    const visible = await el.isVisible().catch(() => false);
    if (!visible) {
      results.push({ url: tc.url, btn: sel.desc, status: '⚠️ 不可见' });
      continue;
    }
    try {
      await el.click();
      await page.waitForTimeout(1500);
      const afterUrl = page.url();
      const reached = sel.expectContains && afterUrl.includes(sel.expectContains);
      const finalUrlShort = afterUrl.replace('http://localhost:3002', '');
      results.push({
        url: tc.url, btn: sel.desc,
        status: reached ? '✅' : `❌ 跳到 ${finalUrlShort} (期望含 ${sel.expectContains})`,
      });
      if (!reached) totalErrors++;
      // 回到测试页 (如果跳走了)
      if (!finalUrlShort.includes(tc.url + '.html') && !finalUrlShort.endsWith(tc.url + '/')) {
        await page.goto(targetUrl, { waitUntil: 'load' });
        await page.waitForTimeout(500);
      }
    } catch (e) {
      results.push({ url: tc.url, btn: sel.desc, status: `❌ click err: ${e.message.slice(0, 60)}` });
      totalErrors++;
    }
  }
  // 5. 总评
  if (tc.selectors.length === 0) {
    if (page.url().includes('login.html') && tc.mode === 'anon' && !targetUrl.includes('login')) {
      results.push({ url: tc.url, status: '❌ 页面自动跳 login' });
      totalErrors++;
    } else if (page.url().includes('login.html') && tc.mode === 'auth') {
      results.push({ url: tc.url, status: '❌ 已登录却跳到 login (auth guard 误触发)' });
      totalErrors++;
    } else {
      results.push({ url: tc.url, status: '✅ 无跳转问题' });
    }
  }
}

console.log('\n===== F3 导航按钮 audit =====');
for (const r of results) {
  const who = r.btn ? `${r.url} · ${r.btn}` : r.url;
  console.log(`  ${who.padEnd(50)} ${r.status}`);
}
console.log(`\n${totalButtons} 按钮 / ${totalErrors} 错误`);
await browser.close();
process.exit(totalErrors > 0 ? 1 : 0);