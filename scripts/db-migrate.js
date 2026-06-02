import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../database/example_db.sqlite');

const MIGRATIONS = [
  {
    version: 1,
    name: 'create_reference_tables',
    description: 'Create reference tables for subjects, question_types, exam_levels, grades',
    up: async (db) => {
      await db.exec(`
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
      `);

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
  },
  {
    version: 2,
    name: 'add_structured_columns_to_wrong_questions',
    description: 'Add structured columns to wrong_questions for efficient querying',
    up: async (db) => {
      const columns = [
        { name: 'subject_code', type: 'VARCHAR(20)', default: 'NULL' },
        { name: 'knowledge_point_id', type: 'VARCHAR(20)', default: 'NULL' },
        { name: 'difficulty', type: 'INTEGER', default: 'NULL' },
        { name: 'question_id', type: 'INTEGER', default: 'NULL' },
        { name: 'is_correct', type: 'INTEGER', default: '0' },
        { name: 'exam_level', type: 'VARCHAR(10)', default: 'NULL' },
        { name: 'user_answer', type: 'TEXT', default: 'NULL' },
        { name: 'correct_answer', type: 'TEXT', default: 'NULL' },
        { name: 'session_id', type: 'VARCHAR(50)', default: 'NULL' }
      ];

      for (const col of columns) {
        try {
          await db.exec(`ALTER TABLE wrong_questions ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
        } catch (e) {
          if (!e.message.includes('duplicate column name')) throw e;
        }
      }

      const rows = await db.all('SELECT id, data FROM wrong_questions WHERE data IS NOT NULL');
      const subjectMap = {
        '数学': 'math', '语文': 'chinese', '英语': 'english',
        '物理': 'physics', '化学': 'chemistry', '政治': 'politics',
        '生物': 'biology', '历史': 'history', '地理': 'geography',
        'math': 'math', 'chinese': 'chinese', 'english': 'english',
        'physics': 'physics', 'chemistry': 'chemistry', 'politics': 'politics',
        'biology': 'biology', 'history': 'history', 'geography': 'geography'
      };

      for (const row of rows) {
        try {
          let parsed;
          try { parsed = JSON.parse(row.data); } catch { continue; }
          if (typeof parsed !== 'object' || parsed === null) continue;

          const updates = [];
          const params = [];

          if (parsed.subject && subjectMap[parsed.subject]) {
            updates.push('subject_code = ?');
            params.push(subjectMap[parsed.subject]);
          }

          if (parsed.knowledge_point_id || parsed.knowledge_points) {
            const kpId = parsed.knowledge_point_id ||
              (Array.isArray(parsed.knowledge_points) && parsed.knowledge_points.length > 0
                ? parsed.knowledge_points[0] : null);
            if (kpId && typeof kpId === 'string') {
              updates.push('knowledge_point_id = ?');
              params.push(kpId);
            }
          }

          if (parsed.difficulty != null) {
            updates.push('difficulty = ?');
            params.push(Math.min(Math.max(parseInt(parsed.difficulty) || 0, 1), 5));
          }

          if (parsed.question_id) {
            updates.push('question_id = ?');
            params.push(parseInt(parsed.question_id));
          }

          if (parsed.user_answer) {
            updates.push('user_answer = ?');
            params.push(typeof parsed.user_answer === 'string' ? parsed.user_answer : JSON.stringify(parsed.user_answer));
          }

          if (parsed.correct_answer) {
            updates.push('correct_answer = ?');
            params.push(typeof parsed.correct_answer === 'string' ? parsed.correct_answer : JSON.stringify(parsed.correct_answer));
          }

          if (parsed.session_id) {
            updates.push('session_id = ?');
            params.push(parsed.session_id);
          }

          if (parsed.exam_level) {
            updates.push('exam_level = ?');
            params.push(parsed.exam_level);
          }

          if (updates.length > 0) {
            params.push(row.id);
            await db.run(`UPDATE wrong_questions SET ${updates.join(', ')} WHERE id = ?`, params);
          }
        } catch (e) {
          console.warn(`Failed to backfill wrong_questions id=${row.id}: ${e.message}`);
        }
      }
    }
  },
  {
    version: 3,
    name: 'add_structured_columns_to_reports',
    description: 'Add structured columns to reports for efficient querying',
    up: async (db) => {
      const columns = [
        { name: 'subject_code', type: 'VARCHAR(20)', default: 'NULL' },
        { name: 'score', type: 'DECIMAL(5,2)', default: 'NULL' },
        { name: 'difficulty', type: 'INTEGER', default: 'NULL' },
        { name: 'knowledge_point_id', type: 'VARCHAR(20)', default: 'NULL' }
      ];

      for (const col of columns) {
        try {
          await db.exec(`ALTER TABLE reports ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
        } catch (e) {
          if (!e.message.includes('duplicate column name')) throw e;
        }
      }

      const subjectMap = {
        '数学': 'math', '语文': 'chinese', '英语': 'english',
        '物理': 'physics', '化学': 'chemistry', '政治': 'politics',
        '生物': 'biology', '历史': 'history', '地理': 'geography'
      };

      const rows = await db.all('SELECT id, data FROM reports WHERE data IS NOT NULL');
      for (const row of rows) {
        try {
          let parsed;
          try { parsed = JSON.parse(row.data); } catch { continue; }
          if (typeof parsed !== 'object' || parsed === null) continue;

          const updates = [];
          const params = [];

          if (parsed.subject && subjectMap[parsed.subject]) {
            updates.push('subject_code = ?');
            params.push(subjectMap[parsed.subject]);
          }

          if (parsed.score != null) {
            updates.push('score = ?');
            params.push(parseFloat(parsed.score));
          }

          if (parsed.difficulty != null) {
            updates.push('difficulty = ?');
            params.push(parseInt(parsed.difficulty));
          }

          if (parsed.knowledge_point_id) {
            updates.push('knowledge_point_id = ?');
            params.push(parsed.knowledge_point_id);
          }

          if (updates.length > 0) {
            params.push(row.id);
            await db.run(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`, params);
          }
        } catch (e) {
          console.warn(`Failed to backfill reports id=${row.id}: ${e.message}`);
        }
      }
    }
  },
  {
    version: 4,
    name: 'create_question_knowledge_points_junction',
    description: 'Create many-to-many junction table for exam_questions and knowledge_points',
    up: async (db) => {
      await db.exec(`
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
      `);

      const questions = await db.all(
        'SELECT id, knowledge_points FROM exam_questions WHERE knowledge_points IS NOT NULL'
      );

      for (const q of questions) {
        try {
          let kpList;
          try { kpList = JSON.parse(q.knowledge_points); } catch { continue; }
          if (!Array.isArray(kpList)) kpList = [kpList];

          for (const kp of kpList) {
            const kpId = typeof kp === 'string' ? kp : kp?.id;
            if (!kpId) continue;
            try {
              await db.run(
                'INSERT OR IGNORE INTO question_knowledge_points (question_id, knowledge_point_id) VALUES (?, ?)',
                [q.id, kpId]
              );
            } catch (_) {}
          }
        } catch (e) {
          console.warn(`Failed to process question_knowledge_points for q=${q.id}: ${e.message}`);
        }
      }
    }
  },
  {
    version: 5,
    name: 'create_practice_records_table',
    description: 'Create practice_records table for tracking user practice history',
    up: async (db) => {
      await db.exec(`
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
      `);

      const sessions = await db.all(
        "SELECT id, user_email, subject, status FROM exam_sessions WHERE status = 'completed'"
      );

      for (const session of sessions) {
        const wrongQs = await db.all(
          'SELECT question_id, user_answer, correct_answer, difficulty, knowledge_points, session_id FROM wrong_questions WHERE user_email = ? AND session_id = ?',
          [session.user_email, session.id]
        );

        for (const wq of wrongQs) {
          try {
            let kpId = null;
            if (wq.knowledge_points) {
              try {
                const kpParsed = JSON.parse(wq.knowledge_points);
                kpId = Array.isArray(kpParsed) ? kpParsed[0] : kpParsed;
              } catch {
                kpId = wq.knowledge_points;
              }
            }

            await db.run(
              `INSERT OR IGNORE INTO practice_records (user_email, question_id, subject_code, knowledge_point_id, difficulty, is_correct, user_answer, correct_answer, session_id, exam_level, created_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [session.user_email, wq.question_id, session.subject, kpId, wq.difficulty, wq.user_answer, wq.correct_answer, session.id, null]
            );
          } catch (e) {
            console.warn(`Failed to migrate practice record: ${e.message}`);
          }
        }
      }
    }
  },
  {
    version: 6,
    name: 'add_updated_at_columns',
    description: 'Add updated_at columns to tables that lack them',
    up: async (db) => {
      const tables = ['exam_papers', 'exam_questions', 'knowledge_points', 'provinces', 'users'];
      for (const table of tables) {
        try {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
        } catch (e) {
          if (!e.message.includes('duplicate column name')) throw e;
        }
      }
    }
  },
  {
    version: 7,
    name: 'add_exam_questions_structured_columns',
    description: 'Add subject_code and exam_level columns to exam_questions for denormalized queries',
    up: async (db) => {
      const columns = [
        { name: 'subject_code', type: 'VARCHAR(20)', default: 'NULL' },
        { name: 'province_code', type: 'VARCHAR(20)', default: 'NULL' },
        { name: 'year', type: 'INTEGER', default: 'NULL' }
      ];

      for (const col of columns) {
        try {
          await db.exec(`ALTER TABLE exam_questions ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
        } catch (e) {
          if (!e.message.includes('duplicate column name')) throw e;
        }
      }

      await db.run(`
        UPDATE exam_questions
        SET subject_code = (SELECT ep.subject FROM exam_papers ep WHERE ep.id = exam_questions.paper_id),
            province_code = (SELECT ep.province_code FROM exam_papers ep WHERE ep.id = exam_questions.paper_id),
            year = (SELECT ep.year FROM exam_papers ep WHERE ep.id = exam_questions.paper_id)
        WHERE subject_code IS NULL
      `);
    }
  },
  {
    version: 8,
    name: 'add_comprehensive_indexes',
    description: 'Add comprehensive indexes for query performance optimization',
    up: async (db) => {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_subject ON wrong_questions(subject_code)',
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_difficulty ON wrong_questions(difficulty)',
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_kp ON wrong_questions(knowledge_point_id)',
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_timestamp ON wrong_questions(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_session ON wrong_questions(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_subject ON wrong_questions(user_email, subject_code)',

        'CREATE INDEX IF NOT EXISTS idx_reports_subject ON reports(subject_code)',
        'CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp)',

        'CREATE INDEX IF NOT EXISTS idx_exam_questions_difficulty ON exam_questions(difficulty)',
        'CREATE INDEX IF NOT EXISTS idx_exam_questions_type ON exam_questions(question_type)',
        'CREATE INDEX IF NOT EXISTS idx_exam_questions_subject ON exam_questions(subject_code)',
        'CREATE INDEX IF NOT EXISTS idx_exam_questions_province ON exam_questions(province_code)',
        'CREATE INDEX IF NOT EXISTS idx_exam_questions_year ON exam_questions(year)',
        'CREATE INDEX IF NOT EXISTS idx_exam_questions_paper_number ON exam_questions(paper_id, question_number)',

        'CREATE INDEX IF NOT EXISTS idx_exam_papers_level ON exam_papers(exam_level)',
        'CREATE INDEX IF NOT EXISTS idx_exam_papers_composite ON exam_papers(province_code, year, subject)',
        'CREATE INDEX IF NOT EXISTS idx_exam_papers_composite2 ON exam_papers(province_code, subject, year)',

        'CREATE INDEX IF NOT EXISTS idx_knowledge_points_subject ON knowledge_points(subject)',
        'CREATE INDEX IF NOT EXISTS idx_knowledge_points_level ON knowledge_points(level)',
        'CREATE INDEX IF NOT EXISTS idx_knowledge_points_subject_level ON knowledge_points(subject, level)',

        'CREATE INDEX IF NOT EXISTS idx_province_knowledge_stats_composite ON province_knowledge_stats(province_code, year, subject)',
        'CREATE INDEX IF NOT EXISTS idx_province_knowledge_stats_kp ON province_knowledge_stats(knowledge_point_id)',

        'CREATE INDEX IF NOT EXISTS idx_question_kp_question ON question_knowledge_points(question_id)',
        'CREATE INDEX IF NOT EXISTS idx_question_kp_kp ON question_knowledge_points(knowledge_point_id)',

        'CREATE INDEX IF NOT EXISTS idx_practice_records_user ON practice_records(user_email)',
        'CREATE INDEX IF NOT EXISTS idx_practice_records_subject ON practice_records(subject_code)',
        'CREATE INDEX IF NOT EXISTS idx_practice_records_kp ON practice_records(knowledge_point_id)',
        'CREATE INDEX IF NOT EXISTS idx_practice_records_user_subject ON practice_records(user_email, subject_code)',
        'CREATE INDEX IF NOT EXISTS idx_practice_records_timestamp ON practice_records(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_practice_records_is_correct ON practice_records(is_correct)',

        'CREATE INDEX IF NOT EXISTS idx_user_province_prefs_user ON user_province_prefs(user_email)',
        'CREATE INDEX IF NOT EXISTS idx_exam_sessions_subject ON exam_sessions(subject)',
        'CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status)',
        'CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_status ON exam_sessions(user_email, status)',

        'CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status)',
        'CREATE INDEX IF NOT EXISTS idx_task_queue_user ON task_queue(user_email)',

        'CREATE INDEX IF NOT EXISTS idx_provinces_exam_type ON provinces(exam_type)',
        'CREATE INDEX IF NOT EXISTS idx_provinces_region ON provinces(region)'
      ];

      for (const sql of indexes) {
        try {
          await db.exec(sql);
        } catch (e) {
          console.warn(`Index creation warning: ${e.message}`);
        }
      }
    }
  },
  {
    version: 9,
    name: 'deduplicate_data',
    description: 'Remove duplicate records from wrong_questions and reports',
    up: async (db) => {
      await db.run(`
        DELETE FROM wrong_questions
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM wrong_questions
          GROUP BY user_email, data
        )
      `);

      await db.run(`
        DELETE FROM reports
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM reports
          GROUP BY user_email, data
        )
      `);

      await db.run(`
        DELETE FROM exam_questions
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM exam_questions
          GROUP BY paper_id, question_number
        )
      `);
    }
  },
  {
    version: 10,
    name: 'add_foreign_key_constraints',
    description: 'Add foreign key indexes and ensure referential integrity',
    up: async (db) => {
      await db.run(`DELETE FROM wrong_questions WHERE question_id IS NOT NULL AND question_id NOT IN (SELECT id FROM exam_questions)`);
      await db.run(`DELETE FROM wrong_questions WHERE session_id IS NOT NULL AND session_id NOT IN (SELECT id FROM exam_sessions)`);
      await db.run(`DELETE FROM similar_questions WHERE report_id NOT IN (SELECT id FROM reports)`);
      await db.run(`DELETE FROM province_knowledge_stats WHERE knowledge_point_id IS NOT NULL AND knowledge_point_id NOT IN (SELECT id FROM knowledge_points)`);
    }
  }
];

async function runMigrations() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA journal_mode=WAL');
  await db.exec('PRAGMA busy_timeout=5000');
  await db.exec('PRAGMA foreign_keys=ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = await db.all('SELECT version FROM db_migrations ORDER BY version');
  const appliedVersions = new Set(applied.map(r => r.version));

  console.log(`\n📋 已应用的迁移: ${appliedVersions.size} 个`);
  console.log(`📦 待应用的迁移: ${MIGRATIONS.filter(m => !appliedVersions.has(m.version)).length} 个\n`);

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      console.log(`  ⏭️  v${migration.version}: ${migration.name} - 已应用，跳过`);
      continue;
    }

    console.log(`  🔄 v${migration.version}: ${migration.name} - 执行中...`);
    const start = Date.now();

    try {
      await db.run('BEGIN TRANSACTION');
      await migration.up(db);
      await db.run('INSERT INTO db_migrations (version, name, description) VALUES (?, ?, ?)',
        [migration.version, migration.name, migration.description]);
      await db.run('COMMIT');
      const elapsed = Date.now() - start;
      console.log(`  ✅ v${migration.version}: ${migration.name} - 完成 (${elapsed}ms)`);
    } catch (error) {
      await db.run('ROLLBACK');
      console.error(`  ❌ v${migration.version}: ${migration.name} - 失败: ${error.message}`);
      throw error;
    }
  }

  console.log('\n🎉 数据库迁移全部完成！\n');

  await printStats(db);

  await db.close();
}

async function printStats(db) {
  const tables = [
    'users', 'wrong_questions', 'reports', 'task_queue', 'similar_questions',
    'knowledge_points', 'personalized_papers', 'provinces', 'exam_papers',
    'exam_questions', 'province_knowledge_stats', 'user_province_prefs',
    'exam_sessions', 'user_checkins', 'user_points', 'user_badges',
    'task_metrics', 'subjects', 'exam_levels', 'question_types', 'grades',
    'question_knowledge_points', 'practice_records', 'db_migrations'
  ];

  console.log('📊 数据库统计信息:');
  console.log('─'.repeat(50));

  for (const table of tables) {
    try {
      const result = await db.all(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ${table.padEnd(35)} ${result[0].count} 行`);
    } catch {
      console.log(`  ${table.padEnd(35)} 不存在`);
    }
  }

  console.log('─'.repeat(50));

  const indexResult = await db.all("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  console.log(`\n📑 索引总数: ${indexResult.length}`);
  for (const idx of indexResult) {
    console.log(`  - ${idx.name}`);
  }
}

runMigrations().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
