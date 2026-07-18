import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getSubjects(req, res);
  }
  return res.status(405).json(errorResponse('Method not allowed'));
}

async function getSubjects(req, res) {
  const { category, exam_level } = req.query;

  try {
    const pool = await getDb();

    let query = `
      SELECT s.*, 
             COALESCE(pcs.count, 0) as question_count,
             COALESCE(avg_difficulty, 0) as avg_difficulty
      FROM subjects s
      LEFT JOIN (
        SELECT subject_code, COUNT(*) as count, AVG(difficulty) as avg_difficulty
        FROM exam_questions
        GROUP BY subject_code
      ) pcs ON s.code = pcs.subject_code
    `;

    const params = [];
    const conditions = [];

    if (category) {
      conditions.push(`s.category = $${params.length + 1}`);
      params.push(category);
    }

    if (exam_level) {
      const gradeLevel = exam_level === 'gaokao' ? 'gaokao' : 'zhongkao';
      query = `
        SELECT s.*,
               COALESCE(pcs.count, 0) as question_count,
               COALESCE(avg_difficulty, 0) as avg_difficulty
        FROM subjects s
        LEFT JOIN (
          SELECT eq.subject_code, COUNT(*) as count, AVG(eq.difficulty) as avg_difficulty
          FROM exam_questions eq
          JOIN exam_papers ep ON eq.paper_id = ep.id
          WHERE ep.exam_level = $1
          GROUP BY eq.subject_code
        ) pcs ON s.code = pcs.subject_code
      `;
      params.push(exam_level);
    }

    if (conditions.length > 0 && !exam_level) {
      query += ' WHERE ' + conditions.join(' AND ');
    } else if (conditions.length > 0 && exam_level) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.sort_order';

    const result = await pool.query(query, params);

    const subjects = result.rows.map(subject => ({
      ...subject,
      avg_difficulty: parseFloat(subject.avg_difficulty) || 0
    }));

    return res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('[Subjects] Get subjects error:', error);
    return res.status(500).json(errorResponse('获取学科列表失败'));
  }
}
