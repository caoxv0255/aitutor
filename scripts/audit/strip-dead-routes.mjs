#!/usr/bin/env node
// scripts/audit/strip-dead-routes.mjs
// 2026-08-20 DSH agent: 自动从 routes.js 删 0 引用 dead backend 端点
//
// 读 docs/audit-dead-routes-checked.md, 找 refCount = 0 端点, 从对应 routes.js 删端点行
// 不动 handler 文件, 不动子 router, 不动有引用的端点
//
// 干跑模式 (--dry): 只打印要删的行, 不动文件
// 实跑模式 (默认): 改文件 + 显示 diff

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

const checkPath = resolve(ROOT, 'docs/audit-dead-routes-checked.md');
if (!existsSync(checkPath)) {
  console.error('Missing docs/audit-dead-routes-checked.md. 先跑:');
  console.error('  1. node scripts/audit/audit-routing.mjs --json scripts/audit/.routing-audit.json');
  console.error('  2. node scripts/audit/check-dead-routes.mjs');
  process.exit(1);
}

// 解析 markdown: 找 0-ref 区的 `METHOD /api/path` + 后端文件 + 行号
const text = readFileSync(checkPath, 'utf8');
const realStart = text.indexOf('## 真死 (0 引用, 可安全删)');
const realEnd = text.indexOf('## 有引用 (需 review)');
const realSection = text.slice(realStart, realEnd);
const entryRe = /### `([A-Z]+) (\/api[^\`]+)`\s*\n- 后端: ([^\n]+):(\d+)\s*\n- 引用: 无/g;
let m;
const deadEntries = [];
while ((m = entryRe.exec(realSection)) !== null) {
  deadEntries.push({ method: m[1], path: m[2], file: m[3], line: parseInt(m[4], 10) });
}
console.log('真死端点:', deadEntries.length);

// 按文件分组
const byFile = {};
for (const e of deadEntries) {
  (byFile[e.file] = byFile[e.file] || []).push(e);
}

if (DRY) {
  console.log('\n=== DRY RUN: 计划删 ===');
  for (const [f, entries] of Object.entries(byFile)) {
    console.log(`\n--- ${f} (${entries.length} 个端点) ---`);
    const text = readFileSync(resolve(ROOT, f), 'utf8');
    const lines = text.split('\n');
    // 按行号倒序删 (避免位移)
    const sorted = entries.sort((a, b) => b.line - a.line);
    for (const e of sorted) {
      console.log(`  L${e.line}: ${e.method} ${e.path}  → "${lines[e.line - 1]?.trim()}"`);
    }
  }
  console.log('\n要实跑, 跑: node scripts/audit/strip-dead-routes.mjs');
  process.exit(0);
}

// 实跑: 改文件
const fs = await import('node:fs');
for (const [file, entries] of Object.entries(byFile)) {
  const fpath = resolve(ROOT, file);
  const text = readFileSync(fpath, 'utf8');
  const lines = text.split('\n');
  // 按行号倒序删
  const sorted = entries.sort((a, b) => b.line - a.line);
  for (const e of sorted) {
    const idx = e.line - 1;
    if (idx >= 0 && idx < lines.length) {
      const line = lines[idx];
      // 严格匹: 行含完整 path, 且 path 后面有 ',' 或 ')'(避免匹 "feedback" 等子串)
      // 排除 router.METHOD 后面跟 'authMiddleware, async (req, res) =>' 函数 wrap
      const isRouterMount = /router\.use\s*\(/.test(line);
      const isRouterMethodFn = /router\.(get|post|put|delete|patch)\s*\([^,]+,\s*authMiddleware\s*,\s*async\s*\(/.test(line);
      if (isRouterMount || isRouterMethodFn) {
        console.error(`  ✗ ${file}:${e.line} SKIP (router mount/method, 不是死端点): ${line.trim().slice(0, 60)}`);
        continue;
      }
      if (line.includes(e.path) || line.includes(e.path.split('/').pop())) {
        lines[idx] = '';  // 标记空行 (下个循环清)
        console.log(`  ✓ ${file}:${e.line} ${e.method} ${e.path}`);
      } else {
        console.error(`  ✗ ${file}:${e.line} 不匹配 (line: ${line.slice(0, 80)})`);
      }
    }
  }
  // 合并连续空行
  const newText = lines.filter((l, i) => l !== '' || (i > 0 && lines[i-1] !== '')).join('\n');
  writeFileSync(fpath, newText);
}
console.log('\n完成. 跑 gate 验证: npm run gate');
