-- ============================================
-- QB-TAR BATCH 01 v3 / CANONICAL MIGRATION PREFLIGHT
-- Generated 2026-09-09T15:38:49.436Z (run_label=QB-TAR-20260904-B01-1788968329-STAGE8)
-- Policy: DSH-STAGING; NO PRODUCTION WRITE
-- ============================================

BEGIN;

-- Target: 4 papers, 90 questions (canonical_candidate)
-- paper_uid: sha16(exam_type|region_key|exam_level|subject|year|paper_variant) per design doc §6
-- question_uid: D063 Rule A {subject}_{year}_{province}_{qn}
-- exam_papers: ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE
-- exam_questions: ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number DO UPDATE
-- Both are idempotent; re-runnable.


-- PAPER: chinese|2024|beijing|gaokao
INSERT INTO public.exam_papers (
  paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type,
  question_count
) VALUES (
  'b4ab624a4e7460d8',
  'beijing',
  2024,
  'chinese',
  'gaokao',
  'main',
  'beijing',
  25
)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id;

-- PAPER: chinese|2025|beijing|gaokao
INSERT INTO public.exam_papers (
  paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type,
  question_count
) VALUES (
  '35dccaaf93229ff4',
  'beijing',
  2025,
  'chinese',
  'gaokao',
  'main',
  'beijing',
  25
)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id;

-- PAPER: history|2024|beijing|gaokao
INSERT INTO public.exam_papers (
  paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type,
  question_count
) VALUES (
  '99e1a3bc2dd808ff',
  'beijing',
  2024,
  'history',
  'gaokao',
  'main',
  'beijing',
  20
)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id;

-- PAPER: history|2025|beijing|gaokao
INSERT INTO public.exam_papers (
  paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type,
  question_count
) VALUES (
  '299a49bf489ab027',
  'beijing',
  2025,
  'history',
  'gaokao',
  'main',
  'beijing',
  20
)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id;
