// tests/scripts/check-ui-standard-parser.test.js — 接管页清单解析的回归用例
//
// 被测量: scripts/check-ui-standard.mjs 的 takenOverFromServer()
// 背景 (2026-09-22): server.js 的 DEFAULT_NEW_TREE_PAGES 自 20 页起改为多段
//   '+' 拼接书写，而该脚本用 /DEFAULT_NEW_TREE_PAGES\s*=\s*'([^']+)'/ 解析，
//   只捕获第一个字符串字面量 → 仅解析出 10 页，后 10 页被当作 backlog 跳过
//   全部逐页判据（漏检/假绿：缺失兜底 Tab、引用境外 CDN、内联 <style> 等都不报）。
//   同款盲点此前已在 scripts/check-new-tree-routing.mjs 修过，本用例把 UI 门禁的
//   解析也钉住：多段 '+' 拼接必须与单段得到相同的完整清单。
//
// 夹具思路: 临时目录里放一个最小 server.js + 最小 frontend-v2/，其中
//   b.html 故意违规（内联 <style>）。若解析只看第一段（只含 a.html），
//   b.html 会被当 backlog 跳过 → 退出码 0（正是旧 bug）；修好后 b.html 被强制
//   → 退出码 1 且输出点名 b.html。用例因此对旧实现是红的、对新实现是绿的。
//
// 运行: npx vitest run tests/scripts/check-ui-standard-parser.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-ui-standard.mjs');

// 满足脚本全局断言的最小 CSS（标准文件存在性 + 4 条 token + 2 个媒体查询规则）
const APP_CSS = [
  ':root{--brand-text:#111;--dur-fast:200ms}',
  ':focus-visible{outline:2px solid #000}',
  '@media (max-width: 767px){.results-scroll{max-height:50vh;overflow-y:auto}}',
  '@media (min-width: 768px){.tabbar{display:none !important}}',
].join('\n');
const SYSTEM_CSS = '@media (prefers-reduced-motion: reduce){*{transition:none}}';

const OK_PAGE = '<!doctype html><html><body><nav class="tabbar"></nav></body></html>';
const BAD_PAGE = '<!doctype html><html><head><style>.x{}</style></head><body></body></html>';

// 在指定目录跑检查器: 返回 { code, out }（非零退出也收敛成返回值）
function runIn(cwd) {
  try {
    const out = execFileSync('node', [CHECKER], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// 在临时目录里跑检查器（cwd 指向夹具，脚本内的相对路径都落在这里）: 返回 { code, out }
function runOn({ serverJs, pages }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ui-std-case-'));
  try {
    writeFileSync(path.join(dir, 'server.js'), serverJs);
    mkdirSync(path.join(dir, 'frontend-v2/assets/css'), { recursive: true });
    writeFileSync(path.join(dir, 'frontend-v2/assets/css/app.css'), APP_CSS);
    writeFileSync(path.join(dir, 'frontend-v2/assets/css/system.css'), SYSTEM_CSS);
    writeFileSync(path.join(dir, 'frontend-v2/assets/css/fonts.css'), '/* fonts */');
    for (const [name, body] of Object.entries(pages)) {
      writeFileSync(path.join(dir, 'frontend-v2', name), body);
    }
    return runIn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('check-ui-standard 接管页解析 (多段拼接盲点)', () => {
  it("多段 '+' 拼接: 第二段里的违规页必须被强制 (旧实现漏检 → 绿)", () => {
    const { code, out } = runOn({
      serverJs: "const DEFAULT_NEW_TREE_PAGES =\n  'a.html,' +\n  'b.html';\n",
      pages: { 'a.html': OK_PAGE, 'b.html': BAD_PAGE },
    });
    // 修好后: b.html 在清单内 → 内联 <style> 被点名 → 红
    expect(code).toBe(1);
    expect(out).toMatch(/b\.html: 含内联 <style>/);
  });

  it('单段写法: 与旧正则行为一致 (清单内违规页照样被强制)', () => {
    const { code, out } = runOn({
      serverJs: "const DEFAULT_NEW_TREE_PAGES = 'a.html,b.html';\n",
      pages: { 'a.html': OK_PAGE, 'b.html': BAD_PAGE },
    });
    expect(code).toBe(1);
    expect(out).toMatch(/b\.html: 含内联 <style>/);
  });

  it('单段写法: 不在清单内的页属 backlog, 不计失败', () => {
    const { code, out } = runOn({
      serverJs: "const DEFAULT_NEW_TREE_PAGES = 'a.html';\n",
      pages: { 'a.html': OK_PAGE, 'b.html': BAD_PAGE },
    });
    expect(code).toBe(0);
    expect(out).toMatch(/接管 1 页全部通过/);
    expect(out).toMatch(/未迁移原型（已知欠账，不计失败）: 1 页/);
  });

  // 修复的验收: 仓库本体 server.js 是 20 页多段拼接, 必须解析成 20 而非 10。
  it('仓库本体: 解析出 20 页接管 (修复前为 10)', () => {
    const { code, out } = runIn(ROOT);
    expect(code).toBe(0);
    expect(out).toMatch(/接管 20 页全部通过/);
  }, 30000);
});
