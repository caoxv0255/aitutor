#!/usr/bin/env node
/**
 * scripts/check-no-ai-innerhtml.mjs — AI 输出禁入 innerHTML 永久闸门 (M-4)
 *
 * 起因 (2026-09-23 全仓安全评审 M-4):
 *   public/src/js/tutor-stream.js:208 把 LLM SSE delta 未消毒拼进 innerHTML
 *   (`container.innerHTML += pending`)。当前是死代码, 但一旦接线即 Critical,
 *   且 token 存 localStorage —— 人工发现必须变成永久闸门, 否则同类问题会反复。
 *
 * 判据 (机械可复现, 宁严勿宽但要可控误报):
 *   1. `innerHTML +=`            — 拼接, 恒危险 (追加不可信内容)。
 *   2. `innerHTML =` 非纯静态字面量 — 赋值右侧是变量/调用/三元/拼接/含 `${}`
 *      的模板字符串, 即可能携带动态数据。
 *   3. `insertAdjacentHTML(`     — 等价注入入口。
 *   4. `document.write(`         — 等价注入入口。
 *   "纯静态字面量" = 单/双引号字符串字面量(无拼接), 或不含 `${}` 的模板字符串
 *   (可跨行)。这类(如 `= ''` 清空、`= '<option>…</option>'` 静态文案)天然不携带
 *   动态数据, 不命中。
 *
 *   v2 修正 (2026-09-23, 误报治理): 静态字面量右侧允许跟**同行注释**再判终结符 ——
 *   `x.innerHTML = ''; // 说明` 与 `x.innerHTML = '静态'; <同行块注释>` 均视为静态放行。
 *   此前同行 `//` 注释会被当作"字面量后还有内容"从而误判非静态, 逼开发者为了过检
 *   挪动注释/改代码结构(闸门被讨厌的典型成因)。修正只剥离**字面量之后**的注释尾巴,
 *   松紧不变: `'' + foo`、`'a' + foo // c`、`cond ? a : b`、`` `<b>${t}</b>` ``、
 *   `+=` 仍全部判红(见 tests/scripts/check-no-ai-innerhtml.test.js 夹具)。
 *
 * ALLOW 登记机制: 每个现存命中站点必须逐一人工核对后登记在下表 (文件:行号 +
 * 理由 + 登记日期)。核对不了、或含 AI/LLM 未消毒数据的, 宁可判红让人工看, 不得
 * 登记。新增站点未登记 → 非零退出 (release-gate 6/7 子项失败)。
 * (2026-09-24 债3: tutor-stream.js:208 已改 createTextNode 文本节点追加, 该
 *  ALLOW 豁免已删除 —— 不再需要 canary。)
 *
 * 射程: 只扫三个前端源码目录 (frontend-v2/assets/js、public/src/js、
 *   frontend/assets/js) 的 .js 文件。旧树 frontend/ 与 ai-tutor-frontend/ 是
 *   历史遗留, 其中大量 innerHTML 属一般 XSS 债务而非本闸门射程, 但仍在扫描
 *   目录内, 故一并登记并如实标注数据来源。
 *
 * 明确不覆盖 (需人工/其它闸门兜底): 跨文件数据流(仅看赋值行, 不追变量来源)、
 *   动态属性访问 `el['innerHTML']` / `el[\`inner\` + x]`、`outerHTML` 赋值、
 *   `setHTMLUnsafe(` / `insertAdjacentElement(` / `Range.createContextualFragment(`
 *   等其它注入入口、RHS 前置注释(如 `= <块注释> ''`)、以及模板字面量后接拼接
 *   (`` `<b>a</b>` + foo ``, 该形态按既有"无 ${} 即放行"规则放行)。命中判定是
 *   行内形状匹配, 不是数据流分析。
 *
 * 输出: 命中未登记站点即非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['frontend-v2/assets/js', 'public/src/js', 'frontend/assets/js'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs']);
const SKIP_FILE = /\.min\.js$/;

// ── ALLOW 白名单: 文件相对 ROOT 的路径 + 行号 ─────────────────────────────
// 每项 { file, line, reason, date }。key = `${file}:${line}`。
// 已逐一核对: 确认非"未消毒的 AI/LLM 输出"。含 API/用户数据但非 LLM 的遗留站点
// 如实标注"遗留, 非 LLM 输出"。tutor-stream.js:208 (原唯一的 AI delta 站点) 已
// 于 2026-09-24 修复, 不再登记。
const ALLOW = [
  // —— public/src/js ——
  { file: 'public/src/js/katex-stream.js', line: 147, reason: 'AI 输出经 _renderPlainText 转义(&<>) + KaTeX(trust:false) 渲染后写入，非未消毒直拼', date: '2026-09-23' },
  { file: 'public/src/js/mastery-graph.js', line: 252, reason: '图谱拓扑结构字段(score/subject/module/difficulty/id)，非 LLM 输出', date: '2026-09-23' },
  { file: 'public/src/js/mastery-graph.js', line: 311, reason: 'AI 诊断结构化指标(数值/日期)，非自由文本', date: '2026-09-23' },
  { file: 'public/src/js/mastery-graph.js', line: 386, reason: '错误文案 err.message(服务端/网络错误)，未转义，遗留，非 LLM 输出', date: '2026-09-23' },

  // —— frontend-v2/assets/js ——
  { file: 'frontend-v2/assets/js/dashboard.js', line: 115, reason: 'svgIcon(name) 返回内联 SVG 常量(ICONS 硬编码 path)，输入仅查表，无动态数据注入', date: '2026-09-23' },
  { file: 'frontend-v2/assets/js/dashboard.js', line: 140, reason: '同上 svgIcon(done?accuracy:review) 查表', date: '2026-09-23' },
  { file: 'frontend-v2/assets/js/dashboard.js', line: 171, reason: '同上 svgIcon("wrong") 查表', date: '2026-09-23' },
  { file: 'frontend-v2/assets/js/dashboard.js', line: 205, reason: '同上 svgIcon("chart") 查表', date: '2026-09-23' },

  // —— frontend/assets/js (旧树) ——
  { file: 'frontend/assets/js/components.js', line: 82, reason: 'headerHtml 中用户名经 escapeHtml，其余为静态模板', date: '2026-09-23' },
  { file: 'frontend/assets/js/components/coach-mark-v1.js', line: 169, reason: 'COPY 文案均经 escapeHtml', date: '2026-09-23' },
  { file: 'frontend/assets/js/theme-utils.js', line: 73, reason: '主题图标切换，三元静态字符串，无外部数据', date: '2026-09-23' },
  { file: 'frontend/assets/js/custom-listbox.js', line: 111, reason: 'buildLabel(cur) 经 escapeHtml', date: '2026-09-23' },
  { file: 'frontend/assets/js/province-selector.js', line: 23, reason: '布尔开关(showExamLevel/showSubject)选择静态模板，无用户/API 数据', date: '2026-09-23' },
  { file: 'frontend/assets/js/router.js', line: 90, reason: '错误面板 title/message(调用方文案)，未转义，遗留，非 LLM 输出', date: '2026-09-23' },
  { file: 'frontend/assets/js/exam-mode.js', line: 29, reason: '纯静态字符串拼接(考试模式栏)，无变量', date: '2026-09-23' },
  { file: 'frontend/assets/js/exam-mode.js', line: 515, reason: '计分数字拼接(correct/total/pct 等数值型)', date: '2026-09-23' },
  { file: 'frontend/assets/js/exam-mode.js', line: 587, reason: '错题面板 header+body+footer；body 含题干/答案片段未转义，遗留，非 LLM 输出', date: '2026-09-23' },
  { file: 'frontend/assets/js/components/toast.js', line: 23, reason: 'message 经 escapeHtml，icon 为枚举', date: '2026-09-23' },
  { file: 'frontend/assets/js/components/emptyState.js', line: 143, reason: 'title/desc/icon 经 escapeHtml，bg/color 为开发者配置样式', date: '2026-09-23' },

  // —— frontend/assets/js/pages/province-page.js (旧树, 大量 API 元数据渲染) ——
  { file: 'frontend/assets/js/pages/province-page.js', line: 87, reason: '考试类型枚举派生(图标/文案)，无外部文本', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 99, reason: 'renderStats：value 经 formatNumber，label 经 escapeHTML', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 101, reason: '省份描述经 escapeHTML', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 447, reason: 'renderPapers：title/paperTypeLabel 经 escapeHTML；year/exam_level/paper.id(onclick) 未转义，遗留，非 LLM 输出', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 502, reason: '知识点条形图：label 经 escapeHTML，value 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 526, reason: '知识点表：name 经 escapeHTML，count 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 556, reason: '题型条形图：label 经 escapeHTML，count 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 673, reason: '分年份题型图：label 经 escapeHTML；subject 部分未转义，遗留，非 LLM 输出', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 703, reason: '题型表：label 经 escapeHTML，数值字段', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 731, reason: '难度条形图：label 枚举，count 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 816, reason: '分年份难度图：label 枚举/escapeHTML，count 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 825, reason: '难度表：levelNames 枚举 + 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 844, reason: 'Top 知识点条形图：name 经 escapeHTML，frequency 数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 868, reason: 'Top 知识点表：name 经 escapeHTML，数值', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 902, reason: '趋势摘要：title/highlights/recommendations 均经 escapeHTML', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 904, reason: '摘要经 escapeHTML', date: '2026-09-23' },
  { file: 'frontend/assets/js/pages/province-page.js', line: 1028, reason: '年度趋势表：subjectName/label 经 SUBJECT_MAP 映射或原始枚举，数值字段，遗留，非 LLM 输出', date: '2026-09-23' },
];

const ALLOW_KEYS = new Set(ALLOW.map((e) => `${e.file}:${e.line}`));

// ── 检测正则 (只描述形状) ──
const INSERT_ADJACENT = /\binsertAdjacentHTML\s*\(/;
const DOC_WRITE = /\bdocument\s*\.\s*write\s*\(/;
// `+=` 或 `=` (排除 `==`/`===`); m[1] 为操作符
const ASSIGN = /\.innerHTML\s*(\+=|=)(?!=)/g;
// 前导单/双引号字面量 (含转义); 用于判断 RHS 是否以纯静态字符串开头
const STRING_LITERAL = /^(['"])(?:\\.|(?!\1)[\s\S])*\1/;

/**
 * 剥离**字面量之后**的同行注释尾巴, 只保留真正的代码终结符:
 *   行注释(以两道斜杠开始)自该处起全部丢弃;
 *   完整块注释(斜杠星号 ... 星号斜杠)先整体删除, 故其中含两道斜杠也不会误截。
 * 调用点已确认: 传入的一定是字符串字面量匹配结果之后的剩余片段, 其中的两道斜杠
 * 只可能是注释起始(不是字符串内容), 故无需区分字符串上下文。真正的拼接
 * (`+ foo // c`) 剥离后仍剩 `+ foo`, 不会被误放行。
 */
