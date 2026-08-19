// scripts/headed-tests/run.mjs
// 2026-08-19 DSH agent: 真浏览器 (headed) 自动化测试 aitutor
//
// 双输出:
//   1. scripts/headed-tests/screenshots/   (历史位置, 老 CI 可能引用)
//   2. frontend/dev/screenshots/<run-id>/  (开发者中心 demo 页消费)
//
// 每次 run 产生一个 <run-id> 目录 + 一份 manifest.json, 前端 fetch 后渲染.
// index.json 列出所有 runs (按时间倒序).

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();
const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const LEGACY_OUT = resolve(ROOT, 'scripts/headed-tests/screenshots');
const DEV_OUT    = resolve(ROOT, 'frontend/dev');           // demo 页消费目录
const RUNS_DIR   = join(DEV_OUT, 'runs');
const INDEX_FILE = join(RUNS_DIR, 'index.json');
const SLOW = Number(process.env.SLOW || 200);

await mkdir(LEGACY_OUT, { recursive: true });
await mkdir(RUNS_DIR,   { recursive: true });

// run-id = YYYYMMDDTHHMMSS (人类可读 + 字典序时间序)
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

log('浏览器启动:', browser.version());
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
});
const page = await ctx.newPage();

const shots = []; // { step, file, url, status, consoleErrors, pageErrors, width, height }
page.on('console', m => { if (['error','warning'].includes(m.type())) log(`page-${m.type()}:`, m.text()); });
page.on('pageerror', e => log('pageerror:', e.message));

async function snap(step, url, extra = {}) {
  const file = `${shots.length + 1}-${step}.png`;
  await sleep(SLOW);
  await page.screenshot({ path: `${RUN_DIR}/${file}`, fullPage: true });
  await page.screenshot({ path: `${LEGACY_OUT}/${file}`, fullPage: true }); // 兼容老位置
  const size = page.viewportSize();
  const meta = {
    step, file,
    url: page.url(),
    requested: url,
    status: extra.status ?? null,
    consoleErrors: extra.consoleErrors ?? 0,
    pageErrors: extra.pageErrors ?? [],
    width: size.width, height: size.height,
    at: new Date().toISOString(),
  };
  shots.push(meta);
  log(`  📸 ${file} → ${meta.url} ${meta.status || ''}`);
}

try {
  // 1/6 health
  log('1/6 health');
  const h = await page.request.get(`${BASE}/api/health`);
  await snap('health', `${BASE}/api/health`, { status: h.status() });

  // 2/6 首页
  log('2/6 首页');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await snap('home', BASE);

  // 3/6 游客登录
  log('3/6 游客登录');
  const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
  const guestJson = await guest.json();
  if (!guestJson?.token) throw new Error('guest-login no token');
  await page.evaluate(t => localStorage.setItem('aitutor.token', t), guestJson.token);
  await snap('guest-login', `${BASE}/api/auth/guest-login`, { status: guest.status() });

  // 4/6 dashboard
  log('4/6 dashboard');
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
  await snap('dashboard', `${BASE}/dashboard.html`);

  // 5/6 错题本
  log('5/6 错题本');
  await page.goto(`${BASE}/wrong-book.html`, { waitUntil: 'domcontentloaded' });
  await snap('wrong-book', `${BASE}/wrong-book.html`);

  // 6/6 RAG
  log('6/6 RAG search');
  const rag = await page.request.post(`${BASE}/api/rag/search`, {
    headers: { Authorization: `Bearer ${guestJson.token}` },
    data: { query: '函数', top_k: 3, threshold: 0 },
  });
  const ragJson = await rag.json();
  await snap('rag-search', `${BASE}/api/rag/search`, {
    status: rag.status(),
    extra: { results: ragJson?.data?.results?.length ?? 0 },
  });

  // ── 写 manifest ──
  const manifest = {
    runId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    base: BASE,
    browser: browser.version(),
    shots,
  };
  // manifest 跟 runs/index.json 同级, demo 页 fetch ./runs/<runId>/manifest.json
  const MANIFEST_DIR = join(RUNS_DIR, runId);
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(join(MANIFEST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // ── 追加/维护 index.json (按时间倒序, 限制 50 条, 清理孤儿) ──
  let index = [];
  try {
    index = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
  } catch {}
  index.unshift({
    runId,
    startedAt: manifest.startedAt,
    finishedAt: manifest.finishedAt,
    shotsCount: shots.length,
    lastStep: shots.at(-1)?.step,
    lastUrl:  shots.at(-1)?.url,
  });
  // 清理孤儿 runId (manifest 文件不存在)
  index = await Promise.all(index.map(async r => {
    try {
      const { stat } = await import('node:fs/promises');
      await stat(join(RUNS_DIR, r.runId, 'manifest.json'));
      return r;
    } catch {
      return null;  // 孤儿
    }
  })).then(rs => rs.filter(Boolean));
  index = index.slice(0, 50);
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

  log(`全部 6 步完成 ✅, manifest → ${RUN_DIR}/manifest.json`);
} catch (err) {
  log('💥', err.message);
  await page.screenshot({ path: `${RUN_DIR}/99-error.png`, fullPage: true });
  await page.screenshot({ path: `${LEGACY_OUT}/99-error.png`, fullPage: true });
  process.exitCode = 1;
} finally {
  await sleep(500);
  await browser.close();
}