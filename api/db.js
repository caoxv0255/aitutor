import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../database/example_db.sqlite');

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db = null;

export async function getDb() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA journal_mode=WAL');
  await db.exec('PRAGMA busy_timeout=5000');
  await db.exec('PRAGMA foreign_keys=ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      province VARCHAR(20),
      exam_level VARCHAR(10),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'general',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exam_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'general',
      has_options INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      level VARCHAR(20) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wrong_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      subject_code VARCHAR(20),
      knowledge_point_id VARCHAR(20),
      difficulty INTEGER,
      question_id INTEGER,
      is_correct INTEGER DEFAULT 0,
      exam_level VARCHAR(10),
      user_answer TEXT,
      correct_answer TEXT,
      session_id VARCHAR(50),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      subject_code VARCHAR(20),
      score DECIMAL(5,2),
      difficulty INTEGER,
      knowledge_point_id VARCHAR(20),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(50) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      image_data TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      result TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS similar_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id VARCHAR(20) PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      subtopics TEXT DEFAULT '[]',
      difficulty INTEGER DEFAULT 3,
      frequency VARCHAR(20) DEFAULT 'medium',
      description TEXT,
      level VARCHAR(20) DEFAULT 'gaokao',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS personalized_papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(50) NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS provinces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      exam_type VARCHAR(20) NOT NULL,
      paper_type VARCHAR(50),
      region VARCHAR(20),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exam_papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      province_code VARCHAR(20),
      year INTEGER NOT NULL,
      subject VARCHAR(20) NOT NULL,
      exam_level VARCHAR(10) NOT NULL,
      paper_file_path VARCHAR(500),
      question_count INTEGER,
      total_score INTEGER,
      difficulty_avg DECIMAL(3,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (province_code) REFERENCES provinces(code)
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      score INTEGER,
      subject_code VARCHAR(20),
      province_code VARCHAR(20),
      year INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_knowledge_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      knowledge_point_id VARCHAR(20) NOT NULL,
      relevance_score DECIMAL(3,2) DEFAULT 1.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id),
      UNIQUE(question_id, knowledge_point_id)
    );

    CREATE TABLE IF NOT EXISTS practice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      question_id INTEGER,
      subject_code VARCHAR(20),
      knowledge_point_id VARCHAR(20),
      difficulty INTEGER,
      is_correct INTEGER DEFAULT 0,
      user_answer TEXT,
      correct_answer TEXT,
      time_spent_ms INTEGER,
      session_id VARCHAR(50),
      exam_level VARCHAR(10),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE SET NULL,
      FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS province_knowledge_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      province_code VARCHAR(20),
      year INTEGER NOT NULL,
      subject VARCHAR(20) NOT NULL,
      knowledge_point_id VARCHAR(20),
      frequency INTEGER DEFAULT 0,
      avg_difficulty DECIMAL(3,2),
      total_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (province_code) REFERENCES provinces(code)
    );

    CREATE TABLE IF NOT EXISTS user_province_prefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      exam_level VARCHAR(10) NOT NULL,
      province_code VARCHAR(20),
      target_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (province_code) REFERENCES provinces(code)
    );

    CREATE TABLE IF NOT EXISTS exam_sessions (
      id VARCHAR(50) PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(20) NOT NULL,
      province_code VARCHAR(20),
      time_limit INTEGER DEFAULT 120,
      question_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      accuracy DECIMAL(5,2),
      score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS user_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      checkin_date DATE NOT NULL,
      streak_days INTEGER DEFAULT 1,
      UNIQUE(user_email, checkin_date)
    );

    CREATE TABLE IF NOT EXISTS user_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      points INTEGER NOT NULL,
      reason VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      badge_id VARCHAR(50) NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_email, badge_id)
    );

    CREATE TABLE IF NOT EXISTS task_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      processing_time_ms INTEGER,
      model VARCHAR(50),
      prompt_version VARCHAR(20),
      quality_score INTEGER DEFAULT 0,
      is_fallback INTEGER DEFAULT 0,
      token_prompt INTEGER DEFAULT 0,
      token_completion INTEGER DEFAULT 0,
      token_total INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES task_queue(id)
    );
  `);

  await seedReferenceData(db);

  await ensureStructuredColumns(db);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exam_papers_province ON exam_papers(province_code);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON exam_papers(subject);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_exam_level ON exam_papers(exam_level);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_composite ON exam_papers(province_code, year, subject);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_composite2 ON exam_papers(province_code, subject, year);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_paper ON exam_questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_paper_number ON exam_questions(paper_id, question_number);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_difficulty ON exam_questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_type ON exam_questions(question_type);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_subject ON exam_questions(subject_code);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_province ON exam_questions(province_code);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_year ON exam_questions(year);
    CREATE INDEX IF NOT EXISTS idx_provinces_code ON provinces(code);
    CREATE INDEX IF NOT EXISTS idx_provinces_exam_type ON provinces(exam_type);
    CREATE INDEX IF NOT EXISTS idx_provinces_region ON provinces(region);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_email);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_subject ON wrong_questions(subject_code);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_difficulty ON wrong_questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_kp ON wrong_questions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_timestamp ON wrong_questions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_session ON wrong_questions(session_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_subject ON wrong_questions(user_email, subject_code);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_email);
    CREATE INDEX IF NOT EXISTS idx_reports_subject ON reports(subject_code);
    CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp);
    CREATE INDEX IF NOT EXISTS idx_knowledge_points_subject ON knowledge_points(subject);
    CREATE INDEX IF NOT EXISTS idx_knowledge_points_level ON knowledge_points(level);
    CREATE INDEX IF NOT EXISTS idx_knowledge_points_subject_level ON knowledge_points(subject, level);
    CREATE INDEX IF NOT EXISTS idx_province_knowledge_stats_composite ON province_knowledge_stats(province_code, year, subject);
    CREATE INDEX IF NOT EXISTS idx_province_knowledge_stats_kp ON province_knowledge_stats(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_question_kp_question ON question_knowledge_points(question_id);
    CREATE INDEX IF NOT EXISTS idx_question_kp_kp ON question_knowledge_points(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_practice_records_user ON practice_records(user_email);
    CREATE INDEX IF NOT EXISTS idx_practice_records_subject ON practice_records(subject_code);
    CREATE INDEX IF NOT EXISTS idx_practice_records_kp ON practice_records(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_practice_records_user_subject ON practice_records(user_email, subject_code);
    CREATE INDEX IF NOT EXISTS idx_practice_records_timestamp ON practice_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_practice_records_is_correct ON practice_records(is_correct);
    CREATE INDEX IF NOT EXISTS idx_user_province_prefs_user ON user_province_prefs(user_email);
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_email);
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_subject ON exam_sessions(subject);
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_status ON exam_sessions(user_email, status);
    CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
    CREATE INDEX IF NOT EXISTS idx_task_queue_user ON task_queue(user_email);
    CREATE INDEX IF NOT EXISTS idx_user_checkins_user ON user_checkins(user_email);
    CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_email);
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_email);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_task ON task_metrics(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_model ON task_metrics(model);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_quality ON task_metrics(quality_score);
  `);

  console.log('✅ SQLite 数据库连接成功');
  return db;
}

