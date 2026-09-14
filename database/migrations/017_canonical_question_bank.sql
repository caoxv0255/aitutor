-- =============================================================================
-- 017_canonical_question_bank.sql
-- Gate B (QB-P0-AUDIT, 2026-09-03): canonical question bank constraints
--
-- 目标 (P0-QB-05 等, 详见 .ai/audits/QB-P0-AUDIT-2026-09-03.md):
--   1. exam_questions 增加 UNIQUE (paper_id, question_number) 约束
--      -> 业务事实: 一份 paper 内一个 question_number 只允许一条 canonical question
--      -> 现状: 仅有非唯一普通索引 idx_exam_questions_paper_number (审计 §2.2 三重验证)
--   2. 删除被约束索引取代的冗余普通索引 idx_exam_questions_paper_number
--   3. 清理分区父表 exam_questions_partitioned (含分区 exam_questions_y2019..ydefault)
--      init/02-partitions.sql 创建 (relkind 'p'); 业务 0 引用; 分区全部为空;
--      migration 013_drop_partitioned.sql 的意图从未落地, 本迁移执行同一清理
--      (DROP ... CASCADE 自动清理 9 个分区 + 分区索引)
--      → 审计原判 "无父表" 方向有误: 分区确有父表 exam_questions_partitioned,
--        只是不属于主表 exam_questions (pg_inherits 对 exam_questions 为 0)
--
-- 幂等性: 全部 DO block + try/exception, 可重复执行 (新库 + 旧库升级均安全)
-- 不改动 exam_questions 主表结构, 不触碰 question_uid NOT NULL/UNIQUE (migration 008/016 已管)
-- =============================================================================

BEGIN;

-- 1. UNIQUE (paper_id, question_number)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- 若已存在同名约束则跳过 (幂等)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_exam_questions_paper_number'
      AND conrelid = 'exam_questions'::regclass
  ) THEN
    RAISE NOTICE '017: uq_exam_questions_paper_number already exists, skip';
    RETURN;
  END IF;

  -- 安全护栏: 若存在违反唯一性的存量数据, 不强行加约束, 只 NOTIFY
  SELECT COUNT(*) INTO duplicate_count
    FROM (
      SELECT paper_id, question_number
        FROM exam_questions
       WHERE paper_id IS NOT NULL
       GROUP BY paper_id, question_number
      HAVING COUNT(*) > 1
    ) d;

  IF duplicate_count > 0 THEN
    RAISE NOTICE '017: % duplicate (paper_id, question_number) rows exist, SKIPPING constraint. Clean data first.', duplicate_count;
  ELSE
    ALTER TABLE exam_questions
      ADD CONSTRAINT uq_exam_questions_paper_number
      UNIQUE (paper_id, question_number);
    RAISE NOTICE '017: uq_exam_questions_paper_number applied';
  END IF;
END $$;

-- 2. 删除冗余普通索引 (唯一约束自动建同名目的索引)
DROP INDEX IF EXISTS idx_exam_questions_paper_number;

-- 3. 清理分区父表 exam_questions_partitioned CASCADE (仅当分区全部为空)
DO $$
DECLARE
  has_rows BOOLEAN;
BEGIN
  IF to_regclass('public.exam_questions_partitioned') IS NULL THEN
    RAISE NOTICE '017: exam_questions_partitioned not present, nothing to drop';
    RETURN;
  END IF;

  -- 查询分区父表即扫全部分区
  SELECT EXISTS (SELECT 1 FROM public.exam_questions_partitioned) INTO has_rows;

  IF has_rows THEN
    RAISE NOTICE '017: exam_questions_partitioned contains rows, KEPT (manual cleanup required)';
  ELSE
    DROP TABLE IF EXISTS public.exam_questions_partitioned CASCADE;
    RAISE NOTICE '017: dropped empty partitioned parent exam_questions_partitioned (CASCADE cleaned all partitions)';
  END IF;
END $$;

COMMIT;
