-- database/migrations/005_rag_questions.sql
-- RAG 方案 B: 微观向量检索表 (1,711 schema v5 → rag_questions)
-- 用 Ollama nomic-embed-text (768 dim) 替换原 DashScope text-embedding-v3 (1536 dim)
-- v0.1: 2026-08-02 — P3 路线 (本地 Ollama embedding)

CREATE EXTENSION IF NOT EXISTS vector;

-- rag_questions 主表 (题目级向量)
CREATE TABLE IF NOT EXISTS rag_questions (
  id              SERIAL PRIMARY KEY,
  content         TEXT NOT NULL,
  content_hash    VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of content (dedup)
  embedding       vector(768),                   -- nomic-embed-text 768 dim
  knowledge_point_id VARCHAR(50),
  subject_code    VARCHAR(20),
  difficulty      INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  question_type   VARCHAR(30),
  source_paper_id VARCHAR(255),                  -- schema v5 file name
  source_year     INTEGER,
  source_region   VARCHAR(50),
  source_subject  VARCHAR(50),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_questions_content_hash ON rag_questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_questions_subject ON rag_questions(subject_code);
CREATE INDEX IF NOT EXISTS idx_rag_questions_year ON rag_questions(source_year);
CREATE INDEX IF NOT EXISTS idx_rag_questions_kp ON rag_questions(knowledge_point_id);

-- ivfflat 向量索引 (10K+ 数据后用)
CREATE INDEX IF NOT EXISTS idx_rag_questions_embedding ON rag_questions
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ingest 进度表 (resume 用)
CREATE TABLE IF NOT EXISTS rag_ingest_progress (
  id              SERIAL PRIMARY KEY,
  file_name       VARCHAR(255) NOT NULL UNIQUE,
  file_hash       VARCHAR(64),
  questions_count INTEGER DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'pending',  -- pending / done / failed
  error           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);
