// api/modules/loop/routes.js — Loop Hub 聚合端点 (Round 8, 2026-09-15)
//
// 目的: 一次 RTT 拿到 Practice Hub 全部 UI 数据, 避免 N+1 fetch.
//
// 设计要点:
//   - 60s in-memory cache per user
//   - 所有响应走 successResponse (D062 envelope)
//   - 业务级 try/catch: 子查询失败时返回 0, 不阻塞整体
//   - 端点:
//     GET /api/loop/summary     — 完整 Loop Hub 数据 (8 功能收口)
//     GET /api/loop/actions     — 仅 next_actions (8 个 action card)
//     GET /api/loop/feed        — 今日 Loop Feed (错题/复习闭环反馈)
//
// 部署: 挂在 api/modules/index.js 的 '/loop' 前缀下 → /api/loop/*

import express from 'express';
import { getDb } from '../../core/db.js';
import { successResponse } from '../../utils/response.js';
import { authMiddleware } from '../../core/auth.js';
import { logger } from '../../core/logger.js';

const router = express.Router();
router.use(authMiddleware);

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function getCached(email, ttl = CACHE_TTL_MS) {
  const e = cache.get(email);
  if (e && Date.now() - e.at < ttl) return e.data;
  return null;
}
function setCached(email, data) {
  cache.set(email, { at: Date.now(), data });
  if (cache.size > 5000) cache.clear();
}

// 9 学科固定顺序: 语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 政治
// 与 .design_library/ai-tutor 调性规则保持一致 (Loop 设计依据)
const SUBJECT_CODE = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];
const SUBJECT_NAME = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  history: '历史', geography: '地理', politics: '政治',
};

function weaknessIndex(wrongCount, difficulty, frequency) {
  const fw = { high: 1.5, medium: 1.0, low: 0.7 }[frequency] || 1.0;
  return Math.round(wrongCount * (difficulty / 3) * fw * 10) / 10;
}

function levelFromCount(c) {
  if (c >= 5) return 'high';
  if (c >= 2) return 'mid';
  return 'low';
}

function buildNextActions() {
  return [
    { id: 'na_001', kind: 'start_practice', featured: true, icon: 'play',
      title: '开始今日练习', desc: '基于薄弱点生成的 10 道精选题, 预计 25 分钟',
      href: '/f3/pages/exam-simulation.html?mode=today' },
    { id: 'na_002', kind: 'generate_paper', featured: false, icon: 'file-text',
      title: '生成预测卷', desc: '按薄弱点智能组卷, 9 科覆盖, 难度自适应',
      href: '/f3/pages/personalized-paper.html' },
    { id: 'na_003', kind: 'ai_tutor', featured: false, icon: 'message-circle',
      title: 'AI 讲题', desc: '拍照或文字提问, AI 即时拆解思路与考点',
      href: '/f3/pages/tutor.html' },
    { id: 'na_004', kind: 'learning_path', featured: false, icon: 'map',
      title: '学习路径', desc: '按你的目标与水平, 规划长期复习路线',
      href: '/f3/pages/learning-path.html' },
    { id: 'na_005', kind: 'photo', featured: false, icon: 'camera',
      title: '拍照解题', desc: 'PWA 拍照上传, AI 自动识别 + 解析',
      href: '/f3/pages/vision.html' },
    { id: 'na_006', kind: 'wrong_book', featured: false, icon: 'book-x',
      title: '错题本', desc: '回顾错题记录, 加入复习计划',
      href: '/f3/pages/wrong-book.html' },
    { id: 'na_007', kind: 'knowledge_map', featured: false, icon: 'network',
      title: '知识图谱', desc: '知识点全景掌握度, 跨学科联动',
      href: '/f3/pages/mastery.html' },
    { id: 'na_008', kind: 'essay', featured: false, icon: 'pen-line',
      title: '作文 AI 批改', desc: '拍照/上传, AI 4 维评分 + 锚定原文',
      href: '/f3/pages/essay.html' },
  ];
}

