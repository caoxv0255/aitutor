// scripts/headed-tests/run-all.mjs
// 2026-08-24: 扩展 run.mjs, 覆盖所有 24 个 F3 页面
// 目的: 实现 M3 Agentic 工作流的"视觉反馈闭环"基础设施
// 用法:
//   AITUTOR_BASE=http://localhost:3002 node scripts/headed-tests/run-all.mjs
//
// 与 run.mjs 区别:
// - 覆盖 F3 全 24 页 (run.mjs 仅 7 页)
// - 失败 page error 不 throw, 收集到 manifest 便于审查 Agent 评估
// - 输出 frontend/dev/runs/<runId>/manifest.json + frontend/dev/screenshots/<runId>/*.png

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();
const BASE = process.env.AITUTOR_BASE || 'http://localhost:3002';
const F3 = `${BASE}/f3/pages`;
const LEGACY_OUT = resolve(ROOT, 'scripts/headed-tests/screenshots');
const DEV_OUT = resolve(ROOT, 'frontend/dev');
const RUNS_DIR = join(DEV_OUT, 'runs');
const INDEX_FILE = join(RUNS_DIR, 'index.json');
const SLOW = Number(process.env.SLOW || 200);

await mkdir(LEGACY_OUT, { recursive: true });
await mkdir(RUNS_DIR, { recursive: true });

const now = new Date();
const runId = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T');
const RUN_DIR = join(DEV_OUT, 'screenshots', runId);
await mkdir(RUN_DIR, { recursive: true });

function log(...a) { console.log(`[headed-all] ${new Date().toLocaleTimeString()}`, ...a); }
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
const allErrors = [];
page.on('console', m => {
  if (['error', 'warning'].includes(m.type())) {
    log(`page-${m.type()}:`, m.text());
    allErrors.push({ type: m.type(), text: m.text() });
  }
});
page.on('pageerror', e => {
  log('pageerror:', e.message);
  allErrors.push({ type: 'pageerror', text: e.message });
});

