-- 024_analysis_split.sql
-- 目的: 满足 G9 (Analysis Integrity) —— original vs generated 区分 + 主观题 reference。
--
-- 规范原文:
--   第 295 行  G9 Analysis Integrity : original vs generated 区分; 主观题 reference+scoring
--   第 194 行  补 original/generated 分列 (§43: analysis_original / analysis_normalized /
--              analysis_ai_generated + enrichment JSONB: {model, model_version, prompt_version,
--              timestamp, confidence} §44)
--
-- 为什么现在就能填
-- ----------------
-- 本管线的解析**全部来自原始语料** (学科网式 【解析】/【分析】/【解答】 段落), 没有任何
-- 一行是模型生成的。所以正确的标注是:
--     analysis_original   = 现有 analysis 内容
--     analysis_normalized = NULL  (未做规范化, 不假装做了)
--     analysis_ai_generated = NULL (未生成, 不假装生成了)
-- 这三列的价值在于**把「来源」变成可查询的一等字段**: 将来接入 AI 补解析时,
-- 生成内容进 ai_generated 列, 与原卷解析物理隔离, 不会混淆 —— 这正是 §43/§44 的用意。

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS analysis_original     text,
  ADD COLUMN IF NOT EXISTS analysis_normalized   text,
  ADD COLUMN IF NOT EXISTS analysis_ai_generated text,
  ADD COLUMN IF NOT EXISTS enrichment            jsonb;

COMMENT ON COLUMN public.exam_questions.analysis_original IS
  '取自原卷的解析原文 (本管线全部解析都在此列)';
COMMENT ON COLUMN public.exam_questions.analysis_ai_generated IS
  '模型生成的解析。与原卷解析物理隔离, 禁止写入 original 列 (§43/44)';
COMMENT ON COLUMN public.exam_questions.enrichment IS
  'AI 富化溯源 {model, model_version, prompt_version, timestamp, confidence} (§44)';

-- 存量回填: 现有 analysis 全部是原卷解析 → 落到 analysis_original
UPDATE public.exam_questions
   SET analysis_original = analysis
 WHERE analysis IS NOT NULL AND btrim(analysis) <> ''
   AND analysis_original IS NULL;

-- 主观题参考答案: 非选择题的 answer 本身就是参考答案 (标准答案原文),
-- 用 reference_answer 单列出来, 让「判分依据」与「学生作答」在语义上分开 (§16)。
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS reference_answer text;

UPDATE public.exam_questions
   SET reference_answer = answer
 WHERE answer IS NOT NULL AND btrim(answer) <> ''
   AND reference_answer IS NULL
   AND question_type IN ('solve','fill','unknown');

-- scoring_points 已存在? 若无则补 (规范 §16: [{label,points}] + total)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='exam_questions' AND column_name='scoring_points') THEN
    ALTER TABLE public.exam_questions ADD COLUMN scoring_points jsonb;
  END IF;
END $$;

-- G9 的可查性: 需要能一键回答「有多少题有原卷解析 / 有多少是生成的」
CREATE INDEX IF NOT EXISTS idx_exam_questions_analysis_original
  ON public.exam_questions ((analysis_original IS NOT NULL))
  WHERE archive_state = 'active';
