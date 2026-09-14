-- database/migrations/020_schema_refactor.sql
-- Dispatch 010 Action A · 物理对齐版
--
-- 设计原则：适配当前真实物理环境，绝不假设未落地的 JSON 输入或未配置的 API key。
-- 新表与新增列均为可独立回滚的最小集；任何对已有 4 张核心表 (exam_papers/exam_questions/
-- question_images/question_knowledge_points) 的变更均经过 ledger 追踪。
--
-- 包含：
--   1. exam_regions        — 全国行政区划维度（基于真实 provinces 表 seed）
--   2. exam_materials      — 材料题元数据
--   3. exam_sub_questions  — 材料题下的子问题
--   4. exam_question_history — SCD Type 2 历史快照
--   5. issue_tickets       — UGC 纠错工单
--   6. ALTER exam_questions — 添加 archive_state 字段

BEGIN;

-- ───────────────────────────────────────────────────────────────
-- 1. exam_regions (行政区划维度)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_regions (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,   -- 例如 'beijing', 'beijing_zhongkao', 'east_china'
    name            VARCHAR(128) NOT NULL,
    region_level    VARCHAR(32)  NOT NULL DEFAULT 'province',  -- country/region/province/district
    parent_code     VARCHAR(64)  REFERENCES public.exam_regions(code) ON DELETE SET NULL,
    macro_region    VARCHAR(32),                   -- 华东/华北/华南/华中/西南/西北/东北
    exam_type       VARCHAR(32),                   -- gaokao/zhongkao/blank
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    metadata        JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_regions_macro ON public.exam_regions(macro_region);
CREATE INDEX IF NOT EXISTS idx_exam_regions_level ON public.exam_regions(region_level);
CREATE INDEX IF NOT EXISTS idx_exam_regions_parent ON public.exam_regions(parent_code);

-- Seed 7 个 macro_region
INSERT INTO public.exam_regions (code, name, region_level, macro_region, exam_type)
VALUES
    ('east_china',     '华东', 'region', 'east_china',     NULL),
    ('north_china',    '华北', 'region', 'north_china',    NULL),
    ('south_china',    '华南', 'region', 'south_china',    NULL),
    ('central_china',  '华中', 'region', 'central_china',  NULL),
    ('southwest',      '西南', 'region', 'southwest',      NULL),
    ('northwest',      '西北', 'region', 'northwest',      NULL),
    ('northeast',      '东北', 'region', 'northeast',      NULL)
ON CONFLICT (code) DO NOTHING;

-- Seed 每个真实省份（从 provinces 表 mirror，parent_code 指向 macro_region）
INSERT INTO public.exam_regions (code, name, region_level, parent_code, macro_region, exam_type)
SELECT
    p.code,
    p.name,
    CASE WHEN p.code LIKE '%_zhongkao' THEN 'province' ELSE 'province' END,
    CASE p.region
        WHEN '华东' THEN 'east_china'
        WHEN '华北' THEN 'north_china'
        WHEN '华南' THEN 'south_china'
        WHEN '华中' THEN 'central_china'
        WHEN '西南' THEN 'southwest'
        WHEN '西北' THEN 'northwest'
        WHEN '东北' THEN 'northeast'
        ELSE NULL
    END,
    CASE p.region
        WHEN '华东' THEN 'east_china'
        WHEN '华北' THEN 'north_china'
        WHEN '华南' THEN 'south_china'
        WHEN '华中' THEN 'central_china'
        WHEN '西南' THEN 'southwest'
        WHEN '西北' THEN 'northwest'
        WHEN '东北' THEN 'northeast'
    END,
    p.exam_type
FROM public.provinces p
WHERE NOT EXISTS (
    SELECT 1 FROM public.exam_regions er WHERE er.code = p.code
);

-- ───────────────────────────────────────────────────────────────
-- 2. exam_materials (材料题元数据)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_materials (
    id              SERIAL PRIMARY KEY,
    question_id     INTEGER NOT NULL UNIQUE
                    REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    material_type   VARCHAR(32) NOT NULL DEFAULT 'text',  -- text/image/audio/mixed
    material_body   TEXT,                                  -- 题目背景/材料原文
    source_ref      VARCHAR(256),                          -- 出处/作者/年代
    parse_status    VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending/parsed/skipped/failed
    parsed_by       VARCHAR(64),                            -- 'rule' / 'llm:dashscope' / 'human'
    parsed_at       TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_materials_status ON public.exam_materials(parse_status);
CREATE INDEX IF NOT EXISTS idx_exam_materials_type ON public.exam_materials(material_type);

-- ───────────────────────────────────────────────────────────────
-- 3. exam_sub_questions (材料题下的子问题)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sub_questions (
    id              SERIAL PRIMARY KEY,
    parent_question_id INTEGER NOT NULL
                    REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    sub_number      VARCHAR(16) NOT NULL,                  -- '1', '2', '(1)', '(2)'
    sub_index       INTEGER NOT NULL DEFAULT 1,           -- 排序
    stem            TEXT NOT NULL,
    options         TEXT,
    answer          TEXT,
    analysis        TEXT,
    score           NUMERIC(6,2),
    knowledge_point_id VARCHAR(64)
                    REFERENCES public.knowledge_points(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_question_id, sub_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_sub_q_parent ON public.exam_sub_questions(parent_question_id);
CREATE INDEX IF NOT EXISTS idx_exam_sub_q_kp ON public.exam_sub_questions(knowledge_point_id);

-- ───────────────────────────────────────────────────────────────
-- 4. exam_question_history (SCD Type 2 历史快照)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_question_history (
    id              BIGSERIAL PRIMARY KEY,
    question_id     INTEGER NOT NULL
                    REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    snapshot        JSONB NOT NULL,                       -- 整行 JSON 快照
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to        TIMESTAMPTZ,                          -- NULL = 当前生效
    change_type     VARCHAR(32) NOT NULL DEFAULT 'update', -- insert/update/archive
    changed_by      VARCHAR(64),
    change_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eqh_qid_valid ON public.exam_question_history(question_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_eqh_valid_to ON public.exam_question_history(valid_to) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_eqh_change_type ON public.exam_question_history(change_type);

-- ───────────────────────────────────────────────────────────────
-- 5. issue_tickets (UGC 纠错工单)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.issue_tickets (
    id              BIGSERIAL PRIMARY KEY,
    question_id     INTEGER REFERENCES public.exam_questions(id) ON DELETE SET NULL,
    question_uid    VARCHAR(64),
    reported_by     VARCHAR(128) NOT NULL,
    issue_type      VARCHAR(32) NOT NULL,                 -- typo/wrong_answer/missing_image/duplicate/other
    description     TEXT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'open',  -- open/triaged/fixing/closed/rejected
    priority        VARCHAR(16) NOT NULL DEFAULT 'normal',-- low/normal/high/urgent
    assignee        VARCHAR(128),
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_tickets_q ON public.issue_tickets(question_id);
CREATE INDEX IF NOT EXISTS idx_issue_tickets_status ON public.issue_tickets(status);
CREATE INDEX IF NOT EXISTS idx_issue_tickets_type ON public.issue_tickets(issue_type);

-- ───────────────────────────────────────────────────────────────
-- 6. exam_questions 添加 archive_state 列 (状态机支持)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.exam_questions
    ADD COLUMN IF NOT EXISTS archive_state VARCHAR(16) NOT NULL DEFAULT 'active';
-- 'active' / 'archived' / 'replaced' / 'pending_review'

CREATE INDEX IF NOT EXISTS idx_exam_questions_archive ON public.exam_questions(archive_state);

-- ───────────────────────────────────────────────────────────────
-- Ledger: 把此次 migration 的执行本身记录到 qb_recovery
-- ───────────────────────────────────────────────────────────────
INSERT INTO qb_recovery.canonical_migration_ledger
    (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
VALUES
    ('dispatch-010-020-migration', 'schema', 'exam_regions', NULL, 'SCHEMA_CREATED', NULL, NULL,
     '{"tables_created":["exam_regions","exam_materials","exam_sub_questions","exam_question_history","issue_tickets"],"columns_added":["exam_questions.archive_state"],"seed_source":"public.provinces"}'::jsonb,
     now()),
    ('dispatch-010-020-migration', 'seed', 'exam_regions:macro', NULL, 'SEED_INSERTED', NULL, NULL,
     '{"seeded_rows":7,"note":"7 macro regions of China"}'::jsonb,
     now()),
    ('dispatch-010-020-migration', 'seed', 'exam_regions:provinces', NULL, 'SEED_INSERTED', NULL, NULL,
     '{"seeded_rows_from":"public.provinces"}'::jsonb,
     now());

COMMIT;
