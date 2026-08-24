-- =============================================================================
-- 015_task_queue_check.sql
-- 目标:
--   task_queue.status 加 CHECK 约束, 限制为已知枚举值
--
-- 背景 (DB 子代理审计 / D074-C2):
--   - task_queue.status 是 VARCHAR, 业务代码 (taskWorker.js) 写入值:
--       pending / processing / completed / failed / cancelled
--   - 当前 schema 无 CHECK, 应用层 bug 或 SQL 直写可写入非法值
--     (如 'PENDING' 大小写错, 'in_progress' 拼写错), 污染 worker 处理
--   - 修复: DB 层兜底, 任何 INSERT/UPDATE 写出非法 status 立即失败
--
-- 设计:
--   - DROP CONSTRAINT IF EXISTS: 幂等 (重跑安全)
--   - 检查 current 值: 确保无非法 status 已存在, 否则 CHECK 加不上
--     (如果发现非法值, 人工修正后再跑)
--
-- Phase C2-fix (2026-08-24): C2-3
-- =============================================================================

BEGIN;

-- 0. 检查现有 status 值, 确保全部在白名单内
DO $$
DECLARE
  invalid_count INT;
  invalid_values TEXT;
BEGIN
  SELECT COUNT(*) INTO invalid_count
    FROM task_queue
   WHERE status NOT IN ('pending', 'processing', 'completed', 'failed', 'cancelled');
  IF invalid_count > 0 THEN
    SELECT string_agg(DISTINCT status, ', ') INTO invalid_values
      FROM task_queue
     WHERE status NOT IN ('pending', 'processing', 'completed', 'failed', 'cancelled');
    RAISE EXCEPTION 'Cannot add CHECK: found % rows with invalid status: %', invalid_count, invalid_values;
  END IF;
  RAISE NOTICE 'task_queue status check passed: all values in whitelist';
END $$;

-- 1. 删除已存在的同名 CHECK (幂等: 兼容重复执行)
ALTER TABLE task_queue DROP CONSTRAINT IF EXISTS task_queue_status_check;

-- 2. 加新 CHECK
ALTER TABLE task_queue
  ADD CONSTRAINT task_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- 验证
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'task_queue'::regclass AND contype = 'c';

COMMIT;