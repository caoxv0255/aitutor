// scripts/headed-tests/run.mjs
// 2026-08-19 DSH agent: 真浏览器 (headed) 自动化测试 aitutor — F3 生产版
//
// 关键修复 (vs 上一版): BASE 从 "/" 改为 "/f3/pages/"
// 真实生产版是 ai-tutor-frontend/ (D070 已迁移), serve 在 /f3/* 路径.
// 老 frontend/ 仍在根路径 (legacy), 但不应作为 E2E 测试目标.
//
// 数据流:
//   1. 截图:  scripts/headed-tests/screenshots/<step>.png (legacy 兼容位置)
//             frontend/dev/screenshots/<runId>/<step>.png (demo 页消费)
//   2. manifest: frontend/dev/runs/<runId>/manifest.json (run metadata)
//   3. index:    frontend/dev/runs/index.json (倒序最多 50, 清理孤儿)

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();
const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const F3   = `${BASE}/f3/pages`;                              // ← F3 真生产路径
const LEGACY_OUT = resolve(ROOT, 'scripts/headed-tests/screenshots');
const DEV_OUT    = resolve(ROOT, 'frontend/dev');
const RUNS_DIR   = join(DEV_OUT, 'runs');
const INDEX_FILE = join(RUNS_DIR, 'index.json');
const SLOW = Number(process.env.SLOW || 200);

await mkdir(LEGACY_OUT, { recursive: true });
await mkdir(RUNS_DIR,   { recursive: true });

const now = new Date();
const runId = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T');
const RUN_DIR = join(DEV_OUT, 'screenshots', runId);
await mkdir(RUN_DIR, { recursive: true });

function log(...a) { console.log(`[headed] ${new Date().toLocaleTimeString()}`, ...a); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: false,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--enable-features=UseOzonePlatform', '--ozone-platform=wayland',
  ],
});

log('浏览器启动:', browser.version(), 'F3 base:', F3);
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
});
const page = await ctx.newPage();

const shots = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) log(`page-${m.type()}:`, m.text()); });
page.on('pageerror', e => log('pageerror:', e.message));

async function snap(step, url, extra = {}) {
  const i = shots.length + 1;
  const file = `${i}-${step}.png`;
  await sleep(SLOW);
  await page.screenshot({ path: `${RUN_DIR}/${file}`, fullPage: true });
  await page.screenshot({ path: `${LEGACY_OUT}/${file}`, fullPage: true });
  const size = page.viewportSize();
  const meta = {
    step, file,
    url: page.url(),
    requested: url,
    status: extra.status ?? null,
    pageErrors: extra.pageErrors ?? [],
    width: size.width, height: size.height,
    at: new Date().toISOString(),
  };
  shots.push(meta);
  log(`  📸 ${file} → ${meta.url} ${meta.status || ''}`);
}

try {
  // 1/7 health
  log('1/7 health');
  const h = await page.request.get(`${BASE}/api/health`);
  await snap('health', `${BASE}/api/health`, { status: h.status() });

  // 2/7 F3 首页
  log('2/7 F3 首页');
  await page.goto(`${F3}/index.html`, { waitUntil: 'domcontentloaded' });
  await snap('f3-home', `${F3}/index.html`);

  // 3/7 游客登录 (走真后端, 不依赖前端 login UI)
  log('3/7 游客登录');
  const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
  const guestJson = await guest.json();
  if (!guestJson?.token) throw new Error('guest-login no token');
  // 把 token 注入 F3 origin 的 localStorage
  await page.goto(`${F3}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, json }) => {
    localStorage.setItem('aitutor.token', token);
    if (json?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(json.data.user));
  }, { token: guestJson.token, json: guestJson });
  await snap('guest-login', `${BASE}/api/auth/guest-login`, { status: guest.status() });

  // 4/7 F3 dashboard (真生产)
  log('4/7 F3 dashboard');
  await page.goto(`${F3}/dashboard.html`, { waitUntil: 'networkidle', timeout: 15_000 });
  await sleep(SLOW * 2);
  await snap('f3-dashboard', `${F3}/dashboard.html`);

  // 5/7 F3 错题本
  log('5/7 F3 错题本');
  await page.goto(`${F3}/wrong-book.html`, { waitUntil: 'domcontentloaded' });
  await sleep(SLOW);
  await snap('f3-wrong-book', `${F3}/wrong-book.html`);

  // 6/7 F3 掌握度
  log('6/7 F3 掌握度');
  await page.goto(`${F3}/mastery.html`, { waitUntil: 'domcontentloaded' });
  await sleep(SLOW);
  await snap('f3-mastery', `${F3}/mastery.html`);

  // 7/7 RAG search (后端 API, 真生产 D068)
  log('7/7 RAG search');
  const rag = await page.request.post(`${BASE}/api/rag/search`, {
    headers: { Authorization: `Bearer ${guestJson.token}` },
    data: { query: '函数', top_k: 3, threshold: 0 },
  });
  const ragJson = await rag.json();
  await snap('rag-search', `${BASE}/api/rag/search`, {
    status: rag.status(),
    extra: { results: ragJson?.data?.results?.length ?? 0 },
  });

  // ── 写 manifest (放 runs/<runId>/manifest.json) ──
  const manifest = {
    runId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    base: F3,
    browser: browser.version(),
    shots,
  };
  const MANIFEST_DIR = join(RUNS_DIR, runId);
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(join(MANIFEST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // ── 维护 index.json (倒序, 限制 50, 清理孤儿) ──
  let index = [];
  try { index = JSON.parse(await readFile(INDEX_FILE, 'utf8')); } catch {}
  index.unshift({
    runId, startedAt: manifest.startedAt, finishedAt: manifest.finishedAt,
    shotsCount: shots.length,
    lastStep: shots.at(-1)?.step,
    lastUrl:  shots.at(-1)?.url,
  });
  index = await Promise.all(index.map(async r => {
    try {
      const { stat } = await import('node:fs/promises');
      // 孤儿检测: manifest AND 截图目录都在才保留
      await stat(join(RUNS_DIR, r.runId, 'manifest.json'));
      await stat(join(DEV_OUT, 'screenshots', r.runId, '1-health.png'));
      return r;
    } catch { return null; }
  })).then(rs => rs.filter(Boolean));
  index = index.slice(0, 50);
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

  log(`全部 7 步完成 ✅, manifest → ${RUN_DIR}/manifest.json`);
} catch (err) {
  log('💥', err.message);
  await page.screenshot({ path: `${RUN_DIR}/99-error.png`, fullPage: true });
  await page.screenshot({ path: `${LEGACY_OUT}/99-error.png`, fullPage: true });
  process.exitCode = 1;
} finally {
  await sleep(500);
  await browser.close();
}