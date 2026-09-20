#!/usr/bin/env node
/**
 * scripts/check-tracked-refs.mjs — 门禁 6/6: tracked 文件引用的本地资源必须全部 tracked
 *
 * 判据（三条同时成立即失败）:
 *   1. 某本地资源被 tracked 的 .html / .js / .mjs / .cjs 以
 *      `<script src>` / `<link href>` / 相对 import / require / 动态 import 引用；
 *   2. 该资源在磁盘上存在；
 *   3. 它未被 git 跟踪，且未被 .gitignore 忽略。
 *
 * 命中即「工作区一丢就不可逆」的运行时闭包缺口
 * （见 docs/audits/architecture-review-2026-09-20.md R1）。
 *
 * 用法: node scripts/check-tracked-refs.mjs    退出码 0 = 通过, 1 = 有缺口
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SCAN_EXT = new Set(['.html', '.js', '.mjs', '.cjs']);
// kind: 'asset' = HTML 里的 script src / link href（允许 `assets/js/x.js` 这种无 ./ 前缀的相对路径）
//       'module' = JS 里的 import / require（必须是显式相对路径 `./` `../`，跳过裸包名）
const REF_PATTERNS = [
  { kind: 'asset', re: /<script\b[^>]*\bsrc=["']([^"']+)["']/gi },
  { kind: 'asset', re: /<link\b[^>]*\bhref=["']([^"']+)["']/gi },
  { kind: 'module', re: /from\s+["']([^"']+)["']/g },
  { kind: 'module', re: /import\s+["']([^"']+)["']/g },
  { kind: 'module', re: /import\s*\(\s*["']([^"']+)["']\s*\)/g },
  { kind: 'module', re: /require\s*\(\s*["']([^"']+)["']\s*\)/g },
];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

// `git check-ignore -q` 用退出码表达结果（0=被忽略），必须单独判
function isIgnored(p) {
  try {
    execFileSync('git', ['check-ignore', '-q', p], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const tracked = new Set(git(['ls-files']).split('\n').filter(Boolean));
const referrers = [...tracked].filter((f) => SCAN_EXT.has(path.extname(f)));

const missing = new Map(); // 未跟踪资源 → Set(引用者)

for (const file of referrers) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { kind, re } of REF_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      let ref = m[1].split(/[?#]/)[0].trim();
      if (!ref) continue;
      // 跳过 http(s)/协议相对/根相对/data:
      if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('/') || ref.startsWith('data:')) continue;
      // JS import/require 只认显式相对路径，避免把裸包名当本地资源
      if (kind === 'module' && !ref.startsWith('.')) continue;
      if (!SCAN_EXT.has(path.extname(ref)) && path.extname(ref) !== '.css') continue;

      const abs = path.resolve(path.dirname(file), ref);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue; // 目标不存在 → 不是缺口
      }
      if (!st.isFile()) continue;

      const rel = path.relative(process.cwd(), abs);
      if (tracked.has(rel)) continue; // 已被跟踪 → OK
      if (isIgnored(rel)) continue; // 故意 ignore → 跳过

      if (!missing.has(rel)) missing.set(rel, new Set());
      missing.get(rel).add(file);
    }
  }
}

if (missing.size === 0) {
  console.log(`  ✓ tracked 引用完整性: ${referrers.length} 个 tracked HTML/JS 的本地引用全部已入库`);
  process.exit(0);
}

console.log('  ✗ 发现被 tracked 文件引用、却未入库的本地资源:');
for (const [res, refs] of [...missing].sort()) {
  console.log(`      - ${res}`);
  for (const r of [...refs].sort()) console.log(`          ← ${r}`);
}
console.log('');
console.log('  这些资源存在但不被 git 跟踪: 工作区一丢即不可逆。');
console.log('  修法: 逐个判断 `git add <路径>` 入库, 或确认无用后删除引用/文件。');
process.exit(1);
