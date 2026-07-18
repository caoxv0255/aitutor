#!/usr/bin/env node
/**
 * 多模态题库数据库迁移脚本
 * 
 * 设计理念：一道题 = 一个多模态知识对象
 * 
 * 文件存储结构：
 * questions/
 *   └── [学科]_[年份]_[地区]_[题号]/
 *       ├── question.md（完整题目信息和结构化内容）
 *       ├── original.png（原始题目截图）
 *       ├── [图片资源文件，如figure_01.png]
 *       ├── metadata.json（题目元数据）
 *       └── embedding.txt（专门用于向量检索的优化文本）
 */
import { getDb } from '../api/core/db.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const QUESTIONS_DIR = join(ROOT, 'database', 'questions');

async function run() {
  const db = await getDb();

  console.log('🚀 多模态题库数据库迁移');
  console.log('='.repeat(80));

  await createTables(db);
  await createIndexes(db);
  await createDirectoryStructure();

  console.log('\n✅ 迁移完成！');
}

async function createTables(db) {
  console.log('\n📦 创建表结构...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS multimodal_questions (
      id SERIAL PRIMARY KEY,
      question_uid VARCHAR(64) UNIQUE NOT NULL,
      
      paper_id INTEGER REFERENCES exam_papers(id) ON DELETE CASCADE,
      question_number INTEGER NOT NULL,
      
      subject_code VARCHAR(20) NOT NULL,
      province_code VARCHAR(20),
      year INTEGER,
      exam_level VARCHAR(10) DEFAULT 'gaokao',
      
      question_type VARCHAR(30) NOT NULL,
      difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
      score NUMERIC(5,2),
      
      original_image_path VARCHAR(500),
      source_info JSONB DEFAULT '{}',
      
      structured_text TEXT,
      latex_formulas TEXT,
      
      answer TEXT,
      analysis TEXT,
      common_mistakes TEXT,
      related_knowledge TEXT,
      
      semantic_description TEXT,
      
      embedding_text TEXT,
      embedding_vector vector(1024),
      
      physics_structure JSONB DEFAULT '{}',
      chemistry_structure JSONB DEFAULT '{}',
      math_structure JSONB DEFAULT '{}',
      
      file_path VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active',
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(question_uid)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS question_images (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES multimodal_questions(id) ON DELETE CASCADE,
      image_path VARCHAR(500) NOT NULL,
      image_type VARCHAR(20) DEFAULT 'figure',
      semantic_description TEXT,
      width INTEGER,
      height INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(question_id, image_path)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS question_tags (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES multimodal_questions(id) ON DELETE CASCADE,
      tag_type VARCHAR(20) NOT NULL,
      tag_value VARCHAR(100) NOT NULL,
      relevance_score NUMERIC(3,2) DEFAULT 1.00,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(question_id, tag_type, tag_value)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS question_knowledge (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES multimodal_questions(id) ON DELETE CASCADE,
      knowledge_point_id VARCHAR(20) NOT NULL REFERENCES knowledge_points(id),
      relevance_score NUMERIC(3,2) DEFAULT 1.00,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(question_id, knowledge_point_id)
    );
  `);

  console.log('  ✅ multimodal_questions 表创建完成');
  console.log('  ✅ question_images 表创建完成');
  console.log('  ✅ question_tags 表创建完成');
  console.log('  ✅ question_knowledge 表创建完成');
}

async function createIndexes(db) {
  console.log('\n📊 创建索引...');

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_mq_subject_year ON multimodal_questions(subject_code, year);
    CREATE INDEX IF NOT EXISTS idx_mq_province ON multimodal_questions(province_code);
    CREATE INDEX IF NOT EXISTS idx_mq_difficulty ON multimodal_questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_mq_type ON multimodal_questions(question_type);
    CREATE INDEX IF NOT EXISTS idx_mq_paper ON multimodal_questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_mq_status ON multimodal_questions(status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_qi_question ON question_images(question_id);
    CREATE INDEX IF NOT EXISTS idx_qt_question ON question_tags(question_id);
    CREATE INDEX IF NOT EXISTS idx_qt_tag ON question_tags(tag_type, tag_value);
    CREATE INDEX IF NOT EXISTS idx_qk_question ON question_knowledge(question_id);
    CREATE INDEX IF NOT EXISTS idx_qk_knowledge ON question_knowledge(knowledge_point_id);
  `);

  console.log('  ✅ 索引创建完成');
}

async function createDirectoryStructure() {
  console.log('\n📁 创建文件目录结构...');

  if (!existsSync(QUESTIONS_DIR)) {
    mkdirSync(QUESTIONS_DIR, { recursive: true });
    console.log(`  ✅ 创建目录: ${QUESTIONS_DIR}`);
  }

  const subjects = ['math', 'physics', 'chemistry', 'biology', 'chinese', 'english', 'politics', 'history', 'geography'];
  
  for (const subject of subjects) {
    const subjectDir = join(QUESTIONS_DIR, subject);
    if (!existsSync(subjectDir)) {
      mkdirSync(subjectDir, { recursive: true });
    }
  }

  console.log('  ✅ 学科子目录创建完成');
}

run().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
