#!/usr/bin/env node
/**
 * scripts/check-new-tree-routing.mjs — 新主树路由门禁
 *
 * 起因 (2026-09-21, Q3): server.js 里加了"新树优先 + 旧树兜底"的接管逻辑。
 * 这类路由是**静默失效**的典型：某次重构把中间件顺序调了、或把某个页面从
 * NEW_TREE_PAGES 里漏掉，用户就会在不知不觉中回到旧页面 —— 而没有地方会报警
 * （与审计 R1「SW 让用户长期看旧页」是同一类故障）。
 *
 * 判据（机械可复现，纯 HTTP）:
 *   1. NEW_TREE_PAGES 里每页在根路径返回 200，且 md5 == frontend-v2/<page>（证明是新树而非旧树同名页）
 *   2. /assets/v2/css/app.css 与 /assets/v2/js/ui.js 返回 200（资源命名空间可用）
 *   3. 旧树兜底未被破坏: /f3/pages/index.html 与 / 返回 200
 *   4. 根路径 / 的产物仍是旧树（未硬切），桌面 md5 == ai-tutor-frontend/pages/index.html
 *   5. 双向交叉校验: frontend-v2 顶层正式页必须在接管清单（豁免 NOT_TAKEN_OVER），
 *      清单页必须真实存在 —— server.js 漏页时真相源无法自察，靠此判据兜底
 * 解析说明: DEFAULT_NEW_TREE_PAGES 支持多段 '+' 拼接（20 页起分段书写），
 *   解析取整个右侧表达式中的全部字符串字面量按 JS 语义拼接 —— 旧正则只捕获
 *   第一个字面量，曾导致后 10 页落在门禁射程之外（实测只报 10 页）。
 *
 * 与 release-gate 的其它检查一致: 后端不可达时默认跳过（除非 REQUIRE_NEW_TREE=1）。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';

const BASE = process.env.BCT_URL || 'http://localhost:3002';
const UA = 'Mozilla/5.0 (X11; Linux x86_64)';

/**
 * 接管清单**从 server.js 读取**（唯一真相源），不在本文件维护副本 ——
 * 副本必然与真相漂移：曾实测"server.js 已加 dashboard.html，门禁仍报 6 页"，
 * 于是新页刚好落在门禁射程之外。环境变量 NEW_TREE_PAGES 仍可覆盖（检查实际部署）。
 */
