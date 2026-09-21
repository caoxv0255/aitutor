-- 037_mastery_scale_unify.sql
-- G6 修复：把 mastery 相关列统一到 0..100 标度
--
-- 为什么需要（docs/spec/SPEC-DATA.md §2.5）:
--   同一个 mastered 概念被两套标度读写，差 100 倍：
--     · schema 与多数读取方（knowledge / study-plan / learning-loop DELTA）用 0..100
--     · srs-engine 的 review 路径与 learning-loop 的旧 JS 涟漪用 0..1
--   后果不是"显示不准"而是数据被覆写：srs review 读旧值 60、加 0.08 后
--   clamp 到 1 → 掌握度 60 变成 1，且 srs_review_log 记下这条不可逆日志。
--
-- 本迁移做两件事：
--   1. 放宽 srs_review_log 的 old_mastery / new_mastery 精度：
--      NUMERIC(4,2) 最大 99.99，而统一到 0..100 后会出现 100.00 → 会报错
--   2. 回填历史小标度数据：把 (0, 1] 区间内的值 ×100
--      判据：0..100 标度下的合法值只有 0 或 ≥1 的整数/两位小数，
--      落在 (0,1] 且非 0 的行只能是旧的小标度残留
--
-- 幂等：ALTER 可重复执行；回填用 > 0 AND <= 1 条件，第二次执行为 0 行。

BEGIN;

-- 1. 精度放宽（0..100 需要 3 位整数）
ALTER TABLE srs_review_log
  ALTER COLUMN old_mastery TYPE NUMERIC(5,2),
  ALTER COLUMN new_mastery TYPE NUMERIC(5,2);

-- 2. 回填 student_knowledge_mastery 的历史小标度值
UPDATE student_knowledge_mastery
   SET mastery_score = mastery_score * 100,
       updated_at = NOW()
 WHERE mastery_score > 0
   AND mastery_score <= 1;

-- 3. 回填 srs_review_log 的历史小标度值（同一判据）
UPDATE srs_review_log
   SET old_mastery = old_mastery * 100
 WHERE old_mastery > 0
   AND old_mastery <= 1;

UPDATE srs_review_log
   SET new_mastery = new_mastery * 100
 WHERE new_mastery > 0
   AND new_mastery <= 1;

COMMIT;

-- 验证（执行后手动跑）:
--   SELECT COUNT(*) FROM student_knowledge_mastery WHERE mastery_score > 0 AND mastery_score <= 1;
--   -- 期望 0 行
--   SELECT MIN(mastery_score), MAX(mastery_score) FROM student_knowledge_mastery;
--   -- 期望落在 [0, 100]