function stripTrailingComments(s) {
  let t = s;
  // 先删**闭合的**块注释(可含 `//`), 再按首个 `//` 截断行注释
  t = t.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = t.indexOf('//');
  if (i !== -1) t = t.slice(0, i);
  return t;
}

/** 是否为"纯静态字面量": 单/双引号完整字面量(后跟仅 ;/}/)/] 等终结符, 允许同行注释), 或跨行模板字符串(不含 ${}) */
function isStaticLiteral(lines, lineIdx, line, afterEqCol) {
  let text = line.slice(afterEqCol).trim();
  let idx = lineIdx;
  let col = afterEqCol;
  if (!text) {
    // RHS 在下一行 (如 `x.innerHTML = \n '静态'`): 取下一非空行 (lines 已 trim)
    let k = lineIdx + 1;
    while (k < lines.length && !lines[k]) k++;
    if (k >= lines.length) return false;
    text = lines[k];
    idx = k;
    col = lines[k].indexOf(text[0]);
  } else {
    col = line.indexOf(text[0], afterEqCol);
  }

  const q = text[0];
  if (q === '"' || q === "'") {
    const m = STRING_LITERAL.exec(text);
    if (!m) return false;
    // 字面量之后只能跟 ; / 空白 / } / ) / ] 等终结符(允许其后跟同行注释), 否则视为拼接/表达式
    return /^[\s;}\])]*$/.test(stripTrailingComments(text.slice(m[0].length)));
  }
  if (q === '`') {
    const tmpl = readTemplateLiteral(lines, idx, col);
    if (tmpl == null) return false;
    return !tmpl.includes('${');
  }
  return false; // 标识符 / 调用 / 三元 / 括号 / 其他表达式
}

