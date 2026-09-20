-- ============================================================================
-- aitutor V1.0 · Staging 压测 Mock 数据准备
-- 关联：tests/load/staging-runbook.md
--
-- 灌入规模：
--   users                       × 1000
--   wrong_questions             × 1,000,000
--   student_knowledge_mastery  × 500,000
--   srs_review_log              × 2,000,000
--
-- 执行：psql -f tests/load/data-prep.sql
-- 注意：需在 Staging DB 执行，**禁止在生产执行**
-- ============================================================================

\set ON_ERROR_STOP on
\timing on

-- ====== 1. 1000 个 mock 用户 ======
INSERT INTO users (email, password, grade, province, exam_level, created_at, updated_at)
SELECT
  'loadtest_' || gs || '@e2e.local'  AS email,
  '$2b$10$abcdefghijklmnopqrstuOvQjKL8cOYx3xH9z3x3x3x3x3x3x3x3x'  AS password,  -- bcrypt mock
  CASE (gs % 3) WHEN 0 THEN '高一' WHEN 1 THEN '高二' ELSE '高三' END,
  CASE (gs % 5) WHEN 0 THEN '11' WHEN 1 THEN '31' WHEN 2 THEN '44' WHEN 3 THEN '50' ELSE '33' END,
  CASE (gs % 2) WHEN 0 THEN 'gaokao' ELSE 'zhongkao' END,
  NOW() - (gs || ' days')::INTERVAL,
  NOW()
FROM generate_series(1, 1000) gs
ON CONFLICT (email) DO NOTHING;

-- ====== 2. 100 万错题（每用户 1000 条，30 天内随机）======
INSERT INTO wrong_questions (user_email, data, timestamp)
SELECT
  u.email,
  jsonb_build_object(
    'id',           'wq-' || gs || '-' || u.email,
    'content',      '模拟错题 ' || gs || ': 已知 ' || (ARRAY['函数','几何','数列','概率','向量','不等式','圆锥曲线','立体几何'])[1 + (gs % 8)] || ' 题目',
    'subject',      (ARRAY['math','chinese','english','physics','chemistry','politics'])[1 + (gs % 6)],
    'image_url',    'https://mock.e2e.local/wq/' || gs || '.jpg',
    'knowledge_point_id',  'kp-' || ((gs % 47) + 1),
    'difficulty',   1 + (gs % 5),
    'error_reason', (ARRAY['概念不清','计算粗心','审题失误','方法不熟','公式遗忘'])[1 + (gs % 5)]
  ),
  NOW() - ((gs * 30 / 1000) || ' minutes')::INTERVAL
FROM users u, generate_series(1, 1000) gs
WHERE u.email LIKE 'loadtest_%@e2e.local'
ON CONFLICT DO NOTHING;

-- ====== 3. 50 万 mastery 记录（每用户 50 KP）======
INSERT INTO student_knowledge_mastery
  (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count, last_practice_at, next_review_at, ease_factor, interval_days, updated_at)
SELECT
  u.email,
  'kp-' || lp.kp_id,
  LEAST(100, GREATEST(0, lp.mastery_base + (random() * 30 - 15)::int)),
  5 + (gs % 20),
  3 + (gs % 15),
  NOW() - (gs || ' hours')::INTERVAL,
  CASE WHEN lp.mastery_base >= 80 THEN NULL
       ELSE NOW() + ((gs * 24 / 50) || ' hours')::INTERVAL
  END,
  2.5,
  CASE WHEN lp.mastery_base >= 80 THEN 0 ELSE (gs % 14) + 1 END,
  NOW()
FROM users u
CROSS JOIN LATERAL (
  SELECT
    gs AS kp_id,
    (CASE WHEN gs % 4 = 0 THEN 90
          WHEN gs % 4 = 1 THEN 60
          WHEN gs % 4 = 2 THEN 30
          ELSE 10 END) AS mastery_base
  FROM generate_series(1, 50) gs
) lp
WHERE u.email LIKE 'loadtest_%@e2e.local'
ON CONFLICT (user_email, knowledge_point_id) DO NOTHING;

-- ====== 4. 200 万 SRS 复习日志（每 mastery 4 条）======
INSERT INTO srs_review_log
  (user_email, knowledge_point_id, is_correct, time_spent_ms, review_quality, old_mastery, new_mastery, old_interval, new_interval, old_ease, new_ease, next_review_at, created_at)
SELECT
  m.user_email,
  m.knowledge_point_id,
  (gs % 4) < 3,                                  -- 75% 正确率
  30000 + (gs * 7) % 60000,                       -- 30-90 秒答题
  CASE WHEN (gs % 4) < 3 THEN 4 ELSE 1 END,        -- quality 1-4
  GREATEST(0, m.mastery_score - 5),
  m.mastery_score,
  m.interval_days,
  m.interval_days + 1,
  m.ease_factor,
  m.ease_factor,
  m.next_review_at,
  NOW() - (gs || ' hours')::INTERVAL
FROM student_knowledge_mastery m, generate_series(1, 4) gs
WHERE m.user_email LIKE 'loadtest_%@e2e.local'
ON CONFLICT DO NOTHING;

-- ====== 验证 ======
SELECT
  (SELECT count(*) FROM users WHERE email LIKE 'loadtest_%@e2e.local')  AS users,
  (SELECT count(*) FROM wrong_questions WHERE user_email LIKE 'loadtest_%@e2e.local')  AS wrong_questions,
  (SELECT count(*) FROM student_knowledge_mastery WHERE user_email LIKE 'loadtest_%@e2e.local')  AS mastery,
  (SELECT count(*) FROM srs_review_log WHERE user_email LIKE 'loadtest_%@e2e.local')  AS srs;
-- 期望：1000 / 1,000,000 / 500,000 / 2,000,000
