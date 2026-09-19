-- 022_question_section.sql
-- 目的: 支持「一卷内多节各自从第 1 题编号」的试卷结构 (上海/浙江/江苏等卷的 听力/语法/阅读/写作 分节)。
--
-- 背景 (2026-09-17 实测, 1634 份高考原卷):
--   725 / 1634 份卷 (44%) 存在卷内题号重复, 共 5660 道题需要消解。
--   其中 95% 的重复对题干**不同** —— 不是冗余, 而是分节各自编号:
--     上海 2018 英语春考 第1题 = 听力第1题 ("M: Kate, happy new year!...")
--                             + 语法第1题 ("Don't think too much sugary drinks...")
--   这直接违反 017 建立的 UNIQUE (paper_id, question_number).
--
-- 取舍: 保留原卷题号 (question_number 仍等于卷面题号, 五维地址语义不变),
--       新增 question_section 承载"分节"这一维; 卷数仍与文件数 1:1 (不拆 paper)。
--       分节可由「题号重启点」自动推出 (见 scripts/qb-extract/qbx.py 的 assign_sections)。
--
-- 兼容: 存量 6219 题全部落到 DEFAULT 'main', 不改变既有查询语义
--       (旧数据无卷内重复, 见文末断言)。

BEGIN;

-- 1. new column
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS question_section varchar(32) NOT NULL DEFAULT 'main';

COMMENT ON COLUMN public.exam_questions.question_section IS
  '卷内分节标识; 单节卷为 main, 多节卷为 s1/s2/s3... (按题号重启点推定)';

-- 2. drop the too-strict unique constraint from 017
ALTER TABLE public.exam_questions
  DROP CONSTRAINT IF EXISTS uq_exam_questions_paper_number;

-- 3. replace with section-aware uniqueness
DROP INDEX IF EXISTS public.uq_exam_questions_paper_number_section;
CREATE UNIQUE INDEX uq_exam_questions_paper_number_section
  ON public.exam_questions (paper_id, question_number, question_section);

-- 4. retrieval helper for the five-dimension address + section
CREATE INDEX IF NOT EXISTS idx_exam_questions_section
  ON public.exam_questions (paper_id, question_section);

-- 5. assertion: 存量数据在补上 'main' 后必须本就无重复
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT paper_id, question_number, question_section
      FROM public.exam_questions
     GROUP BY paper_id, question_number, question_section
    HAVING count(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION '022: % duplicate (paper_id, question_number, question_section) rows — aborting', dup_count;
  END IF;
  RAISE NOTICE '022: applied; question_section ready (paper_id, question_number, question_section) UNIQUE';
END $$;

COMMIT;
