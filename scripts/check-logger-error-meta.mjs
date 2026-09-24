#!/usr/bin/env node
/**
 * scripts/check-logger-error-meta.mjs — logger meta.error 必须传 Error 对象 永久闸门
 *
 * 起因 (2026-09-24, M-2b 余波):
 *   api/handlers/upload/imageHandler.js 等 11 处把 `{ error: e.message }` 传给 logger ——
 *   传的是字符串, 而 api/core/logger.js:70 按 `meta.error.message` 取详情
 *   (logger.js:113 亦按 `meta.error?.stack` 取堆栈)。字符串没有 .message/.stack,
 *   于是这两个字段**静默变成 undefined, 日志里 err.message 直接丢失** —— 响应体那边
 *   已改为固定文案 (M-2b), 但可观测性没了: 排障时只有 "[upload] sharp processing failed",
 *   不知道 sharp 到底报了什么。这类"写得像对的、跑起来不报错、但详情没了"的缺陷
 *   review 看不出来, 必须机械化拦截。
 *
 * 判据 (机械可复现, 基于 acorn AST, 不做数据流分析):
 *   1. 找到 `logger.<method>(...)` 调用 (含可选链 `logger.error?.(...)`), 方法名任意。
 *   2. 取其**直接实参**里的 ObjectExpression (即 meta), 找 key 为 `error` 的属性。
 *   3. 若该属性的值"字符串形态"→ **判红**:
 *        - `X.message` 成员访问 (e.message / err.message …)
 *        - 模板串 `` `…${e.message}` ``
 *        - `String(e)` / `e.toString()` 调用
 *        - 字符串字面量 `'…'`
 *        - `+` 拼接、`a || b`、三元表达式 —— 递归看任一分支是否字符串形态
 *   放行 (对象形态, logger.js 能取到细节):
 *        - `{ error: e }` / `{ error: err }` / `{ error: someError }` (标识符)
 *        - meta 里根本没有 `error` 字段的调用
 *   AST 天然区分: 注释里的 `error: e.message` 文本、字符串字面量内部的
 *   "error: e.message" 都不是表达式 → 不命中。
 *
 *   注意: `formatObsFields({ error: err.message })` 这类把字段**拼进 message 字符串**的
 *   写法不在射程内 (详情已进 message, 未丢失); 本闸门只看 logger 调用的 meta 对象。
 *
 * ALLOW 登记机制: 每项 { file, line, reason, date }, key = `file:line`。
 *   仅登记"确属有意, 且已另行保证详情进入日志"的极少数例外才豁免;
 *   常规修复一律改成 `{ error: e }`, 不得用登记绕过。
 *
 * 空转防护: 扫描范围内若**一个文件都没扫到**, 或**一个 logger.<method>(...) 调用都没发现**,
 *   说明 SCAN_DIRS/SCAN_FILES 或判据已失效 (文件被搬走/重写) —— 此时非零退出并提示,
 *   绝不静默 pass。解析失败的文件一律如实判红。
 *
 * 射程: 后端运行时代码 api/ + services/ 与 server.js、server-design-v2.js (与
 *   check-no-err-message-echo.mjs 一致)。明确不覆盖 tests/ (夹具常故意构造)、
 *   frontend/public (前端无此 logger) 与 scripts/ (一次性脚本, 传参形态各异)。
 *   数据流不覆盖: `const meta = { error: e.message }; logger.error(msg, meta)` 这种经变量
 *   中转的写法不在 AST 实参判据内, 需人工兜底。
 *
 * 输出: 存在未登记的命中 / 解析失败 → 非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const ROOT = process.cwd();
const SCAN_DIRS = ['api', 'services'];
const SCAN_FILES = ['server.js', 'server-design-v2.js'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs']);
const SKIP_DIR = /(^|\/)(node_modules|\.git|archive|dist|coverage|__tests__|tests?)(\/|$)/;

// ── ALLOW 白名单: 文件相对 ROOT 的路径 + 行号 ─────────────────────────────
// 每项 { file, line, reason, date }。key = `${file}:${line}`。
const ALLOW = [
  // 目前为空: 11 处同类误用已全部改为 { error: e } (2026-09-24)。
];

const ALLOW_KEYS = new Set(ALLOW.map((e) => `${e.file}:${e.line}`));

/** logger.<method> 调用? 是则返回方法名, 否则 null (含可选链 logger.error?.(…)) */
function loggerMethod(node) {
  if (node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression' || callee.computed) return null;
  if (!callee.object || callee.object.type !== 'Identifier' || callee.object.name !== 'logger') return null;
  if (!callee.property || callee.property.type !== 'Identifier') return null;
  return callee.property.name;
}

/** 取 ObjectExpression 上 key 为 error 的属性 (支持 { error } 简写与 'error' 字面量 key) */
function errorProperty(objExpr) {
  for (const p of objExpr.properties) {
    if (!p || p.type !== 'Property') continue;
    const k = p.key;
    if (!k) continue;
    if (!p.computed && k.type === 'Identifier' && k.name === 'error') return p;
    if (k.type === 'Literal' && k.value === 'error') return p;
  }
  return null;
}

/** 值是否为"字符串形态"(传进去会被 logger 的 meta.error.message 取不到) */
function isStringLike(node) {
  if (!node) return false;
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string';
    case 'TemplateLiteral':
      return true;
    case 'BinaryExpression':
      return node.operator === '+' && (isStringLike(node.left) || isStringLike(node.right));
    case 'MemberExpression':
      return !node.computed && node.property && node.property.name === 'message';
    case 'CallExpression': {
      const c = node.callee;
      if (c && c.type === 'Identifier' && c.name === 'String') return true;
      if (c && c.type === 'MemberExpression' && !c.computed && c.property && c.property.name === 'toString') {
        return true;
      }
      return false;
    }
    case 'ConditionalExpression':
      return isStringLike(node.consequent) || isStringLike(node.alternate);
    case 'LogicalExpression':
      return isStringLike(node.left) || isStringLike(node.right);
    default:
      return false;
  }
}

