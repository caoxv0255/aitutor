-- database/migrations/006_bge_m3_1024.sql
-- 切换 embedding model: nomic-embed-text (768) -> bge-m3 (1024)
-- 中文 + LaTeX 精度提升, 50k+ 数据更准
-- ⚠️ DESTRUCTIVE: 改 column dim 需 truncate (旧 768 跟新 1024 不兼容)

-- 1. Drop 旧 ivfflat index (vector(768) 索引)
DROP INDEX IF EXISTS idx_rag_questions_embedding;

-- 2. Truncate 旧表 (47,538 题, 768 dim) — 跟新 1024 dim 不兼容, 必须清
TRUNCATE rag_questions RESTART IDENTITY CASCADE;
TRUNCATE rag_ingest_progress;

-- 3. 改 column dim: vector(768) -> vector(1024)
ALTER TABLE rag_questions ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);

-- 4. 重建 HNSW 索引 (W4 一起做, m=16 ef_construction=64, recall ~98%)
CREATE INDEX IF NOT EXISTS idx_rag_questions_embedding ON rag_questions
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 5. 其它索引保持
CREATE INDEX IF NOT EXISTS idx_rag_questions_content_hash ON rag_questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_questions_subject ON rag_questions(subject_code);
CREATE INDEX IF NOT EXISTS idx_rag_questions_year ON rag_questions(source_year);
CREATE INDEX IF NOT EXISTS idx_rag_questions_kp ON rag_questions(knowledge_point_id);

-- [W7] 改 difficulty 公式: int(quality.confidence * 5) if quality else NULL
-- (不需 migration, ingest script 改公式即可)