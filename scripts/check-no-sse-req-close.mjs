#!/usr/bin/env node
/**
 * scripts/check-no-sse-req-close.mjs — SSE/流式响应禁用 req.on('close') 永久闸门
 *
 * 起因 (2026-09-23 实测复现):
 *   api/routes/tutor-agent.js 的 POST /api/tutor/ask/stream 原用
 *   `req.on('close', () => { closed = true; })` 判断客户端断连。在 Node 22 下,
 *   请求体被 express.json() 读完后 req 立刻触发 'close' (req.destroyed=true),
 *   于是 closed 在任何事件写出前就被置 true —— **整条 SSE 流是空的**
 *   (含 F1 meta, 已用真实 HTTP 探针复现)。正确写法是监听 `res.on('close')`:
 *   只有连接真正关闭才触发。
 *   这类回归靠 review 看不出来 (写法"看起来很对"), 必须变成机械可复现的闸门。
 *
 * 判据 (两段式, 宁严勿宽但可控误报):
 *   1. 命中: 后端代码里出现 `<req|request>.<on|once|addListener>('close')`
 *      (注释行/行尾注释不算命中 —— 现存的 2026-09-23 修正说明注释即属此类)。
 *   2. 上下文判定: 从命中行向上找最近的路由声明/处理函数头, 向下找下一条路由
 *      声明(或 EOF), 得到"所属 handler 区间"; 区间内出现 SSE/流式标记即判为
 *      **SSE/流式上下文 → 失败 (除非登记在 ALLOW)**; 区间内无标记 → 判为非流式
 *      请求(如普通请求的清理逻辑), **默认放行**并如实打印, 不为了"看起来干净"
 *      误杀。找不到 handler 头时退化为整文件判定。
 *
 *   SSE/流式标记: `text/event-stream` / `res.flushHeaders(` / `res.write(...)` 且
 *   同行含 `event:` 或 `data:` / `Transfer-Encoding: chunked`。
 *
 * ALLOW 登记机制 (当前为空 —— 仓库现有 0 处代码命中, 无需豁免):
 *   每项 { file, line, reason, date }, key = `file:line`。确属流式场景但又必须
 *   用 req 事件的, 才登记, 且**必须写明理由**; 正常做法是改 `res.on('close')`,
 *   不要用登记绕过。
 *
 * 空转防护: 扫描范围内若**一个 SSE/流式 handler 都没发现**, 说明扫描范围已失效
 *   (文件被搬走/重写), 闸门会静默失效 —— 此时非零退出并提示修正扫描范围。
 *
 * 射程: 后端运行时代码 api/、services/ 与 server.js、server-design-v2.js。
 *   明确不覆盖: tests/ (测试夹具常需模拟断连, 非生产路径)、frontend-v2 / frontend
 *   / public / ai-tutor-frontend (前端, 无 req 对象)、archive 与 aitutor-demo
 *   (冻结旧树)、
 *   docs/ (含大量记录该历史 bug 的文字)。跨行写法 (`req\n .on('close')`)、
 *   动态事件名 (`req.on(evName)`)、以及 `req.socket.on('close')` 不在匹配范围内。
 *   全仓人工盘点见提交说明。
 *
 * 输出: 存在未登记的 SSE/流式命中 → 非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['api', 'services'];
const SCAN_FILES = ['server.js', 'server-design-v2.js'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs']);
const SKIP_DIR = /(^|\/)(node_modules|\.git|archive|__tests__)(\/|$)/;

// ── ALLOW 白名单: 文件相对 ROOT 的路径 + 行号 ─────────────────────────────
// 每项 { file, line, reason, date }。key = `${file}:${line}`。
// 当前为空: 2026-09-23 全仓盘点后, 唯一命中是 api/routes/tutor-agent.js:696 的
// 说明性注释(不计命中); 生产代码 0 处 req.on('close')。
const ALLOW = [];

const ALLOW_KEYS = new Set(ALLOW.map((e) => `${e.file}:${e.line}`));

// ── 命中正则 ──
// req / request 的 'close' 监听 (on / once / addListener), 单双引号均可
const REQ_CLOSE = /\b(?:req|request)\s*\.\s*(?:on|once|addListener)\s*\(\s*['"]close['"]/;

// ── handler 区间判定 ──
// 路由声明: router.post('/x', …) / app.get('/x', …) —— 也用于界定 handler 结束
const ROUTE_DECL = /^\s*(?:router|app)\s*\.\s*(?:get|post|put|patch|delete|all|use)\s*\(/;
// 处理函数头: async (req, res) => { / function (req, res) {
const HANDLER_HEAD = /(?:\basync\s*\([^)]*\breq\b[^)]*\)\s*=>\s*\{)|(?:\bfunction\s*\w*\s*\([^)]*\breq\b[^)]*\)\s*\{)|(?:^\s*(?:const|let|var)\s+\w+\s*=\s*async\s*\([^)]*\breq\b)/;

// SSE / 流式标记
const SSE_MARKERS = [
  { re: /text\/event-stream/, why: "Content-Type: text/event-stream" },
  { re: /\bres\s*\.\s*flushHeaders\s*\(/, why: 'res.flushHeaders()' },
  { re: /\bres\s*\.\s*write\s*\((?:[^)]*)(?:event:|data:)/, why: 'res.write(… event:/data: …)' },
  { re: /['"]Transfer-Encoding['"]\s*[:,]\s*['"]?chunked/, why: 'Transfer-Encoding: chunked' },
];

/** 剥掉同行注释 (块注释 + 行注释; 行注释前是 `:` 时视为 URL 的一部分, 不剥) */
function stripComments(line) {
  let t = line.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = t.indexOf('//');
  if (i > 0 && t[i - 1] !== ':') t = t.slice(0, i);
  return t;
}