/** 通用 AST 遍历 */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) walk(c, visit);
    } else if (val && typeof val.type === 'string') {
      walk(val, visit);
    }
  }
}

function parseAst(text) {
  const opts = {
    ecmaVersion: 'latest',
    locations: true,
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
  };
  try {
    return acorn.parse(text, { ...opts, sourceType: 'module' });
  } catch {
    return acorn.parse(text, { ...opts, sourceType: 'script' });
  }
}

/** 扫描单文件: 返回 { hits, green, loggerCalls, parseError } */
function scanFile(rel, text) {
  let ast;
  try {
    ast = parseAst(text);
  } catch (e) {
    return { hits: [], green: [], loggerCalls: 0, parseError: e.message };
  }
  const rawLines = text.split(/\r?\n/);
  const hits = [];
  const green = [];
  let loggerCalls = 0;

  walk(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const method = loggerMethod(node);
    if (!method) return;
    loggerCalls += 1;

    for (const arg of node.arguments) {
      if (!arg || arg.type !== 'ObjectExpression') continue;
      const prop = errorProperty(arg);
      if (!prop) continue;
      const line = prop.loc.start.line;
      const snippet = (rawLines[line - 1] || '').trim().slice(0, 120);
      const rec = { file: rel, line, method, snippet };
      if (isStringLike(prop.value)) hits.push(rec);
      else green.push(rec);
    }
  });

  return { hits, green, loggerCalls, parseError: null };
}

function walkDir(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relDir = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(relDir)) continue;
      walkDir(full, out);
      continue;
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    if (SKIP_DIR.test(relDir)) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    const r = scanFile(rel, text);
    out.scannedFiles += 1;
    out.loggerCalls += r.loggerCalls;
    out.hits.push(...r.hits);
    out.green.push(...r.green);
    if (r.parseError) out.parseErrors.push({ file: rel, message: r.parseError });
  }
}

