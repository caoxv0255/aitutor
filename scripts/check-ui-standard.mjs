#!/usr/bin/env node
/**
 * scripts/check-ui-standard.mjs — 前端视觉标准门禁
 *
 * 起因 (2026-09-21): 用户指出线上页面"是骨架的感觉，不完整" —— 根因是我只从
 * hero.html 抽了 token，丢掉 .hero-blobs/.float-card/.loop/.section--cream/.trust
 * 等视觉装置。故把 hero 的样式原样抽成 system.css 作为标准（SPEC-UI §5.5），
 * 并用本门禁保证"标准被真正用起来"，而不是又一次口头约定。
 *
 * 分级策略（避免阻塞未迁移页面）：
 *   - 全局规则：适用于所有 frontend-v2 页面（无内联样式 / 无境外请求 / 六态齐备…）
 *   - 迁移规则：只对 MIGRATED 列表内的页强制（骨架必须来自标准：nav/hero/section/footer）
 *   每迁完一页，把它加入 MIGRATED —— 迁移进度因此变成机械可查的。
 *
 * 用法: node scripts/check-ui-standard.mjs   （失败非零退出）
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'frontend-v2';

/**
 * 已按标准重建的页面（迁完一页加一行 —— 迁移进度因此是机械可查的）
 *
 * 2026-09-22: 10 个接管页全部上标准骨架。此前只有 dashboard 是样板，其余 9 页仍是
 * 旧壳（.wrap + .topbar）—— 那次"批量铺开"没真正做到，是名称上铺开、观感没跟上。
 * 现在整个清单不再区分样板与例外：迁完没迁完以这份清单为准。
 */
const MIGRATED = [
  'dashboard.html',
  'essay.html',
  'learning-path.html',
  'login.html',
  'mastery.html',
  'photo-solve.html',
  'practice-hub.html',
  'register.html',
  'review-session.html',
  'wrong-book.html',
];

/** 认证类页面只有 5 态（表单态即未登录态） */
const AUTH_PAGES = new Set(['login.html', 'register.html']);

const STATES_SIX = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

/** 标准骨架必须出现的结构锚点 */
const ANCHORS = [
  ['nav.nav', /<nav[^>]*class="[^"]*\bnav\b/],
  ['nav__inner', /class="[^"]*\bnav__inner\b/],
  ['hero--app', /class="[^"]*\bhero--app\b/],
  ['hero-blobs', /class="[^"]*\bhero-blobs\b/],
  ['hero__title', /class="[^"]*\bhero__title\b/],
  ['section', /class="[^"]*\bsection\b/],
  ['container', /class="[^"]*\bcontainer\b/],
  ['footer', /<footer[^>]*class="[^"]*\bfooter\b/],
];

/** 已淘汰的旧骨架（新页不得再用） */
const DEPRECATED = [
  ['wrap', /class="[^"]*\bwrap\b/],
  ['topbar', /class="[^"]*\btopbar\b/],
];

/**
 * 接管清单从 server.js 读取（与路由门禁同源，防副本漂移）。
 * 规则分级：
 *   - TAKEN_OVER（已接管页）：全局规则 + 骨架规则全部强制
 *   - 其余（未迁移原型）：只记 backlog，不计失败 —— 它们是已知欠账
 *     （SPEC-ROUTES §1 在跟踪），让门禁永久红只会让它失去信任。
 */
function takenOverFromServer() {
  const src = fs.readFileSync('server.js', 'utf8');
  const m = src.match(/DEFAULT_NEW_TREE_PAGES\s*=\s*'([^']+)'/);
  if (!m) throw new Error('无法从 server.js 解析 DEFAULT_NEW_TREE_PAGES');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

const takenOver = new Set(takenOverFromServer());
const pages = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();
const problems = [];
const backlog = [];
const notes = [];

const css = fs.readFileSync(`${DIR}/assets/css/app.css`, 'utf8');
const system = fs.readFileSync(`${DIR}/assets/css/system.css`, 'utf8');

/**
 * 抽出 @media 块的规则体 (花括号配平, 支持块内多规则)。
 * 用途见下方「静态可判断言」: 判的是 CSS 规则文本的存在性, 不是运行时行为 ——
 * jsdom 无布局引擎, 「能不能真的滚到底 / tab 是否真的隐藏」测不了, 那是浏览器
 * 实测 (Playwright) 的射程; 本断言只保证"把规则删了门禁必须红"。
 */
