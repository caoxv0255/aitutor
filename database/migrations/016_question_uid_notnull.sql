-- =============================================================================
-- 016_question_uid_notnull.sql
-- 目标:
--   exam_questions.question_uid 加 NOT NULL 约束
--
-- 背景 (DB 子代理审计 / D074-C2):
--   - question_uid 是 db.js 写入时生成 (api/core/questionUid.js, D063 强制),
--     但 schema 当前允许 NULL, 旧导入数据可能有 NULL 行
--   - 风险: NULL uid 导致 UPSERT 重复写入 (uid 唯一约束 NULL 不冲突),
--     question_vectors / question_knowledge_points 关联错乱
--   - 修复: 检查 NULL 数量, 为 0 时加 NOT NULL; 否则 NOTIFY 让用户手工处理
--
-- 设计:
--   - 先 SELECT COUNT(*) WHERE IS NULL, 仅当为 0 时 ALTER COLUMN
--   - 不删除 UNIQUE 约束 (db.js 已建 exam_questions_question_uid_key)
--   - 不动 question_type (已迁移到 question_types 字典 + question_type_audit, 见 migration 008)
--
-- Phase C2-fix (2026-08-24): C2-4
-- =============================================================================

BEGIN;

DO $$
DECLARE null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count
    FROM exam_questions
   WHERE question_uid IS NULL;

  IF null_count > 0 THEN
    -- 不抛错: 数据迁移场景可能暂存 NULL, 用 NOTICE 让运维感知
    RAISE NOTICE 'Found % rows with NULL question_uid, SKIPPING NOT NULL constraint. Run manual cleanup first.', null_count;
  ELSE
    ALTER TABLE exam_questions ALTER COLUMN question_uid SET NOT NULL;
    RAISE NOTICE 'question_uid NOT NULL constraint applied (0 NULL rows)';
  END IF;
END $$;

-- 验证
-- SELECT question_uid IS NULL AS is_null, COUNT(*) FROM exam_questions GROUP BY 1;

COMMIT;