-- 029_llm_answer_grading.sql
-- LLM 补答案**按学科分级** + 冲突答案作废 + ledger 留痕
--
-- 依据: docs/database/qb-v1.0-acceptance-verdict-2026-09-18.md §3
-- 盲测: docs/database/llm-answer-validation.md (deepseek-v3.2 + 联网, 300 题, 源答案独立于模型)
--
--   学科        样本  准确率   裁决
--   biology      34   94.1%   保留答案位 (带「AI 补·未核验」徽标)
--   physics      22   90.9%   保留
--   politics     43   90.7%   保留
--   math         17   88.2%   保留
--   history      48   87.5%   保留
--   chemistry    32   81.2%   保留
--   english      75   76.0%   保留
--   geography    22   68.2%   **撤出答案位** (原值仅存 provenance, 供 tutor 参考)
--   chinese       7   57.1%   **撤出答案位**
--
-- 分级线 70%（裁决 §3.2）。总原则 (§3.1): **LLM_PROPOSED 永不参与判分** ——
-- 答案的「存在」与「可信」是两个维度, 不得合并。本 migration 不改这条原则,
-- 只决定「谁配占答案位」。
--
-- 另有 CONFLICT 103 条 (§3.3): 两条路径给出的答案互相矛盾, 无法判定哪一方正确,
-- 采纳任一方都是把噪声写成事实 → **两个值都不采纳**, 按 MISSING_SOURCE 处理 + 建工单。
--
-- 范围锁定: 仅 2026-09-17 入库批次 (p.created_at::date) 且 archive_state='active',
--          不动旧库行。**幂等**: 每段靠「改前的状态值」做守卫, 重跑是空操作。
--
-- 回滚: 见文件末尾 §7。

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. 写前对账 (只打印, 不改数)
--    预期量级: LLM_PROPOSED 约 2782 条 (其中 chinese/geography 待撤出),
--              CONFLICT 103 条。**执行前请先看这段输出是否与裁决一致**。
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r      record;
  n_conf int;
BEGIN
  RAISE NOTICE '[029][pre] LLM_PROPOSED 按学科:';
  FOR r IN
    SELECT p.subject, count(*) c
      FROM public.exam_questions q
      JOIN public.exam_papers   p ON p.id = q.paper_id
     WHERE p.created_at::date = '2026-09-17'
       AND q.archive_state = 'active'
       AND q.answer_source = 'llm_websearch'
       AND q.answer_status = 'LLM_PROPOSED'
     GROUP BY 1 ORDER BY 2 DESC
  LOOP
    RAISE NOTICE '[029][pre]   % : % 条 %', r.subject, r.c,
      CASE WHEN r.subject IN ('chinese','geography') THEN '→ 撤出答案位' ELSE '→ 保留 (带徽标)' END;
  END LOOP;

  SELECT count(*) INTO n_conf
    FROM public.exam_questions q
    JOIN public.exam_papers   p ON p.id = q.paper_id
   WHERE p.created_at::date = '2026-09-17'
     AND q.archive_state = 'active'
     AND q.answer_status = 'CONFLICT';
  RAISE NOTICE '[029][pre] CONFLICT 待作废: % 条 (裁决 §3.3 两值都不采纳)', n_conf;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 1. provenance 列 —— 被撤下来的值有地方放, 不硬删
--    裁决 §3.2 原话: 「原值仅存 provenance 字段, 供 tutor 侧参考」。
--    用 jsonb 而不是 varchar: 撤出原因不止 LLM 一种 (冲突作废也走这里),
--    且要带学科准确率/时间/原因, 单列装不下。
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS answer_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.exam_questions.answer_provenance IS
  '被撤出答案位的值与其来路 (2026-09-18 裁决 §3)。形如 '
  '{"llm_proposed":"B","model":"deepseek-v3.2+websearch","subject_accuracy":0.571,'
  '"reason":"subject_blind_accuracy_below_70pct"} 或 '
  '{"rejected_answer":"C","reason":"conflict_unresolved"}。**永不参与判分**, 仅供 tutor 参考。';

-- ─────────────────────────────────────────────────────────────
-- 2. <70% 学科 (chinese 57.1% / geography 68.2%) —— 撤出答案位
--    守卫: answer_status='LLM_PROPOSED' → 改完变 MISSING_SOURCE, 重跑空操作。
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  UPDATE public.exam_questions q
     SET answer_provenance = q.answer_provenance || jsonb_build_object(
           'llm_proposed',      q.answer,
           'model',             'deepseek-v3.2+websearch',
           'subject_accuracy',  CASE p.subject WHEN 'chinese'   THEN 0.571
                                               WHEN 'geography' THEN 0.682 END,
           'grading_threshold', 0.70,
           'graded_at',         now(),
           'reason',            'subject_blind_accuracy_below_70pct'),
         answer         = NULL,
         answer_status  = 'MISSING_SOURCE',
         updated_at     = now()
    FROM public.exam_papers p
   WHERE p.id = q.paper_id
     AND p.created_at::date = '2026-09-17'
     AND p.subject IN ('chinese', 'geography')
     AND q.archive_state = 'active'
     AND q.answer_source = 'llm_websearch'
     AND q.answer_status = 'LLM_PROPOSED'
     AND coalesce(btrim(q.answer), '') <> '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[029][2] chinese/geography 撤出答案位: % 行 (原值已存 answer_provenance)', n;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. ≥70% 学科 —— 保留答案位, 只把学科实测准确率写进 provenance
