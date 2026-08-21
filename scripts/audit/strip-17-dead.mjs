#!/usr/bin/env node
// scripts/audit/strip-17-dead.mjs
// 2026-08-20 DSH agent: 按 review 删 17 个明确的 dead backend 端点
//
// review 来源: docs/audit-dead-routes-review.md
// 17 个 = 5 类 method 错配 + 5 类 routes.js 注释引用 + 5 类 redesign 引用 + 1 类 tutor/mastery
// 不动 routes/*.js 文件 (import 失败但本轮范围外), 不动 9 个真用端点

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

// 11 端点要删 (curl 验证真 401, 不传 token 也 401 = dead)
// 删除 5 个 routes/*.js 端点 (B + C) 实际活 (curl 200), 保留
const TO_DELETE = [
  // A. method 错配 (前端 GET, 后端 POST 没前端用) - 6 个
  { method: 'DELETE', path: '/api/auth/prefs/province', file: 'api/modules/auth/routes.js', line: 32 },
  { method: 'POST',    path: '/api/exam/papers',            file: 'api/modules/exam/routes.js',  line: 14 },
  { method: 'POST',    path: '/api/exam/questions',         file: 'api/modules/exam/routes.js',  line: 16 },
  { method: 'POST',    path: '/api/user/profile',           file: 'api/modules/user/routes.js', line: 17 },
  { method: 'POST',    path: '/api/user/subjects',          file: 'api/modules/user/routes.js', line: 20 },
  { method: 'DELETE',  path: '/api/user/subjects',          file: 'api/modules/user/routes.js', line: 21 },
  // D. redesign 引用 (D070 冻结 legacy) - 5 个
  { method: 'GET',     path: '/api/trends/expert-summary',  file: 'api/modules/trends/routes.js', line: 8 },
  { method: 'POST',    path: '/api/user/initialize',        file: 'api/modules/user/routes.js', line: 23 },
  { method: 'GET',     path: '/api/user/wrong-questions/stats',  file: 'api/modules/user/routes.js', line: 28 },
  { method: 'GET',     path: '/api/user/wrong-questions/export', file: 'api/modules/user/routes.js', line: 29 },
  { method: 'POST',    path: '/api/vision/search',          file: 'api/modules/vision/routes.js', line: 14 },
];

// 下列 5 端点被 strip 排除 (curl 验证真 200, 不删):
// - DELETE /api/rag/questions/:id       (rag-search.js:636)
// - POST /api/rag/multi/upsert          (rag-search.js:745)
// - GET /api/rag/multi/questions/:qid    (rag-search.js:797)
// - DELETE /api/rag/multi/questions/:qid (rag-search.js:819)
// - GET /api/rag/multi/stats            (rag-search.js:841)
// - GET /api/tutor/mastery/:kpId        (tutor-agent.js:585)

console.log(`计划删 ${TO_DELETE.length} 端点`);

// 按 file 分组
const byFile = {};
for (const e of TO_DELETE) {
  (byFile[e.file] = byFile[e.file] || []).push(e);
}

if (DRY) {
  console.log('\n=== DRY RUN ===');
  for (const [f, entries] of Object.entries(byFile)) {
    console.log(`\n--- ${f} (${entries.length}) ---`);
    const text = readFileSync(resolve(ROOT, f), 'utf8');
    const lines = text.split('\n');
    const sorted = entries.sort((a, b) => b.line - a.line);
    for (const e of sorted) {
      const idx = e.line - 1;
      const line = lines[idx];
      console.log(`  L${e.line}: ${e.method} ${e.path}`);
      console.log(`     ↳ "${line.trim().slice(0, 80)}"`);
    }
  }
  process.exit(0);
}

// 实跑
const fs = await import('node:fs');
for (const [file, entries] of Object.entries(byFile)) {
  const fpath = resolve(ROOT, file);
  const text = readFileSync(fpath, 'utf8');
  const lines = text.split('\n');
  const sorted = entries.sort((a, b) => b.line - a.line);
  for (const e of sorted) {
    const idx = e.line - 1;
    if (idx < 0 || idx >= lines.length) {
      console.error(`  ✗ ${file}:${e.line} line out of range`);
      continue;
    }
    const line = lines[idx];
    // 防护: 跳过 router.use / router.METHOD 跟 authMiddleware, async (req, res) =>
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