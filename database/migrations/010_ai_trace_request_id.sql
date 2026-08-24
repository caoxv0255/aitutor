-- =============================================================================
-- 010_ai_trace_request_id.sql
-- 目标:
--   给 ai_trace 表加 request_id 列 (UUID v4), 用于跨前后端追踪同一请求.
--   Phase B (2026-08-24) P0-3 观测能力升级.
--
-- 设计:
--   - 列: request_id VARCHAR(64) NULL  (允许旧 D069 数据无值, 不破坏既有 INSERT)
--   - 索引: idx_ai_trace_request_id 加速按 request_id 查询 (跨次 LLM 调用聚合)
--   - 不加 UNIQUE 约束: 同一 request_id 可能有多个 LLM 调用 (tutor_agent 内部
--     串联向量检索 + LLM, Phase C 可考虑加唯一约束). 当前保留多次插入能力.
--
-- D-NEW (2026-08-24): P0-3 Phase B
-- =============================================================================

BEGIN;

-- 加列 (幂等: IF NOT EXISTS PG9.6+)
ALTER TABLE ai_trace ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);

-- 索引 (CREATE INDEX IF NOT EXISTS 已存在 009 中)
CREATE INDEX IF NOT EXISTS idx_ai_trace_request_id ON ai_trace(request_id) WHERE request_id IS NOT NULL;

-- 注释
COMMENT ON COLUMN ai_trace.request_id IS 'Phase B (2026-08-24): 跨前后端请求追踪 ID, 前端 X-Trace-Id header → 后端 req.traceId → ai_trace.request_id';

COMMIT;

-- 验证
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_trace' AND column_name = 'request_id';
