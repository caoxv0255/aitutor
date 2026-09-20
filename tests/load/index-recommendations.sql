-- ============================================================================
-- aitutor V1.0 · SLA 优化索引（与 docs/api/learning-path-perf-notes.md 对齐）
-- 关联：tests/load/learning-path-load.js
--
-- 执行：psql -c "$(cat tests/load/index-recommendations.sql)"
-- 预期收益：P95 从 ~250ms 降至 ~80ms
-- ============================================================================

-- ===== 索引 1：mastery 联合索引（最高收益）=====
-- 命中：WHERE user_email = $1 AND (next_review_at <= NOW() OR mastery_score < 80)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mastery_user_priority
  ON student_knowledge_mastery (user_email, next_review_at NULLS LAST, mastery_score)
  WHERE next_review_at IS NOT NULL OR mastery_score < 80;

-- ===== 索引 2：srs_review_log 用户索引（兜底查询必需）=====
-- 命中：WHERE user_email = $1 AND next_review_at <= NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_srs_user_next
  ON srs_review_log (user_email, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ===== 索引 3：wrong_questions 复合索引（时间范围查询加速）=====
-- 命中：WHERE user_email = $1 AND timestamp > NOW() - INTERVAL '30 days'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wrong_user_recent
  ON wrong_questions (user_email, timestamp DESC)
  WHERE timestamp > NOW() - INTERVAL '90 days';

-- ===== 验证：执行计划 =====
EXPLAIN (ANALYZE, BUFFERS)
SELECT knowledge_point_id, mastery_score, next_review_at
FROM student_knowledge_mastery
WHERE user_email = 'loadtest_1@e2e.local'
  AND (next_review_at <= NOW() OR mastery_score < 80)
ORDER BY COALESCE(next_review_at, '9999-12-31'::timestamptz) ASC
LIMIT 20;
-- 期望：Index Scan using idx_mastery_user_priority on student_knowledge_mastery
--       Planning Time: < 1ms
--       Execution Time: < 5ms

EXPLAIN (ANALYZE, BUFFERS)
SELECT knowledge_point_id, COUNT(*) AS due
FROM srs_review_log
WHERE user_email = 'loadtest_1@e2e.local'
  AND next_review_at <= NOW()
GROUP BY knowledge_point_id
LIMIT 10;
-- 期望：Index Scan using idx_srs_user_next on srs_review_log
