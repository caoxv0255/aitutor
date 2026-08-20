#!/usr/bin/env node
// scripts/audit/audit-dom-ids.mjs
// 2026-08-20 DSH agent: 扫 "HTML data-dom-id vs JS 引用" 死按钮/死引用
//
// 死按钮 = HTML 写了 data-dom-id="X" 但 JS 0 引用 (点了无反应)
// 死引用 = JS querySelector('[data-dom-id="X"]') 但 HTML 没对应 (代码永远 null)
//
// 用途:
//   1. 防止 D070 重构时漏绑定 click handler
//   2. CI 友好: --strict 模式下有 issue exit 1
//
// 用法:
//   node scripts/audit/audit-dom-ids.mjs                     # 扫 F3 + 老 frontend
//   node scripts/audit/audit-dom-ids.mjs --f3-only          # 只扫 F3
//   node scripts/audit/audit-dom-ids.mjs --strict           # 有 issue 退出 1
//   node scripts/audit/audit-dom-ids.mjs --json out.json    # JSON 报告
//
// 设计:
//   - 同步 (不用 headed), 纯文本扫描
//   - HTML <script src> 递归 resolve, 解析内联 + 外链
//   - 三种 query: querySelector / getElementById / closest('[data-dom-id="X"]')
//   - 排除 dev 资源 (dev-rag-tools, headed-tests 目录) 跟 build 产物

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const F3_ONLY = args.includes('--f3-only');
const STRICT = args.includes('--strict');
const VERBOSE = args.includes('--verbose');
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

// 排除目录 (不入扫描范围)
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  'frontend/dev-verify',  // 自指截图不入仓代码
  'frontend/dev',         // dev 工具目录 (D070 已冻结)
  'frontend/redesign',     // D070 已删除
  '.devcontainer', 'database', 'logs',
]);

// ── 文件收集 ──
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.html$|\.js$|\.mjs$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const HTML_DIRS = F3_ONLY
  ? [join(ROOT, 'ai-tutor-frontend/pages')]
  : [join(ROOT, 'ai-tutor-frontend/pages'), join(ROOT, 'frontend')];

const allFiles = HTML_DIRS.flatMap(d => walk(d));
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
// JS 文件: HTML 所在目录的 .js + ai-tutor-frontend/assets/js/ 全集 (F3 外链资产)
const jsFromHtmlDirs = allFiles.filter(f => /\.(js|mjs)$/.test(f) && !f.endsWith('.config.js'));
const assetsJs = walk(join(ROOT, 'ai-tutor-frontend/assets/js')).filter(f => /\.(js|mjs)$/.test(f));
const jsFiles = Array.from(new Set([...jsFromHtmlDirs, ...assetsJs]));

// ── HTML 扫描: 找 data-dom-id + 提取 <script src> + 收集同元素 id 关联 ──
function extractDomIds(htmlPath) {
  const text = readFileSync(htmlPath, 'utf8');
  const ids = []; // { id, line, col, domIdLine }
  // 用 indexOf 逐个匹配拿行号
  const re = /data-dom-id="([^"]+)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const line = before.split('\n').length;
    const col = m.index - before.lastIndexOf('\n');
    // 找该元素最近的 id="..." (同行或前 200 字符内, 找同标签)
    const tagStart = text.lastIndexOf('<', m.index);
    const tagEnd = text.indexOf('>', m.index);
    const tagSnippet = tagStart >= 0 && tagEnd > tagStart ? text.slice(tagStart, tagEnd) : '';
    const idMatch = tagSnippet.match(/\bid="([^"]+)"/);
    ids.push({ id: m[1], line, col, tagId: idMatch ? idMatch[1] : null });
  }
  // 找 <script src="...">
  const srcs = [];
  const reS = /<script[^>]+src=["']([^"']+)["']/g;
  while ((m = reS.exec(text)) !== null) {
    srcs.push(m[1]);
  }
  return { ids, scriptSrcs: srcs, text };
}

// 解析 script src (相对 HTML 路径)
function resolveScript(src, htmlPath) {
  if (/^https?:\/\//.test(src)) return null;  // CDN, 跳过
  if (src.startsWith('/')) return join(ROOT, src.slice(1));
  return resolve(dirname(htmlPath), src);
}

// ── JS 扫描: 找 querySelector/getElementById/closest + data-dom-id 引用 ──
function extractJsDomIdRefs(jsPath) {
  const text = readFileSync(jsPath, 'utf8');
  const refs = []; // { id, line, kind }
  // 三种引用方式:
  //   - querySelector('[data-dom-id="X"]') 或 '[data-dom-id="X"]'
  //   - getElementById('X') (但 data-dom-id 不直接绑 id, 主要用在 nav 元素)
  //   - closest('[data-dom-id="X"]')
  const re = /data-dom-id="([^"]+)"|data-dom-id='([^']+)'/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1] || m[2];
    const before = text.slice(0, m.index);
    const line = before.split('\n').length;
    // 推断 query 方式
    const around = text.slice(Math.max(0, m.index - 40), m.index);
    let kind = 'unknown';
    if (/querySelector|querySelectorAll/.test(around)) kind = 'querySelector';
    else if (/getElementById/.test(around)) kind = 'getElementById';
    else if (/closest/.test(around)) kind = 'closest';
    refs.push({ id, line, kind, file: jsPath });
  }
  return refs;
}

