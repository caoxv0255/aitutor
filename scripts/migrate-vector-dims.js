/**
 * 迁移向量维度：1536 → 768
 *
 * 由于 pgvector 不支持直接 ALTER COLUMN 修改向量维度，
 * 需要先删除列再重建，然后重新生成所有向量。
 *
 * 运行方式：
 *   node scripts/migrate-vector-dims.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const NEW_DIMS = parseInt(process.env.EMBEDDING_DIMS || '768', 10);

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(`迁移向量维度到 ${NEW_DIMS} 维...`);

    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'question_vectors'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('question_vectors 表不存在，直接创建新表');
    } else {
      console.log('删除现有向量表...');
      await client.query('DROP TABLE IF EXISTS question_vectors');
      console.log('已删除');
    }

    console.log('创建 question_vectors 表 (768 维)...');
    await client.query(`
      CREATE TABLE question_vectors (
        id SERIAL PRIMARY KEY,
        question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
        question_uid VARCHAR(64),
        subject_code VARCHAR(20),
        question_type VARCHAR(30),
        difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
        q_embedding vector(${NEW_DIMS}),
        s_embedding vector(${NEW_DIMS}),
        k_embedding vector(${NEW_DIMS}),
        a_embedding vector(${NEW_DIMS}),
        q_text TEXT,
        s_text TEXT,
        k_text TEXT,
        a_text TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('创建 HNSW 索引...');
    await client.query(`
      CREATE INDEX idx_qv_q ON question_vectors USING hnsw (q_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    `);
    await client.query(`
      CREATE INDEX idx_qv_s ON question_vectors USING hnsw (s_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    `);
    await client.query(`
      CREATE INDEX idx_qv_k ON question_vectors USING hnsw (k_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    `);
    await client.query(`
      CREATE INDEX idx_qv_a ON question_vectors USING hnsw (a_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    `);
    await client.query(`CREATE INDEX idx_qv_qid ON question_vectors(question_id)`);
    await client.query(`CREATE INDEX idx_qv_subject ON question_vectors(subject_code)`);
    await client.query(`CREATE INDEX idx_qv_type ON question_vectors(question_type)`);

    const res = await client.query('SELECT COUNT(*) as cnt FROM exam_questions');
    console.log(`\n迁移完成！总题数: ${res.rows[0].cnt}`);
    console.log(`向量维度: ${NEW_DIMS}`);
    console.log('下一步：运行 enrich-beijing.js 重新生成所有向量');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('迁移失败:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});