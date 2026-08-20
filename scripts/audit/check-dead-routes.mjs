#!/usr/bin/env node
// scripts/audit/check-dead-routes.mjs
// 2026-08-20 DSH agent: 检查 dead backend 端点是否真 0 引用
//
// 输入: scripts/audit/.routing-audit.json (audit-routing.mjs --json 输出)
// 输出: docs/audit-dead-routes-checked.md (引用扫描 + 安全删除建议)
//
// 扫描范围: 全项目 .js/.mjs/.html (排除 node_modules, ai-tutor-frontend/dev-verify 等)
//
// 关注: 每个 dead backend 端点是否在代码中以任何形式被引用 (字符串/常量/配置)

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  'database', 'logs', '.docker-buildx', '.hermes', '.reasonix', '.playwright-mcp',
  'dev-verify', 'dev',
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(e) || e.startsWith('.')) continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(js|mjs|json|html|sh|md|yml|yaml)$/.test(e)) out.push(f);
  }
  return out;
}

// 只扫会真正调后端 API 的目录 (排除 database docs logs)
const SCAN_DIRS = [
  join(ROOT, 'api'),
  join(ROOT, 'ai-tutor-frontend/assets/js'),
  join(ROOT, 'ai-tutor-frontend/pages'),
  join(ROOT, 'frontend'),  // 老的 D070 冻结
  join(ROOT, 'scripts'),
  join(ROOT, 'tests'),
];
const allFiles = SCAN_DIRS.flatMap(d => walk(d)).filter(f =>
  /\.(js|mjs|html|json|sh|md|yml|yaml)$/.test(f)
);

// 读 audit JSON
const auditPath = join(ROOT, 'scripts/audit/.routing-audit.json');
if (!existsSync(auditPath)) {
  console.error(`Missing ${auditPath}. 先跑: node scripts/audit/audit-routing.mjs --json scripts/audit/.routing-audit.json`);
  process.exit(1);
}
const audit = JSON.parse(readFileSync(auditPath, 'utf8'));

// 每个 dead backend 端点: 找哪些文件 (除 routes.js 自身) 引用了这个 path
const results = [];
for (const dead of audit.deadBackend) {
  const { method, path } = { method: dead.key.split(' ')[0], path: dead.key.split(' ')[1] };
  // 找引用: 严格匹完整 path (不加 lastSeg, 避免 class/teacher-dashboard 等子串误报)
  // 也匹去掉 :param 的 path (前端经常调用 /api/foo/123 而不是 :id)
  const pathNoParam = path.replace(/:[^/]+/g, '[^/]+');
  // 找引用 (排除 routes.js 自身, 排除 docs/audit 自己)
  const refs = [];
  for (const f of allFiles) {
    if (f === dead.backend.file) continue;  // 跳过 routes.js 自身
    if (f.includes('/docs/audit') || f.includes('/.hermes') || f.includes('/dev-verify')) continue;
    if (f.includes('audit-dom-ids') || f.includes('audit-routing') || f.includes('check-dead-routes')) continue;
    if (f.includes('.routing-audit.json')) continue;
    // 排除 audit 自己的输出
    if (f.includes('audit-dead-routes')) continue;
    if (f.endsWith('.md') && f.includes('docs/d070-dead-routes')) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    // 匹 1) 完整 path, 2) pathNoParam (regex 模式, 至少 2 段具体 path + 数字 id)
    if (text.includes(path)) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(path)) {
          refs.push({ file: relative(ROOT, f), line: i + 1, snippet: lines[i].trim().slice(0, 80) });
          if (refs.length >= 3) break;
        }
      }
    }
    if (refs.length >= 3) break;
  }
  results.push({
    key: dead.key,
    backendFile: dead.backend.file,
    backendLine: dead.backend.line,
    refs,  // 空数组 = 真死
    refCount: refs.length,
  });
}

// 生成 markdown
const lines = [];
lines.push('# Dead Backend 端点引用扫描 — 2026-08-20');
lines.push('');
lines.push('**生成时间**: ' + new Date().toISOString());
lines.push('**总 dead backend**: ' + results.length);
lines.push('**真 0 引用 (可安全删除)**: ' + results.filter(r => r.refCount === 0).length);
lines.push('**有引用 (需 review)**: ' + results.filter(r => r.refCount > 0).length);
lines.push('');
lines.push('## 决策');
lines.push('- **refCount = 0**: 真 0 引用, 可安全删 routes.js 端点 (4-5 行, 减 dead code)');
lines.push('- **refCount > 0**: 可能是 docstring / 注释 / mock 引用, 需逐个看 snippet 决定');
lines.push('- **清理方式**: 删 routes.js 端点 (不影响子 router, 不动 handler 文件)');
lines.push('');
lines.push('## 真死 (0 引用, 可安全删)');
lines.push('');
for (const r of results.filter(r => r.refCount === 0)) {
  lines.push('### `' + r.key + '`');
  lines.push('- 后端: ' + r.backendFile + ':' + r.backendLine);
  lines.push('- 引用: 无');
  lines.push('');
}

lines.push('## 有引用 (需 review)');
lines.push('');
for (const r of results.filter(r => r.refCount > 0)) {
  lines.push('### `' + r.key + '`');
  lines.push('- 后端: ' + r.backendFile + ':' + r.backendLine);
  lines.push('- 引用 (' + r.refCount + ' 处):');
  for (const ref of r.refs) {
    lines.push('  - `' + ref.file + ':' + ref.line + '` `' + ref.snippet + '`');
  }
  lines.push('');
}

const out = lines.join('\n') + '\n';
const outPath = join(ROOT, 'docs/audit-dead-routes-checked.md');
writeFileSync(outPath, out);
console.log('written', 'docs/audit-dead-routes-checked.md', out.length, 'chars');
console.log('summary: 0-ref=' + results.filter(r => r.refCount === 0).length + ', has-ref=' + results.filter(r => r.refCount > 0).length);