/** 命中行所在 handler 区间 [start, end) 的下标; 找不到头则返回整文件 */
function handlerRange(lines, hitIdx) {
  let start = -1;
  for (let i = hitIdx; i >= 0; i--) {
    if (ROUTE_DECL.test(lines[i]) || HANDLER_HEAD.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return [0, lines.length];
  let end = lines.length;
  for (let i = hitIdx + 1; i < lines.length; i++) {
    if (ROUTE_DECL.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [start, end];
}

/** 区间内第一个命中的流式标记; 无则 null */
function streamMarker(lines, start, end) {
  for (let i = start; i < end; i++) {
    for (const m of SSE_MARKERS) {
      if (m.re.test(lines[i])) return `${m.why} (L${i + 1})`;
    }
  }
  return null;
}

/** 文件内 SSE/流式 handler 区间数 (与是否有命中无关 —— 供空转防护用) */
function countStreamRegions(lines) {
  const starts = [];
  lines.forEach((l, i) => {
    if (ROUTE_DECL.test(l) || HANDLER_HEAD.test(l)) starts.push(i);
  });
  const seen = new Set();
  let n = 0;
  for (const s of starts) {
    if (seen.has(s)) continue;
    seen.add(s);
    let end = lines.length;
    for (let i = s + 1; i < lines.length; i++) {
      if (ROUTE_DECL.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (streamMarker(lines, s, end)) n += 1;
  }
  return n;
}

/** 扫描单文件: 返回 { hits: [...], sseRegions: n } */
function scanFile(rel, text) {
  const raw = text.split(/\r?\n/);
  const lines = raw.map(stripComments);
  const hits = [];

  raw.forEach((rawLine, i) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    // 整行注释 (含 2026-09-23 那条修正说明) 不参与命中判定
    if (/^(\/\/|\/\*|\*|#)/.test(trimmed)) return;
    const line = lines[i];
    if (!REQ_CLOSE.test(line)) return;

    const [start, end] = handlerRange(lines, i);
    const marker = streamMarker(lines, start, end);
    hits.push({
      file: rel,
      line: i + 1,
      sse: Boolean(marker),
      marker,
      snippet: trimmed.slice(0, 120),
    });
  });

  return { hits, sseRegions: countStreamRegions(lines) };
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relDir = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(relDir)) continue;
      walk(full, out);
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
    for (const h of r.hits) out.hits.push(h);
    out.sseRegions += r.sseRegions;
  }
}

const out = { hits: [], sseRegions: 0 };
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), out);
for (const f of SCAN_FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const r = scanFile(f, fs.readFileSync(p, 'utf8'));
  for (const h of r.hits) out.hits.push(h);
  out.sseRegions += r.sseRegions;
}

const sortHits = (arr) =>
  arr.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

const blocking = sortHits(
  out.hits.filter((h) => h.sse && !ALLOW_KEYS.has(`${h.file}:${h.line}`))
);
const passed = sortHits(out.hits.filter((h) => !h.sse));

// ── 空转防护: 扫描范围内没有任何 SSE/流式 handler → 闸门已失去意义 ──
if (out.sseRegions === 0) {
  console.error(
    '❌ 闸门空转: 扫描范围内未发现任何 SSE/流式 handler —— SCAN_DIRS/SCAN_FILES 已失效或流式端点被移走。\n' +
      `   当前扫描: ${[...SCAN_DIRS, ...SCAN_FILES].join(', ')}\n` +
      '   请修正 scripts/check-no-sse-req-close.mjs 的扫描范围, 不要让闸门静默失效。'
  );
  process.exit(1);
}

// 先如实打印放行的非流式监听 (失败时也要能看到, 否则无法核对"没误杀")
if (passed.length) {
  console.log('· 非 SSE/流式上下文的 req \'close\' 监听 (默认放行, 非流式请求的清理逻辑):');
  for (const h of passed) {
    console.log(`   ${h.file}:${h.line}  ${h.snippet}`);
  }
}

if (blocking.length) {
  console.error('❌ SSE/流式响应里用了 req.on(\'close\') (Node 22 下请求体读完即触发 → 整条流为空):');
  for (const h of blocking) {
    console.error(`   ${h.file}:${h.line}  [SSE/流式: ${h.marker}] ${h.snippet}`);
  }
  console.error(
    `\n共 ${blocking.length} 处。请改为 \`res.on('close', …)\` (只有连接真正关闭才触发);` +
      '确需例外才登记到 scripts/check-no-sse-req-close.mjs 的 ALLOW (含理由 + 日期)。'
  );
  process.exit(1);
}

console.log(
  `✓ 无 SSE/流式响应使用 req.on('close') (扫描 ${out.sseRegions} 个流式 handler, ` +
    `放行 ${passed.length} 处非流式监听)`
);
