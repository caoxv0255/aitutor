-- =============================================================================
-- 008_question_uid_and_type_enums.sql
-- 目标:
--   1. exam_questions.question_uid 回填规则 (与 parse-questions-v4.js generateQuestionUID 对齐)
--   2. question_types 字典补齐 multi_choice + solve 两个解析层枚举
--   3. 新增 question_type_audit 表, 记录枚举回退与人工修正历史
-- =============================================================================

BEGIN;

-- 1.1 检查 question_uid 现状
DO $$
DECLARE
  empty_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO empty_count FROM exam_questions WHERE question_uid IS NULL OR question_uid = '';
  SELECT COUNT(*) INTO total_count FROM exam_questions;
  RAISE NOTICE 'exam_questions 总数: %, 空 uid: %', total_count, empty_count;
END $$;

-- 1.2 对空 uid 的题, 用 subject_code|year|province_code|question_number 拼接生成
-- 兼容: 已有 UNIQUE 约束 exam_questions_question_uid_key
UPDATE exam_questions eq
   SET question_uid = eq.subject_code || '_' || eq.year || '_' || COALESCE(eq.province_code, 'xx') || '_' || eq.question_number,
       updated_at = NOW()
 WHERE (eq.question_uid IS NULL OR eq.question_uid = '')
   AND eq.subject_code IS NOT NULL
   AND eq.year IS NOT NULL
   AND eq.question_number IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM exam_questions dup
      WHERE dup.question_uid = (eq.subject_code || '_' || eq.year || '_' || COALESCE(eq.province_code, 'xx') || '_' || eq.question_number)
        AND dup.id <> eq.id
   );

-- 1.3 用 paper_id + question_number 做兜底
UPDATE exam_questions eq
   SET question_uid = 'q_' || eq.paper_id || '_' || eq.question_number,
       updated_at = NOW()
 WHERE (eq.question_uid IS NULL OR eq.question_uid = '')
   AND eq.paper_id IS NOT NULL
   AND eq.question_number IS NOT NULL;

-- 2. 补齐 question_types 中缺失的枚举
INSERT INTO question_types (code, name, category, has_options, sort_order)
VALUES
  ('multi_choice', '多选题', 'objective', 1, 1.5),
  ('solve',        '解答题', 'subjective', 0, 5)
ON CONFLICT (code) DO NOTHING;

-- 3. question_type_audit 表
CREATE TABLE IF NOT EXISTS question_type_audit (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL,
  raw_value TEXT,
  mapped_value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qta_question_id ON question_type_audit(question_id);

COMMIT;

-- 验证
-- SELECT COUNT(*) FILTER (WHERE question_uid IS NULL OR question_uid = '') AS still_empty FROM exam_questions;
