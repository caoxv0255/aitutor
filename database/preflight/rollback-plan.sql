-- ============================================
-- QB-TAR BATCH 01 v3 / CANONICAL MIGRATION PREFLIGHT
-- ROLLBACK PLAN (inverse of migration-plan.sql + question-plan.sql + image-plan.sql + kp-plan.sql)
-- Generated 2026-09-09T15:40:21.122Z
-- Policy: DSH-STAGING; NO PRODUCTION WRITE
-- ============================================

BEGIN;

-- Rollback: delete only the 90 candidate records and 4 papers
-- Identified by: paper_uid IN (the 4 distinct uids) and question_uid IN (90)

-- 1) Delete KP links first (FK from public.question_knowledge_points -> exam_questions)
DELETE FROM public.question_knowledge_points
WHERE question_id IN (
  SELECT id FROM public.exam_questions
  WHERE question_uid IN (
    'chinese_2024_beijing_001',
    'chinese_2024_beijing_002',
    'chinese_2024_beijing_003',
    'chinese_2024_beijing_004',
    'chinese_2024_beijing_005',
    'chinese_2024_beijing_006',
    'chinese_2024_beijing_007',
    'chinese_2024_beijing_008',
    'chinese_2024_beijing_009',
    'chinese_2024_beijing_010',
    'chinese_2024_beijing_011',
    'chinese_2024_beijing_012',
    'chinese_2024_beijing_013',
    'chinese_2024_beijing_014',
    'chinese_2024_beijing_015',
    'chinese_2024_beijing_016',
    'chinese_2024_beijing_017',
    'chinese_2024_beijing_018',
    'chinese_2024_beijing_019',
    'chinese_2024_beijing_020',
    'chinese_2024_beijing_021',
    'chinese_2024_beijing_022',
    'chinese_2024_beijing_023',
    'chinese_2024_beijing_024',
    'chinese_2024_beijing_025',
    'chinese_2025_beijing_001',
    'chinese_2025_beijing_002',
    'chinese_2025_beijing_003',
    'chinese_2025_beijing_004',
    'chinese_2025_beijing_005',
    'chinese_2025_beijing_006',
    'chinese_2025_beijing_007',
    'chinese_2025_beijing_008',
    'chinese_2025_beijing_009',
    'chinese_2025_beijing_010',
    'chinese_2025_beijing_011',
    'chinese_2025_beijing_012',
    'chinese_2025_beijing_013',
    'chinese_2025_beijing_014',
    'chinese_2025_beijing_015',
    'chinese_2025_beijing_016',
    'chinese_2025_beijing_017',
    'chinese_2025_beijing_018',
    'chinese_2025_beijing_019',
    'chinese_2025_beijing_020',
    'chinese_2025_beijing_021',
    'chinese_2025_beijing_022',
    'chinese_2025_beijing_023',
    'chinese_2025_beijing_024',
    'chinese_2025_beijing_025',
    'history_2024_beijing_001',
    'history_2024_beijing_002',
    'history_2024_beijing_003',
    'history_2024_beijing_004',
    'history_2024_beijing_005',
    'history_2024_beijing_006',
    'history_2024_beijing_007',
    'history_2024_beijing_008',
    'history_2024_beijing_009',
    'history_2024_beijing_010',
    'history_2024_beijing_011',
    'history_2024_beijing_012',
    'history_2024_beijing_013',
    'history_2024_beijing_014',
    'history_2024_beijing_015',
    'history_2024_beijing_016',
    'history_2024_beijing_017',
    'history_2024_beijing_018',
    'history_2024_beijing_019',
    'history_2024_beijing_020',
    'history_2025_beijing_001',
    'history_2025_beijing_002',
    'history_2025_beijing_003',
    'history_2025_beijing_004',
    'history_2025_beijing_005',
    'history_2025_beijing_006',
    'history_2025_beijing_007',
    'history_2025_beijing_008',
    'history_2025_beijing_009',
    'history_2025_beijing_010',
    'history_2025_beijing_011',
    'history_2025_beijing_012',
    'history_2025_beijing_013',
    'history_2025_beijing_014',
    'history_2025_beijing_015',
    'history_2025_beijing_016',
    'history_2025_beijing_017',
    'history_2025_beijing_018',
    'history_2025_beijing_019',
    'history_2025_beijing_020'
  )
);

-- 2) Delete question_images (FK -> exam_questions)
DELETE FROM public.question_images
WHERE question_id IN (
  SELECT id FROM public.exam_questions
  WHERE question_uid IN (
    'PLACEHOLDER_QUESTION_UIDS'
  )
);

-- 3) Delete exam_questions
DELETE FROM public.exam_questions
WHERE question_uid IN (
  'PLACEHOLDER_QUESTION_UIDS'
);

-- 4) Delete exam_papers (only if no children remain)
DELETE FROM public.exam_papers
WHERE paper_uid IN (
  'b4ab624a4e7460d8', '35dccaaf93229ff4', '99e1a3bc2dd808ff', '299a49bf489ab027'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.exam_questions eq
    WHERE eq.paper_id = public.exam_papers.id
  );

COMMIT;
