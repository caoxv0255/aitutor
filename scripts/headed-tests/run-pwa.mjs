// scripts/headed-tests/run-pwa.mjs
// PWA 端 mobile viewport 截图 + 品牌色验证
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();
const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const PWA = `${BASE}/`;  // PWA 根路径
const DEV_OUT = resolve(ROOT, 'frontend/dev');
const RUNS_DIR = join(DEV_OUT, 'runs');
const INDEX_FILE = join(RUNS_DIR, 'index.json');
const SLOW = Number(process.env.SLOW || 300);

const now = new Date();
const runId = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T');
const RUN_DIR = join(DEV_OUT, 'screenshots', runId);
await mkdir(RUN_DIR, { recursive: true });

function log(...a) { console.log(`[pwa] ${new Date().toLocaleTimeString()}`, ...a); }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

log('PWA mobile viewport 启动:', browser.version());
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 14 Pro viewport
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  locale: 'zh-CN',
});
const page = await ctx.newPage();

const shots = [];
async function snap(step, url, opts = {}) {
  const i = shots.length + 1;
  const file = `${String(i).padStart(2, '0')}-pwa-${step}.png`;
  await page.waitForTimeout(SLOW);
  await page.screenshot({ path: `${RUN_DIR}/${file}`, fullPage: opts.fullPage ?? false });
  shots.push({ step, file, url: page.url(), at: new Date().toISOString() });
  log(`  📸 ${file} → ${page.url()}`);
}

try {
  // 1. PWA 首屏 (login/menu)
  log('1/N PWA 首屏');
  await page.goto(PWA, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(SLOW * 2);
  await snap('menu', PWA);

  // 2. 游客登录
  log('2/N 游客登录');
  const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
  const guestJson = await guest.json();
  if (!guestJson?.token) throw new Error('guest-login no token');
  await page.evaluate(({ token, json }) => {
    localStorage.setItem('aitutor.token', token);
    if (json?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(json.data.user));
  }, { token: guestJson.token, json: guestJson });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(SLOW * 2);
  await snap('after-login', PWA);

  // 3. 点击拍照搜题菜单 (可能跳 photoPicker)
  log('3/N 拍照搜题菜单');
  // 找 menu-card 拍照
  await page.evaluate(() => {
    const card = document.getElementById('cameraBtn');
    if (card) card.click();
  });
  await page.waitForTimeout(SLOW);
  await snap('photo-picker', PWA);

  // 4. theme-color 验证
  const themeColor = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media*="dark"])');
    return meta ? meta.getAttribute('content') : null;
  });
  log(`  theme-color (light) = ${themeColor}`);

  // 5. .btn-primary 验证 (brand color applied)
  const btnBg = await page.evaluate(() => {
    const btn = document.querySelector('.btn-primary');
    if (!btn) return null;
    return getComputedStyle(btn).backgroundColor;
  });
  log(`  .btn-primary background = ${btnBg}`);

  // 写 manifest
  const manifest = {
    runId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    base: PWA,
    browser: browser.version(),
    shots,
    summary: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      themeColor,
      btnPrimaryBg: btnBg,
    },
  };
  const MANIFEST_DIR = join(RUNS_DIR, runId);
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(join(MANIFEST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // 维护 index.json
  let index = [];
  try { index = JSON.parse(await readFile(INDEX_FILE, 'utf8')); } catch {}
  index.unshift({
    runId,
    startedAt: manifest.startedAt,
    finishedAt: manifest.finishedAt,
    shotsCount: shots.length,
    lastStep: shots.at(-1)?.step,
    lastUrl: shots.at(-1)?.url,
  });
  index = index.slice(0, 50);
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

  log(`✅ PWA run 完成: ${shots.length} 张截图, theme-color=${themeColor}, btn=${btnBg}`);
} catch (err) {
  log('💥', err.message);
  process.exitCode = 1;
} finally {
  await page.waitForTimeout(300);
  await browser.close();
}
