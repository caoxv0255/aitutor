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
 * 纯文本出口 (PDF / 纯文本拼装) 用: 把 ⟦TABLE:n⟧ 换成短标记, 绝不输出裸 token。
 * 表格内容需结构化渲染, 纯文本管道拿不到 —— 至少不让占位符泄给用户。
 */
export function tableTokenToText(text, marker = '［表格］') {
  return String(text == null ? '' : text).replace(/⟦TABLE:\d+⟧/g, marker);
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
