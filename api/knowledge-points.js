import { getDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { KEYWORD_MAP, resolveSubjectName, matchWeakPoint, findWeakKPIds } from './utils/subjectMap.js';
import { errorResponse } from './utils/response.js';

export default async function handler(req, res) {
  const email = req.user.email;
  const db = await getDb();

  if (req.method === 'GET') {
    const { subject, level } = req.query;
    let query = 'SELECT * FROM knowledge_points';
    const params = [];
    const conditions = [];

    if (subject) {
      conditions.push('subject = ?');
      params.push(subject);
    }
    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY subject, difficulty DESC';

    const rows = await db.all(query, params);
    return res.json(rows.map(r => {
      let subtopics;
      try {
        subtopics = JSON.parse(r.subtopics);
      } catch {
        subtopics = [];
      }
      return { ...r, subtopics };
    }));
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'seed') {
      try {
        const filePath = path.join(process.cwd(), 'database', 'seed_knowledge_points.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        await db.run("DELETE FROM knowledge_points WHERE level IS NULL OR level = 'gaokao'");

        for (const kp of data) {
          await db.run(
            `INSERT OR REPLACE INTO knowledge_points (id, subject, name, subtopics, difficulty, frequency, description, level)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [kp.id, kp.subject, kp.name, JSON.stringify(kp.subtopics), kp.difficulty, kp.frequency, kp.description, kp.level || 'gaokao']
          );
        }

        return res.json({ success: true, count: data.length, message: `成功导入 ${data.length} 个高考知识点` });
      } catch (err) {
        console.error('Seed error:', err);
        return res.status(500).json(errorResponse('导入知识点失败: ' + err.message));
      }
    }

    if (action === 'seed_zhongkao') {
      try {
        const filePath = path.join(process.cwd(), 'database', 'seed_knowledge_points_zhongkao.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        await db.run("DELETE FROM knowledge_points WHERE level = 'zhongkao'");

        for (const kp of data) {
          await db.run(
            `INSERT OR REPLACE INTO knowledge_points (id, subject, name, subtopics, difficulty, frequency, description, level)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function getWeakPointsHandler(req, res) {
  const email = req.user.email;
  const db = await getDb();

  const wrongQuestions = await db.all(
    'SELECT id, data, timestamp FROM wrong_questions WHERE user_email = ? ORDER BY timestamp DESC',
    [email]
  );

  const allKP = await db.all('SELECT * FROM knowledge_points');

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
