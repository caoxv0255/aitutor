-- 028_question_dedup.sql
-- 目的: P5 Canonicalization + dedup —— 把「重复题分类」落地成表 (G5 出口要求「分类表落地; 无 unresolved」)。
--
-- 背景
--   设计文档 §6 的阶段表: P5 = duplicate 分类 EXACT/CONTENT/SOURCE_COPY/VARIANT/RELATED/UNIQUE
--   (§32–33); 出口 = 无 unresolved dup; VARIANT 保留策略落地。
--   验收 G5 Dedup: 分类表落地; 无 unresolved。
--
-- ⚠️ 规范细则 (§32–33) 的原文**不在本仓库** (只有词表)。因此本表用**可操作定义**实现,
--    每个取值的判据写在 dup_kind 的 COMMENT 里, 便于日后与规范原文对齐时逐条核对。
--    「VARIANT 保留策略」属**业务决策**, 本表只做分类与记录, 不删除任何题 (一行未删原则)。
--
-- 设计要点
--   · 一题一行 (question_id UNIQUE) —— 不允许一题挂多个分类, 否则「unresolved」无法定义;
--   · canonical_id 指向组内代表 (id 最小者), UNIQUE 的题 canonical_id = 自己;
--   · similarity 记录与代表的相似度 (EXACT/SOURCE_COPY = 1.000);
--   · decided_by 区分 rule / manual —— 人工裁决可覆盖规则结果而不丢历史。

CREATE TABLE IF NOT EXISTS public.question_dedup (
  id           BIGSERIAL PRIMARY KEY,
  question_id  INTEGER NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  dup_kind     VARCHAR(16) NOT NULL,
  group_key    TEXT,
  canonical_id INTEGER,
  similarity   NUMERIC(4,3),
  decided_by   VARCHAR(16) NOT NULL DEFAULT 'rule',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_question_dedup_kind CHECK (
    dup_kind IN ('EXACT','CONTENT','SOURCE_COPY','VARIANT','RELATED','UNIQUE')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_dedup_question
  ON public.question_dedup (question_id);
CREATE INDEX IF NOT EXISTS idx_question_dedup_group
  ON public.question_dedup (group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_question_dedup_kind
  ON public.question_dedup (dup_kind);

COMMENT ON TABLE public.question_dedup IS
  'P5 重复题分类 (G5)。规范 §32–33 原文不在仓库, 判据为可操作定义, 见各 dup_kind 的 COMMENT。';

COMMENT ON COLUMN public.question_dedup.dup_kind IS
  'EXACT=归一化文本完全相同且**同卷**; '
  'SOURCE_COPY=归一化文本完全相同但**跨卷**(同题被不同卷收录, 如全国卷多省共用); '
  'CONTENT=归一化文本不同但相似度>=0.97(排版/空白差异); '
  'VARIANT=相似度 0.85~0.97(改数字/换选项的变式题); '
  'RELATED=同前缀块但相似度<0.85(同材料不同设问); '
  'UNIQUE=无重复。';

COMMENT ON COLUMN public.question_dedup.canonical_id IS
  '组内代表题 id (组内 id 最小者)。UNIQUE 题指向自己。';
