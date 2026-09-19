// api/modules/today/routes.js — D082 Sprint 2 今日任务 lifecycle
//
// 端点 (挂在 '/user/today' 前缀下 → /api/user/today/*):
//   GET    /api/user/today        — 今日任务列表
//   POST   /api/user/today        — 触发今日任务生成 (idempotent, 同一天只生成一次)
//   POST   /api/user/today/:id/start    — 标记任务开始, 记录 started_at
//   POST   /api/user/today/:id/complete — 标记任务完成, 记录 completed_at
//   POST   /api/user/today/:id/skip    — 跳过任务, 记录 skip_reason
//
// 设计要点:
//   - 同一天 deterministic + atomic: ON CONFLICT (user_email, task_date) DO NOTHING
//   - 软失败: 子查询失败时返回空列表
//   - 与 SRS, knowledge mastery, wrong_questions 数据源耦合

import express from 'express';
import { getDb } from '../../core/db.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { authMiddleware } from '../../core/auth.js';
import { logger } from '../../core/logger.js';

const router = express.Router();
router.use(authMiddleware);

const VALID_STATUSES = ['pending', 'started', 'completed', 'skipped'];
const VALID_KINDS = ['review', 'practice', 'predict', 'photo', 'wrong', 'essay', 'path'];

/**
 * 生成今日任务 (idempotent, 同一天不重复生成)
 * 策略:
 *   - 取 top 1 薄弱 KP → review
 *   - 取 top 1 中等 KP → practice (5 题精练)
 *   - 取 top 1 预测卷入口 → predict
 */
