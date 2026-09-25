/* ============================================================================
 * essayStorage.js — 作文批改报告持久化
 *
 * 表：essay_reports（见 api/core/db.js）
 * ============================================================================ */

'use strict';

import { getDb } from '../../core/db.js';

/**
 * 插入一条作文批改报告
 * @returns {Promise<string>} reportId
 */
export async function insertEssayReport(record) {
  const pool = await getDb();
  const sql = `
    INSERT INTO essay_reports
      (report_id, user_email, essay_title, exam_level, grade,
       transcript, annotations, meta, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING report_id
  `;
  const params = [
    record.report_id,
    record.user_email || null,
    record.essay_title || null,
    record.exam_level || null,
    record.grade || null,
    JSON.stringify(record.transcript || { paragraphs: [] }),
    JSON.stringify(record.annotations || []),
    JSON.stringify(record.meta || {}),
    record.status || 'completed',
    record.error_message || null,
  ];
  const result = await pool.query(sql, params);
  return result.rows[0]?.report_id;
}

/**
 * 根据 reportId 查询（无权限检查由调用方负责）
 */
export async function getEssayReport(reportId) {
  const pool = await getDb();
  const result = await pool.query(
    `SELECT * FROM essay_reports WHERE report_id = $1 LIMIT 1`,
    [reportId]
  );
  return result.rows[0] || null;
}

/**
 * 列出用户的报告 (最近 limit 条, 支持 offset 分页)
 * @param {string} userEmail
 * @param {number} [limit=20]
 * @param {number} [offset=0]  2026-09-25: 分页用; 旧调用方不传 → 0, 行为不变
 */
export async function listEssayReports(userEmail, limit = 20, offset = 0) {
  const pool = await getDb();
  const result = await pool.query(
    `SELECT report_id, essay_title, exam_level, grade, status,
            (meta->>'confidence')::numeric AS confidence,
            (meta->>'model') AS model,
            (meta->>'image_url') AS image_url,
            created_at
       FROM essay_reports
       WHERE user_email = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
    [userEmail, limit, offset]
  );
  return result.rows;
}

/**
 * 标记失败状态（用于 OCR 异常 / LLM 报错回滚）
 */
export async function markEssayFailed(reportId, errorMessage) {
  const pool = await getDb();
  await pool.query(
    `UPDATE essay_reports SET status = 'failed', error_message = $2, updated_at = NOW()
     WHERE report_id = $1`,
    [reportId, errorMessage]
  );
}
