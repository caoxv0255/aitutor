// api/services/questionTables.js
// P4-c 表格读端可达 (路线图 P2): 把题面里的 ⟦TABLE:n⟧ 占位符富化成结构化表格数据。
//
// 设计: 返回**结构化 tables** 而非拼好的 stem_html ——
//   · 前端是原生 JS, 用 document.createElement + textContent 构建表格天然防 XSS;
//     服务端拼 HTML 必须再做消毒, 风险与改动面都更大;
//   · tables 可被组卷/PDF/未来前端复用;
//   · stem 保持纯文本 (可搜/可复制/可截断), 不改任何既有字段语义。
//
// 数据来源: exam_questions.table_refs (由 28-backfill-table-refs.py 生成, 键 = token n,
//   值 = {table_id, kind} 或 {table_id:null, missing:<reason>}) + question_tables 的行。

// 多模态资产 URL 前缀 (server.js 把 out/media 挂到 /qb-media)
const MEDIA_BASE = process.env.QB_MEDIA_BASE || '/qb-media';
// 浏览器可直接渲染的图片扩展名 (公式的 wmf/emf 不在其中)
const BROWSER_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']);

/**
 * 给若干行 question 富化多模态 `media` (⟦IMG:rId⟧ / ⟦F:rId⟧ → 资产)。
 * 无 DB 依赖 (media_refs 里已含 rel_path/latex)。见 30-backfill-media-refs.py。
 *   media 元素: {token, kind, ext, url?, latex?, renderable?, missing?}
 *     · 图片 (ext 浏览器可渲染) → url 可用;
 *     · 公式 → 有 latex 用 latex, 否则读端降级为标记;
 *     · wmf/emf 不可直接渲染 → renderable:false。
 */
export function enrichQuestionsWithMedia(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  for (const r of rows) {
    const refs = parseTableRefs(r.media_refs);
    delete r.media_refs;
    if (!refs) continue;
    const media = [];
    for (const [token, v] of Object.entries(refs)) {
      const kind = (v && v.kind) || (token.startsWith('IMG:') ? 'figure' : 'formula');
      const rec = { token, kind };
      if (v && v.rel_path && !v.missing) {
        const ext = (v.ext || '').toLowerCase();
        rec.ext = ext;
        rec.renderable = BROWSER_IMAGE_EXT.has(ext);
        rec.url = `${MEDIA_BASE}/${v.rel_path}`;
      } else {
        rec.missing = (v && v.missing) || 'asset_absent';
      }
      if (v && v.latex) rec.latex = v.latex;
      media.push(rec);
    }
    r.media = media;
  }
  return rows;
}

/**
 * table_refs 可能是 JSONB(对象) 或 JSON 字符串, 统一解成对象; 无效返回 null。
 */
export function parseTableRefs(raw) {
  if (!raw) return null;
  let o = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  return o;
}

/**
 * 纯文本出口 (PDF / 纯文本拼装) 用: 把所有管线占位符换成短标记, 绝不输出裸 token。
 * 结构化内容需 DOM 渲染, 纯文本管道拿不到 —— 至少不让 ⟦TABLE:…⟧/⟦IMG:…⟧/⟦F:…⟧ 泄给用户。
 */
export function placeholderToText(text) {
  return String(text == null ? '' : text)
    .replace(/⟦TABLE:\d+⟧/g, '［表格］')
    .replace(/⟦IMG:[^⟧]*⟧/g, '［图片］')
    .replace(/⟦F:[^⟧]*⟧/g, '［公式］')
    .replace(/⟦OMML:?[^⟧]*⟧/g, '［公式］');
}

/**
 * 给若干行 question 富化 `tables` (数组, 按 token n 升序)。
 * 解析不到的 token 用 {n, table_id:null, missing:<reason>} 显式保留, 并置 has_unresolved_table。
 * 不静默丢弃: 读端可据此提示「该表格暂缺」而不是把 ⟦TABLE:n⟧ 原文吐给用户。
 *
 * @param {import('pg').Pool|import('pg').Client} pool
 * @param {Array<object>} rows 需含 id 与 table_refs
 * @returns {Promise<Array<object>>} 原 rows (原地修改)
 */
export async function enrichQuestionsWithTables(pool, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  // 多模态 (⟦IMG:⟧/⟦F:⟧) 无 DB 依赖, 先富化 —— 即使本题没有 table_refs 也要带走 media。
  enrichQuestionsWithMedia(rows);

  const refMap = new Map(); // questionId -> refs
  const tableIds = new Set();
  for (const r of rows) {
    const refs = parseTableRefs(r.table_refs);
    if (!refs) {
      delete r.table_refs;
      continue;
    }
    refMap.set(r.id, refs);
    for (const v of Object.values(refs)) {
      if (v && v.table_id) tableIds.add(v.table_id);
    }
  }
  // 内部字段不外泄
  for (const r of rows) delete r.table_refs;
  if (refMap.size === 0) return rows;

  const assetMap = new Map();
  if (tableIds.size > 0) {
    const res = await pool.query(
      'SELECT id, table_kind, headers, rows FROM question_tables WHERE id = ANY($1::int[])',
      [Array.from(tableIds)]
    );
    for (const t of res.rows) assetMap.set(t.id, t);
  }

  for (const r of rows) {
    const refs = refMap.get(r.id);
    if (!refs) continue;
    const nums = Object.keys(refs)
      .map((k) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const tables = [];
    let unresolved = false;
    for (const n of nums) {
      const v = refs[String(n)] || {};
      const asset = v.table_id ? assetMap.get(v.table_id) : null;
      if (asset) {
        tables.push({
          n,
          table_id: v.table_id,
          kind: v.kind || asset.table_kind || null,
          headers: asset.headers || null,
          rows: asset.rows || [],
        });
      } else {
        tables.push({ n, table_id: null, missing: v.missing || 'no_asset' });
        unresolved = true;
      }
    }
    r.tables = tables;
    if (unresolved) r.has_unresolved_table = true;
  }
  return rows;
}
