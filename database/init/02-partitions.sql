CREATE TABLE IF NOT EXISTS exam_questions_partitioned (
  id SERIAL,
  question_uid VARCHAR(64) UNIQUE,
  paper_id INTEGER,
  question_number INTEGER NOT NULL,
  question_type VARCHAR(20) NOT NULL,
  stem TEXT NOT NULL,
  options TEXT,
  answer TEXT,
  analysis TEXT,
  knowledge_points TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  ability_tags TEXT,
  score NUMERIC(5,2),
  subject_code VARCHAR(20),
  province_code VARCHAR(20),
  year INTEGER NOT NULL,
  has_image BOOLEAN DEFAULT FALSE,
  has_formula BOOLEAN DEFAULT FALSE,
  raw_image_path VARCHAR(500),
  image_descriptions TEXT,
  latex_formulas TEXT,
  formula_semantics TEXT,
  semantic_description TEXT,
  solution_description TEXT,
  physics_structure JSONB DEFAULT '{}',
  chemistry_structure JSONB DEFAULT '{}',
  math_structure JSONB DEFAULT '{}',
  file_path VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, year)
) PARTITION BY RANGE (year);

CREATE TABLE IF NOT EXISTS exam_questions_y2019 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2019) TO (2020);

CREATE TABLE IF NOT EXISTS exam_questions_y2020 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2020) TO (2021);

CREATE TABLE IF NOT EXISTS exam_questions_y2021 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2021) TO (2022);

CREATE TABLE IF NOT EXISTS exam_questions_y2022 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2022) TO (2023);

CREATE TABLE IF NOT EXISTS exam_questions_y2023 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2023) TO (2024);

CREATE TABLE IF NOT EXISTS exam_questions_y2024 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2024) TO (2025);

CREATE TABLE IF NOT EXISTS exam_questions_y2025 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2025) TO (2026);

CREATE TABLE IF NOT EXISTS exam_questions_y2026 PARTITION OF exam_questions_partitioned
  FOR VALUES FROM (2026) TO (2027);

CREATE TABLE IF NOT EXISTS exam_questions_ydefault PARTITION OF exam_questions_partitioned
  DEFAULT;

CREATE INDEX IF NOT EXISTS idx_eq_part_paper ON exam_questions_partitioned(paper_id);
CREATE INDEX IF NOT EXISTS idx_eq_part_subject ON exam_questions_partitioned(subject_code);
CREATE INDEX IF NOT EXISTS idx_eq_part_province ON exam_questions_partitioned(province_code);
CREATE INDEX IF NOT EXISTS idx_eq_part_type ON exam_questions_partitioned(question_type);
CREATE INDEX IF NOT EXISTS idx_eq_part_difficulty ON exam_questions_partitioned(difficulty);