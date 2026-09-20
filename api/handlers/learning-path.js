/* ============================================================================
 * GET /api/learning-path/current?subject={subject}
 *
 * 用途：今日学习页面（frontend/learning-path.html）数据源
 * 鉴权：必须（JWT Bearer Token，由 server.js 注入 req.user.email）
 * 频率限制：与 /api/ 一致（已登录 120/min）
 *
 * 性能目标：< 200ms（无 LLM 阻塞，4 个并行 SQL）
 *
 * 响应契约：docs/api/learning-path-current.ts
 *   LearningPathResponse
 *     ├ data
 *     │   ├ subject
 *     │   ├ recommendation_reason
 *     │   ├ cited_stats[]
 *     │   ├ global_progress_pct
 *     │   ├ stages[4]
 *     │   ├ today_task | null
 *     │   └ empty_state? (无错题 / 100% 完成 时填充)
 *     └ meta (request_id / timestamp / cache_ttl_seconds / server_now)
 *
 * 实现要点：
 *   · 4 阶段顺序固定：基础巩固 → 方法训练 → 变式应用 → 综合提升
 *   · 状态映射：global_progress_pct ∈ [0,25)→current=1, [25,50)→2, [50,75)→3, [75,100)→4, =100→全部completed
 *   · today_task 优先级：SRS 到期复习 > 当前阶段最低掌握度练习 > null
 *   · empty_state 触发：① 无错题且无 mastery 数据 ② 100% 完成本周计划
 *
 * 同时保留旧 endpoint（向后兼容）：
 *   GET /api/learning-path?subject={subject}  →  旧 shape（phases / analysis / recommendation）
 *
 * 测试：tests/api/learning-path-current.test.js
 * ============================================================================ */

import { getDb } from '../core/db.js';
import { successJson, errorJson } from '../utils/response.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { logger } from '../core/logger.js';

const VALID_SUBJECTS = new Set([
  'math', 'physics', 'chemistry', 'chinese', 'english', 'politics',
  'biology', 'history', 'geography',
]);

const SUBJECT_NAME = {
  math: '数学', physics: '物理', chemistry: '化学', chinese: '语文',
  english: '英语', politics: '政治', biology: '生物', history: '历史', geography: '地理',
};

// 4 阶段固定结构（P11 契约）
const STAGE_STRUCTURE = [
  { id: 'basic',      name: '基础巩固', description: '夯实基础概念与图像判读' },
  { id: 'method',     name: '方法训练', description: '掌握典型题型的解题方法' },
  { id: 'variant',    name: '变式应用', description: '含参、动点、几何综合等变式' },
  { id: 'comprehensive', name: '综合提升', description: '跨章节综合与压轴题' },
];

// ============================================================================
// 公共处理函数（Pure，可单测）
// ============================================================================

/**
 * 计算 4 阶段状态（基于全局进度 0-100）
 * @param {number} progressPct
 * @returns {Array<{id, name, status, progress_pct?}>}
 */
export function buildStages(progressPct) {
  const p = Math.max(0, Math.min(100, Math.round(progressPct || 0)));

  // 100% 完成：全部 completed
  if (p >= 100) {
    return STAGE_STRUCTURE.map(s => ({ id: s.id, name: s.name, status: 'completed', description: s.description }));
  }

  // 当前阶段：第几个 25% 区间
  const currentIdx = Math.min(3, Math.floor(p / 25));
  return STAGE_STRUCTURE.map((s, idx) => {
    if (idx < currentIdx) return { id: s.id, name: s.name, status: 'completed', description: s.description };
    if (idx === currentIdx) {
      const stageProgress = Math.round((p - currentIdx * 25) / 25 * 100);
      return {
        id: s.id, name: s.name, status: 'current',
        progress_pct: stageProgress,
        description: s.description,
      };
    }
    return { id: s.id, name: s.name, status: 'locked', description: s.description };
  });
}

/**
 * 生成 AI 推荐理由（规则引擎，无 LLM）
 * 优先级：高频错因 > 最低掌握度 > 通用鼓励
 * @param {object} ctx
 * @param {string} ctx.subjectName
 * @param {Array<{name, mastery, recent_wrong_count, last_practiced_at}>} ctx.knowledgePoints
 * @param {number} ctx.recentWrongTotal (近 7 天错题数)
 * @param {number} ctx.totalKps
 * @returns {string} 1-2 句中文理由
 */