// ── 核心: 收集所有 HTML 的 data-dom-id + 对应 JS 引用 ──
const htmlIdMap = new Map();  // id -> [{ htmlFile, line, col }, ...]
const jsIdRefMap = new Map(); // id -> [{ jsFile, line, kind }, ...]
const tagIdToDomIds = new Map(); // id (html id) -> [dom-id] (该 id="X" 元素上挂的所有 data-dom-id)

for (const f of htmlFiles) {
  const { ids, scriptSrcs } = extractDomIds(f);
  for (const { id, line, col, tagId } of ids) {
    if (!htmlIdMap.has(id)) htmlIdMap.set(id, []);
    htmlIdMap.get(id).push({ htmlFile: f, line, col });
    // 关联: 如果该元素同时有 id="X" + data-dom-id="Y", 记入 tagIdToDomIds
    if (tagId) {
      if (!tagIdToDomIds.has(tagId)) tagIdToDomIds.set(tagId, []);
      if (!tagIdToDomIds.get(tagId).includes(id)) {
        tagIdToDomIds.get(tagId).push(id);
      }
    }
  }
}

// 收集每个 HTML 引用的所有 JS (内联 + 外链) + assets/js/ 全集
for (const f of htmlFiles) {
  const { text, scriptSrcs } = extractDomIds(f);
  // 内联 <script type="module"> 或无 type 都在 HTML 里
  const inlineRefs = extractRefsFromText(text, f);
  for (const r of inlineRefs) {
    if (!jsIdRefMap.has(r.id)) jsIdRefMap.set(r.id, []);
    jsIdRefMap.get(r.id).push(r);
  }
  // 外链 <script src>
  for (const src of scriptSrcs) {
    const abs = resolveScript(src, f);
    if (!abs || !existsSync(abs)) continue;
    if (abs.endsWith('.js') || abs.endsWith('.mjs')) {
      try {
        const refText = readFileSync(abs, 'utf8');
        const refs = extractRefsFromText(refText, abs);
        for (const r of refs) {
          if (!jsIdRefMap.has(r.id)) jsIdRefMap.set(r.id, []);
          jsIdRefMap.get(r.id).push(r);
        }
      } catch {}
    }
  }
}

// 关键修复: assets/js/ 下的所有 JS (F3 service / hooks / navator) 不在 HTML <script src> 里
// 但里面的 querySelector('[data-dom-id="X"]') 也是合法引用. 必须直接扫整个 jsFiles 集.
// 两轮:
//   第一轮: 找 querySelector / getElementById / closest 真正的事件绑定 (kind !== 'unknown')
//   第二轮: 找 JS 字符串模板里的 data-dom-id="X" (kind = 'template', 给 id 一个 "动态 HTML 源" 标记)
//   死引用 = 只有 querySelector ref 但既无 HTML 静态, 也无 JS template 动态
// 注: HTML 文件本身不用第二轮 — HTML 里的 <button data-dom-id="X"> 是真元素, 不算 template
for (const f of jsFiles) {
  try {
    const text = readFileSync(f, 'utf8');

    // 第一轮: 真正的 query 绑定 (ref 内 kind = querySelector / getElementById / closest)
    const refs = extractRefsFromText(text, f);
    for (const r of refs) {
      if (r.kind === 'unknown') continue;  // 模板字符串里的 id, 留给第二轮
      if (!jsIdRefMap.has(r.id)) jsIdRefMap.set(r.id, []);
      jsIdRefMap.get(r.id).push(r);
    }

    // 第二轮 (只对 JS 文件): 找所有 data-dom-id="X" (含模板字符串), 加 kind = 'template'
    // 这让一个 id 即使无静态 HTML, 也能被"JS 动态生成" 解释掉
    const re = /data-dom-id="([^"]+)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      if (!jsIdRefMap.has(id)) jsIdRefMap.set(id, []);
      const arr = jsIdRefMap.get(id);
      if (!arr.some(r => r.file === f && r.line === line)) {
        arr.push({ id, line, kind: 'template', file: f });
      }
    }
  } catch {}
}

function extractRefsFromText(text, filePath) {
  // 只扫 <script>...</script> 块内的 JS 引用, 跳过 HTML 元素里的 data-dom-id 属性.
  // HTML 元素的 data-dom-id 在 htmlIdMap 已经收集, 不该当 JS ref.
  const refs = [];
  // 找所有 <script ...> ... </script> 块
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let block;
  while ((block = scriptRe.exec(text)) !== null) {
    const code = block[1];
    const blockStart = block.index + block[0].indexOf(block[1]);
    const re = /data-dom-id="([^"]+)"|data-dom-id='([^']+)'/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      const id = m[1] || m[2];
      // 真实行号 = block 起始行 + offset
      const before = text.slice(0, blockStart + m.index);
      const line = before.split('\n').length;
      const around = code.slice(Math.max(0, m.index - 50), m.index);
      let kind = 'unknown';
      if (/querySelector|querySelectorAll/.test(around)) kind = 'querySelector';
      else if (/getElementById/.test(around)) kind = 'getElementById';
      else if (/closest/.test(around)) kind = 'closest';
      refs.push({ id, line, kind, file: filePath });
    }
  }
  return refs;
}

