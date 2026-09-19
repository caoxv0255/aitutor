-- 032_attribute_dropped_tables.sql
-- P4-b: 把「内容未在题面里」的表挂回**引用了表的题**
--
-- 依据: docs/database/table-contamination-diagnosis-2026-09-19.md §3
--   2492 张表里 223 张的单元格在本卷任何题面/解析里都找不到 (DROPPED)。
--   这些表的内容**已经**随 031 + 22-extract-tables.py 进了 question_tables.rows,
--   但 question_id 是 NULL —— 题读不到它, 等于资产存在但不可达。
--
-- 判据 (机械, 不猜)
--   候选 = 同卷内 stem/analysis 里出现「下表 / 上表 / 如表 / 表中 / 表格 / 图表中」的题
--   候选恰好 1 个  → question_id = 该题, attributed_by = 'table_reference'
--   候选 0 个      → 保持 NULL (该题不引用表, 或表属于整卷材料, 没有机械依据)
--   候选 ≥2 个     → 保持 NULL, 把候选写进 candidate_question_ids 供人工裁决
--
-- **不采用弱证据**: 诊断里另有 276 张表只有「弱命中」(单个 4–7 字泛用词, 如「生态系统」)。
-- 这种匹配误命中率高, 不足以支撑归属 —— 一律不写 question_id。
--
-- **幂等**: 只作用于 question_id IS NULL 的行; 已归属的行不动。重跑 0 行。
-- 回滚: UPDATE public.question_tables SET question_id=NULL, attributed_by=NULL
--        WHERE attributed_by='table_reference';

BEGIN;

DO $$
DECLARE
  r        record;
  n_attr   int := 0;
  n_cand   int := 0;
  n_none   int := 0;
BEGIN
  FOR r IN
    SELECT t.id AS tid,
           t.paper_id,
           t.candidate_question_ids,
           (SELECT array_agg(q.id ORDER BY q.question_number)
              FROM public.exam_questions q
             WHERE q.paper_id = t.paper_id
               AND q.archive_state = 'active'
               AND (q.stem || ' ' || coalesce(q.analysis, '')) ~
                   '下表|上表|如表|表中|表格|图表中') AS cand
      FROM public.question_tables t
     WHERE t.question_id IS NULL
  LOOP
    IF r.cand IS NULL OR array_length(r.cand, 1) IS NULL THEN
      n_none := n_none + 1;
    ELSIF array_length(r.cand, 1) = 1 THEN
      UPDATE public.question_tables
         SET question_id   = r.cand[1],
             attributed_by = 'table_reference',
             candidate_question_ids = r.candidate_question_ids
       WHERE id = r.tid;
      n_attr := n_attr + 1;
    ELSE
      -- 合并而不是覆盖: 先前 22-extract-tables.py 可能已写入「强命中候选」,
      -- 覆盖等于丢证据。两边取并集, 人工裁决时看全。
      UPDATE public.question_tables t
         SET candidate_question_ids = (
               SELECT jsonb_agg(DISTINCT v ORDER BY v)
                 FROM jsonb_array_elements(
                        coalesce(t.candidate_question_ids, '[]'::jsonb)
                        || to_jsonb(r.cand)) AS v)
       WHERE t.id = r.tid;
      n_cand := n_cand + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[032] 未归属表: 引用表且候选唯一 → 已归属 % 条', n_attr;
  RAISE NOTICE '[032]           候选≥2 (歧义, 记候选待人工) → % 条', n_cand;
  RAISE NOTICE '[032]           无引用表的候选 → 保持 NULL % 条', n_none;
END $$;

COMMIT;
