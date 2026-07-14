#!/usr/bin/env node
/**
 * 修复数据库结构，添加多模态字段
 *
 * 与 db.js 中的定义保持一致：
 * 1. exam_questions 表扩展多模态字段
 * 2. 创建 question_vectors 四向量表（如不存在）
 * 3. 创建 question_images、question_formulas 表
 * 4. 创建必要的索引
 */

import { getDb } from '../api/core/db.js';

const pool = await getDb();
console.log('🔧 数据库结构修复 — 添加多模态字段');
console.log('='.repeat(60));

// 1. 扩展 exam_questions 表
console.log('\n📋 1. 扩展 exam_questions 表...');
const examAlterStatements = [
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS question_uid VARCHAR(64)`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS has_formula BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS raw_image_path VARCHAR(500)`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS image_descriptions TEXT`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS latex_formulas TEXT`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS formula_semantics TEXT`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS semantic_description TEXT`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS solution_description TEXT`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS physics_structure JSONB DEFAULT '{}'`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS chemistry_structure JSONB DEFAULT '{}'`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS math_structure JSONB DEFAULT '{}'`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)`,
];
for (const sql of examAlterStatements) {
  try {
    await pool.query(sql);
    console.log(`   ✅ ${sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1]}`);
  } catch (err) {
    console.log(`   ❌ ${sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1]}: ${err.message}`);
  }
}

// 添加 UNIQUE 约束（如果不存在）
try {
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_questions_uid_unique ON exam_questions(question_uid) WHERE question_uid IS NOT NULL`);
  console.log(`   ✅ question_uid UNIQUE INDEX`);
} catch (err) {
  console.log(`   ⚠️ question_uid UNIQUE INDEX: ${err.message}`);
}

// 2. 创建 question_vectors 表
console.log('\n📋 2. 创建 question_vectors 表...');
try {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_vectors (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      question_uid VARCHAR(64),
      subject_code VARCHAR(20),
      question_type VARCHAR(30),
      difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
      q_embedding vector(1536),
      s_embedding vector(1536),
      k_embedding vector(1536),
      a_embedding vector(1536),
      q_text TEXT,
      s_text TEXT,
      k_text TEXT,
      a_text TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log(`   ✅ question_vectors 表已创建`);
} catch (err) {
  console.log(`   ❌ question_vectors: ${err.message}`);
}

// 3. 创建 question_images 表
console.log('\n📋 3. 创建 question_images 表...');
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_images (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES exam_questions(id) ON DELETE CASCADE,
      image_type VARCHAR(20) DEFAULT 'figure',
      file_path VARCHAR(500) NOT NULL,
      semantic_description TEXT,
      caption TEXT,
      width INTEGER,
      height INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log(`   ✅ question_images 表已创建`);
} catch (err) {
  console.log(`   ❌ question_images: ${err.message}`);
}

// 4. 创建 question_formulas 表
console.log('\n📋 4. 创建 question_formulas 表...');
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_formulas (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES exam_questions(id) ON DELETE CASCADE,
      latex TEXT NOT NULL,
      semantic_description TEXT,
      formula_type VARCHAR(30),
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log(`   ✅ question_formulas 表已创建`);
} catch (err) {
  console.log(`   ❌ question_formulas: ${err.message}`);
}

// 5. 创建索引
console.log('\n📋 5. 创建索引...');
const indexStatements = [
  `CREATE INDEX IF NOT EXISTS idx_exam_questions_uid ON exam_questions(question_uid)`,
  `CREATE INDEX IF NOT EXISTS idx_exam_questions_has_image ON exam_questions(has_image)`,
  `CREATE INDEX IF NOT EXISTS idx_exam_questions_has_formula ON exam_questions(has_formula)`,
  `CREATE INDEX IF NOT EXISTS idx_question_vectors_subject ON question_vectors(subject_code)`,
  `CREATE INDEX IF NOT EXISTS idx_question_vectors_type ON question_vectors(question_type)`,
  `CREATE INDEX IF NOT EXISTS idx_question_vectors_difficulty ON question_vectors(difficulty)`,
  `CREATE INDEX IF NOT EXISTS idx_question_images_question ON question_images(question_id)`,
  `CREATE INDEX IF NOT EXISTS idx_question_formulas_question ON question_formulas(question_id)`,
];
for (const sql of indexStatements) {
  try {
    await pool.query(sql);
    const name = sql.match(/idx_(\w+)/)?.[1] || 'unknown';
    console.log(`   ✅ ${name}`);
  } catch (err) {
    console.log(`   ❌ 索引创建失败: ${err.message}`);
  }
}

// 6. 创建 HNSW 向量索引
console.log('\n📋 6. 创建四向量 HNSW 索引...');
const hnswStatements = [
  `CREATE INDEX IF NOT EXISTS idx_qv_q_embedding_hnsw ON question_vectors USING hnsw (q_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
  `CREATE INDEX IF NOT EXISTS idx_qv_s_embedding_hnsw ON question_vectors USING hnsw (s_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
  `CREATE INDEX IF NOT EXISTS idx_qv_k_embedding_hnsw ON question_vectors USING hnsw (k_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
  `CREATE INDEX IF NOT EXISTS idx_qv_a_embedding_hnsw ON question_vectors USING hnsw (a_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
];
for (const sql of hnswStatements) {
  try {
    await pool.query(sql);
    const name = sql.match(/idx_(\w+)/)?.[1] || 'unknown';
    console.log(`   ✅ ${name}`);
  } catch (err) {
    console.log(`   ❌ HNSW索引失败: ${err.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('✅ 数据库结构修复完成！');

await pool.end();
process.exit(0);