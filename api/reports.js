import { getDb } from './db.js';
import { errorResponse, successResponse, createdResponse } from './utils/response.js';

export default async function handler(req, res) {
  const email = req.user.email;
  const db = await getDb();

  if (req.method === 'GET') {
    const reportRows = await db.all(
      'SELECT id, data, timestamp FROM reports WHERE user_email = ? ORDER BY timestamp DESC',
      [email]
    );

    if (reportRows.length === 0) return res.json([]);

    const reportIds = reportRows.map(r => r.id);
    const placeholders = reportIds.map((_, i) => '?').join(',');
    const sqRows = await db.all(
      `SELECT report_id, data FROM similar_questions WHERE report_id IN (${placeholders}) ORDER BY id ASC`,
      reportIds
    );

    const sqByReport = {};
    for (const sq of sqRows) {
      if (!sqByReport[sq.report_id]) sqByReport[sq.report_id] = [];
      sqByReport[sq.report_id].push(JSON.parse(sq.data));
    }

    return res.json(reportRows.map(r => ({
      _id: String(r.id),
      ...JSON.parse(r.data),
      similarQuestions: sqByReport[r.id] || [],
      timestamp: r.timestamp
    })));
  }

  if (req.method === 'POST') {
    const { similarQuestions = [], ...reportData } = req.body;

    const result = await db.run(
      'INSERT INTO reports (user_email, data) VALUES (?, ?)',
      [email, JSON.stringify(reportData)]
    );
    const reportId = result.lastID;

    if (similarQuestions.length > 0) {
      for (const sq of similarQuestions) {
        await db.run(
          'INSERT INTO similar_questions (report_id, user_email, data) VALUES (?, ?, ?)',
          [reportId, email, JSON.stringify(sq)]
        );
      }
    }

    return res.status(201).json(createdResponse({ id: String(reportId) }));
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('缺少 id 参数'));
    await db.run('DELETE FROM reports WHERE id = ? AND user_email = ?', [id, email]);
    return res.json(successResponse(null));
  }

  res.status(405).json(errorResponse('Method not allowed'));
}
