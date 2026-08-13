import express from 'express';
import { getDb } from '../../core/db.js';
import { successResponse } from '../../utils/response.js';
import { authMiddleware } from '../../core/auth.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/review/reports
 * Query: page, page_size
 * Response: data: [{id, title, subject, period, score, total, correct, duration_minutes, created_at}]
 */
router.get('/reports', async (req, res) => {
  const { email } = req.user;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size) || 20));
  const offset = (page - 1) * pageSize;
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT id, user_email, subject_code, score, difficulty, knowledge_point_id, data, timestamp
       FROM reports WHERE user_email = $1
       ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [email, pageSize, offset]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM reports WHERE user_email = $1`,
      [email]
    );
    const reports = result.rows.map((r) => {
      let parsed = {};
      try { parsed = r.data ? JSON.parse(r.data) : {}; } catch (e) { parsed = {}; }
      const subjectName = parsed.subject_name || r.subject_code || '';
      const dateStr = r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : '';
      return {
        id: 'rpt_' + r.id,
        title: parsed.title || (subjectName + ' 学情报告'),
        subject: subjectName,
        period: parsed.period || dateStr,
        score: r.score != null ? parseFloat(r.score) : (parsed.score ?? null),
        total: parsed.total ?? null,
        correct: parsed.correct ?? null,
        duration_minutes: parsed.duration_minutes ?? null,
        created_at: r.timestamp,
        date: dateStr
      };
    });
    return res.json(successResponse(reports, '获取报告列表成功'));
  } catch (err) {
    console.error('[Review] reports 失败:', err.message);
    return res.status(500).json({ success: false, error: '获取报告列表失败' });
  }
});

/**
 * GET /api/review/reports/:id
 * Path: :id (rpt_<numeric>)
 */
router.get('/reports/:id', async (req, res) => {
  const { email } = req.user;
  const m = String(req.params.id || '').match(/^rpt_(\d+)$/);
  if (!m) return res.status(400).json({ success: false, error: '无效的报告 id' });
  const numericId = parseInt(m[1], 10);
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT id, user_email, subject_code, score, difficulty, knowledge_point_id, data, timestamp
       FROM reports WHERE id = $1 AND user_email = $2`,
      [numericId, email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '报告不存在或无权访问' });
    }
    const r = result.rows[0];
    let parsed = {};
    try { parsed = r.data ? JSON.parse(r.data) : {}; } catch (e) { parsed = {}; }
    return res.json(successResponse({
      id: 'rpt_' + r.id,
      title: parsed.title || (r.subject_code || '') + ' 学情报告',
      subject: r.subject_code,
      score: r.score != null ? parseFloat(r.score) : null,
      difficulty: r.difficulty,
      knowledge_point_id: r.knowledge_point_id,
      created_at: r.timestamp,
      details: parsed
    }, '获取报告详情成功'));
  } catch (err) {
    console.error('[Review] report detail 失败:', err.message);
    return res.status(500).json({ success: false, error: '获取报告详情失败' });
  }
});

/**
 * GET /api/review/session/history
 * Query: limit
 * Response: data: [{id, title, subject, mode, started_at, ended_at, score, accuracy}]
 */
