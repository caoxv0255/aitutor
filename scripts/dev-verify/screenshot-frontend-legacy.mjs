#!/usr/bin/env node
// scripts/dev-verify/screenshot-frontend-legacy.mjs
// 截图 frontend/ 旧前端 (非 F3) dashboard.html (systemd 跑在 :3002)

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

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/frontend/dashboard.html', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const out = path.join(OUT_DIR, 'screenshot-frontend-dashboard.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log('✓ ' + out);
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
