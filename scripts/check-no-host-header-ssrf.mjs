#!/usr/bin/env node
/**
 * scripts/check-no-host-header-ssrf.mjs — 服务端内部自调用不得用请求头拼地址
 *
 * 起因 (2026-09-22 全仓安全扫描 F1–F3, 批次 project-fast-20260922132755):
 *   api/handlers/essay/{essayService,gradeService,transcribeService} 三处用
 *   `req.get('host')` + `req.protocol` 拼出 `${proto}://${host}/api/proxy`,
 *   还把调用方 JWT 作为 Authorization 转发过去 —— Host 头由客户端可控,
 *   等于让攻击者把"携带自己凭据的服务端请求"引导到任意主机; 加重情节是
 *   /api/auth/guest-login 为公开路由, 无需凭证即可拿到 7 天 JWT 来触发。
 *   三处是同一模式, 只靠人工/增量 diff 都会漏 —— 必须落成永久闸门。
 *
 * 判据 (机械可复现, 三遍扫描, 命中输出 file:line):
 *   1) 污点源: 从 req/request 读取 Host 类请求头 (host / x-forwarded-* /
 *      forwarded / origin / referer) 或 req.protocol 的语句 —— 记下被污染的
 *      变量名 (如 `const host = req.get('host')`)。
 *   2) URL 构造: 出现 URL 构造 (`://` 或 `new URL(`) 且引用了被污染变量的行;
 *      命中前必须能确认"这个 URL 真的被外发": 该行本身就是外发调用
 *      (fetch/axios/http.request…), 或它赋值的变量后续被外发调用使用。
 *      只解析/比对请求头 (如 CSRF 的 new URL(origin).origin 比较) 不命中。
 *
 * 已知射程边界 (不假装有判据): 跨文件/跨函数传递 (A 文件拼好 URL 传给 B 文件的
 *      helper 再发) 无法用单文件正则确认, 不在本闸门射程内。
 *
 * 放行: 配置化/本机常量基址 (如 `process.env.SELF_BASE_URL || 127.0.0.1:PORT`)
 *       —— 不含 req, 天然不匹配本判据。
 *
 * 射程: 只扫服务端代码 (api/ services/ scripts/ server.js), git tracked 文件。
 *      前端/测试夹具不参与 (那里没有服务端自调用)。
 *
 * 输出: 命中即非零退出 (release-gate 6/7 子项失败)。
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
// server-design-v2.js 是设计验证服务, 也做 /api 自调用, 一并纳入
const SCAN_ROOTS = ['api', 'services', 'scripts', 'server.js', 'server-design-v2.js'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.ts']);
// 本文件自身含"污点源"的正则字面量, 不构成命中
const SKIP_FILES = new Set(['scripts/check-no-host-header-ssrf.mjs']);

// 客户端可控、且能决定"请求发往哪台主机"的请求头
const HOST_FIELDS = new Set([
  'host',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-forwarded-for',
  'forwarded',
  'origin',
  'referer',
  'referrer',
]);

// ── 污点源正则 (只描述形状) ──
const SRC_GET = /\b(?:req|request)[?]?\s*\.\s*get\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const SRC_HEADERS = /\b(?:req|request)[?]?\s*\.\s*headers\s*[?]?\s*[.[]\s*['"]?([A-Za-z0-9_-]+)/g;
const SRC_PROTO = /\b(?:req|request)[?]?\s*\.\s*protocol\b/g;

// ── 变量声明 / 解构 ──
const DECL = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;
const DESTR = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=/;

// ── URL 构造 ──
const URLISH = /:\/\/|new\s+URL\s*\(/;
// 外发调用 (sink): 只有"拿这个 URL 真去发请求"才是 SSRF; 仅解析/比对不算
const SINK = /\b(?:fetch\s*\(|axios\s*[.(]|node-fetch|got\s*\(|superagent|http\.request|https\.request|request\s*\()/;

const tracked = (() => {
  try {
    return new Set(
      execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n')
        .filter(Boolean)
    );
  } catch {
    return null; // 非 git 环境 (如临时夹具目录) → 退化为全量扫描
  }
})();

const usesName = (line, name) => new RegExp(`\\$\\{\\s*${name}\\s*\\}|\\b${name}\\b`).test(line);

/**
 * 扫描单个文件, 返回命中 [{line, why, snippet}]
 */
