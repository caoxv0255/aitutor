-- 030_formula_known_issue_tickets.sql
-- G11 残留 5 条不可渲染公式 —— 逐条建工单 (裁决 §1③: **建工单, 不硬修**)
--
-- 依据: docs/database/qb-v1.0-acceptance-verdict-2026-09-18.md §1③ / known-issues K1
-- 判据: D093 ③ —— 闸门按**可渲染率 ≥99.5%** 判定 (实测 99.95%, 达标);
--       残留项不阻塞发布, 但必须有留待人工处理的入口, 不能只标状态就完。
--
-- 为什么不硬修: 这 5 条修了会变成更坏的东西 ——
--   #160394 / #162522  VLM 循环产物 (bar{bar{... 无限嵌套 / 长 \! 串), 结构不可复原
--   #160817 / #162522  JSON 外壳 ({"latex": ...}), 抽字段会丢内容
--   #161046            双下标 \log_{b}^{x}_{...}, 修后仍非法
--   #161226            \boxempty 为臆造命令, 无对应语义
--
-- 口径与闸门一致 (20-formula-gate.py): formula_quality='F0' 或 latex 为空。
-- **幂等**: 同 run_label + formula_id 的工单已存在则跳过。
-- 回滚: DELETE FROM public.issue_tickets WHERE metadata->>'run_label' = 'qb-v1.0-formula-gate';

BEGIN;

INSERT INTO public.issue_tickets
  (question_id, reported_by, issue_type, description, status, priority, metadata, created_at, updated_at)
SELECT f.question_id,
       'qb-v1.0-formula-gate',
       'FORMULA_UNRENDERABLE',
       '公式不可渲染 (KaTeX), 按 2026-09-18 裁决 §1③ 不硬修 —— 修复后会变成更坏的东西, '
         || '列入 v1.0 known-issues K1。原文已存 latex_original, 需人工回原卷重取。',
       'open',
       'low',
       jsonb_build_object(
         'run_label',   'qb-v1.0-formula-gate',
         'formula_id',  f.id,
         'latex',       left(f.latex, 200),
         'has_original', f.latex_original IS NOT NULL,
         'repair_note', f.repair_note),
       now(), now()
  FROM public.question_formulas f
 WHERE (f.formula_quality = 'F0' OR f.latex IS NULL OR btrim(f.latex) = '')
   AND NOT EXISTS (
         SELECT 1 FROM public.issue_tickets t
          WHERE t.metadata ->> 'run_label'  = 'qb-v1.0-formula-gate'
            AND (t.metadata ->> 'formula_id')::int = f.id);

COMMIT;