async function seedReferenceData(db) {
  const subjectCount = await db.get('SELECT COUNT(*) as count FROM subjects');
  if (subjectCount.count > 0) return;

  await db.exec(`
    INSERT OR IGNORE INTO subjects (code, name, category, sort_order) VALUES
      ('chinese', '语文', 'liberal', 1),
      ('math', '数学', 'science', 2),
      ('english', '英语', 'liberal', 3),
      ('physics', '物理', 'science', 4),
      ('chemistry', '化学', 'science', 5),
      ('biology', '生物', 'science', 6),
      ('politics', '政治', 'liberal', 7),
      ('history', '历史', 'liberal', 8),
      ('geography', '地理', 'liberal', 9);

    INSERT OR IGNORE INTO exam_levels (code, name, sort_order) VALUES
      ('zhongkao', '中考', 1),
      ('gaokao', '高考', 2);

    INSERT OR IGNORE INTO question_types (code, name, category, has_options, sort_order) VALUES
      ('choice', '选择题', 'objective', 1, 1),
      ('fill', '填空题', 'objective', 0, 2),
      ('true_false', '判断题', 'objective', 1, 3),
      ('short_answer', '简答题', 'subjective', 0, 4),
      ('calculation', '计算题', 'subjective', 0, 5),
      ('proof', '证明题', 'subjective', 0, 6),
      ('essay', '作文题', 'subjective', 0, 7),
      ('reading', '阅读理解', 'subjective', 1, 8),
      ('cloze', '完形填空', 'objective', 1, 9),
      ('grammar_fill', '语法填空', 'objective', 0, 10),
      ('correction', '短文改错', 'objective', 0, 11),
      ('translation', '翻译题', 'subjective', 0, 12),
      ('listening', '听力题', 'objective', 1, 13),
      ('seven_choose_five', '七选五', 'objective', 1, 14),
      ('continuation', '读后续写', 'subjective', 0, 15),
      ('experiment', '实验题', 'subjective', 0, 16),
      ('comprehensive', '综合题', 'subjective', 0, 17),
      ('other', '其他', 'general', 0, 99);

    INSERT OR IGNORE INTO grades (code, name, level, sort_order) VALUES
      ('grade_7', '七年级', 'zhongkao', 1),
      ('grade_8', '八年级', 'zhongkao', 2),
      ('grade_9', '九年级', 'zhongkao', 3),
      ('grade_10', '高一', 'gaokao', 4),
      ('grade_11', '高二', 'gaokao', 5),
      ('grade_12', '高三', 'gaokao', 6);
  `);
}

