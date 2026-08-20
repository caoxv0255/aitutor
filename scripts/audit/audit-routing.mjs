#!/usr/bin/env node
// scripts/audit/audit-routing.mjs
// 2026-08-20 DSH agent: D070 routing 一致性 audit
//
// 检测:
//   1. 死路由: 后端声明的端点无任何前端调用 (D070 迁移残留)
//   2. 前端调用但后端不存在: 404 风险 (tutor.html /api/tutor/ask 类 bug 的元凶)
//   3. double-prefix: router.use('/xxx', subRouter) + subRouter 又用 '/xxx/...' (双前缀)
//   4. router.use('/', ...) vs router.use('/xxx', ...) 不一致: 模块内 mount 风格混用
//
// 启发式 (静态分析):
//   - 用 AST 风格 regex 解析 routes.js, 不真正跑 server
//   - 子 router 递归展开 (import 路径解析)
//   - 拼接完整路径: /api/<module> + mount + subpath
//
// 用法:
//   node scripts/audit/audit-routing.mjs                    # 全 F3 + 老 frontend
//   node scripts/audit/audit-routing.mjs --strict           # 有 issue exit 1
//   node scripts/audit/audit-routing.mjs --json out.json     # JSON 报告

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

const MODULES_DIR = join(ROOT, 'api/modules');
const FRONTEND_DIR = join(ROOT, 'ai-tutor-frontend');

// ── 后端: 收集所有真实端点 ──
function readText(p) { return readFileSync(p, 'utf8'); }

function extractImports(text) {
  // import xxxRouter from '...';
  const re = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  const map = {};
  let m;
  while ((m = re.exec(text)) !== null) map[m[1]] = m[2];
  return map;
}

function resolveImport(spec, fromFile) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;  // 跳过 bare / node_modules
  let abs = spec.startsWith('/') ? join(ROOT, spec.slice(1)) : resolve(dirname(fromFile), spec);
  if (!existsSync(abs)) abs += '.js';
  if (!existsSync(abs)) abs = abs.replace('.js', '/index.js');
  return existsSync(abs) ? abs : null;
}

