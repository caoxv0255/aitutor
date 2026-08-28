-- Apache AGE 图谱 (Learning Loop ripple effect + tutor-agent.js 防跳跃检测依赖)
-- Dockerfile.db 编译 AGE PG15/v1.6.0-rc0, init 时必须 CREATE EXTENSION
-- 否则 learning-loop.js 的 borrowAgeClient 会失败, 整个事务回滚, mastery 不更新
-- 也修复 R-AGE: sprint 1 验证阻塞根因 (2026-Q4)
CREATE EXTENSION IF NOT EXISTS age;
-- 向量检索 (RAG 依赖)
-- pgvector 0.7.0 的 Dockerfile.db 编译可能缺 initial install SQL,
-- 用 DO block 让 vector 失败时不阻塞其他 extension 安装
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector 安装失败 (%), 跳过 — RAG 检索不可用, 不影响 Learning Loop', SQLERRM;
  END;
END $$;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
