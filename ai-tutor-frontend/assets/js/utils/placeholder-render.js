// ai-tutor-frontend/assets/js/utils/placeholder-render.js
// P4 多模态读端渲染 (路线图 P2 表格 + P2b 图片/公式)。
//
// 背景: qbx 抽出的题面里, 结构化内容被替换成占位符 —— ⟦TABLE:n⟧(表格) /
//   ⟦IMG:rId⟧(图片) / ⟦F:rId⟧(公式) / ⟦OMML:txt⟧(线性公式)。后端已把它们解析成
//   结构化数据: exam_questions.table_refs + media_refs (见 28/30 回填脚本与
//   api/services/questionTables.js), 本模块负责渲染出来。
//
// 为什么不用 innerHTML: 单元格/文本来自试卷, 拼 HTML 有 XSS 风险; 全部
//   document.createElement + textContent / 受控 <img src> 构建。
//
// 降级 (绝不把裸 token 显示给用户):
//   表格解析不到 → 「（表格暂缺: reason）」; 图片不可渲染/缺失 → 「［图片］」;
//   公式无 latex/不可渲染 → 「［公式］」; OMML → 其内联文本。

const TOKEN_RE = /⟦([A-Z]+):?([^⟧]*)⟧/g;

/** 文本里是否含任意管线占位符 */
export function hasPlaceholder(text) {
  return /⟦[A-Z]+:?[^⟧]*⟧/.test(String(text == null ? '' : text));
}

/** 是否含表格占位符 */
export function hasTableToken(text) {
  return /⟦TABLE:\d+⟧/.test(String(text == null ? '' : text));
}

/** 切分为 [text | table | img | formula | omml] 段 */
function splitSegments(text) {
  const s = String(text == null ? '' : text);
  const segs = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) segs.push({ type: 'text', text: s.slice(last, m.index) });
    const kind = m[1];
    const arg = m[2];
    if (kind === 'TABLE') segs.push({ type: 'table', n: parseInt(arg, 10) });
    else if (kind === 'IMG') segs.push({ type: 'img', rid: arg });
    else if (kind === 'F') segs.push({ type: 'formula', rid: arg });
    else if (kind === 'OMML') segs.push({ type: 'omml', text: arg });
    else segs.push({ type: 'text', text: m[0] }); // 未知 token 原样保留
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

function findMedia(media, token) {
  if (!Array.isArray(media)) return null;
  for (const t of media) if (t && t.token === token) return t;
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
  if (Array.isArray(headers) && headers.length > 0) thead.appendChild(mkRow(headers, 'th'));
  for (const r of rows) tbody.appendChild(mkRow(Array.isArray(r) ? r : [r], 'td'));
  if (thead.childNodes.length > 0) table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function marker(doc, cls, text) {
  const span = doc.createElement('span');
  span.className = cls;
  span.textContent = text;
  return span;
}

/**
 * 把带占位符的文本渲染进 el (清空后重建)。
 * @param {HTMLElement} el 容器
 * @param {string} text 题面文本
 * @param {Array} tables 后端 tables: [{n, headers, rows, missing?}]
 * @param {Array} media  后端 media:  [{token, kind, url?, latex?, renderable?, missing?}]
 */
export function renderStemInto(el, text, tables, media) {
  if (!el) return;
  el.textContent = '';
  const doc = el.ownerDocument || document;
  for (const seg of splitSegments(text)) {
    switch (seg.type) {
      case 'text':
        if (seg.text) el.appendChild(doc.createTextNode(seg.text));
        break;
      case 'table': {
        const t = findTable(tables, seg.n);
        if (t && !t.missing && (Array.isArray(t.rows) || Array.isArray(t.headers))) {
          el.appendChild(buildTableElement(t, doc));
        } else {
          el.appendChild(marker(doc, 'qb-table-missing',
            '（表格暂缺: ' + ((t && t.missing) || 'no_asset') + '）'));
        }
        break;
      }
      case 'img': {
        const rec = findMedia(media, 'IMG:' + seg.rid);
        if (rec && rec.url && rec.renderable) {
          const img = doc.createElement('img');
          img.className = 'qb-figure';
          img.src = rec.url;
          img.alt = '题目插图';
          img.loading = 'lazy';
          el.appendChild(img);
        } else if (rec && rec.url && !rec.renderable) {
          // 非浏览器可渲染格式 (如 wmf) → 给个可点击链接, 不显示裸 token
          const a = doc.createElement('a');
          a.className = 'qb-media-link';
          a.href = rec.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = '［图片(原始格式)］';
          el.appendChild(a);
        } else {
          el.appendChild(marker(doc, 'qb-media-missing', '［图片］'));
        }
        break;
      }
      case 'formula': {
        const rec = findMedia(media, 'F:' + seg.rid);
        if (rec && rec.latex) {
          // 有 LaTeX → 以等宽文本呈现 (前端 KaTeX 可后续接管); 显式标注避免误读
          el.appendChild(marker(doc, 'qb-formula', rec.latex));
        } else if (rec && rec.url && rec.renderable) {
          const img = doc.createElement('img');
          img.className = 'qb-figure qb-formula-img';
          img.src = rec.url;
          img.alt = '公式';
          img.loading = 'lazy';
          el.appendChild(img);
        } else {
          el.appendChild(marker(doc, 'qb-media-missing', '［公式］'));
        }
        break;
      }
      case 'omml':
        el.appendChild(marker(doc, 'qb-formula', seg.text || '［公式］'));
        break;
      default:
        break;
    }
  }
}

/**
 * 列表预览用: 按可见长度截断, **绝不切断 ⟦...⟧ token**; 各类 token 折叠成短标记。
 * @returns {{text:string, truncated:boolean, hasTable:boolean, hasMedia:boolean}}
 */
export function tokenAwareSlice(text, max) {
  const s = String(text == null ? '' : text);
  max = max > 0 ? max : 220;
  const parts = [];
  let last = 0;
  let m;
  let hasTable = false;
  let hasMedia = false;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) parts.push({ tok: false, v: s.slice(last, m.index) });
    if (m[1] === 'TABLE') { hasTable = true; parts.push({ tok: true, v: '[表]' }); }
    else { hasMedia = true; parts.push({ tok: true, v: m[1] === 'IMG' ? '[图]' : '[式]' }); }
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ tok: false, v: s.slice(last) });

  let out = '';
  let visible = 0;
  for (const p of parts) {
    if (visible + p.v.length > max) {
      if (!p.tok) out += p.v.slice(0, Math.max(0, max - visible));
      return { text: out + '…', truncated: true, hasTable, hasMedia };
    }
    out += p.v;
    visible += p.v.length;
  }
  return { text: out, truncated: false, hasTable, hasMedia };
}
