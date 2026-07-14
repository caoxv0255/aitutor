import { getDb } from '../core/db.js';
import fs from 'fs';
import path from 'path';
import { KEYWORD_MAP, resolveSubjectName, matchWeakPoint, findWeakKPIds } from '../utils/subjectMap.js';
import { errorResponse, successResponse } from '../utils/response.js';

export default async function handler(req, res) {
  const email = req.user.email;
  const pool = await getDb();

  if (req.method === 'GET') {
    const { subject, level, source, include_content } = req.query;
    let query = 'SELECT * FROM knowledge_points';
    const params = [];
    const conditions = [];
    let paramIdx = 1;

    if (subject) {
      conditions.push(`subject = $${paramIdx++}`);
      params.push(subject);
    }
    if (level) {
      conditions.push(`level = $${paramIdx++}`);
      params.push(level);
    }
    // 按数据来源过滤：source=textbook 表示有教材内容的知识点
    if (source === 'textbook') {
      conditions.push(`content IS NOT NULL AND content != ''`);
    } else if (source === 'seed') {
      conditions.push(`content IS NULL OR content = ''`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY subject, difficulty DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows.map(r => {
      let subtopics;
      try {
        subtopics = JSON.parse(r.subtopics);
      } catch {
        subtopics = [];
      }
      // 默认截断 content 为前 200 字（避免大响应），include_content=full 时返回完整内容
      const content = include_content === 'full'
        ? r.content
        : (r.content ? r.content.slice(0, 200) + (r.content.length > 200 ? '...' : '') : null);
      return { ...r, subtopics, content };
    }));
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'seed') {
      try {
        const filePath = path.join(process.cwd(), 'database', 'seed_knowledge_points.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        await pool.query("DELETE FROM knowledge_points WHERE level IS NULL OR level = 'gaokao'");

        for (const kp of data) {
          await pool.query(
            `INSERT INTO knowledge_points (id, subject, name, subtopics, difficulty, frequency, description, level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, name = EXCLUDED.name, subtopics = EXCLUDED.subtopics, difficulty = EXCLUDED.difficulty, frequency = EXCLUDED.frequency, description = EXCLUDED.description, level = EXCLUDED.level`,
            [kp.id, kp.subject, kp.name, JSON.stringify(kp.subtopics), kp.difficulty, kp.frequency, kp.description, kp.level || 'gaokao']
          );
        }

        return res.json({ success: true, count: data.length, message: `成功导入 ${data.length} 个高考知识点` });
      } catch (err) {
        console.error('Seed error:', err);
        return res.status(500).json(errorResponse('导入知识点失败: ' + err.message));
      }
    }

    if (action === 'seed_textbook') {
      try {
        const filePath = path.join(process.cwd(), 'database', 'graphify-gaokao-knowledge', 'textbook_knowledge.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        let inserted = 0, updated = 0;
        const existingResult = await pool.query('SELECT id FROM knowledge_points');
        const existingIds = new Set(existingResult.rows.map(r => r.id));

        for (const kp of data) {
          const isNew = !existingIds.has(kp.id);
          await pool.query(
            `INSERT INTO knowledge_points
              (id, subject, name, subtopics, difficulty, frequency, description, level,
               module, textbook, volume, volume_code, content, source, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO UPDATE SET
               subject = EXCLUDED.subject, name = EXCLUDED.name, subtopics = EXCLUDED.subtopics,
               difficulty = EXCLUDED.difficulty, frequency = EXCLUDED.frequency, description = EXCLUDED.description,
               level = EXCLUDED.level, module = EXCLUDED.module, textbook = EXCLUDED.textbook,
               volume = EXCLUDED.volume, volume_code = EXCLUDED.volume_code, content = EXCLUDED.content,
               source = EXCLUDED.source, tags = EXCLUDED.tags, updated_at = NOW()`,
            [
              kp.id, kp.subject, kp.name, JSON.stringify([]),
              kp.difficulty || 3, kp.frequency || 'medium',
              kp.summary || kp.content?.slice(0, 300) || '',
              kp.level || 'gaokao',
              kp.module || '', kp.textbook || '', kp.volume || '', kp.volume_code || '',
              kp.content || '', kp.source || '', JSON.stringify(kp.tags || []),
            ]
          );
          if (isNew) inserted++; else updated++;
        }

        return res.json({
          success: true,
          inserted,
          updated,
          total: data.length,
          message: `教材知识点导入完成：新增 ${inserted} 条，更新 ${updated} 条`
        });
      } catch (err) {
        console.error('Seed textbook error:', err);
        return res.status(500).json(errorResponse('导入教材知识点失败: ' + err.message));
      }
    }

    if (action === 'seed_zhongkao') {
      try {
        const filePath = path.join(process.cwd(), 'database', 'seed_knowledge_points_zhongkao.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        await pool.query("DELETE FROM knowledge_points WHERE level = 'zhongkao'");

        for (const kp of data) {
          await pool.query(
            `INSERT INTO knowledge_points (id, subject, name, subtopics, difficulty, frequency, description, level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, name = EXCLUDED.name, subtopics = EXCLUDED.subtopics, difficulty = EXCLUDED.difficulty, frequency = EXCLUDED.frequency, description = EXCLUDED.description, level = EXCLUDED.level`,
            [kp.id, kp.subject, kp.name, JSON.stringify(kp.subtopics), kp.difficulty, kp.frequency, kp.description, kp.level || 'zhongkao']
          );
        }

        return res.json({ success: true, count: data.length, message: `成功导入 ${data.length} 个中考知识点` });
      } catch (err) {
        console.error('Seed zhongkao error:', err);
        return res.status(500).json(errorResponse('导入中考知识点失败: ' + err.message));
      }
    }

    return res.status(400).json(errorResponse('Invalid action'));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}

/**
 * GET /api/knowledge-points/:id/content — 返回指定知识点的完整教材内容
 */
export async function getKPContentHandler(req, res) {
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT id, name, subject, module, textbook, volume, volume_code, content, source, tags, difficulty, frequency
       FROM knowledge_points WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('知识点不存在'));
    }

    const kp = result.rows[0];
    let tags;
    try { tags = JSON.parse(kp.tags); } catch { tags = []; }

    return res.json(successResponse({ ...kp, tags }));
  } catch (err) {
    console.error('[KP Content] 查询失败:', err.message);
    return res.status(500).json(errorResponse('查询失败: ' + err.message));
  }
}

export async function getWeakPointsHandler(req, res) {
  const email = req.user.email;
  const pool = await getDb();

  const wrongQuestionsResult = await pool.query(
    'SELECT id, data, timestamp FROM wrong_questions WHERE user_email = $1 ORDER BY timestamp DESC',
    [email]
  );
  const wrongQuestions = wrongQuestionsResult.rows;

  const allKPResult = await pool.query('SELECT * FROM knowledge_points');
  const allKP = allKPResult.rows;

  const weakResults = findWeakKPIds(wrongQuestions, allKP);

  const weakPoints = weakResults.map(result => {
    const kp = allKP.find(k => k.id === result.kpId) || {};
    let subtopics;
    try {
      subtopics = JSON.parse(kp.subtopics || '[]');
    } catch {
      subtopics = [];
    }
    return {
      ...kp,
      subtopics,
      error_count: result.errorCount,
      matched_keywords: result.matchedKeywords,
      avg_confidence: Math.round(result.avgConfidence * 100) / 100,
      weakness_index: Math.round(result.weaknessIndex * 10) / 10,
      sample_questions: wrongQuestions
        .filter(wq => {
          let qData;
          try { qData = typeof wq.data === 'string' ? JSON.parse(wq.data) : wq.data; } catch { return false; }
          return matchWeakPoint(qData, result.kpId).matched;
        })
        .slice(0, 3)
        .map(wq => {
          let qData;
          try { qData = typeof wq.data === 'string' ? JSON.parse(wq.data) : wq.data; } catch { qData = {}; }
          return { id: wq.id, content: qData.content || qData.question || '无内容' };
        })
    };
  });

  return res.json({
    total_wrong_questions: wrongQuestions.length,
    weak_points_count: weakPoints.length,
    weak_points: weakPoints
  });
}
