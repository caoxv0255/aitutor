import { getDb } from '../core/db.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

const VALID_SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '政治', '生物', '历史', '地理', '作文'];

const SUBJECT_MAP = {
  '数学': 'math', '语文': 'chinese', '英语': 'english',
  '物理': 'physics', '化学': 'chemistry', '政治': 'politics',
  '生物': 'biology', '历史': 'history', '地理': 'geography'
};

export default async function handler(req, res) {
  const email = req.user.email;
  const pool = await getDb();

  if (req.method === 'GET') {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const conditions = ['user_email = $1'];
    const params = [email];
    let paramIdx = 2;

    if (req.query.subject) {
      const code = SUBJECT_MAP[req.query.subject] || req.query.subject;
      conditions.push(`subject_code = $${paramIdx++}`);
      params.push(code);
    }
    if (req.query.difficulty) {
      conditions.push(`difficulty = $${paramIdx++}`);
      params.push(req.query.difficulty);
    }
    if (req.query.knowledge_point_id) {
      conditions.push(`knowledge_point_id = $${paramIdx++}`);
      params.push(req.query.knowledge_point_id);
    }

    const whereClause = conditions.join(' AND ');

    const rows = await pool.query(
      `SELECT id, data, timestamp, subject_code, knowledge_point_id, difficulty, question_id, is_correct, exam_level, user_answer, correct_answer, session_id FROM wrong_questions WHERE ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM wrong_questions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    const data = rows.rows.map(r => {
      let parsed;
      try {
        parsed = JSON.parse(r.data);
      } catch {
        parsed = { raw: r.data };
      }
      return {
        _id: String(r.id),
        data: parsed,
        timestamp: r.timestamp,
        subject_code: r.subject_code,
        knowledge_point_id: r.knowledge_point_id,
        difficulty: r.difficulty,
        question_id: r.question_id,
        is_correct: r.is_correct,
        exam_level: r.exam_level,
        user_answer: r.user_answer,
        correct_answer: r.correct_answer,
        session_id: r.session_id
      };
    });
    return res.json(paginatedResponse(data, total, Math.floor(offset / limit) + 1, limit));
  }

  if (req.method === 'POST') {
    const { question, subject, answer, analysis, knowledge_point_id, difficulty, question_id, is_correct, exam_level, user_answer, correct_answer, session_id } = req.body;
    if (!question || !subject) {
      return res.status(400).json(errorResponse('题目内容和学科为必填项'));
    }

    const dataStr = JSON.stringify(req.body);
    if (dataStr.length > 1024 * 1024) {
      return res.status(413).json(errorResponse('数据过大，单条错题不能超过1MB'));
    }

    const subject_code = SUBJECT_MAP[subject] || null;

    const result = await pool.query(
      `INSERT INTO wrong_questions (user_email, data, subject_code, knowledge_point_id, difficulty, question_id, is_correct, exam_level, user_answer, correct_answer, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [email, dataStr, subject_code, knowledge_point_id || null, difficulty || null, question_id || null, is_correct !== undefined ? (is_correct ? 1 : 0) : null, exam_level || null, user_answer || null, correct_answer || null, session_id || null]
    );
    return res.status(201).json(successResponse({ id: String(result.rows[0].id) }, '添加错题成功'));
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('缺少 id 参数'));
    
    const deleteResult = await pool.query(
      'DELETE FROM wrong_questions WHERE id = $1 AND user_email = $2', 
      [id, email]
    );
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json(errorResponse('错题不存在或无权限删除'));
    }
    
    return res.json(successResponse(null, '删除成功'));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}