async function ensureStructuredColumns(db) {
  const columnChecks = [
    { table: 'wrong_questions', columns: [
      ['subject_code', "VARCHAR(20)"],
      ['knowledge_point_id', "VARCHAR(20)"],
      ['difficulty', "INTEGER"],
      ['question_id', "INTEGER"],
      ['is_correct', "INTEGER DEFAULT 0"],
      ['exam_level', "VARCHAR(10)"],
      ['user_answer', "TEXT"],
      ['correct_answer', "TEXT"],
      ['session_id', "VARCHAR(50)"]
    ]},
    { table: 'reports', columns: [
      ['subject_code', "VARCHAR(20)"],
      ['score', "DECIMAL(5,2)"],
      ['difficulty', "INTEGER"],
      ['knowledge_point_id', "VARCHAR(20)"]
    ]},
    { table: 'users', columns: [['updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"]] },
    { table: 'exam_papers', columns: [['updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"]] },
    { table: 'exam_questions', columns: [
      ['updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"],
      ['subject_code', "VARCHAR(20)"],
      ['province_code', "VARCHAR(20)"],
      ['year', "INTEGER"]
    ]},
    { table: 'knowledge_points', columns: [['updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"]] },
    { table: 'provinces', columns: [['updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"]] }
  ];

  for (const check of columnChecks) {
    for (const [colName, colType] of check.columns) {
      try {
        await db.run(`ALTER TABLE ${check.table} ADD COLUMN ${colName} ${colType}`);
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.warn(`Column add warning (${check.table}.${colName}): ${e.message}`);
        }
      }
    }
  }

  const denormalizeResult = await db.get(
    `SELECT COUNT(*) as count FROM exam_questions WHERE subject_code IS NULL LIMIT 1`
  );
  if (denormalizeResult && denormalizeResult.count > 0) {
    await db.run(`
      UPDATE exam_questions
      SET subject_code = (SELECT ep.subject FROM exam_papers ep WHERE ep.id = exam_questions.paper_id),
          province_code = (SELECT ep.province_code FROM exam_papers ep WHERE ep.id = exam_questions.paper_id),
          year = (SELECT ep.year FROM exam_papers ep WHERE ep.id = exam_questions.paper_id)
      WHERE subject_code IS NULL AND paper_id IS NOT NULL
    `);
  }
}

export async function query(sql, params = []) {
  const database = await getDb();
  return database.all(sql, params);
}
