#!/usr/bin/env node
/**
 * scripts/check-no-err-message-echo.mjs — 错误对象 message 禁入响应体 永久闸门 (M-2b)
 *
 * 起因 (2026-09-23 波次4 M-2b):
 *   多处路由把 `err.message` 直接拼进返回给客户端的错误文案, 泄露内部实现细节
 *   (SQL 片段 / 文件路径 / 上游报错原文)。先例 79897e2 已在 tutor-agent.js 手工修过
 *   3 处 (M-2a), 但同类写法散布 27+ 处 —— 只靠人工必然遗漏, 必须机械化。
 *
 * 判据 (机械可复现, 基于 AST 而非字符串形状 —— 精确, 不做数据流分析):
 *   用 acorn 解析源文件, 收集两类节点:
 *     1. 客户端响应体 sink 的**实参范围** (每个实参节点的 [start,end) 区间):
 *        - 函数式: errorResponse( / createErrorResponse( / errorJson( /
 *          legacyReply( / sendErrorResponse(
 *        - 方法式: res.json( / res.send( / res.render( / res.end( / res.write( 及
 *          res.status(...).json( / .send( / .end(
 *     2. `X.message` 成员访问, 其中 X 为错误对象标识符:
 *        `err` / `error` / `e` / 或以 `Err`、`Error` 结尾 (sqlErr, txErr, someError …),
 *        含可选链 `err?.message`。
 *   命中 = 某 `X.message` 节点落在任一 sink 实参区间内 → **判红** (拼进响应体)。
 *   AST 天然区分: 模板串插值 `${err.message}` 与拼接 `'x: ' + err.message` 里的
 *   err.message 是表达式 → 命中; 而字符串字面量内部的 "err.message" 文本、
 *   注释里的 err.message 都不是表达式 → 不命中。
 *
 *   放行 (如实打印, 不为了"看起来干净"误杀):
 *     - 只进日志: console.error(… err.message) / logger.error(… err.message)
 *     - 只用于状态码判断: `const status = err.message.includes('API Key') ? 503 : 500;`
 *     - 抛出/返回给服务层: `throw new Error(…err.message…)`、`return { error: err.message }`
 *       —— 均不在响应体 sink 实参内, 天然放行。
 *
 * ALLOW 登记机制: 每项 { file, line, reason, date }, key = `file:line`。
 *   仅登记"受控、面向用户"的校验类 message (非内部实现细节泄露) 才豁免;
 *   确属泄露的一律改固定文案 + err.message 只留给日志, 不得用登记绕过。
 *
 * 空转防护: 扫描范围内若**一个文件都没扫到**, 或**一个响应体 sink 都没发现**,
 *   说明 SCAN_DIRS/SCAN_FILES 或 sink 判据已失效 (文件被搬走/重写), 闸门会静默失效
 *   —— 此时非零退出并提示修正扫描范围, 绝不静默 pass。解析失败的文件一律如实判红。
 *
 * 射程: 后端运行时代码 api/ + services/ 与 server.js、server-design-v2.js。
 *   明确不覆盖: tests/ (夹具常需构造错误)、frontend 与 public / ai-tutor-frontend
 *   (前端, 无 err 对象进了响应体这一形态)、archive 与 aitutor-demo (冻结旧树)。
 *   数据流不覆盖: 服务层把 message 放进返回对象、再由路由 `res.json(那个对象)` 透传;
 *   全局错误中间件 errorHandler.js 的 `sendErrorResponse(error, …)` 直接把
 *   error.message 写出 —— 这两类跨语句数据流不在本 AST 实参区间判据内, 需人工兜底。
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
// 登记标准: message 受控且面向用户 (校验反馈), **非**内部实现细节泄露。
const ALLOW = [
  {
    file: 'api/handlers/login.js',
    line: 17,
    reason: 'validateLogin 抛出的 AppError message 为静态校验文案(邮箱格式/密码长度等), 受控且面向用户, 非内部细节泄露',
    date: '2026-09-23',
  },
  {
    file: 'api/modules/exam/routes.js',
    line: 313,
    reason: 'QueryParamError message 由字段名+取值范围拼成的校验文案(400), 受控且面向用户, 非内部细节泄露',
    date: '2026-09-23',
  },
];

const ALLOW_KEYS = new Set(ALLOW.map((e) => `${e.file}:${e.line}`));

// ── 响应体 sink 名称 (函数式调用) ──
const SINK_FNS = new Set(['errorResponse', 'createErrorResponse', 'errorJson', 'legacyReply', 'sendErrorResponse']);
// ── 响应体 sink 方法名 (res.<m>(...) / res.status(...).<m>(...)) ──
const SINK_RES_METHODS = new Set(['json', 'send', 'render', 'end', 'write']);

/** 错误对象标识符: err / error / e / 以 Err 或 Error 结尾 */
function isErrFamily(name) {
  return name === 'err' || name === 'error' || name === 'e' || /(?:Err|Error)$/.test(name);
}

/** 判定 CallExpression 是否为客户端响应体 sink; 是则返回 sink 名, 否则 null */
function sinkName(node) {
  if (node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (!callee) return null;
  if (callee.type === 'Identifier') {
    return SINK_FNS.has(callee.name) ? `${callee.name}(` : null;
  }
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property) {
    const prop = callee.property.name;
    if (!SINK_RES_METHODS.has(prop)) return null;
    const obj = callee.object;
    if (obj && obj.type === 'Identifier' && obj.name === 'res') return `res.${prop}(`;
    if (obj && obj.type === 'CallExpression' && obj.callee && obj.callee.type === 'MemberExpression') {
      const inner = obj.callee;
      if (
        !inner.computed &&
        inner.property &&
        inner.property.name === 'status' &&
        inner.object &&
        inner.object.type === 'Identifier' &&
        inner.object.name === 'res'
      ) {
        return `res.status(...).${prop}(`;
      }
    }
  }
  return null;
}

