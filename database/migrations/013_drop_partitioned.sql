-- =============================================================================
-- 013_drop_partitioned.sql
-- 目标:
--   删除未使用的 exam_questions_partitioned 分区表及其分区
--
-- 背景 (DB 子代理审计 / D074-C2):
--   - exam_questions_partitioned 在 init/02-partitions.sql 中声明 (按 year RANGE 分区,
--     包含 y2019 ~ y2026 共 8 个分区 + ydefault)
--   - 但 db.js 主表创建走的是 exam_questions (非分区版), 业务代码全部用后者,
--     分区表从未被任何 query / import / seed 引用
--   - 保留它的代价:
--       * DDL 时间 (启动时 8 个 CREATE TABLE IF NOT EXISTS)
--       * 维护负担 (新增年份需要手工加分区, 否则数据进 ydefault)
--       * 误导 (新人以为主表是分区版本)
--
-- 设计:
--   - DROP TABLE IF EXISTS ... CASCADE: 幂等, 兼容新库 (表不存在) 与旧库 (表存在)
--   - CASCADE 会自动 drop 所有分区 (y2019 ~ ydefault) 与依赖对象
--   - 不影响 exam_questions 主表 (0 业务查询, 0 依赖)
--
-- Phase C2-fix (2026-08-24): C2-1
-- =============================================================================

BEGIN;

-- 1. 删除分区表 + 所有分区 (CASCADE 自动清理分区 + 索引)
DROP TABLE IF EXISTS exam_questions_partitioned CASCADE;

-- 验证: 表已不存在
-- SELECT to_regclass('exam_questions_partitioned');  -- 应为 NULL

COMMIT;