const out = { hits: [], green: [], parseErrors: [], loggerCalls: 0, scannedFiles: 0 };
for (const d of SCAN_DIRS) walkDir(path.join(ROOT, d), out);
for (const f of SCAN_FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const r = scanFile(f, fs.readFileSync(p, 'utf8'));
  out.scannedFiles += 1;
  out.loggerCalls += r.loggerCalls;
  out.hits.push(...r.hits);
  out.green.push(...r.green);
  if (r.parseError) out.parseErrors.push({ file: f, message: r.parseError });
}

const sortRecs = (arr) => arr.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

// 去重 (同一行可能多次命中)
const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((r) => {
    const k = `${r.file}:${r.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const blocking = sortRecs(dedupe(out.hits.filter((h) => !ALLOW_KEYS.has(`${h.file}:${h.line}`))));
const allowed = sortRecs(dedupe(out.hits.filter((h) => ALLOW_KEYS.has(`${h.file}:${h.line}`))));
const green = sortRecs(dedupe(out.green));

// ── 空转防护: 扫不到文件 / 扫不到任何 logger 调用 → 闸门已失去意义 ──
if (out.scannedFiles === 0) {
  console.error(
    '❌ 闸门空转: 扫描范围内一个文件都没扫到 —— SCAN_DIRS/SCAN_FILES 路径已失效。\n' +
      `   当前扫描: ${[...SCAN_DIRS, ...SCAN_FILES].join(', ')}\n` +
      '   请修正 scripts/check-logger-error-meta.mjs 的扫描范围, 不要让闸门静默通过。'
  );
  process.exit(1);
}
if (out.loggerCalls === 0) {
  console.error(
    `❌ 闸门空转: 扫描了 ${out.scannedFiles} 个文件, 但未发现任何 logger.<method>(...) 调用\n` +
      '   —— 判据已失效 (logger 被换名/被搬走)。\n' +
      '   请修正 scripts/check-logger-error-meta.mjs 的判据, 不要让闸门静默通过。'
  );
  process.exit(1);
}

let failed = false;

if (out.parseErrors.length) {
  console.error('❌ 以下文件无法解析 (acorn), 无法验证 —— 如实判红:');
  for (const p of out.parseErrors) console.error(`   ${p.file}  ${p.message}`);
  failed = true;
}

if (allowed.length) {
  console.log('· 已登记豁免:');
  for (const h of allowed) console.log(`   ${h.file}:${h.line}  ${h.snippet}`);
}

console.log(`· logger 调用中 meta.error 传对象 —— 放行 ${green.length} 处` + (green.length ? ':' : ''));
for (const g of green.slice(0, 25)) console.log(`   ${g.file}:${g.line}  ${g.snippet}`);
if (green.length > 25) console.log(`   … 其余 ${green.length - 25} 处同理放行`);

if (blocking.length) {
  console.error('❌ logger meta.error 传了字符串 (详情会被 logger.js 静默丢弃):');
  for (const h of blocking) {
    console.error(`   ${h.file}:${h.line}  [logger.${h.method}] ${h.snippet}`);
  }
  console.error(
    `\n共 ${blocking.length} 处。请改为传 **Error 对象** (如 { error: e }) —— logger.js 按` +
      ` meta.error.message / meta.error.stack 取详情; 传 e.message 会取不到。` +
      ` 确属有意才登记到 scripts/check-logger-error-meta.mjs 的 ALLOW (含理由 + 日期)。`
  );
  failed = true;
}

if (failed) process.exit(1);

console.log(
  `✓ logger meta.error 均为对象形态 (扫描 ${out.scannedFiles} 个文件 / ${out.loggerCalls} 个 logger 调用, ` +
    `传对象 ${green.length} 处 / 未传 error 字段的调用不适用)`
);