/** 通用 AST 遍历 (无 parent 指针, 递归安全) */
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

/** 扫描单文件: 返回 { hits, green, sinks, parseError } */
function scanFile(rel, text) {
  let ast;
  try {
    ast = parseAst(text);
  } catch (e) {
    return { hits: [], green: [], sinks: 0, parseError: e.message };
  }
  const rawLines = text.split(/\r?\n/);
  const sinkSpans = [];
  const errMsgs = [];

  walk(ast, (node) => {
    if (node.type === 'CallExpression') {
      const name = sinkName(node);
      if (name) {
        for (const arg of node.arguments) {
          if (arg && typeof arg.start === 'number') {
            sinkSpans.push({ start: arg.start, end: arg.end, name });
          }
        }
      }
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property &&
      node.property.name === 'message' &&
      node.object &&
      node.object.type === 'Identifier' &&
      isErrFamily(node.object.name)
    ) {
      errMsgs.push(node);
    }
  });

  const hits = [];
  const green = [];
  const seen = new Set();
  for (const m of errMsgs) {
    const span = sinkSpans.find((s) => m.start >= s.start && m.end <= s.end);
    const line = m.loc.start.line;
    const snippet = (rawLines[line - 1] || '').trim().slice(0, 120);
    const rec = { file: rel, line, snippet };
    if (span) {
      const k = `${rel}:${line}`;
      if (seen.has(k)) continue;
      seen.add(k);
      hits.push({ ...rec, sink: span.name });
    } else {
      green.push(rec);
    }
  }

  return { hits, green, sinks: sinkSpans.length, parseError: null };
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
    out.sinks += r.sinks;
    out.hits.push(...r.hits);
    out.green.push(...r.green);
    if (r.parseError) out.parseErrors.push({ file: rel, message: r.parseError });
  }
}

const out = { hits: [], green: [], parseErrors: [], sinks: 0, scannedFiles: 0 };
for (const d of SCAN_DIRS) walkDir(path.join(ROOT, d), out);
for (const f of SCAN_FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const r = scanFile(f, fs.readFileSync(p, 'utf8'));
  out.scannedFiles += 1;
  out.sinks += r.sinks;
  out.hits.push(...r.hits);
  out.green.push(...r.green);
  if (r.parseError) out.parseErrors.push({ file: f, message: r.parseError });
}

const sortRecs = (arr) => arr.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

const blocking = sortRecs(out.hits.filter((h) => !ALLOW_KEYS.has(`${h.file}:${h.line}`)));
const allowed = sortRecs(out.hits.filter((h) => ALLOW_KEYS.has(`${h.file}:${h.line}`)));

// ── 空转防护: 扫不到文件 / 扫不到任何响应体 sink → 闸门已失去意义 ──
if (out.scannedFiles === 0) {
  console.error(
    '❌ 闸门空转: 扫描范围内一个文件都没扫到 —— SCAN_DIRS/SCAN_FILES 路径已失效。\n' +
      `   当前扫描: ${[...SCAN_DIRS, ...SCAN_FILES].join(', ')}\n` +
      '   请修正 scripts/check-no-err-message-echo.mjs 的扫描范围, 不要让闸门静默通过。'
  );
  process.exit(1);
}
if (out.sinks === 0) {
  console.error(
    `❌ 闸门空转: 扫描了 ${out.scannedFiles} 个文件, 但未发现任何客户端响应体 sink\n` +
      '   (errorResponse / res.json / res.status(...).json / errorJson …) —— 判据已失效。\n' +
      '   请修正 scripts/check-no-err-message-echo.mjs 的 sink 判据, 不要让闸门静默通过。'
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
  console.log('· 已登记豁免 (受控校验文案, 非内部细节泄露):');
  for (const h of allowed) console.log(`   ${h.file}:${h.line}  ${h.snippet}`);
}

if (out.green.length) {
  console.log(`· 非响应体上下文 (日志/状态码/抛出/返回服务层) —— 放行 ${out.green.length} 处, 举例如下:`);
  for (const g of out.green.slice(0, 25)) console.log(`   ${g.file}:${g.line}  ${g.snippet}`);
  if (out.green.length > 25) console.log(`   … 其余 ${out.green.length - 25} 处同理放行`);
}

if (blocking.length) {
  console.error('❌ 错误对象 message 被拼进客户端响应体 (泄露内部实现细节):');
  for (const h of blocking) {
    console.error(`   ${h.file}:${h.line}  [sink: ${h.sink}] ${h.snippet}`);
  }
  console.error(
    `\n共 ${blocking.length} 处。请改为固定文案 (与该端点语境匹配), err.message 只保留给` +
      ` console.error/logger.error; 确属受控校验文案才登记到` +
      ` scripts/check-no-err-message-echo.mjs 的 ALLOW (含理由 + 日期)。`
  );
  failed = true;
}

if (failed) process.exit(1);

console.log(
  `✓ 无错误对象 message 进入响应体 (扫描 ${out.scannedFiles} 个文件 / ${out.sinks} 个响应体 sink, ` +
    `豁免 ${allowed.length} 处 / 放行 ${out.green.length} 处非响应体用法)`
);
