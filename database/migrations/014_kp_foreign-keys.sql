-- =============================================================================
-- 014_kp_foreign-keys.sql
-- 目标:
--   KP 逻辑外键加正式 FK 约束 (cascade delete)
--   - question_knowledge_points.knowledge_point_id 已是 VARCHAR, 已有 FK (auto 名)
--     但缺少 ON DELETE CASCADE, 升级到 CASCADE (KP 删除时清理 QKP 关联)
--   - srs_review_log.knowledge_point_id 此前完全无 FK (裸 VARCHAR), 现加 FK
--
-- 背景 (DB 子代理审计 / D074-C2):
--   - KP 表 (knowledge_points) 已存在多年, 但 5 张关联表都只有逻辑外键
--   - 风险: KP 改名 / 删除后, 子表留下孤儿 / 错引用
--   - 副作用: KP 删除后 question_knowledge_points 行变孤儿, srs_review_log 行错引用
--   - 现在加 FK 让数据库自己保证引用完整性, 减轻手动清理负担
--
-- 设计:
--   - DROP CONSTRAINT IF EXISTS (PG 幂等: 兼容新库 + 旧库 (auto 命名的 FK))
--   - ADD CONSTRAINT 重新建立带 ON DELETE CASCADE 的 FK
--   - qkp.knowledge_point_id 旧 FK 名: question_knowledge_points_knowledge_point_id_fkey
--     (PG auto 命名约定: <table>_<col>_fkey)
--   - 不动 practice_records.question_id (已存在 ON DELETE SET NULL, 语义不同: 保留练习记录)
--
-- Phase C2-fix (2026-08-24): C2-2
-- =============================================================================

BEGIN;

-- 0. 安全检查: 确保无孤儿 KP 引用, 否则 FK 加不上
DO $$
DECLARE
  qkp_orphans INT;
  srs_orphans INT;
BEGIN
  SELECT COUNT(*) INTO qkp_orphans
    FROM question_knowledge_points qkp
   WHERE qkp.knowledge_point_id NOT IN (SELECT id FROM knowledge_points);
  SELECT COUNT(*) INTO srs_orphans
    FROM srs_review_log srs
   WHERE srs.knowledge_point_id NOT IN (SELECT id FROM knowledge_points);

  IF qkp_orphans > 0 OR srs_orphans > 0 THEN
    RAISE EXCEPTION 'Cannot add FK: found % orphan qkp + % orphan srs references. Clean up first.', qkp_orphans, srs_orphans;
  END IF;
  RAISE NOTICE 'Orphan check passed: qkp=0, srs=0';
END $$;

-- 1. question_knowledge_points.knowledge_point_id: 加 CASCADE FK
--    旧 FK 是 PG auto 命名的 question_knowledge_points_knowledge_point_id_fkey (无 CASCADE)
--    用 DO block 包裹, 保证重复跑 idempotent (PG 没有 ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  ALTER TABLE question_knowledge_points
    DROP CONSTRAINT IF EXISTS question_knowledge_points_knowledge_point_id_fkey;
  ALTER TABLE question_knowledge_points
    DROP CONSTRAINT IF EXISTS fk_qkp_kp_id;
  ALTER TABLE question_knowledge_points
    ADD CONSTRAINT fk_qkp_kp_id
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'qkp FK add skipped: %', SQLERRM;
END $$;

-- 2. srs_review_log.knowledge_point_id: 之前无 FK, 现新增
--    SRS 复习历史: KP 删除时复习记录也应清理 (避免历史统计错引用)
DO $$
BEGIN
  ALTER TABLE srs_review_log
    DROP CONSTRAINT IF EXISTS fk_srs_log_kp_id;
  ALTER TABLE srs_review_log
    ADD CONSTRAINT fk_srs_log_kp_id
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'srs_review_log FK add skipped: %', SQLERRM;
END $$;

-- 验证
-- SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE contype = 'f' AND conrelid::regclass::text IN ('question_knowledge_points', 'srs_review_log');

COMMIT;