// ── 死按钮: HTML 写了, JS 0 引用 (排除 kind='template' 的 ref) ──
// 死按钮判定: jsIdRefMap 里没有任何 kind = querySelector / getElementById / closest 的 ref.
// 例外: 该 dom-id 关联的 HTML id (id="X") 在 JS 有 getElementById('X') 引用, 视为已绑定.
const deadButtons = [];
for (const [id, locations] of htmlIdMap) {
  const refs = jsIdRefMap.get(id) || [];
  const realRefs = refs.filter(r => r.kind !== 'template');
  if (realRefs.length === 0) {
    // 找该 dom-id 的 tagId 关联, 若有 JS 引用, 不算 dead
    const htmlLoc = locations[0];
    if (htmlLoc) {
      // 找该行所在元素关联的 tagId
      // 简单做法: 用反向 map tagId -> dom-ids, 反向找
      let bound = false;
      for (const [tagId, domIds] of tagIdToDomIds) {
        if (domIds.includes(id)) {
          const tagRefs = jsIdRefMap.get(tagId) || [];
          if (tagRefs.some(r => r.kind !== 'template')) {
            bound = true; break;
          }
        }
      }
      if (!bound) {
        deadButtons.push({ id, htmlLocations: locations });
      }
    } else {
      deadButtons.push({ id, htmlLocations: locations });
    }
  }
}

// ── 死引用: JS 用了 (querySelector / getElementById / closest), HTML 没对应 且 JS 模板也没生成 ──
// 死引用 = jsIdRefMap 里有非 template ref (querySelector / getElementById / closest),
// 但 htmlIdMap 没对应 (无静态 HTML), 且也没有 template ref (JS 动态生成).
const deadRefs = [];
for (const [id, refs] of jsIdRefMap) {
  if (htmlIdMap.has(id)) continue;  // HTML 静态已有, 不是 dead
  const realRefs = refs.filter(r => r.kind !== 'template');
  const hasTemplate = refs.some(r => r.kind === 'template');
  if (realRefs.length > 0 && !hasTemplate) {
    // 真 dead ref: 用了 querySelector 但 HTML 静态 + JS 模板都没对应
    deadRefs.push({ id, refs: realRefs });
  }
}

// ── 输出 ──
const summary = {
  scannedAt: new Date().toISOString(),
  scope: F3_ONLY ? 'F3 only' : 'F3 + legacy frontend',
  filesScanned: { html: htmlFiles.length, js: jsFiles.length },
  totalDomIds: htmlIdMap.size,
  deadButtons: deadButtons.length,
  deadRefs: deadRefs.length,
};

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({
    summary,
    deadButtons,
    deadRefs,
    allIds: Array.from(htmlIdMap.entries()).map(([id, htmls]) => ({
      id, htmlCount: htmls.length, refCount: (jsIdRefMap.get(id) || []).length,
    })),
  }, null, 2));
}

// stderr 详细输出
console.error(`\n========== data-dom-id audit ==========`);
console.error(`Scope: ${summary.scope}`);
console.error(`Files: ${htmlFiles.length} HTML + ${jsFiles.length} JS`);
console.error(`Unique data-dom-id: ${summary.totalDomIds}`);
console.error(`Dead buttons (HTML has, JS no ref): ${summary.deadButtons}`);
console.error(`Dead refs (JS refs, HTML missing): ${summary.deadRefs}`);

if (deadButtons.length) {
  console.error(`\n--- Dead buttons ---`);
  for (const { id, htmlLocations } of deadButtons) {
    // 启发式: 如果 dom-id 与该元素 HTML id 同名, 大概率是 <a> 链接型锚 (不是 button)
    const isLink = htmlLocations[0]?.htmlFile && tagIdToDomIds.get(id)?.includes(id);
    const tag = isLink ? '🔗(link)' : '🔘(btn)';
    console.error(`  ${tag} ${id}`);
    for (const loc of htmlLocations) {
      const pathStr = relative(ROOT, loc.htmlFile);
      console.error(`     ${pathStr}:${loc.line}:${loc.col}`);
    }
  }
}

if (deadRefs.length) {
  console.error(`\n--- Dead refs (JS qSA but no HTML) ---`);
  for (const { id, refs } of deadRefs) {
    console.error(`  ❌ ${id}`);
    for (const r of refs) {
      const pathStr = relative(ROOT, r.file);
      console.error(`     ${pathStr}:${r.line} (${r.kind})`);
    }
  }
}

if (!deadButtons.length && !deadRefs.length) {
  console.error(`\n✅ No issues found.`);
}

if (JSON_OUT) {
  console.error(`\nJSON report → ${JSON_OUT}`);
}

process.exit(STRICT && (deadButtons.length + deadRefs.length) > 0 ? 1 : 0);
