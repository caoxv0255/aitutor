// scripts/headed-tests/verify-gallery.mjs
// 一次性: 用 headed Chromium 打开 demo 页, 截图验证 UX

import { chromium } from 'playwright';
import { resolve } from 'node:path';
const OUT = resolve(process.cwd(), 'scripts/headed-tests/screenshots');
const browser = await chromium.launch({
  headless: false,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
         '--enable-features=UseOzonePlatform','--ozone-platform=wayland'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('page-error:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('console-error:', m.text()); });

await page.goto('http://localhost:3002/dev/headed-gallery.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 全页截图
await page.screenshot({ path: `${OUT}/dev-gallery-full.png`, fullPage: true });
console.log('📸 full page');

// 滚动到 diff 区块
await page.locator('#diff').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/dev-gallery-diff.png`, fullPage: false });
console.log('📸 diff section');

// 模拟点击一张缩略图, 看 lightbox
await page.locator('#gallery').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.locator('.hg-shot').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/dev-gallery-lightbox.png`, fullPage: false });
console.log('📸 lightbox');

await browser.close();
console.log('done');