--    徽标由前端读这个字段渲染, 别把百分比硬编码进前端。
--    守卫: 该 key 已存在则跳过 (幂等)。
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  UPDATE public.exam_questions q
     SET answer_provenance = q.answer_provenance || jsonb_build_object(
           'model',            'deepseek-v3.2+websearch',
           'subject_accuracy', CASE p.subject WHEN 'biology'   THEN 0.941
                                              WHEN 'physics'   THEN 0.909
                                              WHEN 'politics'  THEN 0.907
                                              WHEN 'math'      THEN 0.882
                                              WHEN 'history'   THEN 0.875
                                              WHEN 'chemistry' THEN 0.812
                                              WHEN 'english'   THEN 0.760 END,
           'grading_threshold', 0.70,
           'graded_at',        now(),
           'reason',           'subject_blind_accuracy_at_or_above_70pct'),
         updated_at = now()
    FROM public.exam_papers p
   WHERE p.id = q.paper_id
     AND p.created_at::date = '2026-09-17'
     AND p.subject IN ('biology','physics','politics','math','history','chemistry','english')
     AND q.archive_state = 'active'
     AND q.answer_source = 'llm_websearch'
     AND q.answer_status = 'LLM_PROPOSED'
     AND NOT (q.answer_provenance ? 'subject_accuracy');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[029][3] ≥70%% 学科标注准确率: % 行 (答案位与 LLM_PROPOSED 状态不变)', n;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. CONFLICT 103 条 —— 两个值都不采纳, 按 MISSING_SOURCE 处理
--    守卫: answer_status='CONFLICT' → 改完变 MISSING_SOURCE, 重跑空操作。
--    注意: 这里不动 answer_source。它记录的是「这条值从哪来的」, 属于溯源,
--          作废的是值本身, 不是「它曾经从哪来」这条事实。
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  UPDATE public.exam_questions q
     SET answer_provenance = q.answer_provenance || jsonb_build_object(
           'rejected_answer', q.answer,
           'rejected_at',     now(),
           'reason',          'conflict_unresolved'),
         answer        = NULL,
         answer_status = 'MISSING_SOURCE',
         updated_at    = now()
    FROM public.exam_papers p
   WHERE p.id = q.paper_id
     AND p.created_at::date = '2026-09-17'
     AND q.archive_state = 'active'
     AND q.answer_status = 'CONFLICT';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[029][4] CONFLICT 作废并转 MISSING_SOURCE: % 行', n;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. 逐条建工单 (裁决 §3.3: CONFLICT 必须留待人工裁决的入口, 不能只标状态就完)
--    守卫: 同 run_label 的工单已存在则跳过 (幂等)。
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  INSERT INTO public.issue_tickets
    (question_id, question_uid, reported_by, issue_type, description,
     status, priority, metadata, created_at, updated_at)
  SELECT q.id,
         q.question_uid,
         'qb-v1.0-answer-grading',
         'wrong_answer',
         '答案冲突未裁决: 源提取值与独立重建值不一致。按 2026-09-18 裁决 §3.3, '
           || '两个值都不采纳, 已转 answer_status=MISSING_SOURCE; 原值存 answer_provenance。'
           || '需人工回原卷裁决后回填。',
         'open',
         'normal',
         jsonb_build_object(
           'run_label',       'qb-v1.0-answer-grading',
           'reason',          'conflict_unresolved',
           'rejected_answer', q.answer_provenance -> 'rejected_answer',
           'paper_subject',   p.subject,
           'paper_year',      p.year,
           'question_number', q.question_number),
         now(), now()
    FROM public.exam_questions q
    JOIN public.exam_papers   p ON p.id = q.paper_id
   WHERE p.created_at::date = '2026-09-17'
     AND q.archive_state = 'active'
     AND q.answer_status = 'MISSING_SOURCE'
     AND q.answer_provenance ? 'rejected_answer'
     AND NOT EXISTS (
           SELECT 1 FROM public.issue_tickets t
            WHERE t.question_id = q.id
              AND t.issue_type  = 'wrong_answer'
              AND t.metadata ->> 'run_label' = 'qb-v1.0-answer-grading');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[029][5] 新建冲突工单: % 条', n;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. ledger 留痕 (qb_recovery.canonical_migration_ledger)
