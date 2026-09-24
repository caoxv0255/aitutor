/**
 * api/srs-engine.js — SRS 间隔重复系统 (Spaced Repetition System)
 *
 * 基于 SM-2 算法变体 + 掌握度加权，为每个学生动态生成"今日必复习"任务列表。
 *
 * 核心算法：
 *   priority = (1 - mastery_score) × 0.6 + overdue_factor × 0.4
 *   其中 overdue_factor = min(1, days_overdue / expected_interval)
 *
 * SM-2 间隔计算：
 *   EF' = EF + (0.1 - (5-q) × (0.08 + (5-q)×0.02))
 *   if q < 3: interval = 1
 *   else if interval == 0: interval = 1
 *   else if interval == 1: interval = 6
 *   else: interval = round(interval × EF')
 *
 * 架构边界：
 *   - 读写 student_knowledge_mastery（方案 C 业务表）
 *   - 写入 srs_review_log（复习日志）
 *   - 不修改方案 A 图谱拓扑或方案 B 向量索引
 */

import express from 'express';
import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SM-2 算法核心
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SM-2 算法：根据复习质量计算下次复习间隔
 *
 * @param {number} quality - 复习质量 0-5（0=完全不会，5=完美掌握）
 * @param {number} currentEF - 当前简易因子（默认 2.5）
 * @param {number} currentInterval - 当前间隔天数
 * @returns {{ newEF: number, newInterval: number }}
 */
function sm2Calculate(quality, currentEF, currentInterval) {
  // EF 下限保护
  const MIN_EF = 1.3;

  // SM-2 公式
  let newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(MIN_EF, newEF);

  let newInterval;
  if (quality < 3) {
    // 回答不佳，重置间隔
    newInterval = 1;
  } else if (currentInterval === 0) {
    newInterval = 1;
  } else if (currentInterval === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(currentInterval * newEF);
  }

  // 间隔上限保护（最大 365 天）
  newInterval = Math.min(newInterval, 365);

  return { newEF: parseFloat(newEF.toFixed(2)), newInterval };
}

/**
 * 将 is_correct 转换为 SM-2 quality 评分
 * 结合 time_spent_ms 给予额外信号
 */
function toQualityScore(isCorrect, timeSpentMs) {
  if (!isCorrect) {
    // 答错：根据耗时判断（快速答错说明完全不会，慢速答错说明有思路）
    return timeSpentMs > 30000 ? 2 : 1;
  }
  // 答对：根据耗时判断流畅度
  if (timeSpentMs < 10000) return 5; // 秒答，非常熟练
  if (timeSpentMs < 30000) return 4; // 正常速度
  if (timeSpentMs < 60000) return 3; // 思考较久
  return 2; // 很久才答对
}

// ─────────────────────────────────────────────────────────────────────────────
// 每日任务排序算法
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 计算复习优先级分数
 *
 * @param {number} masteryScore - 掌握度 0-100
 * @param {Date|null} nextReviewAt - 计划复习时间
 * @param {Date} now - 当前时间
 * @returns {number} 优先级分数（越高越需要复习）
 */
