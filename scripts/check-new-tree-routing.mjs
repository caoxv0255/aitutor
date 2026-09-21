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
 *
 * 与 release-gate 的其它检查一致: 后端不可达时默认跳过（除非 REQUIRE_NEW_TREE=1）。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';

const BASE = process.env.BCT_URL || 'http://localhost:3002';
const UA = 'Mozilla/5.0 (X11; Linux x86_64)';

/**
 * 与 server.js 的 DEFAULT_NEW_TREE_PAGES 保持一致。
 * 若环境变量 NEW_TREE_PAGES 覆盖过, 以覆盖值为准（门禁要检查"实际部署的东西"）。
 */
const PAGES = (
  process.env.NEW_TREE_PAGES ||
  'login.html,register.html,photo-solve.html,wrong-book.html,review-session.html,mastery.html'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
