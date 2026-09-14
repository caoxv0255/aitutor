-- =============================================================
-- 019_kp_source_column.sql
-- Author: DSH
-- Applied: 2026-09-04 23:58
-- Per user decision: 加 source 列, stage16 暂不填 (分两步)
-- =============================================================
BEGIN;
ALTER TABLE public.question_knowledge_points ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'rule';
ALTER TABLE public.question_knowledge_points ALTER COLUMN source SET DEFAULT 'rule';
UPDATE public.question_knowledge_points SET source='rule' WHERE source IS NULL;
COMMIT;