async function snap(step, url, extra = {}) {
  const i = shots.length + 1;
  const file = `${String(i).padStart(2, '0')}-${step}.png`;
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

async function snapPage(step, url, opts = {}) {
  try {
    await page.goto(url, { waitUntil: opts.waitUntil || 'domcontentloaded', timeout: opts.timeout || 15_000 });
    await sleep(opts.delay || SLOW);
    await snap(step, url);
  } catch (e) {
    log(`  ⚠️ ${step} failed: ${e.message}`);
    await snap(step, url, { pageErrors: [e.message] });
  }
}

// ─── 24 个 F3 页面列表 ───
// 顺序: 公共 → 登录/注册 → Dashboard 系列 → 内容消费 → 内容生产
const PAGES = [
  // 公共首页
  { step: 'home',           path: 'index.html',              auth: false },
  // 登录/注册
  { step: 'login',          path: 'login.html',              auth: false },
  { step: 'register',       path: 'register.html',           auth: false },
  // Dashboard Shell (登录后)
  { step: 'dashboard',      path: 'dashboard.html',          auth: true },
  { step: 'mastery',        path: 'mastery.html',            auth: true },
  // Workspace Shell
  { step: 'tutor',          path: 'tutor.html',              auth: true },
  // Hybrid Shell
  { step: 'wrong-book',     path: 'wrong-book.html',         auth: true },
  // Immersive Shell
  { step: 'review',         path: 'review.html',             auth: true },
  { step: 'vision',         path: 'vision.html',             auth: true },
  // Exam
  { step: 'exam-simulation', path: 'exam-simulation.html',   auth: true },
  // 功能页
  { step: 'learning-path',  path: 'learning-path.html',      auth: true },
  { step: 'my-weak-points', path: 'my-weak-points.html',     auth: true },
  { step: 'personalized-paper', path: 'personalized-paper.html', auth: true },
  { step: 'question-explainer', path: 'question-explainer.html', auth: true },
  // 内容页 (公开)
  { step: 'methodology',    path: 'methodology.html',        auth: false },
  { step: 'zhongkao',       path: 'zhongkao.html',           auth: false },
  { step: 'policy-2026',    path: '2026-policy.html',        auth: false },
  { step: 'province',       path: 'province.html',           auth: false },
  // 样例报告
  { step: 'sample-student', path: 'sample-report-student.html',  auth: false },
  { step: 'sample-parent',  path: 'sample-report-parent.html',   auth: false },
  { step: 'sample-teacher', path: 'sample-report-teacher.html',  auth: false },
  // 各科 exam (6)
  { step: 'exam-math',      path: 'math-exam.html',          auth: false },
  { step: 'exam-chinese',   path: 'chinese-exam.html',       auth: false },
  { step: 'exam-english',   path: 'english-exam.html',       auth: false },
  { step: 'exam-physics',   path: 'physics-exam.html',       auth: false },
  { step: 'exam-chemistry', path: 'chemistry-exam.html',     auth: false },
  { step: 'exam-politics',  path: 'politics-exam.html',      auth: false },
  // 各科 report (6)
  { step: 'report-math',    path: 'math-report.html',        auth: false },
  { step: 'report-chinese', path: 'chinese-report.html',     auth: false },
  { step: 'report-english', path: 'english-report.html',     auth: false },
  { step: 'report-physics', path: 'physics-report.html',     auth: false },
  { step: 'report-chemistry', path: 'chemistry-report.html', auth: false },
  { step: 'report-politics', path: 'politics-report.html',   auth: false },
];

try {
  // 1. health
  log('1/N health');
  const h = await page.request.get(`${BASE}/api/health`);
  await snap('health', `${BASE}/api/health`, { status: h.status() });

  // 2. guest-login (获得 token)
  log('2/N guest-login (为后续 auth 页面准备 token)');
  const guest = await page.request.post(`${BASE}/api/auth/guest-login`, { data: {} });
  const guestJson = await guest.json();
  if (!guestJson?.token) throw new Error('guest-login no token');
  await snap('guest-login', `${BASE}/api/auth/guest-login`, { status: guest.status() });

  // 注入 token
  await page.goto(`${F3}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, json }) => {
    localStorage.setItem('aitutor.token', token);
    if (json?.data?.user) localStorage.setItem('aitutor.user', JSON.stringify(json.data.user));
  }, { token: guestJson.token, json: guestJson });

  // 3+ 截图所有页面
  for (const p of PAGES) {
    log(`snap ${p.step} → ${p.path}`);
    await snapPage(p.step, `${F3}/${p.path}`, { delay: p.auth ? SLOW * 2 : SLOW });
  }

  // ── 写 manifest ──
  const manifest = {
    runId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    base: F3,
    browser: browser.version(),
    shots,
    summary: {
      totalPages: PAGES.length + 2, // + health + guest-login
      totalShots: shots.length,
      pageErrors: allErrors.length,
      authPages: PAGES.filter(p => p.auth).length,
      publicPages: PAGES.filter(p => !p.auth).length,
    },
  };
  const MANIFEST_DIR = join(RUNS_DIR, runId);
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(join(MANIFEST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // ── 维护 index.json ──
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
  index = await Promise.all(index.map(async r => {
    try {
      const { stat } = await import('node:fs/promises');
      await stat(join(RUNS_DIR, r.runId, 'manifest.json'));
      await stat(join(DEV_OUT, 'screenshots', r.runId, '01-health.png'));
      return r;
    } catch { return null; }
  })).then(rs => rs.filter(Boolean));
  index = index.slice(0, 50);
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

  log(`✅ 全部完成: ${shots.length} 张截图, ${allErrors.length} 个 page error`);
  log(`   manifest → ${MANIFEST_DIR}/manifest.json`);
} catch (err) {
  log('💥', err.message);
  await page.screenshot({ path: `${RUN_DIR}/99-error.png`, fullPage: true });
  process.exitCode = 1;
} finally {
  await sleep(500);
  await browser.close();
}