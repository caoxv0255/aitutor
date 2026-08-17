-- =============================================================================
-- 009_ai_trace.sql
-- 目标:
--   创建 ai_trace 表, 记录所有 LLM 调用 (prompt/response/token/cost/latency)
--   用于 cost monitoring + quality benchmark + debugging
--
-- D069 (2026-08-17): P2-2
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ai_trace (
  id BIGSERIAL PRIMARY KEY,
  -- 关联
  user_email VARCHAR(255),
  session_id VARCHAR(100),
  -- LLM 调用信息
  provider VARCHAR(50) NOT NULL,      -- 'dashscope' | 'openai' | 'ollama'
  model VARCHAR(100) NOT NULL,        -- 'qwen-max' | 'bge-m3' | ...
  task_type VARCHAR(50),              -- 'chat' | 'embedding' | 'vision_parse' | 'diagnosis_report' | ...
  -- 请求/响应
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  -- 性能
  latency_ms INTEGER,                 -- 总延迟 (含网络)
  -- 成本
  cost_cny NUMERIC(10, 6) DEFAULT 0,  -- 单次调用人民币成本
  -- 状态
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引: 按时间查询最新调用
CREATE INDEX IF NOT EXISTS idx_ai_trace_created_at ON ai_trace(created_at DESC);
-- 索引: 按用户查询
CREATE INDEX IF NOT EXISTS idx_ai_trace_user ON ai_trace(user_email, created_at DESC);
-- 索引: 按模型查询 (cost analysis)
CREATE INDEX IF NOT EXISTS idx_ai_trace_model ON ai_trace(model, created_at DESC);
-- 索引: 按任务类型查询
CREATE INDEX IF NOT EXISTS idx_ai_trace_task ON ai_trace(task_type, created_at DESC);

-- 统计视图: 按天聚合 token 消耗与成本
CREATE OR REPLACE VIEW ai_trace_daily_summary AS
SELECT
  DATE(created_at) AS date,
  provider,
  model,
  task_type,
  COUNT(*) AS call_count,
  SUM(prompt_tokens) AS total_prompt_tokens,
  SUM(completion_tokens) AS total_completion_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_cny) AS total_cost_cny,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE success = false) AS error_count
FROM ai_trace
GROUP BY DATE(created_at), provider, model, task_type
ORDER BY DATE(created_at) DESC;

COMMIT;

-- 验证
SELECT 'ai_trace table created' AS status;
