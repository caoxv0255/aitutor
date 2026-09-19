-- 023_answer_analysis_status.sql
-- 目的: 满足验收 G8 (Answer Integrity) 与 G9 的状态标注要求。
--
-- 规范原文 (docs/database/qb-v1.0-national-migration-design.md):
--   第 294 行  G8 Answer Integrity : answer_status 100% 标注; 客观题可判
--   第 273 行  P3 出口: answer_status 覆盖率 100% (含 MISSING/CONFLICT 状态); 无静默覆盖
--   第 64 行   宁可 REVIEW_REQUIRED 不造假 (Principle 1)
--   第 38 行   旧库缺陷: 无 answer_status/analysis_status/original vs generated
--
-- **关键澄清**: 「100% 标注」要求的是**每道题都有一个状态值**(含标成 MISSING),
-- 而**不是**「每道题都有答案」。两者差异巨大 —— 前者是可即时达成的数据治理动作,
-- 后者受限于原始语料本身有没有答案。100% 标注 = 不允许出现「状态未知」的题。
--
-- answer_source / analysis_source 记录**这份答案是从哪来的**(overwrite 前必须有据可查),
-- 对应规范「无静默覆盖」: 任何一次写入都要能回答「它从哪来」。
--
-- 词表沿用库内既有 image_status 的风格 (PRESENT / MISSING_SOURCE / ...):
--   PRESENT          已捕获到内容
--   MISSING_SOURCE   源里就没有 (原卷无答案区 / 答案卷无题干)
--   CONFLICT         同一题拿到互相矛盾的答案, 需人工裁决
--   REVIEW_REQUIRED  有内容但来源不可信, 待复核 (规范 Principle 1: 宁可 REVIEW 不造假)
--   UNKNOWN          未判定 (启用初期占位; 目标状态是 0 行)

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS answer_status   varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS analysis_status varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS answer_source   varchar(32),
  ADD COLUMN IF NOT EXISTS analysis_source varchar(32);

-- 用 CHECK 约束把词表钉死, 避免下游写进拼写变体 (既有 image_status 也是这么做的)
ALTER TABLE public.exam_questions
  DROP CONSTRAINT IF EXISTS ck_exam_questions_answer_status;
ALTER TABLE public.exam_questions
  ADD CONSTRAINT ck_exam_questions_answer_status
  CHECK (answer_status IN ('PRESENT','MISSING_SOURCE','CONFLICT','REVIEW_REQUIRED','UNKNOWN'));

ALTER TABLE public.exam_questions
  DROP CONSTRAINT IF EXISTS ck_exam_questions_analysis_status;
ALTER TABLE public.exam_questions
  ADD CONSTRAINT ck_exam_questions_analysis_status
  CHECK (analysis_status IN ('PRESENT','MISSING_SOURCE','CONFLICT','REVIEW_REQUIRED','UNKNOWN'));

-- 回填存量 (旧 283 卷 + 本次入库前的行): 有内容→PRESENT, 否则→MISSING_SOURCE。
-- 注意: 旧库的 answer 里混着「整段解析」这种污染值, 这里只做状态标注, 不动内容 ——
-- 内容治理属于 §43 的 original/normalized/generated 分列, 不在本 migration 范围。
UPDATE public.exam_questions
   SET answer_status = CASE WHEN answer IS NOT NULL AND btrim(answer) <> ''
                            THEN 'PRESENT' ELSE 'MISSING_SOURCE' END
 WHERE answer_status = 'UNKNOWN';

UPDATE public.exam_questions
   SET analysis_status = CASE WHEN analysis IS NOT NULL AND btrim(analysis) <> ''
                              THEN 'PRESENT' ELSE 'MISSING_SOURCE' END
 WHERE analysis_status = 'UNKNOWN';

-- 状态标注是高频过滤条件 (例如「取所有客观题可判的题」), 建部分索引
CREATE INDEX IF NOT EXISTS idx_exam_questions_answer_status
  ON public.exam_questions (answer_status)
  WHERE archive_state = 'active';

COMMENT ON COLUMN public.exam_questions.answer_status IS
  'G8: 答案完整性状态。100% 标注是验收要求 (含 MISSING_SOURCE), 不等于 100% 有答案。';
COMMENT ON COLUMN public.exam_questions.answer_source IS
  '答案来源溯源 (from_analysis/compact_global/answer_line_global/...), 对应「无静默覆盖」。';