router.get('/session/history', async (req, res) => {
  const { email } = req.user;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT id, subject, score, accuracy, correct_count, total_score, status,
              started_at, completed_at, time_limit
       FROM exam_sessions WHERE user_email = $1
       ORDER BY started_at DESC LIMIT $2`,
      [email, limit]
    );
    const items = result.rows.map((s) => {
      const started = s.started_at ? new Date(s.started_at) : null;
      const completed = s.completed_at ? new Date(s.completed_at) : null;
      const durationMin = (started && completed) ? Math.round((completed - started) / 60000) : null;
      return {
        id: s.id,
        title: s.subject + ' 会话',
        subject: s.subject,
        mode: s.status === 'completed' ? 'exam' : (s.time_limit ? 'exam' : 'tutor'),
        started_at: s.started_at,
        ended_at: s.completed_at,
        duration_minutes: durationMin,
        score: s.score != null ? parseInt(s.score, 10) : null,
        accuracy: s.accuracy != null ? parseFloat(s.accuracy) : null,
        correct_count: s.correct_count != null ? parseInt(s.correct_count, 10) : null
      };
    });
    return res.json(successResponse(items, '获取会话历史成功'));
  } catch (err) {
    console.error('[Review] session history 失败:', err.message);
    return res.status(500).json({ success: false, error: '获取会话历史失败' });
  }
});

/**
 * GET /api/review/weak-points
 * Query: subject (optional)
 * Response: data: [{kp_id, kp_name, subject, error_rate, wrong_count, total_count, level}]
 *
 * Aggregates practice_records per knowledge_point_id, computes error_rate
 * (1 - correct/total). Joins knowledge_points for name.
 */
router.get('/weak-points', async (req, res) => {
  const { email } = req.user;
  const subject = req.query.subject || null;
  try {
    const pool = await getDb();
    const params = [email];
    let subjectFilter = '';
    if (subject) {
      subjectFilter = ' AND pr.subject_code = $2';
      params.push(subject);
    }
    const result = await pool.query(
      `SELECT pr.knowledge_point_id,
              kp.name AS kp_name,
              pr.subject_code,
              SUM(CASE WHEN pr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct_count,
              COUNT(*)::int AS total_count,
              SUM(CASE WHEN pr.is_correct = 0 THEN 1 ELSE 0 END)::int AS wrong_count
       FROM practice_records pr
       LEFT JOIN knowledge_points kp ON pr.knowledge_point_id = kp.id
       WHERE pr.user_email = $1 AND pr.knowledge_point_id IS NOT NULL${subjectFilter}
       GROUP BY pr.knowledge_point_id, kp.name, pr.subject_code
       HAVING COUNT(*) > 0
       ORDER BY wrong_count DESC, total_count DESC
       LIMIT 20`,
      params
    );
    const items = result.rows.map((r) => {
      const correctRate = r.total_count > 0 ? r.correct_count / r.total_count : 0;
      const errorRate = 1 - correctRate;
      let level = 'low';
      if (errorRate >= 0.5 || r.wrong_count >= 5) level = 'high';
      else if (errorRate >= 0.3 || r.wrong_count >= 3) level = 'medium';
      return {
        kp_id: r.knowledge_point_id,
        kp_name: r.kp_name || r.knowledge_point_id,
        subject: r.subject_code,
        error_rate: Math.round(errorRate * 100) / 100,
        wrong_count: r.wrong_count,
        total_count: r.total_count,
        level
      };
    });
    return res.json(successResponse(items, '获取危机点成功'));
  } catch (err) {
    console.error('[Review] weak points 失败:', err.message);
    return res.status(500).json({ success: false, error: '获取危机点失败' });
  }
});

/**
 * GET /api/review/trend-summary
 * Query: days (default 30)
 * Response: data: {period_days, total_questions, accuracy, avg_score, trend: [{date, score, questions}], improvement}
 */
router.get('/trend-summary', async (req, res) => {
  const { email } = req.user;
  const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT DATE(pr.timestamp) AS day,
              COUNT(*)::int AS q_count,
              SUM(CASE WHEN pr.is_correct = 1 THEN 1 ELSE 0 END)::int AS c_count
       FROM practice_records pr
       WHERE pr.user_email = $1 AND pr.timestamp >= NOW() - ($2 || ' days')::interval
       GROUP BY DATE(pr.timestamp)
       ORDER BY day ASC`,
      [email, days]
    );
    const byDay = result.rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      questions: r.q_count,
      correct: r.c_count,
      score: r.q_count > 0 ? Math.round((r.c_count / r.q_count) * 100) : 0
    }));
    const totalQ = byDay.reduce((s, d) => s + d.questions, 0);
    const totalC = byDay.reduce((s, d) => s + d.correct, 0);
    const accuracy = totalQ > 0 ? totalC / totalQ : 0;
    const avgScore = byDay.length > 0 ? Math.round(byDay.reduce((s, d) => s + d.score, 0) / byDay.length) : 0;
    let improvement = 0;
    if (byDay.length >= 2) {
      const first = byDay[0].score;
      const last = byDay[byDay.length - 1].score;
      improvement = first > 0 ? Math.round(((last - first) / first) * 100) / 100 : 0;
    }
    const trend = byDay.map((d) => ({ date: d.date, score: d.score, questions: d.questions }));
    return res.json(successResponse({
      period_days: days,
      total_questions: totalQ,
      accuracy: Math.round(accuracy * 100) / 100,
      avg_score: avgScore,
      trend,
      improvement
    }, '获取趋势汇总成功'));
  } catch (err) {
    console.error('[Review] trend summary 失败:', err.message);
    return res.status(500).json({ success: false, error: '获取趋势汇总失败' });
  }
});

export default router;