function mediaBlocks(cssText, mediaQuerySource) {
  const blocks = [];
  const open = new RegExp(`@media[^{]*${mediaQuerySource}[^{]*\\{`, 'gi');
  let m;
  while ((m = open.exec(cssText))) {
    let depth = 1;
    let i = open.lastIndex;
    while (i < cssText.length && depth > 0) {
      if (cssText[i] === '{') depth++;
      else if (cssText[i] === '}') depth--;
      i++;
    }
    blocks.push(cssText.slice(open.lastIndex, i - 1));
  }
  return blocks;
}

// ── 全局规则：标准文件本身 ───────────────────────────────────────────────
if (!fs.existsSync(`${DIR}/assets/css/system.css`)) problems.push('缺少标准文件 assets/css/system.css');
if (!fs.existsSync(`${DIR}/assets/css/fonts.css`)) problems.push('缺少字体样式 assets/css/fonts.css');
if (!/--brand-text:/.test(css)) problems.push('app.css 缺 --brand-text（暗色下品牌红文字对比度不合格，见 SPEC-UI §5.5.3-5）');
if (!/--dur-fast:\s*200ms/.test(css)) problems.push('app.css 缺 --dur-fast:200ms（微交互时长判据，SPEC-UI §5.5.3-6）');
if (!/:focus-visible/.test(css)) problems.push('app.css 缺 :focus-visible 覆盖（skill CRITICAL）');
if (!/@media\s*\(prefers-reduced-motion/.test(css + system)) problems.push('缺 prefers-reduced-motion 降级');

// ── 静态可判断言 (2026-09-22): 两个 jsdom 测不到的洞 ─────────────────────
// 1) .results-scroll 移动端限高+滚动 (2026-09-22 用户反馈"内容多时看不到底"):
//    ≤767px 媒体查询里必须有 max-height + overflow-y:auto 的规则文本。
//    判的是规则存在性, 不是运行时行为 (能否真的滚到底需浏览器实测)。
const mobileBlocks = mediaBlocks(css, '\\(max-width:\\s*767px\\)');
const rsBody = mobileBlocks.map((b) => b.match(/\.results-scroll\s*\{([^}]*)\}/)?.[1]).find(Boolean);
if (!rsBody) {
  problems.push('app.css 缺 ≤767px 媒体查询下的 .results-scroll 规则（判据: @media (max-width:767px) 块内 .results-scroll{...}，app.css ~302）');
} else if (!/max-height/.test(rsBody) || !/overflow-y:\s*auto/.test(rsBody)) {
  problems.push(`app.css 的 .results-scroll 移动端规则缺 max-height/overflow-y:auto（现为: ${rsBody.trim().replace(/\s+/g, ' ').slice(0, 80)}…）`);
}

// 2) 桌面端隐藏底部 Tab: ≥768px 媒体查询里必须有 .tabbar{display:none !important}。
//    判的是规则存在性, 不是运行时行为 (真机布局需浏览器实测)。
const desktopBlocks = mediaBlocks(css, '\\(min-width:\\s*768px\\)');
const tabbarBody = desktopBlocks.map((b) => b.match(/\.tabbar\s*\{([^}]*)\}/)?.[1]).find(Boolean);
if (!tabbarBody) {
  problems.push('app.css 缺 ≥768px 媒体查询下的 .tabbar 隐藏规则（判据: @media (min-width:768px) 块内 .tabbar{display:none !important}，app.css ~1466）');
} else if (!/display:\s*none\s*!important/.test(tabbarBody)) {
  problems.push(`app.css 的 .tabbar 桌面端规则缺 display:none !important（现为: ${tabbarBody.trim().replace(/\s+/g, ' ').slice(0, 80)}…）`);
}