/** 从 lines[idx][col] (开反引号) 读到闭合反引号, 返回完整模板字符串或 null */
function readTemplateLiteral(lines, idx, col) {
  let buf = lines[idx].slice(col);
  let line = idx;
  // 跳过开反引号本身, 从 col+1 起扫闭合
  for (let guard = 0; guard < 20000; guard++) {
    for (let j = 1; j < buf.length; j++) {
      if (buf[j] !== '`') continue;
      let bs = 0;
      for (let k = j - 1; k >= 0 && buf[k] === '\\'; k--) bs++;
      if (bs % 2 === 0) return buf.slice(0, j + 1);
    }
    line += 1;
    if (line >= lines.length) return null;
    buf += '\n' + lines[line];
  }
  return null;
}

/** 扫描单文件, 返回未登记的命中 [{file, line, kind, snippet}] */
function scanFile(rel, text) {
  // 统一用 trim 后的行做检测 (行号仍按 i+1); 模板跨行读取也在 trim 行上进行, 不影响 `${}` 判定
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const hits = [];

  lines.forEach((line, i) => {
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('#')) return;

    if (INSERT_ADJACENT.test(line)) {
      hits.push({ file: rel, line: i + 1, kind: 'insertAdjacentHTML', snippet: line.slice(0, 100) });
    }
    if (DOC_WRITE.test(line)) {
      hits.push({ file: rel, line: i + 1, kind: 'document.write', snippet: line.slice(0, 100) });
    }

    // innerHTML 赋值/拼接
    ASSIGN.lastIndex = 0;
    for (const m of line.matchAll(ASSIGN)) {
      const op = m[1];
      if (op === '+=') {
        hits.push({ file: rel, line: i + 1, kind: 'innerHTML +=', snippet: line.slice(0, 100) });
        continue;
      }
      // op === '=': 判是否纯静态字面量
      if (isStaticLiteral(lines, i, line, m.index + m[0].length)) continue;
      hits.push({ file: rel, line: i + 1, kind: 'innerHTML = 非静态', snippet: line.slice(0, 100) });
    }
  });

  // 同一行去重 + 过滤已登记
  const seen = new Set();
  return hits.filter((h) => {
    const k = `${h.file}:${h.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return !ALLOW_KEYS.has(k);
  });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    if (SKIP_FILE.test(entry.name)) continue;
    const rel = path.relative(ROOT, full);
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const h of scanFile(rel, text)) findings.push(h);
  }
}

const findings = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d));

findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

if (findings.length) {
  console.error('❌ 检测到 AI/LLM 数据可能未消毒进入 innerHTML 的风险：');
  for (const f of findings) {
    console.error(`   ${f.file}:${f.line}  [${f.kind}] ${f.snippet}`);
  }
  console.error(
    `\n共 ${findings.length} 处。新增站点须在 scripts/check-no-ai-innerhtml.mjs 的 ALLOW 登记` +
      `（含理由 + 登记日期），确认无 AI/LLM 数据才可登记；` +
      `AI 输出请用 textContent / createTextNode，公式用 KaTeX(trust:false)。`
  );
  process.exit(1);
}

console.log('✓ 无非静态 innerHTML / insertAdjacentHTML / document.write 注入（AI 输出禁入 innerHTML）');
