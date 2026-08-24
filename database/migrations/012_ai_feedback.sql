-- =============================================================================
-- 012_ai_feedback.sql
-- 目标:
--   用户对 AI 回答的反馈通道 (Phase G1).
--   收集 1-5 星评分 + 可选评论, 关联 request_id 用于跟 ai_trace 关联.
--
-- 设计:
--   - BIGSERIAL 主键 (高写入量, 不复用 ai_trace)
--   - user_email 可空 (匿名反馈也能写, 比如公开页)
--   - request_id 关联 ai_trace.request_id (VARCHAR(64))
--   - rating 1-5 (CHECK 约束防越界)
--   - metadata JSONB (浏览器/客户端/版本等扩展信息)
--   - 3 个索引: 用户维度查询 / request_id 关联 / 按时间分布
--
-- Phase-G1-fix (2026-08-24): G1 用户反馈通道
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ai_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_email VARCHAR(255),
  request_id VARCHAR(64),
  task_type VARCHAR(50) NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_request ON ai_feedback(request_id);

COMMIT;