// ── 逐页规则 ─────────────────────────────────────────────────────────────
const migratedSeen = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(DIR, p), 'utf8');

  // 未接管的原型页 = 已知欠账，记 backlog 不计失败
  if (!takenOver.has(p)) {
    backlog.push(p);
    continue;
  }

  // ── 以下规则只对已接管页强制 ──

  // 外部依赖与内联样式
  const cdn = html.match(/fonts\.googleapis|fonts\.gstatic|jsdelivr|unpkg/g);
  if (cdn) problems.push(`${p}: 引用境外 CDN ${[...new Set(cdn)].join(',')}（DoD 要求零境外请求）`);
  if (/<style[^>]*>/.test(html)) problems.push(`${p}: 含内联 <style>（样式必须来自共享层）`);

  // KaTeX 引入顺序与来源 (2026-09-22): 公式页里 katex.min.js 必须先于 ui.js/api.js/
  // 页面脚本加载, 否则渲染时 KaTeX 未就绪会静默退回原文 —— 这个退化 jsdom 测不出
  // (photo-solve-states.test.mjs 只测公式 DOM 存在性)。机械判据:
  //   a. src 必须以 /assets/v2/vendor/katex/ 开头 (自托管, 防 CDN 回退);
  //   b. katex 的 <script> 在页面所有其他本地 /assets/ <script> 之前。
  // 判的是静态顺序, 不是运行时行为 (公式真渲染出来需浏览器实测)。
  const katexScript = html.match(/<script[^>]*src="([^"]*katex\.min\.js)"[^>]*>/);
  if (katexScript) {
    if (!katexScript[1].startsWith('/assets/v2/vendor/katex/')) {
      problems.push(`${p}: katex.min.js 必须自托管于 /assets/v2/vendor/katex/（当前 src: ${katexScript[1]}）`);
    }
    const katexIdx = html.indexOf(katexScript[0]);
    const firstLocalScript = html.match(/<script[^>]*src="\/assets\/[^"]*"[^>]*>/);
    if (firstLocalScript && html.indexOf(firstLocalScript[0]) < katexIdx) {
      problems.push(`${p}: katex.min.js 必须先于其他本地脚本加载（防 KaTeX 未就绪静默退回原文）`);
    }
  }

  // 底部 Tab（PM-BRIEF §B.2 移动端主导航）：非认证页恰好 1 份，认证页 0 份
  //
  // 2026-09-22: 最初把 tabbar 插进页面时脚本重复执行过一次，essay/learning-path/
  // mastery/practice-hub/review-session/wrong-book 六页各有两份 <nav class="tabbar">
  // （同为 position:fixed 会叠在一起）。修完加这条规则，防止同一坑复发。
  const tabbars = [...html.matchAll(/<nav[^>]*class="[^"]*\btabbar\b/g)].length;
  if (AUTH_PAGES.has(p)) {
    if (tabbars > 0) problems.push(`${p}: 认证页不应出现底部 Tab（登录/注册的目标是单一动作，不该给二级导航）`);
  } else if (tabbars === 0) {
    problems.push(`${p}: 缺底部 Tab .tabbar（PM-BRIEF §B.2：移动端主导航，5 Tab 中央凸起）`);
  } else if (tabbars > 1) {
    problems.push(`${p}: 底部 Tab 有 ${tabbars} 份（只能 1 份；2026-09-22 修过六页重复，禁复发）`);
  }

  // 图标不用 emoji（只查可交互元素的文本）
  const emojiInControls = html.match(/<(button|a)[^>]*>[^<]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  if (emojiInControls) problems.push(`${p}: 可交互元素用 emoji 当图标（skill 明令禁止）`);

  // 状态面板（认证页：form 态替代 auth/empty）
  const states = [...html.matchAll(/data-state="([a-z]+)"/g)].map((m) => m[1]);
  const expected = AUTH_PAGES.has(p)
    ? ['form', 'loading', 'success', 'error', 'offline']
    : STATES_SIX;
  const missing = expected.filter((s) => !states.includes(s));
  if (states.length && missing.length) problems.push(`${p}: 缺状态面板 ${missing.join(',')}`);

  // 标准骨架（已在标准骨架上的页强制；其余接管页待迁移）
  if (MIGRATED.includes(p)) {
    migratedSeen.push(p);

    const orderOk = /fonts\.css[\s\S]*system\.css[\s\S]*app\.css/.test(html);
    if (!orderOk) problems.push(`${p}: 样式加载顺序必须为 fonts → system → app`);

    for (const [label, re] of ANCHORS) {
      if (!re.test(html)) problems.push(`${p}: 缺标准骨架锚点 ${label}（见 SPEC-UI §5.5.1）`);
    }
    for (const [label, re] of DEPRECATED) {
      if (re.test(html)) problems.push(`${p}: 仍在使用已淘汰骨架 .${label}（改用标准件）`);
    }
  } else {
    notes.push(`${p}: 已接管但未上标准骨架（待迁移）`);
  }
}

if (backlog.length) notes.push(`未迁移原型（已知欠账，不计失败）: ${backlog.length} 页`);

if (problems.length) {
  console.error('❌ 前端视觉标准未达标:');
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n标准见 docs/spec/SPEC-UI.md §5.5；视觉只改 system.css，页面差异放 app.css。');
  process.exit(1);
}

console.log(
  `✓ 视觉标准达标（接管 ${takenOver.size} 页全部通过；标准骨架 ${migratedSeen.length} 页）` +
    (notes.length ? `\n  ℹ ${notes.join('；')}` : '')
);
process.exit(0);