function calculatePriority(masteryScore, nextReviewAt, now) {
  const masteryWeight = 1 - (masteryScore / 100); // 掌握度越低，权重越高

  let overdueFactor = 0;
  if (nextReviewAt) {
    const reviewDate = new Date(nextReviewAt);
    const daysOverdue = Math.max(0, (now - reviewDate) / (1000 * 60 * 60 * 24));
    // 过期越久，优先级越高（归一化到 0-1）
    overdueFactor = Math.min(1, daysOverdue / 7);
  } else {
    // 从未安排复习 → 高优先级
    overdueFactor = 0.8;
  }

  return masteryWeight * 0.6 + overdueFactor * 0.4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Express 路由
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/srs/daily-tasks — 获取今日必复习任务列表
 *
 * 查询参数:
 *   ?limit=20&subject=math
 */
router.get('/daily-tasks', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const userEmail = req.user.email;
    const now = new Date();

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const subject = req.query.subject;

    // 查询该学生所有有练习记录的知识点
    const conditions = ['user_email = $1', 'attempt_count > 0'];
    const params = [userEmail];
    let paramIdx = 2;

    if (subject) {
      conditions.push(`knowledge_point_id LIKE $${paramIdx}`);
      params.push(`${subject}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit * 3); // 多取一些用于排序截断

    const result = await pool.query(
      `SELECT
         knowledge_point_id, mastery_score, attempt_count, correct_count,
         next_review_at, ease_factor, interval_days, last_reviewed_at,
         last_practice_at
       FROM student_knowledge_mastery
       WHERE ${whereClause}
       ORDER BY mastery_score ASC
       LIMIT $${paramIdx}`,
      params
    );

    // 计算优先级并排序
    const tasks = result.rows
      .map((row) => {
        const mastery = parseFloat(row.mastery_score);
        const priority = calculatePriority(mastery, row.next_review_at, now);
        const isOverdue = row.next_review_at && new Date(row.next_review_at) < now;
        const daysOverdue = row.next_review_at
          ? Math.max(0, Math.round((now - new Date(row.next_review_at)) / (1000 * 60 * 60 * 24)))
          : null;

        return {
          knowledge_point_id: row.knowledge_point_id,
          mastery_score: mastery,
          priority: parseFloat(priority.toFixed(3)),
          is_overdue: isOverdue,
          days_overdue: daysOverdue,
          next_review_at: row.next_review_at,
          interval_days: row.interval_days || 0,
          attempt_count: row.attempt_count,
          correct_count: row.correct_count,
          accuracy: row.attempt_count > 0 ? parseFloat(((row.correct_count / row.attempt_count) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.priority - a.priority) // 优先级降序
      .slice(0, limit);

    // 统计摘要
    const stats = {
      total_due: tasks.filter((t) => t.is_overdue).length,
      total_weak: tasks.filter((t) => t.mastery_score < 40).length,
      avg_priority:
        tasks.length > 0 ? parseFloat((tasks.reduce((s, t) => s + t.priority, 0) / tasks.length).toFixed(3)) : 0,
    };

    return res.json(
      successResponse({ tasks, stats, generated_at: now.toISOString() }, `今日 ${tasks.length} 条复习任务`)
    );
  } catch (err) {
    console.error('[SRS] 每日任务查询失败:', err.message);
    return res.status(500).json(errorResponse('每日任务查询失败，请稍后重试'));
  }
});

/**
 * POST /api/srs/complete — 完成一次复习并更新 SRS 状态
 *
 * 请求体: { knowledge_point_id, is_correct, time_spent_ms }
 */
router.post('/complete', authMiddleware, async (req, res) => {
  const pool = await getDb();
  let client = null;

  try {
    const { knowledge_point_id, is_correct, time_spent_ms } = req.body;

    if (!knowledge_point_id || typeof is_correct !== 'boolean') {
      return res.status(400).json(errorResponse('缺少必填字段: knowledge_point_id (string), is_correct (boolean)'));
    }

    const userEmail = req.user.email;
    const timeSpent = time_spent_ms || 0;

    client = await pool.connect();

    // ── 事务：更新掌握度 + SRS 参数 + 复习日志 ──
    await client.query('BEGIN');

    try {
      // 读取当前状态
      const current = await client.query(
        `SELECT mastery_score, ease_factor, interval_days, attempt_count, correct_count
         FROM student_knowledge_mastery
         WHERE user_email = $1 AND knowledge_point_id = $2`,
        [userEmail, knowledge_point_id]
      );

      const row = current.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return res.status(404).json(errorResponse('未找到该知识点的练习记录'));
      }

      const oldMastery = parseFloat(row.mastery_score);
      const oldEF = parseFloat(row.ease_factor) || 2.5;
      const oldInterval = row.interval_days || 0;

      // ── 计算新的掌握度（复用数据飞轮的 delta 逻辑）──
      // 2026-09-21 (G6): 统一到 0..100。此前此处用 0..1 delta 与 clamp(…,1)，
      // 会把 learning-loop 按 0..100 写下的 60 覆写成 1（见 docs/spec/SPEC-DATA.md §2.5）。
      let masteryDelta;
      if (is_correct) {
        masteryDelta = timeSpent > 60000 ? 5 : 12;
      } else {
        masteryDelta = -15;
      }
      const newMastery = Math.max(0, Math.min(100, oldMastery + masteryDelta));

      // ── SM-2 计算新间隔 ──
      const quality = toQualityScore(is_correct, timeSpent);
      const { newEF, newInterval } = sm2Calculate(quality, oldEF, oldInterval);

      // 计算下次复习日期
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + newInterval);

      // ── 更新 student_knowledge_mastery ──
      await client.query(
        `UPDATE student_knowledge_mastery
         SET mastery_score = $3,
             attempt_count = attempt_count + 1,
             correct_count = correct_count + $4,
             last_practice_at = NOW(),
             last_reviewed_at = NOW(),
             ease_factor = $5,
             interval_days = $6,
             next_review_at = $7,
             updated_at = NOW()
         WHERE user_email = $1 AND knowledge_point_id = $2`,
        [userEmail, knowledge_point_id, newMastery, is_correct ? 1 : 0, newEF, newInterval, nextReview]
      );

      // ── 写入复习日志 ──
      await client.query(
        `INSERT INTO srs_review_log
           (user_email, knowledge_point_id, is_correct, time_spent_ms,
            review_quality, old_mastery, new_mastery, old_interval, new_interval,
            old_ease, new_ease, next_review_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userEmail,
          knowledge_point_id,
          is_correct,
          timeSpent,
          quality,
          oldMastery,
          newMastery,
          oldInterval,
          newInterval,
          oldEF,
          newEF,
          nextReview,
        ]
      );

      await client.query('COMMIT');

      return res.json(
        successResponse(
          {
            knowledge_point_id,
            old_mastery: oldMastery,
            new_mastery: parseFloat(newMastery.toFixed(2)),
            mastery_delta: parseFloat(masteryDelta.toFixed(2)),
            quality,
            old_interval: oldInterval,
            new_interval: newInterval,
            old_ef: oldEF,
            new_ef: newEF,
            next_review_at: nextReview.toISOString(),
          },
          '复习已记录'
        )
      );
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw new Error(`事务回滚: ${txErr.message}`);
    }
  } catch (err) {
    console.error('[SRS] 复习记录失败:', err.message);
    return res.status(500).json(errorResponse('复习记录失败，请稍后重试'));
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/srs/stats — SRS 复习统计概览
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const userEmail = req.user.email;

    // 总复习次数
    const totalResult = await pool.query(`SELECT COUNT(*) as total FROM srs_review_log WHERE user_email = $1`, [
      userEmail,
    ]);

    // 今日复习次数
    const todayResult = await pool.query(
      `SELECT COUNT(*) as today_count FROM srs_review_log
       WHERE user_email = $1 AND created_at >= CURRENT_DATE`,
      [userEmail]
    );

    // 待复习数量
    const dueResult = await pool.query(
      `SELECT COUNT(*) as due_count FROM student_knowledge_mastery
       WHERE user_email = $1 AND next_review_at <= NOW() AND attempt_count > 0`,
      [userEmail]
    );

    // 连续复习天数（streak）
    const streakResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as streak_days
       FROM srs_review_log
       WHERE user_email = $1
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      [userEmail]
    );

    return res.json(
      successResponse({
        total_reviews: parseInt(totalResult.rows[0].total),
        today_reviews: parseInt(todayResult.rows[0].today_count),
        due_count: parseInt(dueResult.rows[0].due_count),
        active_days_30d: parseInt(streakResult.rows[0].streak_days),
      })
    );
  } catch (err) {
    console.error('[SRS] 统计查询失败:', err.message);
    return res.status(500).json(errorResponse('统计查询失败，请稍后重试'));
  }
});