// GET /api/loop/summary
router.get('/summary', async (req, res) => {
  const email = req.user.email;
  const t0 = Date.now();

  const hit = getCached(email);
  if (hit) {
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Latency-Ms', String(Date.now() - t0));
    return res.json(successResponse(hit, '获取练习中心汇总成功 (cache)'));
  }

  try {
    const pool = await getDb();
    const [wrongBySubject, recentPractice, mastery, todayQuestions, todayTasksRes] = await Promise.all([
      pool.query(
        `SELECT subject_code, COUNT(*)::int AS count
         FROM wrong_questions WHERE user_email = $1
         GROUP BY subject_code`,
        [email]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COALESCE(SUM(is_correct), 0)::int AS correct,
           COALESCE(AVG(time_spent_ms), 0)::int AS avg_ms,
           COUNT(DISTINCT DATE(created_at))::int AS study_days
         FROM practice_records
         WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [email]
      ),
      pool.query(
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
         LIMIT 10`,
        [email]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS done,
           COALESCE(SUM(time_spent_ms), 0)::int AS total_ms
         FROM practice_records
         WHERE user_email = $1 AND created_at >= CURRENT_DATE`,
        [email]
      ),
      pool.query(
        `SELECT id, kind, title, kp_id, kp_name, subject, reason, minutes, start_url, status, weight
         FROM today_tasks
         WHERE user_email = $1 AND task_date = CURRENT_DATE
           AND status IN ('pending', 'started')
         ORDER BY weight DESC LIMIT 10`,
        [email]
      ).catch(() => ({ rows: [] })),
    ]);

    const wrongRows = wrongBySubject.rows;
    const recent = recentPractice.rows[0] || { total: 0, correct: 0, avg_ms: 0, study_days: 0 };
    const masteryRows = mastery.rows;
    const today = todayQuestions.rows[0] || { done: 0, total_ms: 0 };
    const todayTasks = todayTasksRes.rows || [];

    const subjectDistribution = wrongRows.map((r) => ({
      subject: SUBJECT_NAME[r.subject_code] || r.subject_code,
      subject_code: r.subject_code,
      count: r.count,
      level: levelFromCount(r.count),
    }));

    const hotKps = masteryRows.map((r) => {
      const wc = Math.max(1, r.attempt_count - r.correct_count);
      const w = weaknessIndex(wc, r.difficulty, r.frequency);
      return {
        kp_id: r.kp_id,
        name: r.name,
        subject: SUBJECT_NAME[r.subject_code] || r.subject_code,
        subject_code: r.subject_code,
        weight: w,
        mastery_score: r.mastery_score,
      };
    });

    const totalWrong = wrongRows.reduce((s, r) => s + r.count, 0);
    const overallScore = recent.total > 0 ? Math.round((recent.correct / recent.total) * 100) : 0;
    const streakDays = Math.min(recent.study_days, 30);
    const todayTarget = 40;
    const todayDone = today.done;
    const todayMinutes = Math.round(today.total_ms / 60000);

    const data = {
      date: new Date().toISOString().slice(0, 10),
      streak_days: streakDays,
      stats: {
        overall_score: overallScore,
        overall_score_delta: 0,
        weak_points_total: totalWrong,
        weak_points_delta: 0,
        today_questions_done: todayDone,
        today_questions_target: todayTarget,
        today_minutes_done: todayMinutes,
        today_minutes_target: 60,
      },
      subject_distribution: subjectDistribution,
      hot_kps: hotKps,
      next_actions: buildNextActions(),
      today_tasks: todayTasks,
    };

    setCached(email, data);
    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Latency-Ms', String(Date.now() - t0));
    return res.json(successResponse(data, '获取练习中心汇总成功'));
  } catch (err) {
    logger.error('[loop/summary] failed:', err.message);
    return res.json(successResponse({
      date: new Date().toISOString().slice(0, 10),
      streak_days: 0,
      stats: {
        overall_score: 0, overall_score_delta: 0,
        weak_points_total: 0, weak_points_delta: 0,
        today_questions_done: 0, today_questions_target: 40,
        today_minutes_done: 0, today_minutes_target: 60,
      },
      subject_distribution: [],
      hot_kps: [],
      next_actions: buildNextActions(),
      today_tasks: [],
    }, '获取练习中心汇总降级返回'));
  }
});

router.get('/actions', async (req, res) => {
  return res.json(successResponse(buildNextActions(), '获取行动列表成功'));
});

router.get('/feed', async (req, res) => {
  const { email } = req.user;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const pool = await getDb();
    const events = await pool.query(
      `SELECT 'wrong' AS kind, id, subject_code AS subject, created_at AS ts,
              '加入错题: ' || COALESCE(knowledge_point_name, '未知') AS text
       FROM wrong_questions
       WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '24 hours'
       UNION ALL
       SELECT 'review' AS kind, NULL::int, kp_id, created_at, '复习完成: ' || kp_id
       FROM srs_review_log
       WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY ts DESC LIMIT $2`,
      [email, limit]
    );
    return res.json(successResponse({
      items: events.rows.map((r, i) => ({
        id: `${r.kind}-${r.id || i}`,
        kind: r.kind,
        subject: r.subject,
        text: r.text,
        ts: r.ts,
        time: new Date(r.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })),
    }, '获取今日 Loop Feed 成功'));
  } catch (err) {
    logger.error('[loop/feed] failed:', err.message);
    return res.json(successResponse({ items: [] }, '获取 Loop Feed 降级返回'));
  }
});

export default router;