export function generateRecommendation(ctx) {
  const { subjectName, knowledgePoints = [], recentWrongTotal = 0 } = ctx;

  // 找近 7 天错误 ≥ 3 的 KP
  const hotKps = knowledgePoints
    .filter(kp => (kp.recent_wrong_count || 0) >= 3)
    .sort((a, b) => (b.recent_wrong_count || 0) - (a.recent_wrong_count || 0));
  if (hotKps[0]) {
    const kp = hotKps[0];
    return `你最近在「${kp.name}」相关题目中出现了 ${kp.recent_wrong_count} 次错误，建议先花 2-3 天巩固${kp.name}的基础，再进入综合应用。`;
  }

  // 找最低掌握度
  const weakest = knowledgePoints
    .filter(kp => typeof kp.mastery === 'number' && kp.mastery < 80)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0];
  if (weakest && recentWrongTotal > 0) {
    return `你的「${weakest.name}」掌握度还比较低（${Math.round(weakest.mastery)}%），建议先把这块的基础打牢，再开始新的内容。`;
  }

  // 通用鼓励（新生或全部已掌握）
  if (recentWrongTotal === 0) {
    return `${subjectName}还没有错题记录，建议先做几道题让 aitutor 了解你的水平，再生成专属学习路径。`;
  }
  return `继续按当前路径学习，aitutor 会根据你的进度自动调整下一阶段的难度。`;
}

/**
 * 生成 cited_stats（chip 形式展示的引用依据）
 * @param {object} ctx
 * @returns {Array<{icon, label, href?}>} 0-4 项
 */
export function buildCitedStats(ctx) {
  const { knowledgePoints = [], recentWrongTotal = 0 } = ctx;
  const stats = [];
  const hot = knowledgePoints.find(kp => (kp.recent_wrong_count || 0) >= 3);
  if (hot) {
    stats.push({ icon: 'alert-triangle', label: `近 7 天 ${hot.recent_wrong_count} 次错` });
  }
  const weak = knowledgePoints
    .filter(kp => typeof kp.mastery === 'number')
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0];
  if (weak && typeof weak.mastery === 'number' && weak.mastery < 80) {
    stats.push({ icon: 'bar-chart-3', label: `${weak.name} 掌握度 ${Math.round(weak.mastery)}%` });
  }
  if (recentWrongTotal > 0) {
    stats.push({ icon: 'clock', label: `共 ${recentWrongTotal} 条错题` });
  }
  return stats.slice(0, 4);
}

/**
 * 挑选今日任务
 * 优先级：SRS 到期复习（next_review_at ≤ now）> 当前阶段最低掌握度练习 > null
 * @param {Array<object>} srsDueKps - SRS 到期的 KP 列表（按 next_review_at 升序）
 * @param {Array<object>} currentStageKps - 当前阶段的 KP 列表（含 mastery）
 * @returns {object|null} TodayTask
 */
export function pickTodayTask(srsDueKps = [], currentStageKps = [], subject = 'math') {
  // 优先级 1：SRS 到期复习
  if (srsDueKps.length > 0) {
    const kp = srsDueKps[0];
    return {
      id: `task-review-${kp.knowledge_point_id}-${Date.now()}`,
      type: 'review',
      title: `复习「${kp.name}」相关错题`,
      reason: `这${kp.due_count || '些'}道题到了复习时间，按 SRS 间隔复习最稳。`,
      estimated_minutes: 8,
      topic: kp.name,
      target_url: `/review.html?session=auto&kp=${encodeURIComponent(kp.knowledge_point_id)}`,
      knowledge_point_id: kp.knowledge_point_id,
      question_count: kp.due_count || 3,
      difficulty: kp.difficulty || 3,
    };
  }

  // 优先级 2：当前阶段最低掌握度 KP 的练习
  if (currentStageKps.length > 0) {
    const candidates = [...currentStageKps]
      .filter(kp => typeof kp.mastery === 'number')
      .sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
    const kp = candidates[0] || currentStageKps[0];
    if (kp) {
      return {
        id: `task-practice-${kp.knowledge_point_id}-${Date.now()}`,
        type: 'practice',
        title: `练习「${kp.name}」基础题`,
        reason: `这是当前阶段的薄弱点，先做 3 道基础题巩固一下。`,
        estimated_minutes: 10,
        topic: kp.name,
        target_url: `/practice.html?kp=${encodeURIComponent(kp.knowledge_point_id)}`,
        knowledge_point_id: kp.knowledge_point_id,
        question_count: 3,
        difficulty: kp.difficulty || 3,
      };
    }
  }

  // 优先级 3：无任务
  return null;
}

/**
 * 判断是否触发 EmptyState
 * @param {object} ctx
 * @returns {object|null} EmptyState payload 或 null
 */
