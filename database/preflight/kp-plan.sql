-- ============================================
-- KP PLAN: ONLY 3 DETERMINISTIC MAPPINGS (B5 BOUNDARY)
-- 263 UNMAPPED remain in kp_staging_candidate with mapping_status='UNMAPPED'
-- and are NOT inserted into canonical.question_knowledge_points
-- ============================================

BEGIN;

-- chinese_2025_beijing_014 -> CHIN-G0-167 (source=rule, confidence=0.50)
INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score)
SELECT q.id, 'CHIN-G0-167', 0.50
FROM public.exam_questions q WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT (question_id, knowledge_point_id) DO NOTHING;

-- chinese_2025_beijing_014 -> CHIN-G0-154 (source=rule, confidence=0.50)
INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score)
SELECT q.id, 'CHIN-G0-154', 0.50
FROM public.exam_questions q WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT (question_id, knowledge_point_id) DO NOTHING;

-- chinese_2025_beijing_015 -> CHIN-G0-159 (source=rule, confidence=0.50)
INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score)
SELECT q.id, 'CHIN-G0-159', 0.50
FROM public.exam_questions q WHERE q.question_uid = 'chinese_2025_beijing_015' LIMIT 1
ON CONFLICT (question_id, knowledge_point_id) DO NOTHING;

COMMIT;