function scanFile(text) {
  const lines = text.split(/\r?\n/);
  const tainted = new Set(); // 被污染的变量名
  const hits = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('#')) return;

    // 本行读到的请求头字段名
    const fields = [];
    for (const m of line.matchAll(SRC_GET)) fields.push(m[1].toLowerCase());
    for (const m of line.matchAll(SRC_HEADERS)) fields.push(m[1].toLowerCase());
    const readsProto = SRC_PROTO.test(line);
    SRC_PROTO.lastIndex = 0;

    const isTaintSource = fields.some((f) => HOST_FIELDS.has(f)) || readsProto;

    // (b0) 直接从 req / req.headers 解构出 Host 类字段:
    //      const { host } = req.headers;  /  const { protocol } = req;
    const destr0 = line.match(DESTR);
    if (destr0 && /\b(?:req|request)\b/.test(line.split('=').slice(1).join('='))) {
      for (const part of destr0[1].split(',')) {
        const [keyRaw, valRaw] = part.split(':');
        const key = keyRaw.trim().toLowerCase().replace(/['"]/g, '');
        if (!HOST_FIELDS.has(key) && key !== 'protocol') continue;
        const name = (valRaw ?? keyRaw).trim().replace(/=.*$/, '');
        if (/^[A-Za-z_$][\w$]*$/.test(name)) tainted.add(name);
      }
    }

    if (!isTaintSource) return;

    // (a) 内联: 同一行既读请求头、又拼 URL、又直接外发
    if (URLISH.test(line) && SINK.test(line)) {
      hits.push({ line: i + 1, why: '外发调用的地址直接由请求头拼出', snippet: line.slice(0, 120) });
    }

    // (b) 记下被污染的变量名
    const decl = line.match(DECL);
    if (decl) tainted.add(decl[1]);
    const destr = line.match(DESTR);
    if (destr) {
      for (const part of destr[1].split(',')) {
        const name = part.split(':').pop().trim().replace(/=.*$/, '');
        if (/^[A-Za-z_$][\w$]*$/.test(name)) tainted.add(name);
      }
    }
  });

  if (tainted.size === 0) return dedupe(hits);

  // 第二遍: 找出"用被污染变量拼出的 URL"及其承载变量
  const urlVars = []; // { name, line, snippet }
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*')) return;
    if (!URLISH.test(line)) return;
    for (const name of tainted) {
      if (!usesName(line, name)) continue;
      const decl = line.match(DECL);
      if (SINK.test(line)) {
        hits.push({ line: i + 1, why: `外发调用的地址拼入了请求头派生的 \`${name}\``, snippet: line.slice(0, 120) });
      } else if (decl) {
        // 由第三遍确认它是否真的被外发调用使用
        urlVars.push({ name: decl[1], line: i + 1, snippet: line.slice(0, 120) });
      }
      // 既不是外发调用、也没有赋给变量 (如仅解析/比对请求头) → 不构成 SSRF, 不报
      break;
    }
  });

  // 第三遍: 该 URL 变量确实被外发调用使用 → 命中 (报在 URL 构造行)
  if (urlVars.length) {
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('*')) return;
      if (!SINK.test(line)) return;
      for (const v of urlVars) {
        if (usesName(line, v.name)) {
          hits.push({
            line: v.line,
            why: `\`${v.name}\` 拼入请求头派生值, 并在第 ${i + 1} 行被外发调用`,
            snippet: v.snippet,
          });
        }
      }
    });
  }

  return dedupe(hits);
}

function dedupe(hits) {
  const seen = new Set();
  return hits.filter((h) => (seen.has(h.line) ? false : seen.add(h.line)));
}

const findings = [];

function walk(p) {
  const full = path.join(ROOT, p);
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (!SCAN_EXT.has(path.extname(p))) return;
    const rel = path.relative(ROOT, full);
    if (SKIP_FILES.has(rel)) return;
    if (tracked && !tracked.has(rel)) return;
    const text = fs.readFileSync(full, 'utf8');
    for (const h of scanFile(text)) findings.push({ file: rel, ...h });
    return;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    walk(path.join(p, entry.name));
  }
}

for (const r of SCAN_ROOTS) walk(r);

findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

if (findings.length) {
  console.error('❌ 服务端内部自调用地址不得由请求头拼出 (SSRF):');
  for (const f of findings) {
    console.error(`   ${f.file}:${f.line}  [${f.why}] ${f.snippet}`);
  }
  console.error(
    `\n共 ${findings.length} 处。请用配置化自身基址 (如 process.env.SELF_BASE_URL || \`http://127.0.0.1:\${process.env.PORT || 3002}\`), 不要用 req 的 Host / X-Forwarded-* / protocol。`
  );
  process.exit(1);
}

console.log('✓ 内部自调用地址均未取自请求头 (无 Host/protocol 拼接 SSRF)');
