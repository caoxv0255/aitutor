/**
 * ai-feedback.js — 用户反馈通道 (Phase G1)
 *
 * POST /api/feedback         提交 1-5 星 + 评论
 * GET  /api/feedback/stats   统计最近 N 天的平均评分 / 分布
 *
 * 表: ai_feedback (database/migrations/012_ai_feedback.sql)
 *   - user_email  可空 (匿名访问 / dev bypass 也能写)
 *   - request_id  关联 ai_trace.request_id (VARCHAR(64))
 *   - task_type   tutor_ask / explain_question / learning_path ...
 *   - rating      1-5 (CHECK 约束防越界)
 *   - comment     可选
 *   - metadata    JSONB, 来源 / 客户端版本 / 浏览器指纹 等
 *
 * Phase-G1-fix (2026-08-24): 用户反馈通道
 */

import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

const VALID_TASK_TYPES = new Set([
  'tutor_ask',
  'tutor_ask_stream',
  'explain_question',
  'learning_path',
  'generate_paper',
  'knowledge_search',
  'other',
]);

/**
 * POST /api/feedback
 * Body: { task_type, rating, comment?, request_id? }
 */
export async function submitFeedback(req, res) {
  const pool = await getDb();
  const { task_type, rating, comment, request_id } = req.body || {};

  // 1. 必填校验
  if (!task_type || typeof task_type !== 'string') {
    return res.status(400).json(errorResponse('task_type 必填', 'VALIDATION'));
  }
  if (!VALID_TASK_TYPES.has(task_type)) {
    // 不阻断未知 task_type, 但记录 metadata, 便于后续补分类
    // (灵活策略: 业务方可能新加 task_type, 拒绝会卡死前端)
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json(errorResponse('rating 必须是 1-5 的整数', 'VALIDATION'));
  }

  // 2. 可选字段长度限制 (防止恶意大文本)
  const safeComment = typeof comment === 'string' ? comment.slice(0, 2000) : null;
  const safeRequestId = typeof request_id === 'string' ? request_id.slice(0, 64) : null;

  // 3. user_email 来自 auth middleware (req.user.email)
  const userEmail = (req.user && req.user.email) || null;

  // 4. metadata: 合并 user_agent / ip (后端侧补充)
  const metadata = {
    ...((req.body && req.body.metadata) || {}),
    user_agent: (req.headers && req.headers['user-agent']) || null,
    ip: (req.headers && req.headers['x-forwarded-for']) || (req.ip || null),
  };

  try {
    const result = await pool.query(
      `INSERT INTO ai_feedback (user_email, request_id, task_type, rating, comment, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [userEmail, safeRequestId, task_type, ratingNum, safeComment, metadata]
    );
    const row = result.rows[0];
    return res.json(successResponse({ id: row.id, created_at: row.created_at }, '反馈已记录'));
  } catch (err) {
    console.error('[ai-feedback] submit error:', err.message);
    return res.status(500).json(errorResponse('反馈提交失败', 'SERVER'));
  }
}

/**
 * GET /api/feedback/stats?days=7
 * 返回: {
 *   avg_rating, total_count,
 *   distribution: {1: N, 2: N, 3: N, 4: N, 5: N}
 * }
 */
export async function getFeedbackStats(req, res) {
  const pool = await getDb();
  const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);

  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total_count,
         COALESCE(AVG(rating)::float, 0) AS avg_rating,
         COUNT(*) FILTER (WHERE rating = 1)::int AS r1,
         COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
         COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
         COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
         COUNT(*) FILTER (WHERE rating = 5)::int AS r5
       FROM ai_feedback
       WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [String(days)]
    );
    const row = result.rows[0];
    return res.json(successResponse({
      avg_rating: Number(row.avg_rating.toFixed(2)),
      total_count: row.total_count,
      distribution: {
        1: row.r1,
        2: row.r2,
        3: row.r3,
        4: row.r4,
        5: row.r5,
      },
    }, '统计成功'));
  } catch (err) {
    console.error('[ai-feedback] stats error:', err.message);
    return res.status(500).json(errorResponse('统计失败', 'SERVER'));
  }
}