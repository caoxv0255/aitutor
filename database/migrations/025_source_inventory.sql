-- 025_source_inventory.sql
-- 目的: 满足 G1 (Source Preservation) —— source_inventory 对账 + 原卷/解析版成对。
--
-- 规范原文:
--   第 287 行  G1 Source Preservation : source_inventory 对账 + 原卷/解析版成对
--   第 270 行  P0 原始资料接收: source_inventory 登记、sha256、区域/年份/科目元数据核验
--   出口验收: inventory 对账 100%; 无静默漏登记
--
-- 为什么需要它
-- ------------
-- 这是整个流水线的**地基**: 没有 source 层, 「DB 里这 1634 卷到底是不是语料的全集」这个问题
-- 永远无法回答 —— 而本任务恰恰吃过这个亏: docx→HTML 阶段曾静默跳过 566 份卷 (34.6%),
-- 因为当时没有任何「源侧应有多少」的基准可对账 (见 SKILL「静默跳过必须先对账」)。
--
-- 「原卷/解析版成对」的落地: 语料文件名自带线索 ——
--   `2024年高考数学试卷（新课标Ⅰ卷）（解析卷）.docx`  → 解析版 (has_answer=true)
--   `2024年高考数学试卷（新课标Ⅰ卷）.docx`            → 原卷   (has_answer=false)
-- 两者共享同一个 paper_key = (exam_level, subject, year, 去掉版本后缀的卷名)。
-- 用 paper_key 就能把「原卷(身份/结构/图)」与「解析版(答案/解析)」配对 (规范 §67 的 join 依据)。

CREATE TABLE IF NOT EXISTS public.source_inventory (
  id            bigserial PRIMARY KEY,
  source_path   text        NOT NULL,
  sha256        char(64)    NOT NULL,
  bytes         bigint      NOT NULL,
  ext           varchar(16) NOT NULL,
  exam_level    varchar(20) NOT NULL,
  subject       varchar(32),
  year          smallint,
  has_answer    boolean     NOT NULL DEFAULT false,   -- 文件名含 解析卷/答案卷/详解
  paper_key     varchar(200),                         -- 配对键: level|subject|year|卷名(去版本后缀)
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sha256)                                     -- 同一份字节只登记一次 (内容寻址)
);

CREATE INDEX IF NOT EXISTS idx_source_inventory_key ON public.source_inventory (paper_key);
CREATE INDEX IF NOT EXISTS idx_source_inventory_meta ON public.source_inventory (exam_level, subject, year);

COMMENT ON TABLE public.source_inventory IS
  'G1: 原始语料登记表。任何「DB 里有多少卷」的问题都要先与这张表对账。';
COMMENT ON COLUMN public.source_inventory.paper_key IS
  '配对键 —— 同一 paper_key 下 has_answer=true 的是解析版, false 的是原卷 (§67 join 依据)';

-- 每个 paper_key 的配对情况视图: 一眼看出「哪些卷只有原卷没解析版」或反之。
-- G1 的「成对」要求不该是「必须成对」(语料里确实有只有原卷的), 而是「配对情况可查、不静默」。
CREATE OR REPLACE VIEW public.v_source_pairs AS
SELECT paper_key,
       count(*)                                    AS versions,
       count(*) FILTER (WHERE has_answer)          AS n_answer_versions,
       count(*) FILTER (WHERE NOT has_answer)      AS n_plain_versions,
       bool_or(has_answer) AND bool_or(NOT has_answer) AS is_paired
  FROM public.source_inventory
 WHERE paper_key IS NOT NULL
 GROUP BY paper_key;
