-- 031_question_tables.sql
-- P4 多模态之表格资产 (规范 §25, 设计文档 §5.3c)
--
-- 诊断依据: docs/database/table-contamination-diagnosis-2026-09-19.md
-- 实测: 本批 1634 卷含 2492 张表 (data_table 2334 / option_layout 158),
--       其中 1464 张完整落在一题里, 529 张被拆给多题, 223 张整表丢失。
--
-- 为什么现在建: qbx.py 不处理 OOXML w:tbl, 表内段落被当正文塞进文本流 ——
--   表格内容目前只以「扁平化文本」的形式存在于 stem/options 里, 没有结构化资产。
--
-- 与设计 §5.3c 的**有意偏离** (两处, 均因机械判据不允许猜):
--   1. question_id 改为**可空** —— 设计写 NOT NULL, 但实测有 529 张表被拆给多题
--      (223 张整表在库里查无此物)。归属无法机械确定时写 NULL + 记 candidate_question_ids,
--      **不猜一个题挂上去** —— 猜了就是把噪声写成归属, 违反本项目「不得把没法测写成通过」。
--   2. 增加 paper_id (NOT NULL) —— 保证即使无归属题, 表也能溯源到卷, 对账不断链。
--
-- **幂等**: UNIQUE(paper_id, source_hash, sort_order) + 回填脚本用 ON CONFLICT DO NOTHING。
-- 回滚: DROP TABLE public.question_tables;

BEGIN;

CREATE TABLE IF NOT EXISTS public.question_tables (
  id                     SERIAL PRIMARY KEY,
  question_id            INTEGER REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  paper_id               INTEGER NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  sort_order             INTEGER NOT NULL,
  headers                JSONB,
  rows                   JSONB NOT NULL,
  n_rows                 INTEGER,
  n_cols                 INTEGER,
  table_kind             VARCHAR(20) NOT NULL,      -- option_layout / data_table
  source_docx            TEXT,                       -- 溯源: 相对仓库路径
  source_hash            VARCHAR(64) NOT NULL,       -- 幂等键: 表格内容 sha256
  candidate_question_ids JSONB,                      -- 归属有歧义时的候选题 (不猜)
  attributed_by          VARCHAR(20),                -- 'cell_match' / NULL (未归属)
  asset_uri              TEXT,                       -- 原截图 (如有, 当前未生成)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_question_tables_src UNIQUE (paper_id, source_hash, sort_order)
);

COMMENT ON TABLE public.question_tables IS
  '题目表格资产 (规范 §25)。表格在原文里是 OOXML w:tbl, 本表存其结构化 rows/headers。'
  'question_id 为空 = 归属无法机械确定 (表被拆给多题 / 内容未在库里), '
  '此时看 candidate_question_ids 与 paper_id。2026-09-19 诊断: 2492 张表里 '
  '1464 张单一归属 / 529 张多题 / 223 张丢失。';

COMMENT ON COLUMN public.question_tables.table_kind IS
  'option_layout = 首列 ≥50% 单元格匹配 ^[A-D][．.、)] (选项是表格排版的, 语文常见); '
  'data_table = 其余。两档处置方式不同: 前者是选项容器, 后者是数据。'
  '混合形态会归错档, 需抽样复核。';

CREATE INDEX IF NOT EXISTS idx_question_tables_q
  ON public.question_tables (question_id);
CREATE INDEX IF NOT EXISTS idx_question_tables_paper
  ON public.question_tables (paper_id);

COMMIT;
