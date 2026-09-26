/* ============================================================================
 * essayStorage.js — 作文批改报告持久化
 *
 * 表：essay_reports（见 api/core/db.js）
 * ============================================================================ */

'use strict';

import { getDb } from '../../core/db.js';

/**
 * 插入一条作文批改报告
 *
 * 2026-09-26: 新增顶层 score 列 (与 meta.scores.total 同步, 供列表/排序直接读,
 * 不必下钻 jsonb)。meta 的既有结构一个键都不改, V0 链路不受影响。
 *
 * @returns {Promise<string>} reportId
 */
export async function insertEssayReport(record) {
  const pool = await getDb();
  const sql = `
    INSERT INTO essay_reports
      (report_id, user_email, essay_title, exam_level, grade,
       transcript, annotations, meta, status, error_message, score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
    normalizeScore(record.score),
  ];
  const result = await pool.query(sql, params);
  return result.rows[0]?.report_id;
}

/**
 * 后台批改任务写回结果 (异步 analyze 的完成路径)。
 * 同时落 transcript / annotations / meta / status / 顶层 score / essay_title。
 *
 * essay_title 用 COALESCE: 只有 result.essay_title 非空才覆盖 (题目图 OCR 出的
 * 真实题目文本); 老调用方不传 (null) 时保留 pending 行已写入的值 —— 行为不变。
 */
export async function updateEssayReportResult(reportId, result) {
  const pool = await getDb();
  const sql = `
    UPDATE essay_reports
       SET transcript = $2,
           annotations = $3,
           meta = $4,
           status = $5,
           score = $6,
           error_message = $7,
           essay_title = COALESCE($8, essay_title),
           updated_at = NOW()
     WHERE report_id = $1
  `;
  const params = [
    reportId,
    JSON.stringify(result.transcript || { paragraphs: [] }),
    JSON.stringify(result.annotations || []),
    JSON.stringify(result.meta || {}),
    result.status || 'completed',
    normalizeScore(result.score),
    result.error_message || null,
    result.essay_title || null,
  ];
  await pool.query(sql, params);
}

/**
 * 回收孤儿/陈旧 pending (2026-09-26): 服务重启后, 上一进程未跑完的行会永远停在
 * pending —— 前端轮询永不见结果。这里把「创建至今已超过 timeoutMs」的 pending
 * 统一标 failed(error_message='pending_timeout'), 不留悬空状态。
 *
 * @param {number} [timeoutMs] 超过该毫秒数仍未完成即判定为陈旧
 * @returns {Promise<string[]>} 被回收的 report_id 列表
 */
export async function reclaimStalePending(timeoutMs = PENDING_TIMEOUT_MS) {
  const pool = await getDb();
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : PENDING_TIMEOUT_MS;
  const result = await pool.query(
    `UPDATE essay_reports
        SET status = 'failed', error_message = 'pending_timeout', updated_at = NOW()
      WHERE status = 'pending'
        AND created_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
      RETURNING report_id`,
    [Math.round(ms)]
  );
  return (result.rows || []).map((r) => r.report_id);
}

/** pending → failed 的默认陈旧阈值: 3 分钟 (qwen-plus 实测 ~41.5s, 留足余量) */
export const PENDING_TIMEOUT_MS = 180_000;

/**
 * score 归一: 只接受有限数值, 其余 (undefined/null/NaN/字符串) → null。
 * 绝不把非数字写进 numeric 列, 也绝不编造分数。
 */
function normalizeScore(score) {
  if (score === null || score === undefined || score === '') return null;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

/**
 * 根据 reportId 查询（无权限检查由调用方负责）
 *
 * 注: score 是 numeric 列, node-pg 默认把 numeric 解析成**字符串**; 这里归一成
 * number, 让顶层 score 与 meta.scores.total 类型一致 (消费方无需区分)。
 */
export async function getEssayReport(reportId) {
  const pool = await getDb();
  const result = await pool.query(
    `SELECT * FROM essay_reports WHERE report_id = $1 LIMIT 1`,
    [reportId]
  );
  const row = result.rows[0] || null;
  if (row && row.score !== null && row.score !== undefined) {
    row.score = normalizeScore(row.score);
  }
  return row;
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
            score::double precision AS score,
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
