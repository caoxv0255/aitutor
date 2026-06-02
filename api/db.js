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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wrong_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
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
      level VARCHAR(20) DEFAULT 'gaokao'
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
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

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exam_papers_province ON exam_papers(province_code);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON exam_papers(subject);
    CREATE INDEX IF NOT EXISTS idx_exam_papers_province_year ON exam_papers(province_code, year);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_paper ON exam_questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_provinces_code ON provinces(code);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_email);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_email);
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_email);
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

export async function query(sql, params = []) {
  const database = await getDb();
  return database.all(sql, params);
}