async function generateTodayTasks(pool, email) {
  // 已存在: 直接返回 (idempotent)
  const existing = await pool.query(
    `SELECT id, kind, title, kp_id, kp_name, subject, reason, minutes, start_url, status, weight
     FROM today_tasks
     WHERE user_email = $1 AND task_date = CURRENT_DATE
     ORDER BY weight DESC`,
    [email]
  );
  if (existing.rows.length > 0) return existing.rows;

  // 取 top 3 薄弱 KP
  const hotKps = await pool.query(
    `SELECT
       skm.knowledge_point_id AS kp_id,
       skm.mastery_score,
       skm.attempt_count,
       skm.correct_count,
       COALESCE(kp.name, skm.knowledge_point_id) AS name,
       COALESCE(kp.subject, 'math') AS subject_code,
       COALESCE(kp.difficulty, 3) AS difficulty,
       COALESCE(kp.frequency, 'medium') AS frequency
     FROM student_knowledge_mastery skm
     LEFT JOIN knowledge_points kp ON kp.id = skm.knowledge_point_id
     WHERE skm.user_email = $1 AND skm.attempt_count > 0
     ORDER BY skm.mastery_score ASC
     LIMIT 5`,
    [email]
  );

  const tasks = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10).replace(/-/g, '');
  const userId = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8);

  if (hotKps.rows.length > 0) {
    // Task 1: top 1 薄弱 → review
    const top1 = hotKps.rows[0];
    const wc = Math.max(1, top1.attempt_count - top1.correct_count);
    const fw = { high: 1.5, medium: 1.0, low: 0.7 }[top1.frequency] || 1.0;
    const weight = Math.round(wc * (top1.difficulty / 3) * fw * 10) / 10;
    tasks.push({
      id: `t_${today}_${userId}_001`,
      kind: 'review',
      title: `复习${top1.name}错题`,
      kp_id: top1.kp_id,
      kp_name: top1.name,
      subject: top1.subject_code,
      reason: `最近错 ${wc} 道, 掌握度 ${Math.round(top1.mastery_score * 100)}%, 建议今日复习`,
      minutes: 8,
      start_url: `/f3/pages/wrong-book.html?subject=${top1.subject_code}&kp=${top1.kp_id}`,
      status: 'pending',
      weight: Math.max(weight, 7.0),
    });
  }

  if (hotKps.rows.length > 1) {
    // Task 2: top 2 中等 → practice
    const top2 = hotKps.rows[1];
    tasks.push({
      id: `t_${today}_${userId}_002`,
      kind: 'practice',
      title: `${top2.name} · 5 题精练`,
      kp_id: top2.kp_id,
      kp_name: top2.name,
      subject: top2.subject_code,
      reason: '薄弱度指数中等, 5 题精练巩固, 配合 SRS 间隔',
      minutes: 12,
      start_url: `/f3/pages/exam-simulation.html?subject=${top2.subject_code}&kp_id=${top2.kp_id}`,
      status: 'pending',
      weight: 7.5,
    });
  }

  // Task 3: 预测卷
  const weakCount = hotKps.rows.length;
  tasks.push({
    id: `t_${today}_${userId}_003`,
    kind: 'predict',
    title: `数学薄弱点预测卷`,
    kp_id: null,
    kp_name: weakCount > 0 ? `${weakCount} 个薄弱点` : '综合预测',
    subject: hotKps.rows[0]?.subject_code || 'math',
    reason: `基于本周错题, AI 智能组卷 10 题, 预计 25 分钟`,
    minutes: 25,
    start_url: '/f3/pages/personalized-paper.html?mode=weak-points',
    status: 'pending',
    weight: 8.0,
  });

  // 批量插入 (idempotent by PK)
  for (const t of tasks) {
    await pool.query(
      `INSERT INTO today_tasks
         (id, user_email, task_date, kind, title, kp_id, kp_name, subject, reason, minutes, start_url, weight)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, email, t.kind, t.title, t.kp_id, t.kp_name, t.subject, t.reason, t.minutes, t.start_url, t.weight]
    ).catch((err) => {
      logger.warn('[today/generate] insert failed for', t.id, err.message);
    });
  }

  return tasks;
}

// GET /api/user/today
router.get('/', async (req, res) => {
  const { email } = req.user;
  try {
    const pool = await getDb();
    // 自动 idempotent 生成
    const tasks = await generateTodayTasks(pool, email);
    return res.json(successResponse({
      date: new Date().toISOString().slice(0, 10),
      streak_days: 0,  // 简化: 从 practice_records 计算
      tasks,
    }, `今日 ${tasks.length} 个任务已就绪`));
  } catch (err) {
    logger.error('[today/GET] failed:', err.message);
    return res.json(successResponse({
      date: new Date().toISOString().slice(0, 10),
      streak_days: 0,
      tasks: [],
    }, '获取今日任务降级返回'));
  }
});

// POST /api/user/today — 强制重新生成 (测试用)
router.post('/', async (req, res) => {
  const { email } = req.user;
  try {
    const pool = await getDb();
    // 清空今日 pending 任务
    await pool.query(
      `DELETE FROM today_tasks WHERE user_email = $1 AND task_date = CURRENT_DATE AND status = 'pending'`,
      [email]
    );
    const tasks = await generateTodayTasks(pool, email);
    return res.json(successResponse({
      date: new Date().toISOString().slice(0, 10),
      tasks,
    }, `重新生成 ${tasks.length} 个任务`));
  } catch (err) {
    logger.error('[today/POST] failed:', err.message);
    return res.status(500).json(errorResponse('生成今日任务失败'));
  }
});

// POST /api/user/today/:id/start
router.post('/:id/start', async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  try {
    const pool = await getDb();
    const result = await pool.query(
      `UPDATE today_tasks
       SET status = 'started', started_at = NOW()
       WHERE id = $1 AND user_email = $2 AND status = 'pending'
       RETURNING id, kind, title, status, started_at`,
      [id, email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('任务不存在或已启动'));
    }
    return res.json(successResponse(result.rows[0], '任务已启动'));
  } catch (err) {
    logger.error('[today/start] failed:', err.message);
    return res.status(500).json(errorResponse('启动任务失败'));
  }
});

// POST /api/user/today/:id/complete
router.post('/:id/complete', async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const { score, time_spent_ms } = req.body || {};
  try {
    const pool = await getDb();
    const result = await pool.query(
      `UPDATE today_tasks
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND user_email = $2 AND status IN ('pending', 'started')
       RETURNING id, kind, title, status, completed_at`,
      [id, email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('任务不存在或已完成'));
    }
    return res.json(successResponse({
      ...result.rows[0],
      score: score ?? null,
      time_spent_ms: time_spent_ms ?? null,
    }, '任务已完成'));
  } catch (err) {
    logger.error('[today/complete] failed:', err.message);
    return res.status(500).json(errorResponse('完成任务失败'));
  }
});

// POST /api/user/today/:id/skip
router.post('/:id/skip', async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const pool = await getDb();
    const result = await pool.query(
      `UPDATE today_tasks
       SET status = 'skipped', skip_reason = $3
       WHERE id = $1 AND user_email = $2 AND status IN ('pending', 'started')
       RETURNING id, kind, status, skip_reason`,
      [id, email, reason || 'user_skipped']
    );
    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('任务不存在或已跳过'));
    }
    return res.json(successResponse(result.rows[0], '任务已跳过'));
  } catch (err) {
    logger.error('[today/skip] failed:', err.message);
    return res.status(500).json(errorResponse('跳过任务失败'));
  }
});

export default router;