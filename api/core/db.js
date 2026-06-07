import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

let pool = null;

export async function getDb() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.PG_POOL_MAX) || 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 30000, // 防止慢查询拖死连接（30s 上限）
    application_name: 'aitutor-api', // pg_stat_activity 监控标识
    keepAlive: true, // TCP keepalive 防止连接被防火墙断开
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL 连接池错误:', err.message);
  });

  pool.on('acquire', () => {
    if (pool.waitingCount > 5) {
      console.warn(
        `[Pool] 连接等待队列过长: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`
      );
    }
  });

  // 验证连接
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  await initTables(pool);

  console.log('✅ PostgreSQL 数据库连接池初始化成功');
  return pool;
}

async function initTables(pool) {
  // 启用 pgvector 扩展（方案B：向量检索基座）
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      province VARCHAR(20),
      exam_level VARCHAR(10),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'general',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exam_levels (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS question_types (
      id SERIAL PRIMARY KEY,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'general',
      has_options INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      level VARCHAR(20) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wrong_questions (
      id SERIAL PRIMARY KEY,
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
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      subject_code VARCHAR(20),
      score NUMERIC(5,2),
      difficulty INTEGER,
      knowledge_point_id VARCHAR(20),
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS task_queue (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(50) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      image_data TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      result TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS similar_questions (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      user_email VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
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
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS personalized_papers (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(50) NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS provinces (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      exam_type VARCHAR(20) NOT NULL,
      paper_type VARCHAR(50),
      region VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exam_papers (
      id SERIAL PRIMARY KEY,
      province_code VARCHAR(20) REFERENCES provinces(code),
      year INTEGER NOT NULL,
      subject VARCHAR(20) NOT NULL,
      exam_level VARCHAR(10) NOT NULL,
      paper_file_path VARCHAR(500),
      question_count INTEGER,
      total_score INTEGER,
      difficulty_avg NUMERIC(3,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER REFERENCES exam_papers(id) ON DELETE CASCADE,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS question_knowledge_points (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
      knowledge_point_id VARCHAR(20) NOT NULL REFERENCES knowledge_points(id),
      relevance_score NUMERIC(3,2) DEFAULT 1.00,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(question_id, knowledge_point_id)
    );

    CREATE TABLE IF NOT EXISTS exam_sessions (
      id VARCHAR(50) PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(20) NOT NULL,
      province_code VARCHAR(20),
      time_limit INTEGER DEFAULT 120,
      question_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      accuracy NUMERIC(5,2),
      score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS practice_records (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      question_id INTEGER REFERENCES exam_questions(id) ON DELETE SET NULL,
      subject_code VARCHAR(20),
      knowledge_point_id VARCHAR(20),
      difficulty INTEGER,
      is_correct INTEGER DEFAULT 0,
      user_answer TEXT,
      correct_answer TEXT,
      time_spent_ms INTEGER,
      session_id VARCHAR(50) REFERENCES exam_sessions(id) ON DELETE SET NULL,
      exam_level VARCHAR(10),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS province_knowledge_stats (
      id SERIAL PRIMARY KEY,
      province_code VARCHAR(20) REFERENCES provinces(code),
      year INTEGER NOT NULL,
      subject VARCHAR(20) NOT NULL,
      knowledge_point_id VARCHAR(20),
      frequency INTEGER DEFAULT 0,
      avg_difficulty NUMERIC(3,2),
      total_score INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_province_prefs (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      exam_level VARCHAR(10) NOT NULL,
      province_code VARCHAR(20) REFERENCES provinces(code),
      target_score INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, exam_level)
    );

    CREATE TABLE IF NOT EXISTS user_checkins (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      checkin_date DATE NOT NULL,
      streak_days INTEGER DEFAULT 1,
      UNIQUE(user_email, checkin_date)
    );

    CREATE TABLE IF NOT EXISTS user_points (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      points INTEGER NOT NULL,
      reason VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      badge_id VARCHAR(50) NOT NULL,
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, badge_id)
    );

    CREATE TABLE IF NOT EXISTS task_metrics (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES task_queue(id),
      processing_time_ms INTEGER,
      model VARCHAR(50),
      prompt_version VARCHAR(20),
      quality_score INTEGER DEFAULT 0,
      is_fallback INTEGER DEFAULT 0,
      token_prompt INTEGER DEFAULT 0,
      token_completion INTEGER DEFAULT 0,
      token_total INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 方案B：微观向量检索表（题库语义索引）
    -- knowledge_point_id 为逻辑外键，关联方案A Apache AGE 中的 KnowledgePoint.id
    CREATE TABLE IF NOT EXISTS rag_questions (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(1536),
      knowledge_point_id VARCHAR(20),
      subject_code VARCHAR(20),
      difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
      question_type VARCHAR(30),
      source_paper_id INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 方案C：学生知识点掌握度表（学情诊断核心）
    -- knowledge_point_id 逻辑关联方案A Apache AGE KnowledgePoint.id
    CREATE TABLE IF NOT EXISTS student_knowledge_mastery (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) NOT NULL,
      mastery_score NUMERIC(4,2) DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 1),
      attempt_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      -- SRS 间隔重复字段
      next_review_at TIMESTAMPTZ,
      ease_factor NUMERIC(4,2) DEFAULT 2.5,
      interval_days INTEGER DEFAULT 0,
      last_reviewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );

    -- SRS 复习日志表（记录每次复习的详情，用于分析复习效果）
    CREATE TABLE IF NOT EXISTS srs_review_log (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) NOT NULL,
      is_correct BOOLEAN NOT NULL,
      time_spent_ms INTEGER DEFAULT 0,
      review_quality INTEGER CHECK (review_quality BETWEEN 0 AND 5),
      old_mastery NUMERIC(4,2),
      new_mastery NUMERIC(4,2),
      old_interval INTEGER,
      new_interval INTEGER,
      old_ease NUMERIC(4,2),
      new_ease NUMERIC(4,2),
      next_review_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await seedReferenceData(pool);

  await pool.query(`
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

    -- 方案B：rag_questions 索引
    CREATE INDEX IF NOT EXISTS idx_rag_questions_subject ON rag_questions(subject_code);
    CREATE INDEX IF NOT EXISTS idx_rag_questions_kp ON rag_questions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_rag_questions_difficulty ON rag_questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_rag_questions_type ON rag_questions(question_type);
    CREATE INDEX IF NOT EXISTS idx_rag_questions_kp_subject ON rag_questions(knowledge_point_id, subject_code);

    -- 方案C：student_knowledge_mastery 索引
    CREATE INDEX IF NOT EXISTS idx_skm_user ON student_knowledge_mastery(user_email);
    CREATE INDEX IF NOT EXISTS idx_skm_kp ON student_knowledge_mastery(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_skm_score ON student_knowledge_mastery(mastery_score);
    CREATE INDEX IF NOT EXISTS idx_skm_user_kp ON student_knowledge_mastery(user_email, knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_skm_user_score ON student_knowledge_mastery(user_email, mastery_score);
    CREATE INDEX IF NOT EXISTS idx_skm_next_review ON student_knowledge_mastery(user_email, next_review_at);

    -- SRS 复习日志索引
    CREATE INDEX IF NOT EXISTS idx_srs_log_user ON srs_review_log(user_email);
    CREATE INDEX IF NOT EXISTS idx_srs_log_kp ON srs_review_log(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_srs_log_created ON srs_review_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_srs_log_user_kp ON srs_review_log(user_email, knowledge_point_id);
  `);

  // 方案B：HNSW 向量索引（独立执行，避免与常规索引混在同一事务）
  // m=16: 中等图连接度，平衡内存与召回率
  // ef_construction=64: 构建质量与速度的折中
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_questions_embedding_hnsw
      ON rag_questions
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  `);
}

async function seedReferenceData(pool) {
  const result = await pool.query('SELECT COUNT(*) as count FROM subjects');
  if (parseInt(result.rows[0].count) > 0) return;

  await pool.query(`
    INSERT INTO subjects (code, name, category, sort_order) VALUES
      ('chinese', '语文', 'liberal', 1),
      ('math', '数学', 'science', 2),
      ('english', '英语', 'liberal', 3),
      ('physics', '物理', 'science', 4),
      ('chemistry', '化学', 'science', 5),
      ('biology', '生物', 'science', 6),
      ('politics', '政治', 'liberal', 7),
      ('history', '历史', 'liberal', 8),
      ('geography', '地理', 'liberal', 9)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO exam_levels (code, name, sort_order) VALUES
      ('zhongkao', '中考', 1),
      ('gaokao', '高考', 2)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO question_types (code, name, category, has_options, sort_order) VALUES
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
      ('other', '其他', 'general', 0, 99)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO grades (code, name, level, sort_order) VALUES
      ('grade_7', '七年级', 'zhongkao', 1),
      ('grade_8', '八年级', 'zhongkao', 2),
      ('grade_9', '九年级', 'zhongkao', 3),
      ('grade_10', '高一', 'gaokao', 4),
      ('grade_11', '高二', 'gaokao', 5),
      ('grade_12', '高三', 'gaokao', 6)
    ON CONFLICT (code) DO NOTHING;
  `);
}

export async function query(sql, params = []) {
  const database = await getDb();
  const result = await database.query(sql, params);
  return result.rows;
}

/**
 * 获取连接池运行状态（用于监控与调试）
 */
export function getPoolStats() {
  if (!pool) return null;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max,
  };
}