export function checkEmptyState(ctx) {
  const {
    subject, subjectName, hasData, globalProgressPct, todayTask
  } = ctx;

  // 情况 1：100% 完成（即使有数据）
  if (globalProgressPct >= 100) {
    return {
      scenario: 'newUser',
      title: '本周任务都完成啦',
      description: '明天 09:00 会开启新一周的学习计划。先去错题本复习巩固记忆吧。',
      primary_action:   { label: '去看错题本', target_url: '/wrong-book.html' },
      secondary_action: { label: '回到首页',   target_url: '/dashboard.html' },
    };
  }

  // 情况 2：完全无数据（新生）
  if (!hasData) {
    return {
      scenario: 'newUser',
      title: '学习路径还没准备好',
      description: '先做几道诊断题，aitutor 就能为你定制专属学习路径。',
      primary_action:   { label: '去诊断一下', target_url: '/onboarding.html?step=diagnose' },
      secondary_action: { label: '去拍照录题', target_url: '/photo-search.html' },
    };
  }

  return null;
}

/**
 * 整合查询结果 → 完整 LearningPathData
 * @param {object} raw - 来自数据库的 4 个并行查询结果
 * @returns {object} LearningPathData
 */
export function composeLearningPathData(raw, subject) {
  const { masteryRows = [], kpRows = [], wrongRows = [], reviewRows = [] } = raw;
  const subjectName = SUBJECT_NAME[subject] || subject;

  // 合并 mastery + kp
  const masteryMap = new Map(masteryRows.map(m => [m.knowledge_point_id, m]));
  const knowledgePoints = kpRows.map(kp => {
    const m = masteryMap.get(kp.id) || {};
    return {
      knowledge_point_id: kp.id,
      name: kp.name,
      mastery: m.mastery_score == null ? null : Number(m.mastery_score),
      recent_wrong_count: m.recent_wrong_count || 0,
      last_practiced_at: m.last_practice_at,
      next_review_at: m.next_review_at,
      due_count: m.due_count || 0,
      difficulty: kp.difficulty,
    };
  });

  // 计算总错题数
  const recentWrongTotal = wrongRows.length;
  const hasData = masteryRows.length > 0 || recentWrongTotal > 0;

  // 计算全局进度（基于 mastery 平均值，clamp 到 [0, 100]）
  const masteredKps = knowledgePoints.filter(kp => typeof kp.mastery === 'number');
  const rawPct = masteredKps.length > 0
    ? masteredKps.reduce((s, kp) => s + (kp.mastery || 0), 0) / masteredKps.length
    : 0;
  const globalProgressPct = Math.max(0, Math.min(100, Math.round(rawPct)));

  // 找 SRS 到期复习（next_review_at ≤ now）
  const now = Date.now();
  const srsDueKps = knowledgePoints
    .filter(kp => kp.next_review_at && new Date(kp.next_review_at).getTime() <= now)
    .sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));

  // 当前阶段的 KP（按 mastery 升序，限制 5 个）
  const currentStageKps = knowledgePoints
    .filter(kp => typeof kp.mastery === 'number' && kp.mastery < 80)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
    .slice(0, 5);

  // 推荐理由 + 引用 chip
  const recommendationReason = generateRecommendation({ subjectName, knowledgePoints, recentWrongTotal });
  const citedStats = buildCitedStats({ knowledgePoints, recentWrongTotal });

  // 4 阶段状态
  const stages = buildStages(globalProgressPct);

  // 今日任务
  const todayTask = pickTodayTask(srsDueKps, currentStageKps, subject);

  // EmptyState 检测
  const emptyState = checkEmptyState({
    subject, subjectName, hasData, globalProgressPct, todayTask
  });

  return {
    subject,
    recommendation_reason: recommendationReason,
    cited_stats: citedStats,
    global_progress_pct: globalProgressPct,
    stages,
    today_task: todayTask,
    ...(emptyState ? { empty_state: emptyState } : {}),
  };
}

// ============================================================================
// HTTP Handler · P11 新版（GET /api/learning-path/current）
// ============================================================================

/**
 * GET /api/learning-path/current?subject=math
 */
