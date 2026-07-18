ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET effective_cache_size = '4GB';
ALTER SYSTEM SET synchronous_commit = 'off';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET log_min_duration_statement = '5000';
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_lock_waits = 'on';
ALTER SYSTEM SET deadlock_timeout = '2s';
ALTER SYSTEM SET max_locks_per_transaction = '64';
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = '0.05';
ALTER SYSTEM SET autovacuum_analyze_scale_factor = '0.02';

CREATE OR REPLACE VIEW v_exam_questions_recent AS
SELECT * FROM exam_questions WHERE year >= EXTRACT(YEAR FROM NOW()) - 3;

CREATE OR REPLACE FUNCTION get_questions_by_year_range(start_year INT, end_year INT)
RETURNS SETOF exam_questions AS $$
BEGIN
  RETURN QUERY SELECT * FROM exam_questions WHERE year BETWEEN start_year AND end_year;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION analyze_slow_queries(hours_back INT DEFAULT 24)
RETURNS TABLE(
  queryid BIGINT,
  query TEXT,
  calls BIGINT,
  total_time INTERVAL,
  min_time INTERVAL,
  max_time INTERVAL,
  mean_time INTERVAL,
  rows BIGINT,
  shared_blks_hit BIGINT,
  shared_blks_read BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.queryid,
    pg_stat_statements.query,
    pg_stat_statements.calls,
    make_interval(secs => pg_stat_statements.total_time / 1000) AS total_time,
    make_interval(secs => pg_stat_statements.min_time / 1000) AS min_time,
    make_interval(secs => pg_stat_statements.max_time / 1000) AS max_time,
    make_interval(secs => pg_stat_statements.mean_time / 1000) AS mean_time,
    pg_stat_statements.rows,
    pg_stat_statements.shared_blks_hit,
    pg_stat_statements.shared_blks_read
  FROM pg_stat_statements
  WHERE pg_stat_statements.total_time > 5000
  ORDER BY pg_stat_statements.total_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION analyze_slow_queries(INT) TO aitutor;