function pagesFromServer() {
  const src = fs.readFileSync('server.js', 'utf8');
  // 捕获 DEFAULT_NEW_TREE_PAGES 右侧整个表达式（到语句结束的 ';' 为止），
  // 再提取其中全部单引号字符串字面量按 JS 语义拼接 —— 兼容单字符串与
  // 多段 '+' 拼接写法（2026-09-22 起 20 页即分段拼接）。旧正则只捕获
  // 第一个字面量，导致拼接写法下后半清单落在门禁射程之外（实测只报 10 页）。
  const m = src.match(/DEFAULT_NEW_TREE_PAGES\s*=\s*([\s\S]*?);/);
  if (!m) throw new Error('无法从 server.js 解析 DEFAULT_NEW_TREE_PAGES');
  const literals = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  if (!literals.length) throw new Error('DEFAULT_NEW_TREE_PAGES 表达式中未找到字符串字面量');
  return literals
    .join('')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const PAGES = (process.env.NEW_TREE_PAGES || pagesFromServer().join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 有意不接管的 frontend-v2 顶层页（仅经 /v2/ 命名空间提供）。新增豁免必须注明理由，
// 否则新页落地后要么进 server.js 接管清单、要么进这里 —— 不允许两边都不在（静默失效）。
const NOT_TAKEN_OVER = new Set([
  'hero.html', // 视觉规格基准，/v2/ 的索引页
  'landing.html', // /v2/ 落地原型页
  'error-404.html', // /v2/ 的 404 模板（server.js DESIGN_V2_404），不走接管路由
  'practice-hub-v2.html', // practice-hub 迭代原型，正式页仍为 practice-hub.html
  'teacher-dashboard.html', // 教师端未迁移，仅 /v2/ 预览
]);

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

async function get(pathname) {
  const res = await fetch(BASE + pathname, { headers: { 'User-Agent': UA } });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}

async function main() {
  try {
    const health = await fetch(BASE + '/api/health');
    if (!health.ok) throw new Error(`health=${health.status}`);
  } catch (err) {
    console.log(`  (跳过: 后端不可达 ${BASE} —— ${err.message})`);
    process.exit(process.env.REQUIRE_NEW_TREE === '1' ? 1 : 0);
  }

  const problems = [];

  // 交叉校验（独立参照，2026-09-22）：接管清单读自 server.js，但 server.js 自己
  // 漏页时本脚本无从察觉 —— 实测把清单删掉一页后仍报「N 页接管」全绿（真相源
  // 无法自察缺漏）。故以 frontend-v2/ 顶层页面为第二参照双向核对：
  //   a) frontend-v2 顶层正式页必须在清单里（豁免 NOT_TAKEN_OVER 并注明理由）；
  //   b) 清单里的页必须真实存在于 frontend-v2（否则本地 md5 校验被跳过，接管成空路由）。
  for (const f of fs.readdirSync('frontend-v2').filter((x) => x.endsWith('.html'))) {
    if (!PAGES.includes(f) && !NOT_TAKEN_OVER.has(f)) {
      problems.push(`frontend-v2/${f} 存在但不在 server.js 接管清单（缺失页名: ${f}）—— 新页漏登记或应加入 NOT_TAKEN_OVER 豁免清单`);
    }
  }
  for (const page of PAGES) {
    if (!fs.existsSync(`frontend-v2/${page}`)) {
      problems.push(`清单页 frontend-v2/${page} 不存在 —— 接管了空路由，md5 校验将被跳过`);
    }
  }

  for (const page of PAGES) {
    const local = fs.existsSync(`frontend-v2/${page}`) ? md5(fs.readFileSync(`frontend-v2/${page}`)) : null;
    const r = await get(`/${page}`);
    if (r.status !== 200) {
      problems.push(`/${page} 返回 ${r.status}（期望 200）`);
      continue;
    }
    if (local && md5(r.buf) !== local) {
      problems.push(`/${page} 内容与 frontend-v2/${page} 不一致 —— 说明服务的是旧树同名页`);
    }
  }

  for (const asset of ['/assets/v2/css/app.css', '/assets/v2/js/ui.js']) {
    const r = await get(asset);
    if (r.status !== 200) problems.push(`${asset} 返回 ${r.status}（新树资源命名空间不可用）`);
  }

  const legacy = await get('/f3/pages/index.html');
  if (legacy.status !== 200) problems.push(`/f3/pages/index.html 返回 ${legacy.status}（旧树兜底被破坏）`);

  const root = await get('/');
  const f3Index = fs.existsSync('ai-tutor-frontend/pages/index.html')
    ? md5(fs.readFileSync('ai-tutor-frontend/pages/index.html'))
    : null;
  if (root.status !== 200) {
    problems.push(`/ 返回 ${root.status}`);
  } else if (f3Index && md5(root.buf) !== f3Index) {
    problems.push('/ 的产物不再是旧树首页 —— 若是有意硬切，请同步更新本门禁与 PLAN §1.1');
  }

  if (problems.length) {
    console.error('❌ 新树路由异常:');
    for (const p of problems) console.error(`   ${p}`);
    process.exit(1);
  }
  console.log(`✓ 新树路由正常（${PAGES.length} 页接管 + 资源命名空间 + 旧树兜底完好，/ 仍为旧树）`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`  (跳过: ${err.message})`);
  process.exit(process.env.REQUIRE_NEW_TREE === '1' ? 1 : 0);
});
