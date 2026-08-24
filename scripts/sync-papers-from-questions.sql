-- scripts/sync-papers-from-questions.sql (2026-08-24)
-- 从 exam_questions 表聚合出 exam_papers 记录
-- 用法: docker exec -i aitutor-db-1 psql -U aitutor -d aitutor_db < scripts/sync-papers-from-questions.sql
-- 或: docker cp scripts/sync-papers-from-questions.sql aitutor-db-1:/tmp/ && docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -f /tmp/sync-papers-from-questions.sql

BEGIN;
DELETE FROM exam_papers;

INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_type, question_count, total_score, difficulty_avg, created_at, updated_at)
SELECT 
  pcode, year, subj, 'gaokao', ptype, qcount,
  CASE WHEN subj IN ('math', 'english') THEN 150 ELSE 100 END,
  3.5, NOW(), NOW()
FROM (
  SELECT 
    pcode, year, subj, ptype, qcount,
    ROW_NUMBER() OVER (PARTITION BY pcode, year, subj ORDER BY qcount DESC) as rn
  FROM (
    SELECT 
      CASE 
        WHEN province_code IS NULL OR province_code = '' THEN 'national'
        WHEN province_code ~ '^[a-z_]+$' THEN province_code
        ELSE 'national'
      END as pcode,
      year, subject_code as subj, COUNT(*) as qcount,
      CASE 
        WHEN province_code ~ '^[a-z_]+$' THEN 'provincial'
        WHEN province_code LIKE '%I%' OR province_code = '新课标ⅰ卷' OR province_code = '新课标I卷' THEN 'new_gaokao_i'
        WHEN province_code LIKE '%II%' OR province_code = '新课标ⅱ卷' OR province_code = '新课标II卷' OR province_code = '新高考' THEN 'new_gaokao_ii'
        WHEN province_code = '上海6月' THEN 'shanghai_jun'
        ELSE 'national_other'
      END as ptype
    FROM exam_questions
    WHERE subject_code IS NOT NULL AND year IS NOT NULL
    GROUP BY year, subject_code, province_code
    HAVING COUNT(*) >= 1
  ) agg
) ranked
WHERE rn = 1;

COMMIT;