--    守卫: 同 run_label + action 已存在则跳过 (幂等)。
-- ─────────────────────────────────────────────────────────────
INSERT INTO qb_recovery.canonical_migration_ledger
  (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
SELECT 'qb-v1.0-answer-grading', 'answer', NULL, NULL, 'BEGIN', NULL, NULL,
       jsonb_build_object(
         'verdict',   'docs/database/qb-v1.0-acceptance-verdict-2026-09-18.md#3',
         'policy',    'LLM_PROPOSED 永不参与判分; <70% 学科撤出答案位; CONFLICT 两值都不采纳',
         'threshold', 0.70,
         'batch',     'exam_papers.created_at::date = 2026-09-17'),
       now()
 WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.canonical_migration_ledger
                    WHERE run_label = 'qb-v1.0-answer-grading' AND action = 'BEGIN');

INSERT INTO qb_recovery.canonical_migration_ledger
  (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
SELECT 'qb-v1.0-answer-grading', 'answer', NULL, NULL, 'ANSWER_GRADED', NULL, NULL,
       jsonb_build_object(
         'demoted_to_provenance', (
           SELECT count(*) FROM public.exam_questions q
             JOIN public.exam_papers p ON p.id = q.paper_id
            WHERE p.created_at::date = '2026-09-17' AND q.archive_state = 'active'
              AND q.answer_source = 'llm_websearch'
              AND q.answer_status = 'MISSING_SOURCE'
              AND q.answer_provenance ->> 'reason' = 'subject_blind_accuracy_below_70pct'),
         'kept_with_accuracy', (
           SELECT count(*) FROM public.exam_questions q
             JOIN public.exam_papers p ON p.id = q.paper_id
            WHERE p.created_at::date = '2026-09-17' AND q.archive_state = 'active'
              AND q.answer_source = 'llm_websearch'
              AND q.answer_status = 'LLM_PROPOSED'
              AND q.answer_provenance ? 'subject_accuracy'),
         'conflict_invalidated', (
           SELECT count(*) FROM public.exam_questions q
             JOIN public.exam_papers p ON p.id = q.paper_id
            WHERE p.created_at::date = '2026-09-17' AND q.archive_state = 'active'
              AND q.answer_provenance ->> 'reason' = 'conflict_unresolved'),
         'tickets_created', (
           SELECT count(*) FROM public.issue_tickets
            WHERE metadata ->> 'run_label' = 'qb-v1.0-answer-grading')),
       now()
 WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.canonical_migration_ledger
                    WHERE run_label = 'qb-v1.0-answer-grading' AND action = 'ANSWER_GRADED');

INSERT INTO qb_recovery.canonical_migration_ledger
  (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
SELECT 'qb-v1.0-answer-grading', 'answer', NULL, NULL, 'COMMIT', NULL, NULL,
       jsonb_build_object('migration', '029_llm_answer_grading.sql', 'committed_at', now()),
       now()
 WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.canonical_migration_ledger
                    WHERE run_label = 'qb-v1.0-answer-grading' AND action = 'COMMIT');

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- 7. 回滚 (整类, 不需要逐条找)
--    前提: 本 migration 只搬值、不删值 —— 所有被撤下的值都在 answer_provenance 里。
--
--  -- 7.1 chinese/geography 撤出的值放回答案位
--  UPDATE public.exam_questions q
--     SET answer = q.answer_provenance ->> 'llm_proposed',
--         answer_status = 'LLM_PROPOSED',
--         answer_provenance = q.answer_provenance - 'llm_proposed' - 'reason',
--         updated_at = now()
--   FROM public.exam_papers p
--   WHERE p.id = q.paper_id AND p.created_at::date = '2026-09-17'
--     AND q.answer_provenance ->> 'reason' = 'subject_blind_accuracy_below_70pct';
--
--  -- 7.2 冲突作废的值放回答案位 (状态回到 CONFLICT, 等人工裁决)
--  UPDATE public.exam_questions q
--     SET answer = q.answer_provenance ->> 'rejected_answer',
--         answer_status = 'CONFLICT',
--         answer_provenance = q.answer_provenance - 'rejected_answer' - 'reason',
--         updated_at = now()
--   FROM public.exam_papers p
--   WHERE p.id = q.paper_id AND p.created_at::date = '2026-09-17'
--     AND q.answer_provenance ->> 'reason' = 'conflict_unresolved';
--
--  -- 7.3 撤掉本轮工单与 ledger
--  DELETE FROM public.issue_tickets WHERE metadata ->> 'run_label' = 'qb-v1.0-answer-grading';
--  DELETE FROM qb_recovery.canonical_migration_ledger WHERE run_label = 'qb-v1.0-answer-grading';
-- ─────────────────────────────────────────────────────────────
