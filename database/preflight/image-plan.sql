-- ============================================
-- IMAGE PLAN: 3 BRANCHES
-- Branch A (PRESENT): INSERT question_images rows for each resolved filename
-- Branch B (MISSING_SOURCE): do NOT INSERT; rely on question.image_status='MISSING_SOURCE'
-- Branch C (NOT_EXPECTED): no image rows
-- ============================================

BEGIN;

-- chinese_2024_beijing_001 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_001 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_001 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_001 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_001 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_002 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_002 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_002 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_002 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_002 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_003 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_003 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_003 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_003 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_003 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_004 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_004 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_004 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_004 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_004 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_005 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_005 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_005 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_005 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_005 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_006 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_006 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_006 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_006 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_006 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_007 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_007 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_007 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_007 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_007 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_008 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_008 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_008 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_008 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_008 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_009 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_009 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_009 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_009 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_009 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_010 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_010 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_010 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_010 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_010 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_011 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_011 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_011 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_011 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_011 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_012 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_012 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_012 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_012 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_012 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_013 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_013 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_013 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_013 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_013 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_014 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_014 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_014 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_014 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_014 | MISSING_SOURCE for: page_21_img_1.png, page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_015 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_015 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_015 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_015 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_015 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_016 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_016 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_016 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_016 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_016 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_017 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_017 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_017 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_017 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_017 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_018 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_018 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_018 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_018 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_018 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_019 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_019 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_019 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_019 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_019 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_020 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_020 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_020 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_020 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_020 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_021 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_021 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_021 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_021 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_021 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_022 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_022 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_022 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_022 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_022 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_023 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_023 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_023 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_023 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_023 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_024 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_024 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_024 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_024 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_024 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2024_beijing_025 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_025 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_025 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2024_beijing_025 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2024_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2024_beijing_025 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png, page_26_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_001 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_001 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_001 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_001 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_001 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_002 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_002 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_002 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_002 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_002 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_003 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_003 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_003 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_003 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_003 | MISSING_SOURCE for: page_21_img_1.png, page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_004 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_004 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_004 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_004 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_004 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_005 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_005 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_005 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_005 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_005 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_006 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_006 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_006 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_006 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_006 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_007 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_007 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_007 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_007 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_007 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_008 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_008 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_008 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_008 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_008 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_009 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_009 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_009 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_009 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_009 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_010 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_010 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_010 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_010 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_010 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_011 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_011 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_011 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_011 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_011 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_012 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_012 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_012 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_012 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_012 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_013 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_013 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_013 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_013 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_013 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_014 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_014 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_014 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_014 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_014 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_015 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_015 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_015 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_015 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_015 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_016 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_016 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_016 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_016 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_016 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_017 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_017 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_017 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_017 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_017 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_018 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_018 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_018 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_018 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_018 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_019 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_019 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_019 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_019 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_019 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_020 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_020 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_020 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_020 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_020 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_021 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_021 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_021 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_021 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_021' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_021 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_022 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_022 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_022 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_022 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_022' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_022 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_023 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_023 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_023 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_023 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_023' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_023 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_024 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_024 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_024 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_024 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_024' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_024 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- chinese_2025_beijing_025 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_025 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_025 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;

-- chinese_2025_beijing_025 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/chinese/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'chinese_2025_beijing_025' LIMIT 1
ON CONFLICT DO NOTHING;
-- chinese_2025_beijing_025 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png, page_17_img_1.png, page_18_img_1.png, page_19_img_1.png, page_20_img_1.png, page_21_img_1.png, page_22_img_1.png, page_23_img_1.png, page_24_img_1.png, page_25_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_001 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_001 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_001 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_001 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_001 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_001 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_001 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_002 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_002 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_002 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_002 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_002 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_002 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_002 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_003 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_003 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_003 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_003 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_003 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_003 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_003 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_004 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_004 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_004 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_004 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_004 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_004 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_004 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_005 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_005 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_005 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_005 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_005 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_005 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_005 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_006 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_006 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_006 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_006 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_006 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_006 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_006 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_007 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_007 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_007 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_007 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_007 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_007 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_007 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_008 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_008 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_008 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_008 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_008 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_008 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_008 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_009 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_009 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_009 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_009 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_009 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_009 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_009 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_010 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_010 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_010 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_010 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_010 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_010 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_010 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_011 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_011 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_011 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_011 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_011 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_011 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_011 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_012 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_012 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_012 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_012 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_012 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_012 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_012 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_013 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_013 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_013 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_013 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_013 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_013 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_013 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_014 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_014 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_014 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_014 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_014 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_014 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_014 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_015 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_015 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_015 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_015 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_015 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_015 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_015 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_016 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_016 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_016 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_016 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_016 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_016 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_016 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_017 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_017 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_017 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_017 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_017 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_017 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_017 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_018 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_018 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_018 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_018 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_018 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_018 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_018 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_019 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_019 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_019 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_019 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_019 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_019 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_019 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2024_beijing_020 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_020 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_020 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_020 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_020 | page_10_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_10_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2024_beijing_020 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2024/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2024_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2024_beijing_020 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_001 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_001 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_001' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_001 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_002 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_002 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_002' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_002 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_003 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_003 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_003' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_003 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_004 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_004 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_004' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_004 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_005 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_005 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_005' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_005 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_006 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_006 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_006' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_006 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_007 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_007 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_007' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_007 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_008 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_008 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_008' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_008 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_009 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_009 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_009' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_009 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_010 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_010 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_010' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_010 | MISSING_SOURCE for: page_9_img_1.png, page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_011 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_011 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_011' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_011 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_012 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_012 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_012' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_012 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_013 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_013 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_013' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_013 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_014 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_014 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_014' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_014 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_015 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_015 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_015' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_015 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_016 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_016 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_016' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_016 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_017 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_017 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_017' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_017 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_018 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_018 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_018' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_018 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_019 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_019 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_019' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_019 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

-- history_2025_beijing_020 | page_2_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_2_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_3_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_3_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_3_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_6_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_6_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_9_img_2.jpeg (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_9_img_2.jpeg', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_10_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_10_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;

-- history_2025_beijing_020 | page_12_img_1.png (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, 'database/question-bank/history/2025/page_12_img_1.png', 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = 'history_2025_beijing_020' LIMIT 1
ON CONFLICT DO NOTHING;
-- history_2025_beijing_020 | MISSING_SOURCE for: page_1_img_1.png, page_2_img_1.png, page_4_img_1.png, page_5_img_1.png, page_7_img_1.png, page_8_img_1.png, page_9_img_1.png, page_11_img_1.png, page_13_img_1.png, page_14_img_1.png, page_15_img_1.png, page_16_img_1.png (no INSERT; question.image_status='MISSING_SOURCE')

COMMIT;
