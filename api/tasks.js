import { getDb } from './db.js';
import { errorResponse, successResponse, createdResponse } from './utils/response.js';

export default async function handler(req, res) {
  const email = req.user.email;
  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.all(
      'SELECT id, subject, status, image_data, result, created_at, updated_at FROM task_queue WHERE user_email = ? ORDER BY created_at DESC',
      [email]
    );
    return res.json(rows.map(r => ({
      _id: String(r.id),
      subject: r.subject,
      status: r.status,
      imageData: r.image_data,
      result: r.result ? JSON.parse(r.result) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })));
  }

  if (req.method === 'POST') {
    const { subject, grade, imageData } = req.body;
    if (!subject || !grade || !imageData) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }
    const result = await db.run(
      'INSERT INTO task_queue (user_email, subject, grade, image_data) VALUES (?, ?, ?, ?)',
      [email, subject, grade, imageData]
    );
    return res.status(201).json(createdResponse({ id: String(result.lastID) }));
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('缺少 id 参数'));
    await db.run('DELETE FROM task_queue WHERE id = ? AND user_email = ?', [id, email]);
    return res.json(successResponse(null));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}
