import { getDb } from '../core/db.js';
import { errorResponse, successResponse, createdResponse } from '../utils/response.js';

export default async function handler(req, res) {
  const email = req.user.email;
  const pool = await getDb();

  if (req.method === 'GET') {
    const reportRows = await pool.query(
      'SELECT id, data, timestamp FROM reports WHERE user_email = $1 ORDER BY timestamp DESC',
      [email]
    );

    if (reportRows.rows.length === 0) return res.json([]);

    const reportIds = reportRows.rows.map(r => r.id);
    const placeholders = reportIds.map((_, i) => `$${i + 1}`).join(',');
    const sqRows = await pool.query(
      `SELECT report_id, data FROM similar_questions WHERE report_id IN (${placeholders}) ORDER BY id ASC`,
      reportIds
    );

    const sqByReport = {};
    for (const sq of sqRows.rows) {
      if (!sqByReport[sq.report_id]) sqByReport[sq.report_id] = [];
      sqByReport[sq.report_id].push(JSON.parse(sq.data));
    }

    return res.json(reportRows.rows.map(r => ({
      _id: String(r.id),
      ...JSON.parse(r.data),
      similarQuestions: sqByReport[r.id] || [],
      timestamp: r.timestamp
    })));
  }

  if (req.method === 'POST') {
    const { similarQuestions = [], ...reportData } = req.body;

    const result = await pool.query(
      'INSERT INTO reports (user_email, data) VALUES ($1, $2) RETURNING id',
      [email, JSON.stringify(reportData)]
    );
    const reportId = result.rows[0].id;

    if (similarQuestions.length > 0) {
      for (const sq of similarQuestions) {
        await pool.query(
          'INSERT INTO similar_questions (report_id, user_email, data) VALUES ($1, $2, $3)',
          [reportId, email, JSON.stringify(sq)]
        );
      }
    }

    return res.status(201).json(createdResponse({ id: String(reportId) }));
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('缺少 id 参数'));
    await pool.query('DELETE FROM reports WHERE id = $1 AND user_email = $2', [id, email]);
    return res.json(successResponse(null));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}