/**
 * POST /api/srs/engine/review — PM §F.2/F.14 复习评分核心 (Round 10 后端补齐)
 *
 * 请求体: { wrong_id, quality 0-5, time_spent_ms, group_results }
 * 返回: { new_ef, new_interval, mastery_delta, next_review_at, group_bonus }
 */
router.post('/review', authMiddleware, async (req, res) => {
  const pool = await getDb();
  let client = null;
  try {
    const { wrong_id, quality, time_spent_ms = 0, group_results = [] } = req.body || {};
    if (!wrong_id || typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json(errorResponse('缺少或非法字段: wrong_id + quality(0-5)'));
    }
    const userEmail = req.user.email;
    // 2026-09-21 (G6): mastery_score 统一到 0..100（与 schema / knowledge / study-plan 一致）。
    // 此前用 0..1 标度：读 60 的旧值 + 0.08 后被 clamp 成 1，等于把掌握度清零。见 SPEC-DATA §2.5。
    const MASTERY_DELTA_MAP = { 0: -15, 1: -10, 2: -5, 3: 4, 4: 8, 5: 12 };
    const EF_INIT = 2.5;
    client = await pool.connect();
    await client.query('BEGIN');
    const wrongQ = await client.query(
      `SELECT id, subject_code, knowledge_point_id, knowledge_point_name FROM wrong_questions WHERE id=$1 AND user_email=$2`,
      [wrong_id, userEmail]
    );
    if (wrongQ.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(errorResponse('错题不存在或不属于当前用户'));
    }
    const wq = wrongQ.rows[0];
    const kpId = wq.knowledge_point_id;
    // 文案可操作化: 指向用户下一步（去错题本补知识点），不暴露内部字段/表名。
    if (!kpId) { await client.query('ROLLBACK'); return res.status(400).json(errorResponse('该题尚未关联知识点，无法开始复习。请先到错题本为它补充知识点，再回来复习。')); }
    const cur = await client.query(
      `SELECT mastery_score, ease_factor, interval_days FROM student_knowledge_mastery WHERE user_email=$1 AND knowledge_point_id=$2`,
      [userEmail, kpId]
    );
    const oldEF = cur.rows[0] ? parseFloat(cur.rows[0].ease_factor) : EF_INIT;
    const oldInterval = cur.rows[0] ? (cur.rows[0].interval_days || 0) : 0;
    const oldMastery = cur.rows[0] ? parseFloat(cur.rows[0].mastery_score) : 50;
    let groupBonus = 0;
    let effectiveQuality = quality;
    if (Array.isArray(group_results) && group_results.length > 0) {
      const simResults = group_results.filter(r => r.card_index >= 2 && r.card_index <= 4);
      if (simResults.length === 3) {
        const correctCount = simResults.filter(r => r.correct).length;
        if (correctCount >= 2) groupBonus = 5;
        if (correctCount === 0) effectiveQuality = Math.min(2, quality);
      }
    }
    const { newEF, newInterval } = sm2Calculate(effectiveQuality, oldEF, oldInterval);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);
    const baseDelta = MASTERY_DELTA_MAP[effectiveQuality] ?? 0;
    const totalDelta = parseFloat((baseDelta + groupBonus).toFixed(3));
    const newMastery = Math.max(0, Math.min(100, oldMastery + totalDelta));
    await client.query(
      `INSERT INTO student_knowledge_mastery
         (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count,
          last_practice_at, last_reviewed_at, ease_factor, interval_days, next_review_at, updated_at)
       VALUES ($1,$2,$3,1,$4,NOW(),NOW(),$5,$6,$7,NOW())
       ON CONFLICT (user_email, knowledge_point_id) DO UPDATE SET
         mastery_score=$3, attempt_count=student_knowledge_mastery.attempt_count+1,
         correct_count=student_knowledge_mastery.correct_count+$4,
         last_practice_at=NOW(), last_reviewed_at=NOW(),
         ease_factor=$5, interval_days=$6, next_review_at=$7, updated_at=NOW()`,
      [userEmail, kpId, newMastery, effectiveQuality >= 3 ? 1 : 0, newEF, newInterval, nextReview]
    );
    await client.query(
      `INSERT INTO srs_review_log
         (user_email, knowledge_point_id, is_correct, time_spent_ms,
          review_quality, old_mastery, new_mastery, old_interval, new_interval,
          old_ease, new_ease, next_review_at, wrong_id, group_bonus, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
      [userEmail, kpId, effectiveQuality >= 3, time_spent_ms,
       effectiveQuality, oldMastery, newMastery, oldInterval, newInterval,
       oldEF, newEF, nextReview, wrong_id, groupBonus]
    );
    await client.query('COMMIT');
    return res.json(successResponse({
      wrong_id, knowledge_point_id: kpId,
      new_ef: newEF, new_interval: newInterval,
      mastery_delta: totalDelta, base_delta: baseDelta,
      group_bonus: groupBonus, effective_quality: effectiveQuality,
      next_review_at: nextReview.toISOString(),
    }, `q=${effectiveQuality} · 间隔 ${newInterval}d · mastery ${totalDelta >= 0 ? '+' : ''}${totalDelta}`));
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch {}
    console.error('[SRS] review 失败:', err.message);
    return res.status(500).json(errorResponse('复习记录失败，请稍后重试'));
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/srs/engine/queue — PM §F.2 今日 SRS 队列 (review-session 入口)
 *
 * 返回 [{ wrong_id, group: [主错题 + 3 相似题] }]
 */
router.get('/queue', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const userEmail = req.user.email;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const tasks = await pool.query(
      `SELECT wq.id AS wrong_id, wq.subject_code,
              wq.knowledge_point_id AS kp_id,
              wq.knowledge_point_name AS kp_name,
              wq.content AS stem,
              wq.user_answer, wq.correct_answer,
              wq.difficulty,
              skm.mastery_score, skm.ease_factor, skm.interval_days
       FROM wrong_questions wq
       LEFT JOIN student_knowledge_mastery skm
         ON skm.user_email = wq.user_email
         AND skm.knowledge_point_id = wq.knowledge_point_id
       WHERE wq.user_email = $1
         AND wq.mastered = 0
         AND (skm.next_review_at <= NOW() OR skm.next_review_at IS NULL)
       ORDER BY skm.mastery_score ASC NULLS LAST
       LIMIT $2`,
      [userEmail, limit]
    );
    const out = [];
    for (const row of tasks.rows) {
      const kpId = row.kp_id;
      let similar = [];
      if (kpId) {
        const sims = await pool.query(
          `SELECT id, data FROM similar_questions WHERE data::text LIKE $1 ORDER BY RANDOM() LIMIT 3`,
          [kpId]
        );
        similar = sims.rows;
      }
      out.push({
        wrong_id: row.wrong_id,
        subject_code: row.subject_code,
        kp_id: kpId,
        kp_name: row.kp_name,
        stem: row.stem,
        user_answer: row.user_answer,
        correct_answer: row.correct_answer,
        mastery_score: row.mastery_score ? parseFloat(row.mastery_score) : 0,
        ease_factor: row.ease_factor ? parseFloat(row.ease_factor) : 2.5,
        is_weak: (row.mastery_score || 0) < 50,
        group: [
          { card_index: 1, kind: 'wrong', qid: row.wrong_id, stem: row.stem, options: null, difficulty: 3 },
          ...similar.map((s, i) => ({ card_index: i + 2, kind: 'similar', ...s })),
        ],
        group_size: 1 + similar.length,
      });
    }
    return res.json(successResponse({
      queue: out, total: out.length,
      generated_at: new Date().toISOString(),
    }, `今日 ${out.length} 组复习 (1 组 = 1 错题 + 3 相似)`));
  } catch (err) {
    console.error('[SRS] queue 失败:', err.message);
    return res.status(500).json(errorResponse('复习队列查询失败，请稍后重试'));
  }
});

export { sm2Calculate, toQualityScore };
export default router;
