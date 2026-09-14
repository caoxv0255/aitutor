-- database/migrations/021_batch02_staging.sql
-- Dispatch 012 Task 1 · Batch-02 专用 Staging 表
--
-- 设计原则：
--   1. 三元组 (paper_uid, question_number, stem_hash) 唯一去重
--   2. content_json 字段保留原始解析结果，便于审计/重处理
--   3. ingest_status 状态机：'parsed' / 'validated' / 'llm_enriched' / 'failed'
--   4. 仅在 qb_recovery schema 内，不污染 public.* 表
--   5. SCD-style metadata: created_at + updated_at + last_processed_at
--   6. 与 020 创建的 exam_regions/exam_materials/exam_sub_questions/exam_question_history/issue_tickets 协同
--
-- 注：此表与 qb_recovery.qb_staging（QB-TAR-B01 历史遗留）并存，不做迁移/合并。

BEGIN;

CREATE TABLE IF NOT EXISTS qb_recovery.batch02_staging (
    id                  BIGSERIAL PRIMARY KEY,
    paper_uid           VARCHAR(80)  NOT NULL,
    question_number     INTEGER      NOT NULL,
    question_uid        VARCHAR(80)  NOT NULL,
    subject             VARCHAR(20)  NOT NULL,
    year                INTEGER      NOT NULL,
    province_code       VARCHAR(20),
    exam_level          VARCHAR(10),
    stem                TEXT         NOT NULL,
    stem_hash           CHAR(64)     NOT NULL,
    options             TEXT,
    answer              TEXT,
    analysis            TEXT,
    content_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    source_file         TEXT         NOT NULL,
    source_format       VARCHAR(20)  NOT NULL DEFAULT 'json',  -- json/jsonl/docx
    ingest_status       VARCHAR(20)  NOT NULL DEFAULT 'parsed', -- parsed/validated/llm_enriched/failed
    llm_processed       BOOLEAN      NOT NULL DEFAULT FALSE,
    validation_errors   JSONB,
    paper_id_ref        INTEGER      REFERENCES public.exam_papers(id) ON DELETE SET NULL,
    region_code         VARCHAR(64)  REFERENCES public.exam_regions(code) ON DELETE SET NULL,
    metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    last_processed_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- 三元组唯一去重
    CONSTRAINT uq_batch02_dedup UNIQUE (paper_uid, question_number, stem_hash)
);

CREATE INDEX IF NOT EXISTS idx_batch02_paper       ON qb_recovery.batch02_staging(paper_uid);
CREATE INDEX IF NOT EXISTS idx_batch02_subject     ON qb_recovery.batch02_staging(subject);
CREATE INDEX IF NOT EXISTS idx_batch02_year        ON qb_recovery.batch02_staging(year);
CREATE INDEX IF NOT EXISTS idx_batch02_status      ON qb_recovery.batch02_staging(ingest_status);
CREATE INDEX IF NOT EXISTS idx_batch02_question_uid ON qb_recovery.batch02_staging(question_uid);
CREATE INDEX IF NOT EXISTS idx_batch02_subject_year ON qb_recovery.batch02_staging(subject, year);

-- 状态机约束
ALTER TABLE qb_recovery.batch02_staging
    DROP CONSTRAINT IF EXISTS ck_batch02_status;
ALTER TABLE qb_recovery.batch02_staging
    ADD CONSTRAINT ck_batch02_status CHECK (
        ingest_status IN ('parsed','validated','llm_enriched','failed','committed')
    );

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION qb_recovery.touch_batch02_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batch02_touch ON qb_recovery.batch02_staging;
CREATE TRIGGER trg_batch02_touch
    BEFORE UPDATE ON qb_recovery.batch02_staging
    FOR EACH ROW EXECUTE FUNCTION qb_recovery.touch_batch02_updated_at();

-- Ledger 留痕
INSERT INTO qb_recovery.canonical_migration_ledger
    (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
VALUES
    ('migration-021-batch02-staging', 'schema', 'batch02_staging', NULL, 'SCHEMA_CREATED', NULL, NULL,
     '{"table":"qb_recovery.batch02_staging","columns":["paper_uid","question_number","question_uid","subject","year","province_code","exam_level","stem","stem_hash","options","answer","analysis","content_json","source_file","source_format","ingest_status","llm_processed","validation_errors","paper_id_ref","region_code","metadata","last_processed_at","created_at","updated_at"],"unique_constraint":["paper_uid","question_number","stem_hash"],"foreign_keys":["public.exam_papers(id)","public.exam_regions(code)"],"indexes":["paper_uid","subject","year","ingest_status","question_uid","subject+year"],"check_constraint":"ingest_status IN (parsed/validated/llm_enriched/failed/committed)"}'::jsonb,
     now()),
    ('migration-021-batch02-staging', 'trigger', 'trg_batch02_touch', NULL, 'TRIGGER_CREATED', NULL, NULL,
     '{"function":"qb_recovery.touch_batch02_updated_at()","event":"BEFORE UPDATE"}'::jsonb,
     now());

COMMIT;
