// ai-tutor-frontend/assets/js/utils/placeholder-render.js
// P4-c 表格读端渲染 (路线图 P2)。
//
// 背景: qbx 抽出的题面里, 结构化表格被替换成 ⟦TABLE:n⟧ 占位符 (治本「干净投影」),
//   后端 exam_questions.table_refs + question_tables 已经能把它解析成结构化的
//   {n, headers, rows} (见 api/services/questionTables.js)。本模块负责把它渲染出来。
//
// 为什么不用 innerHTML 拼表格: 表格单元格来自试卷文本, 拼 HTML 有 XSS 风险;
//   全部用 document.createElement + textContent 构建, 天然安全, 不依赖 DOMPurify 白名单。
//
// 范围: 本模块只处理 ⟦TABLE:n⟧。⟦F:⟧ / ⟦IMG:⟧ / ⟦OMML⟧ 属 P2b (需要 rId→asset 映射),
//   目前原样保留为文本, 不做半吊子替换。

// ⟦KIND:arg⟧ / ⟦KIND⟧ (KIND 全大写)
const TOKEN_RE = /⟦([A-Z]+):?([^⟧]*)⟧/g;
const TABLE_TOKEN_RE = /⟦TABLE:(\d+)⟧/g;

/** 文本里是否含表格占位符 */
export function hasTableToken(text) {
  return TABLE_TOKEN_RE.test(String(text == null ? '' : text));
}

/** 把文本切成 [text | table] 段 (只切 TABLE, 其余 token 留在 text 段里) */
function splitTableSegments(text) {
  const s = String(text == null ? '' : text);
  const segs = [];
  let last = 0;
  let m;
  TABLE_TOKEN_RE.lastIndex = 0;
  while ((m = TABLE_TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) segs.push({ type: 'text', text: s.slice(last, m.index) });
    segs.push({ type: 'table', n: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < s.length) segs.push({ type: 'text', text: s.slice(last) });
  return segs;
}

function findTable(tables, n) {
  if (!Array.isArray(tables)) return null;
  for (const t of tables) if (t && t.n === n) return t;
  return null;
}

/** 用 DOM 构建一张表格 (全 textContent, 无 XSS) */
export function buildTableElement(t, doc) {
  const d = doc || document;
  const table = d.createElement('table');
  table.className = 'qb-table';
  const headers = t && t.headers;
  const rows = (t && t.rows) || [];
  const thead = d.createElement('thead');
  const tbody = d.createElement('tbody');

  const mkRow = (cells, cellTag) => {
    const tr = d.createElement('tr');
    for (const c of cells) {
      const cell = d.createElement(cellTag);
      cell.textContent = c == null ? '' : String(c);
      tr.appendChild(cell);
    }
    return tr;
  };

  if (Array.isArray(headers) && headers.length > 0) {
    thead.appendChild(mkRow(headers, 'th'));
  }
  for (const r of rows) {
    tbody.appendChild(mkRow(Array.isArray(r) ? r : [r], 'td'));
  }
  if (thead.childNodes.length > 0) table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

/**
 * 把带 ⟦TABLE:n⟧ 的文本渲染进 el (清空后重建)。
 * 解析不到的 token 显式渲染成「（表格暂缺）」, 不显示原始 ⟦TABLE:n⟧。
 *
 * @param {HTMLElement} el 容器 (会被清空)
 * @param {string} text 题面文本
 * @param {Array} tables 后端返回的 tables: [{n, headers, rows, missing?}]
 */
export function renderStemInto(el, text, tables) {
  if (!el) return;
  el.textContent = '';
  const doc = el.ownerDocument || document;
  for (const seg of splitTableSegments(text)) {
    if (seg.type === 'text') {
      if (seg.text) el.appendChild(doc.createTextNode(seg.text));
      continue;
    }
    const t = findTable(tables, seg.n);
    if (t && !t.missing && (Array.isArray(t.rows) || Array.isArray(t.headers))) {
      el.appendChild(buildTableElement(t, doc));
    } else {
      const span = doc.createElement('span');
      span.className = 'qb-table-missing';
      const reason = t && t.missing ? t.missing : 'no_asset';
      span.textContent = '（表格暂缺: ' + reason + '）';
      el.appendChild(span);
    }
  }
}

/**
 * 列表预览用: 按可见长度截断, **绝不切断 ⟦...⟧ token**; 表格 token 记作「[表]」。
 * @returns {{text:string, truncated:boolean, hasTable:boolean}}
 */
export function tokenAwareSlice(text, max) {
  const s = String(text == null ? '' : text);
  max = max > 0 ? max : 220;
  const parts = [];
  let last = 0;
  let m;
  let hasTable = false;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) parts.push({ tok: false, v: s.slice(last, m.index) });
    if (m[1] === 'TABLE') hasTable = true;
    parts.push({ tok: true, v: '[表]' }); // 表格显示为 [表]; 其他 token 也折叠成短标记
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ tok: false, v: s.slice(last) });

  let out = '';
  let visible = 0;
  for (const p of parts) {
    if (p.tok) {
      if (visible + p.v.length > max) return { text: out + '…', truncated: true, hasTable };
      out += p.v;
      visible += p.v.length;
    } else {
      if (visible + p.v.length > max) {
        out += p.v.slice(0, Math.max(0, max - visible));
        return { text: out + '…', truncated: true, hasTable };
      }
      out += p.v;
      visible += p.v.length;
    }
  }
  return { text: out, truncated: false, hasTable };
}
