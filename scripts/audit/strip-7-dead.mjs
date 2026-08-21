#!/usr/bin/env node
// scripts/audit/strip-7-dead.mjs
// 2026-08-20 DSH agent: 删 7 个真死 backend (modules/* only, routes/*.js 留给 server 业务)
//
// 来源: docs/audit-dead-routes-review.md
// 7 个 = 4 类:
//  - alias dead (guest vs guest-login 别名, 前端走 guest-login)
//  - method 错配 + 前端不同调用 (exam papers, exam pdf/generate)
//  - knowledge 4 个端点前端 GET 用了, 路径在 routes.js 注释 (实际 GET 用了, 这里只是 path 错配)
//  - user wrong-questions GET + vision search POST 没前端

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

const TO_DELETE = [
  { method: 'POST',   path: '/api/auth/guest',          file: 'api/modules/auth/routes.js',     line: 15 },
  { method: 'GET',    path: '/api/exam/papers',          file: 'api/modules/exam/routes.js',      line: 12 },
  { method: 'POST',   path: '/api/exam/pdf/generate',    file: 'api/modules/exam/routes.js',      line: 17 },
  { method: 'GET',    path: '/api/knowledge/mastery',    file: 'api/modules/knowledge/routes.js', line: 17 },
  { method: 'GET',    path: '/api/knowledge/map',        file: 'api/modules/knowledge/routes.js', line: 126 },
  { method: 'GET',    path: '/api/knowledge/points',     file: 'api/modules/knowledge/routes.js', line: 181 },
  { method: 'GET',    path: '/api/user/wrong-questions', file: 'api/modules/user/routes.js',     line: 20 },
];

console.log(`计划删 ${TO_DELETE.length} 端点`);

const byFile = {};
for (const e of TO_DELETE) (byFile[e.file] = byFile[e.file] || []).push(e);

if (DRY) {
  console.log('\n=== DRY RUN ===');
  for (const [f, entries] of Object.entries(byFile)) {
    console.log(`\n--- ${f} (${entries.length}) ---`);
    const text = readFileSync(resolve(ROOT, f), 'utf8');
    const lines = text.split('\n');
    const sorted = entries.sort((a, b) => b.line - a.line);
    for (const e of sorted) {
      const idx = e.line - 1;
      const line = lines[idx] || '';
      console.log(`  L${e.line}: ${e.method} ${e.path}`);
      console.log(`     ↳ "${line.trim().slice(0, 80)}"`);
    }
  }
  process.exit(0);
}

const fs = await import('node:fs');
for (const [file, entries] of Object.entries(byFile)) {
  const fpath = resolve(ROOT, file);
  const text = readFileSync(fpath, 'utf8');
  const lines = text.split('\n');
  const sorted = entries.sort((a, b) => b.line - a.line);
  for (const e of sorted) {
    const idx = e.line - 1;
    if (idx < 0 || idx >= lines.length) {
      console.error(`  ✗ ${file}:${e.line} out of range`);
      continue;
    }
    const line = lines[idx];
    if (line == null) { console.error(`  ✗ ${file}:${e.line} line null`); continue; }
    // 防护: 跳过 router.use(mount) + router.method(...authMiddleware, async()
    const isRouterMount = /router\.use\s*\(/.test(line);
    const isRouterMethodFn = /router\.(get|post|put|delete|patch)\s*\([^,]+,\s*authMiddleware\s*,\s*async\s*\(/.test(line);
    if (isRouterMount || isRouterMethodFn) {
      console.error(`  ✗ SKIP ${file}:${e.line} (router mount/method-fn): ${line.trim().slice(0, 60)}`);
      continue;
    }
    if (line.includes(e.path) || line.includes(e.path.split('/').pop())) {
      lines[idx] = '';
      console.log(`  ✓ ${file}:${e.line} ${e.method} ${e.path}`);
    } else {
      console.error(`  ✗ ${file}:${e.line} 不匹配 (line: ${line.slice(0, 80)})`);
    }
  }
  const newText = lines.filter((l, i) => l !== '' || (i > 0 && lines[i-1] !== '')).join('\n');
  writeFileSync(fpath, newText);
}
console.log('\n完成. 跑 gate 验证.');