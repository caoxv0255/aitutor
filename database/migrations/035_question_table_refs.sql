-- 035_question_table_refs.sql
-- P4-c 表格读端可达 (路线图 P1): 把题面里的 ⟦TABLE:n⟧ 占位符确定性映射到 question_tables。
--
-- 为什么需要 (不查 sort_order):
--   qbx 的 n = body.iter(w:tbl) **含空表**的顺序编号 (qbx.py read_paras);
--   question_tables.sort_order = 22-extract-tables.py 对**非空表**重新枚举。
--   实测 386 卷里 4 卷计数不一致 (如 paper 3832 qbx=2/qt=1) → (paper_id, sort_order=n) 会错位。
--   故把映射显式存在题行上, 由 28-backfill-table-refs.py 用**内容签名**生成。
--
-- 值形态 (键 = ⟦TABLE:n⟧ 的 n; 值 = 指到 question_tables.id 或缺失原因):
--   {"1": {"table_id": 1234, "kind": "data_table"},
--    "3": {"table_id": null, "missing": "image_only_table"}}
--   missing 取值 (显式, 不静默): image_only_table / empty_table / ambiguous / no_asset
--
-- 为什么放在 exam_questions 而非独立表: 随题行走 —— 详情端点 SELECT eq.* 自动带上,
--   组卷 SELECT * 自动带上, 读端一次 batch join 即可; 703 token 的规模不需要独立表。
--
-- **幂等**: ADD COLUMN IF NOT EXISTS。回滚: ALTER TABLE ... DROP COLUMN table_refs;

BEGIN;

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS table_refs JSONB;

COMMENT ON COLUMN public.exam_questions.table_refs IS
  '⟦TABLE:n⟧ 占位符 → question_tables.id 的映射 (键为 qbx 表序号 n)。'
  '值为 {"table_id": <int|null>, "kind": <str>, "missing": <reason>}。'
  '为什么不按 question_tables.sort_order 算: qbx 对含空表的每张表编号, '
  '22 只数非空表, 实测 4/386 卷错位。由 28-backfill-table-refs.py 内容签名生成。'
  'missing=image_only_table 表示该占位符其实指向一张只含图片的表 (route A 把图片当表的已知缺陷)。';

-- 部分索引: 只有带映射的行需要被读端按 token 取, 绝大多数题 table_refs IS NULL。
CREATE INDEX IF NOT EXISTS idx_exam_questions_table_refs
  ON public.exam_questions USING gin (table_refs)
  WHERE table_refs IS NOT NULL;

COMMIT;
