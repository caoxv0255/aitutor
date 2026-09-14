#!/usr/bin/env node
// scripts/dev-verify/screenshot-frontend-loop.mjs
// D089-front-loop-2026-09-14: Playwright 截图验证 (含 auth)

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'audits');
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const TEST_EMAIL = `verify_${Date.now()}@test.local`;
const TEST_PWD = 'verifyPass123!';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function ensureToken() {
  // 先尝试注册 (可能失败, 因为已存在)
  const regRes = await fetch(BASE + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PWD,
      name: 'DSH Verify',
      grade: '高一'
    })
  });
  const regJ = await regRes.json().catch(() => ({}));
  let token = regJ?.data?.token || regJ?.token;
  if (!token) {
    // 注册失败 (可能已存在), 尝试登录
    console.log('  [register failed: ' + (regJ.message || regRes.status) + '], try login');
    const loginRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PWD })
    });
    const loginJ = await loginRes.json().catch(() => ({}));
    token = loginJ?.data?.token || loginJ?.token;
    if (!token) throw new Error('无法获取 token: register=' + (regJ.message || regRes.status) + ' login=' + (loginJ.message || loginRes.status));
  }
  console.log('  [token] ' + token.slice(0, 20) + '... (' + TEST_EMAIL + ')');
  return token;
}

async function main() {
  console.log('=== Playwright 截图验证 (含 auth) ===');
  console.log('BASE = ' + BASE);
  const token = await ensureToken();

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  // 提前注入 token + user 到 localStorage (避免被重定向登录)
  await context.addInitScript(({ token, email }) => {
    localStorage.setItem('aitutor.token', token);
    localStorage.setItem('aitutor.user', JSON.stringify({ email, name: 'DSH Verify', grade: '高一' }));
  }, { token, email: TEST_EMAIL });
  const page = await context.newPage();
  page.on('console', msg => console.log('    [browser/' + msg.type() + '] ' + msg.text().slice(0, 200)));
  page.on('pageerror', err => console.log('    [pageerror] ' + err.message.slice(0, 200)));
  page.on('response', r => {
    if (r.status() === 401) console.log('    [401] ' + r.url());
  });
  // 先访问 login 触发 auth.js 加载, 再注入 token
  await page.goto(BASE + '/f3/pages/login.html', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.evaluate(({ t, e }) => {
    localStorage.setItem('aitutor.token', t);
    localStorage.setItem('aitutor.user', JSON.stringify({ email: e, name: 'DSH Verify', grade: '高一' }));
  }, { t: token, e: TEST_EMAIL });
  // 直接 eval 测试 token 是否真能用
  const probe = await page.evaluate(async (b) => {
    const t = localStorage.getItem('aitutor.token');
    const r = await fetch(b + '/api/exam/questions?subject=math&limit=2', { headers: { 'Authorization': 'Bearer ' + t } });
    return { status: r.status, len: (await r.text()).length };
  }, BASE);
  console.log('  [probe] ' + JSON.stringify(probe));

  const targets = [
    { url: '/f3/pages/dashboard.html', file: 'screenshot-dashboard.png', wait: 3500 },
    { url: '/f3/pages/question-bank.html?subject=math', file: 'screenshot-question-bank-math.png', wait: 3500, clickFirstQuestion: true, postClickWait: 2500, fileAfter: 'screenshot-question-bank-detail.png' },
    { url: '/f3/pages/math-exam.html', file: 'screenshot-math-exam-cta.png', wait: 1500 },
    { url: '/f3/pages/wrong-book.html', file: 'screenshot-wrong-book.png', wait: 3500 },
  ];
  for (const t of targets) {
    console.log('  → ' + t.url);
    await page.goto(BASE + t.url, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('    networkidle timeout: ' + e.message));
    await page.waitForTimeout(t.wait);
    const out = path.join(OUT_DIR, t.file);
    await page.screenshot({ path: out, fullPage: true });
    console.log('    ✓ ' + out);
    if (t.clickFirstQuestion) {
      const card = await page.$('.qb-card[data-qid]');
      if (card) {
        await card.click();
        await page.waitForTimeout(t.postClickWait || 2500);
        const out2 = path.join(OUT_DIR, t.fileAfter);
        await page.screenshot({ path: out2, fullPage: false });
        console.log('    ✓ (after click) ' + out2);
      } else {
        console.log('    ⚠ no .qb-card[data-qid] found');
      }
    }
  }
  await browser.close();
  console.log('\n=== 截图完成 ===');
}

main().catch(e => { console.error('[FATAL]', e); process.exit(2); });