export async function getCurrentLearningPath(req, res) {
  if (req.method !== 'GET') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }

  const email = req.user && req.user.email;
  if (!email) {
    return errorJson(res, ErrorCode.AUTH_NOT_LOGIN);
  }

  const subject = String(req.query.subject || 'math');
  if (!VALID_SUBJECTS.has(subject)) {
    return errorJson(res, ErrorCode.VALIDATION_INVALID_ENUM,
      `Unsupported subject: ${subject}. Valid: ${Array.from(VALID_SUBJECTS).join(', ')}`);
  }

  const requestId = req.requestId || `req_lpc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTs = Date.now();

  try {
    const pool = await getDb();

    // 4 个查询并行（target < 200ms）
    const [masteryRes, kpRes, wrongRes, srsDueRes] = await Promise.all([
      pool.query(
        `SELECT
           knowledge_point_id, mastery_score,
           next_review_at, last_practice_at,
           (SELECT COUNT(*) FROM srs_review_log
            WHERE user_email = $1 AND knowledge_point_id = student_knowledge_mastery.knowledge_point_id
              AND is_correct = false
              AND created_at > NOW() - INTERVAL '7 days') AS recent_wrong_count,
           (SELECT COUNT(*) FROM srs_review_log
            WHERE user_email = $1 AND knowledge_point_id = student_knowledge_mastery.knowledge_point_id
              AND next_review_at <= NOW()) AS due_count
         FROM student_knowledge_mastery
         WHERE user_email = $1
           AND (next_review_at <= NOW() OR mastery_score < 80)
         ORDER BY COALESCE(next_review_at, '9999-12-31'::timestamptz) ASC
         LIMIT 20`,
        [email]
      ),
      pool.query(
        `SELECT id, name, difficulty
         FROM knowledge_points
         WHERE subject = $1
         ORDER BY difficulty ASC
         LIMIT 20`,
        [subject]
      ),
      pool.query(
        `SELECT id, data, timestamp
         FROM wrong_questions
         WHERE user_email = $1
           AND timestamp > NOW() - INTERVAL '30 days'
         ORDER BY timestamp DESC
         LIMIT 50`,
        [email]
      ),
      // 备用：直接查 srs_review_log 用于 due_count 兜底
      pool.query(
        `SELECT knowledge_point_id, COUNT(*) AS due
         FROM srs_review_log
         WHERE user_email = $1
           AND next_review_at <= NOW()
         GROUP BY knowledge_point_id
         LIMIT 10`,
        [email]
      ),
    ]);

    const data = composeLearningPathData(
      {
        masteryRows: masteryRes.rows,
        kpRows: kpRes.rows,
        wrongRows: wrongRes.rows,
        reviewRows: srsDueRes.rows,
      },
      subject
    );

    const duration = Date.now() - startTs;
    logger.info?.('[learning-path/current]', {
      requestId, subject, duration_ms: duration,
      mastery_count: masteryRes.rows.length,
      kp_count: kpRes.rows.length,
      wrong_count: wrongRes.rows.length,
      progress: data.global_progress_pct,
      has_today: !!data.today_task,
      has_empty: !!data.empty_state,
    });

    return successJson(res, data, 'ok', {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      api_version: 'v1',
      cache_ttl_seconds: 300,
      server_now: new Date().toISOString(),
    });
  } catch (err) {
    logger.error?.('[learning-path/current] failed', {
      requestId, subject, error: err.message, stack: err.stack
    });
    return errorJson(res, ErrorCode.DATABASE_ERROR, 'Failed to load learning path');
  }
}

// ============================================================================
// 向后兼容 · 旧 handler（GET /api/learning-path?subject=...）
// ============================================================================

/**
 * @deprecated 旧版 API，由 P11 `getCurrentLearningPath` 取代
 * 保留仅供 legacy/learning-path.html 调用，将在 D070 sunset 时移除
 */
export default async function legacyLearningPathHandler(req, res) {
  if (req.method !== 'GET') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }
  // 直接复用新逻辑，但仅返回旧 shape（phases / analysis）
  req.query = req.query || {};
  // 简单委托：调用新 handler 读取后再映射回旧 shape
  const newRes = {
    status: () => newRes,
    json: (data) => {
      if (!data.success) {
        return legacyReply(res, 500, { success: false, message: data.message });
      }
      const d = data.data;
      return legacyReply(res, 200, {
        success: true,
        subject: d.subject,
        subjectName: SUBJECT_NAME[d.subject] || d.subject,
        totalWeeks: d.stages.length,
        phases: d.stages.map((s, i) => ({
          week: i + 1, focus: s.name, topics: [], dailyGoal: s.description, difficulty: 'medium',
        })),
        recommendation: d.recommendation_reason,
        analysis: {
          weakPoints: [], strongPoints: [], totalWrongQuestions: 0, totalKnowledgePoints: 0,
        },
      });
    },
  };
  return getCurrentLearningPath(req, newRes);
}

function legacyReply(res, status, body) {
  return res.status(status).json(body);
}
