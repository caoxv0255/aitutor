import { getDb } from './db.js';
import { successResponse, errorResponse, paginatedResponse } from './utils/response.js';

const VALID_SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '政治', '生物', '历史', '地理', '作文'];

export default async function handler(req, res) {
  const email = req.user.email;
  const db = await getDb();

  if (req.method === 'GET') {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const rows = await db.all(
      'SELECT id, data, timestamp FROM wrong_questions WHERE user_email = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [email, limit, offset]
    );

    const countResult = await db.all(
      'SELECT COUNT(*) as total FROM wrong_questions WHERE user_email = ?',
      [email]
    );
    const total = countResult[0]?.total || 0;

    const data = rows.map(r => {
      let parsed;
      try {
        parsed = JSON.parse(r.data);
      } catch {
        parsed = { raw: r.data };
      }
      return { _id: String(r.id), data: parsed, timestamp: r.timestamp };
    });
    return res.json(paginatedResponse(data, total, Math.floor(offset / limit) + 1, limit));
  }

  if (req.method === 'POST') {
    const { question, subject, answer, analysis } = req.body;
    if (!question || !subject) {
      return res.status(400).json(errorResponse('题目内容和学科为必填项'));
    }

    const dataStr = JSON.stringify(req.body);
    if (dataStr.length > 1024 * 1024) {
      return res.status(413).json(errorResponse('数据过大，单条错题不能超过1MB'));
    }

    const result = await db.run(
      'INSERT INTO wrong_questions (user_email, data) VALUES (?, ?)',
      [email, JSON.stringify(req.body)]
    );
    return res.status(201).json(successResponse({ id: String(result.lastID) }, '添加错题成功'));
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('缺少 id 参数'));
    
    const deleteResult = await db.run(
      'DELETE FROM wrong_questions WHERE id = ? AND user_email = ?', 
      [id, email]
    );
    
    if (deleteResult.changes === 0) {
      return res.status(404).json(errorResponse('错题不存在或无权限删除'));
    }
    
    return res.json(successResponse(null, '删除成功'));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}
