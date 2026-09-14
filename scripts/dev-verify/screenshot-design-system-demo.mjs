#!/usr/bin/env node
// scripts/dev-verify/screenshot-design-system-demo.mjs
// D093: 用 demo-design-system.html (静态) 截图 3 状态 × 2 主题 + focus

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'audits');
const BASE = 'http://localhost:3002';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function shoot(page, name) {
  await page.waitForTimeout(300);
  const out = path.join(OUT_DIR, name);
  await page.screenshot({ path: out, fullPage: true });
  console.log('✓ ' + out);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 200)); });

  // 1-2) 浅色 normal + hover
  await page.goto(BASE + '/f3/pages/demo-design-system.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(1500);
  await shoot(page, 'design-system-1-light-normal.png');

  // 浅色 hover 第一张卡片
  await page.hover('.ds-card').catch(() => console.log('  hover skip'));
  await page.waitForTimeout(200);
  await shoot(page, 'design-system-2-light-hover.png');

  // 浅色 hover 第二个按钮 (主按钮 hover)
  await page.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
  await page.mouse.move(100, 100);
  const btn = await page.$$('.ds-btn');
  if (btn[1]) {
    await btn[1].hover();
    await shoot(page, 'design-system-3-light-hover-btn.png');
  }

  // 浅色 active (鼠标按住)
  if (btn[2]) {
    await btn[2].hover();
    await page.mouse.down();
    await page.waitForTimeout(200);
    await shoot(page, 'design-system-4-light-active.png');
    await page.mouse.up();
  }

  // 浅色 focus (Tab 键)
  await page.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await shoot(page, 'design-system-5-light-focus.png');

  // 6) 切换深色
  await page.click('#themeToggle');
  await page.waitForTimeout(800);
  await shoot(page, 'design-system-6-dark-normal.png');

  // 深色 hover
  await page.hover('.ds-card').catch(() => {});
  await page.waitForTimeout(200);
  await shoot(page, 'design-system-7-dark-hover.png');

  // 深色 hover 主按钮
  const btnDark = await page.$$('.ds-btn');
  if (btnDark[1]) {
    await btnDark[1].hover();
    await shoot(page, 'design-system-8-dark-hover-btn.png');
  }

  // 深色 active
  if (btnDark[2]) {
    await btnDark[2].hover();
    await page.mouse.down();
    await page.waitForTimeout(200);
    await shoot(page, 'design-system-9-dark-active.png');
    await page.mouse.up();
  }

  // 深色 focus
  await page.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await shoot(page, 'design-system-10-dark-focus.png');

  await browser.close();
  console.log('\n=== 设计系统 Demo 截图完成 (10 张) ===');
}

main().catch(e => { console.error(e); process.exit(1); });
