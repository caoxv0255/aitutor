-- 037_mastery_scale_unify.sql
-- G6 修复：把 mastery 相关标度统一到 0..100（含线上约束迁移）
--
-- 为什么需要（docs/spec/SPEC-DATA.md §2.5 / §2.6）:
--   同一列被两套标度读写，差 100 倍：
--     · 仓库 schema(api/core/db.js:452) 与多数读取方(knowledge / study-plan /
--       learning-loop DELTA) 用 0..100
--     · srs-engine 的 review 路径用 0..1
--   更麻烦的是**线上实际约束与仓库声明不一致**(schema drift)：
--     线上  student_knowledge_mastery_mastery_score_check = CHECK (0 <= x <= 1)
--     仓库  db.js 声明                                    = CHECK (0 <= x <= 100)
--   首次执行本迁移时被线上 0..1 约束拦下，才暴露出这层 drift。
--   因此本迁移必须**同时迁移约束**，否则 0..100 的写入会被 DB 拒绝。
--
-- 本迁移做四件事：
--   1. 放宽 srs_review_log 的 old_mastery / new_mastery 精度：NUMERIC(4,2) 最大 99.99，
--      统一到 0..100 后会出现 100.00 → 会报错
--   2. 摘掉线上的 0..1 约束（回填必须在此之前，否则触发约束错误）
--   3. 回填历史小标度数据：(0, 1] 区间内的值 ×100
--      判据说明：0..100 标度下 1 表示 1%，落在 (0,1] 的行只能是旧的小标度残留；
--      本库该区间仅 3 行(0.40/0.45/0.50) + 1 行日志(0.32/0.40)，
--      且与 SM-2 的连续演进一致(0.32 → 0.40)，可确认是小标度而非 0.x%
--   4. 建立 0..100 约束（幂等：已存在则跳过）
--
-- 幂等：1/2 可重复执行；3 第二次匹配 0 行；4 有存在性判断。

BEGIN;

-- 1. 精度放宽（0..100 需要 3 位整数）
ALTER TABLE srs_review_log
  ALTER COLUMN old_mastery TYPE NUMERIC(5,2),
  ALTER COLUMN new_mastery TYPE NUMERIC(5,2);

-- 2. 摘掉 0..1 旧约束（若存在）
ALTER TABLE student_knowledge_mastery
  DROP CONSTRAINT IF EXISTS student_knowledge_mastery_mastery_score_check;

-- 3. 回填历史小标度值
UPDATE student_knowledge_mastery
   SET mastery_score = mastery_score * 100,
       updated_at = NOW()
 WHERE mastery_score > 0
   AND mastery_score <= 1;

UPDATE srs_review_log
   SET old_mastery = old_mastery * 100
 WHERE old_mastery > 0
   AND old_mastery <= 1;

UPDATE srs_review_log
   SET new_mastery = new_mastery * 100
 WHERE new_mastery > 0
   AND new_mastery <= 1;

-- 4. 建立 0..100 约束（与 api/core/db.js 的声明对齐）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'student_knowledge_mastery'::regclass
       AND conname  = 'student_knowledge_mastery_mastery_score_check'
  ) THEN
    ALTER TABLE student_knowledge_mastery
      ADD CONSTRAINT student_knowledge_mastery_mastery_score_check
      CHECK (mastery_score >= 0 AND mastery_score <= 100);
  END IF;
END $$;

COMMIT;

-- 验证（执行后手动跑）:
--   -- 约束已是 0..100
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='student_knowledge_mastery'::regclass
--      AND conname='student_knowledge_mastery_mastery_score_check';
--   -- 期望: CHECK (((mastery_score >= 0) AND (mastery_score <= 100)))
--
--   -- 无残留小标度
--   SELECT COUNT(*) FROM student_knowledge_mastery WHERE mastery_score > 0 AND mastery_score <= 1;
--   SELECT COUNT(*) FROM srs_review_log WHERE (old_mastery > 0 AND old_mastery <= 1)
--                                           OR (new_mastery > 0 AND new_mastery <= 1);
--   -- 期望均为 0
--
--   -- 区间合理
--   SELECT MIN(mastery_score), MAX(mastery_score) FROM student_knowledge_mastery;
--   -- 期望落在 [0, 100]
