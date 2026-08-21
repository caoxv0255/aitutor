#!/usr/bin/env node
// scripts/audit/strip-4-dead.mjs
// 2026-08-20 DSH agent: 删 4 个单行 dead backend 端点 (无函数体, 删整行安全)
//
// 来源: docs/audit-dead-routes-review.md
// 知识 3 个多行端点保留 (人工 review), routes/*.js 30 个保留 (前端 0 调用但 server API 真活给教师/owner)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

// 4 端点 (单行, 删整行安全)
const TO_DELETE = [
  { method: 'POST', path: '/api/auth/guest',          file: 'api/modules/auth/routes.js', line: 15, note: 'router.use("/guest", ...) mount, 前端走别名 /guest-login' },
  { method: 'GET',  path: '/api/exam/papers',          file: 'api/modules/exam/routes.js',  line: 12, note: '单行 router.get, 前端走错配 method' },
  // POST /api/exam/pdf/generate 已不存在 (v1 strip 已删)
  { method: 'GET',  path: '/api/user/wrong-questions', file: 'api/modules/user/routes.js', line: 20, note: '单行 router.get, 前端 service 调它但 rag.search 失败的错配' },
];

console.log(`计划删 ${TO_DELETE.length} 端点 (理论 4, 第 3 个 PDF/generate 已删)`);

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
      console.log(`     note: ${e.note}`);
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
    // 防护: 跳 router.use(mount) + router.method(...authMiddleware, async)
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