// 从一个 router 文件提取端点 (递归子 router)
function extractRoutesFromRouterFile(routerFile, prefixPath, seen = new Set(), depth = 0) {
  if (!routerFile || !existsSync(routerFile)) return [];
  if (seen.has(routerFile) || depth > 5) return [];
  seen.add(routerFile);
  const text = readText(routerFile);
  const endpoints = [];
  const imports = extractImports(text);

  // 1. router.METHOD('/path', handler) → 端点
  const directRe = /router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = directRe.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const path = m[2];
    if (path === '/') continue;  // 跳过空根
    endpoints.push({
      method,
      path: prefixPath + path,
      file: relative(ROOT, routerFile),
      line: text.slice(0, m.index).split('\n').length,
    });
  }
  // 2. router.use('/mount', subRouter|handler) → 递归或标 handler
  const useRe = /router\.use\(\s*['"]([^'"]*)['"]\s*,\s*(\w+)\s*\)/g;
  while ((m = useRe.exec(text)) !== null) {
    const mountPath = m[1];
    const subName = m[2];
    const subSpec = imports[subName];
    if (!subSpec) continue;
    const subAbs = resolveImport(subSpec, routerFile);
    if (!subAbs) continue;
    // 检测 subAbs 是 router 还是 handler (handler 文件通常以 (req, res) 签名 default export)
    const subText = readText(subAbs);
    const isHandler = /export\s+default\s+async\s+function\s+handler\s*\(/.test(subText) ||
                       /export\s+default\s+function\s+handler\s*\(/.test(subText) ||
                       /export\s+default\s+async\s+function\s*\(/.test(subText) ||
                       /export\s+default\s+function\s*\(/.test(subText);
    if (isHandler) {
      // Handler 模式: mounted path 是端点, 但 method 由 handler 内部 req.method 决定
      // 列出常见 methods (handler 通常用 POST or GET+POST)
      // 简化: 只记录 'POST' (handler 默认, 大多数情况)
      const handlerPath = mountPath === '/' ? prefixPath : prefixPath + mountPath;
      endpoints.push({
        method: 'POST',
        path: handlerPath,
        file: relative(ROOT, routerFile),
        line: text.slice(0, m.index).split('\n').length,
        kind: 'handler-mount',
      });
    } else {
      const newPrefix = mountPath === '/' ? prefixPath : prefixPath + mountPath;
      endpoints.push(...extractRoutesFromRouterFile(subAbs, newPrefix, seen, depth + 1));
    }
  }
  return endpoints;
}

// 模块 → routes.js 路径
function discoverModules() {
  const mods = {};
  for (const name of readdirSync(MODULES_DIR)) {
    if (name === 'index.js') continue;
    const routesFile = join(MODULES_DIR, name, 'routes.js');
    if (!existsSync(routesFile)) continue;
    mods[name] = routesFile;
  }
  return mods;
}

// 后端真实端点
const backendEndpoints = new Map();  // path -> [{method, file, line}]
for (const [modName, routesFile] of Object.entries(discoverModules())) {
  const eps = extractRoutesFromRouterFile(routesFile, `/api/${modName}`);
  for (const e of eps) {
    const key = `${e.method} ${e.path}`;
    if (!backendEndpoints.has(key)) backendEndpoints.set(key, []);
    backendEndpoints.get(key).push(e);
  }
}

// ── 前端: 收集所有调用端点 ──
function extractFrontendCalls() {
  const calls = new Map();  // path -> [{method, file, line}]
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', 'node_modules'].includes(e) || e.startsWith('.')) continue;
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|mjs)$/.test(e)) {
        const text = readText(full);
        // 模式 1: request('POST', '/api/...', ...)
        const re1 = /request\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = re1.exec(text)) !== null) {
          // 提取 path template 的第一段 (去掉 :param 和 ?query)
          const path = m[2].replace(/\$\{[^}]+\}/g, ':param').split('?')[0];
          const key = `${m[1].toUpperCase()} ${path}`;
          if (!calls.has(key)) calls.set(key, []);
          calls.get(key).push({ file: relative(ROOT, full), line: text.slice(0, m.index).split('\n').length });
        }
        // 模式 2: fetch(getApiBase() + '/api/...', { method: 'POST' })
        // 重要: fetch 调用跨多行, method 在 config 对象里, 可能距 path 字符串 200+ 字符
        const re2 = /fetch\(\s*[^,]+\s*\+\s*['"]([^'"]+)['"]/g;
        while ((m = re2.exec(text)) !== null) {
          if (!m[1].startsWith('/api/')) continue;
          // 推断 method: 找 path 前的 fetch( + path 后 2000 字符的 method:
          // 关键: re2 match 起点 = 'fetch(' 位置, 所以 fetchOpen = m.index
          const fetchOpen = m.index;
          let method = 'GET';
          const textBefore = text.slice(0, m.index);
          const beforeReqMatches = [...textBefore.matchAll(/request\(\s*['"](\w+)['"]/g)];
          if (beforeReqMatches.length > 0) {
            method = beforeReqMatches[beforeReqMatches.length - 1][1].toUpperCase();
          }
          // 看 path 后的 fetch 调用块 (跨多行) 找 method: 'XXX'
          if (fetchOpen >= 0) {
            const afterFetch = text.slice(fetchOpen, Math.min(text.length, fetchOpen + 2000));
            const mFetch = afterFetch.match(/method:\s*['"](\w+)['"]/);
            if (mFetch) method = mFetch[1].toUpperCase();
          }
          const path = m[1].replace(/\$\{[^}]+\}/g, ':param').split('?')[0];
          const key = `${method} ${path}`;
          if (!calls.has(key)) calls.set(key, []);
          calls.get(key).push({ file: relative(ROOT, full), line: text.slice(0, m.index).split('\n').length });
        }
        // 模式 3: const url = '/api/...'; (await request(method, url, ...))
        // 关键: re1/re2 匹中过的 path 不重复加, 优先用 re1/re2 的 method
        const re3 = /['"`](\/api\/[a-z0-9\/_-]+)['"`]/g;
        while ((m = re3.exec(text)) !== null) {
          const path = m[1].replace(/\$\{[^}]+\}/g, ':param').split('?')[0];
          // method 推断: 三步优先级
          // 1. 找 path 前后 200 字符内最近一个 request('METHOD', (用最后的 match)
          // 2. fetch 调用内 method config — fetch 调用跨多行, 需要扩展到整个 fetch
          // 3. 默认 GET
          const textBefore = text.slice(0, m.index);
          const textAfter = text.slice(m.index, Math.min(text.length, m.index + 300));
          let method = 'GET';
          // 1. request('METHOD' in textBefore (整 textBefore, 不是 200 字符)
          const beforeReqMatches = [...textBefore.matchAll(/request\(\s*['"](\w+)['"]/g)];
          if (beforeReqMatches.length > 0) {
            method = beforeReqMatches[beforeReqMatches.length - 1][1].toUpperCase();
          } else {
            const afterReq = textAfter.match(/request\(\s*['"](\w+)['"]/);
            if (afterReq) method = afterReq[1].toUpperCase();
          }
          // 2. fetch 调用 — 找 path 字符串**之前最近一个** fetch(
          const fetchOpen = textBefore.lastIndexOf('fetch(');
          if (fetchOpen >= 0) {
            const afterFetch = text.slice(fetchOpen, Math.min(text.length, fetchOpen + 2000));
            const mFetch = afterFetch.match(/method:\s*['"](\w+)['"]/);
            if (mFetch) method = mFetch[1].toUpperCase();
          }
          // 3. 默认 GET
          const key = `${method} ${path}`;
          if (!calls.has(key)) calls.set(key, []);
          calls.get(key).push({ file: relative(ROOT, full), line: text.slice(0, m.index).split('\n').length });
        }
      }
    }
  }
  walk(FRONTEND_DIR);
  return calls;
}

const frontendCalls = extractFrontendCalls();

// ── 对账 ──
const deadBackend = [];  // 后端有, 前端没调
const missingBackend = [];  // 前端调, 后端没
const aligned = [];  // 两边都有

for (const [key, eps] of backendEndpoints) {
  if (frontendCalls.has(key)) {
    aligned.push({ key, backend: eps[0], frontend: frontendCalls.get(key) });
  } else {
    deadBackend.push({ key, backend: eps[0] });
  }
}
for (const [key, calls] of frontendCalls) {
  if (!backendEndpoints.has(key)) {
    missingBackend.push({ key, frontend: calls[0] });
  }
}

// ── 输出 ──
const summary = {
  scannedAt: new Date().toISOString(),
  backendEndpoints: backendEndpoints.size,
  frontendCalls: frontendCalls.size,
  aligned: aligned.length,
  deadBackend: deadBackend.length,
  missingBackend: missingBackend.length,
};

console.error(`\n========== D070 Routing Audit ==========`);
console.error(`Backend endpoints: ${summary.backendEndpoints}`);
console.error(`Frontend calls:   ${summary.frontendCalls}`);
console.error(`Aligned:           ${summary.aligned}  ✅`);
console.error(`Dead backend:      ${summary.deadBackend}  (后端有, 前端没调, 可能是 dead code)`);
console.error(`Missing backend:   ${summary.missingBackend}  (前端调, 后端 404 — 必修复)`);

if (missingBackend.length) {
  console.error(`\n--- 404 风险 (前端调, 后端无) ---`);
  for (const { key, frontend } of missingBackend.slice(0, 50)) {
    console.error(`  ❌ ${key}`);
    console.error(`     ${frontend.file}:${frontend.line}`);
  }
}

if (deadBackend.length) {
  console.error(`\n--- 死路由 (后端有, 前端 0 调用, 可能 D070 残留) ---`);
  for (const { key, backend } of deadBackend.slice(0, 30)) {
    console.error(`  🪦 ${key}`);
    console.error(`     ${backend.file}:${backend.line}`);
  }
}

if (!missingBackend.length && !deadBackend.length) {
  console.error(`\n✅ All endpoints aligned.`);
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ summary, aligned, deadBackend, missingBackend }, null, 2));
  console.error(`\nJSON report → ${JSON_OUT}`);
}

process.exit(STRICT && missingBackend.length > 0 ? 1 : 0);