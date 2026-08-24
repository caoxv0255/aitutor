-- =============================================================================
-- 011_task_metrics_fk.sql
-- 目标:
--   task_metrics.task_id 加 ON DELETE CASCADE FK, 防止 task_queue 删除后
--   在 task_metrics 中留下孤儿 metrics 记录.
--
-- 背景 (P0-1 / DB 子代理审计):
--   - task_metrics 当前 schema: task_id INTEGER REFERENCES task_queue(id) (NO ACTION)
--   - api/core/taskWorker.js purgeOldFailedTasks() 每 30 天清理 status='failed'
--     且 updated_at < cutoff 的 task_queue 记录, 但 task_metrics 没有 CASCADE,
--     会留下 task_id 指向已不存在 task 的孤儿 metrics 行.
--   - 副作用: 浪费存储 + 污染分析聚合 (getTaskStats / quality_score 计算).
--
-- 设计:
--   - DROP CONSTRAINT IF EXISTS (PG 幂等, 兼容已存在但非 CASCADE 的旧 FK)
--   - ADD CONSTRAINT 重新建立带 ON DELETE CASCADE 的 FK
--   - 不重建 task_metrics 表, 仅替换 FK 行为 (最小化迁移影响)
--
-- Phase C1-fix (2026-08-24): C1-1 P0-1
-- =============================================================================

BEGIN;

-- 1. 删除可能存在的同名 FK (幂等: 兼容新库与已存在旧 FK 的库)
--    旧 FK 名约定: fk_task_metrics_task_id (与 db.js 同步)
ALTER TABLE task_metrics DROP CONSTRAINT IF EXISTS fk_task_metrics_task_id;

-- 2. 添加带 ON DELETE CASCADE 的 FK
--    PostgreSQL 不支持 ADD CONSTRAINT IF NOT EXISTS, 依赖上面的 DROP IF EXISTS 实现幂等
ALTER TABLE task_metrics
  ADD CONSTRAINT fk_task_metrics_task_id
  FOREIGN KEY (task_id) REFERENCES task_queue(id)
  ON DELETE CASCADE;

-- 验证: 确认 FK 已带 ON DELETE CASCADE
-- SELECT conname, confdeltype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'task_metrics'::regclass AND contype = 'f';

COMMIT;
