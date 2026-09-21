/**
 * api/learning-loop.js — 数据飞轮：学习行为反馈与掌握度动态更新引擎
 *
 * 核心能力：
 *   POST /api/loop/feedback — 接收学生交互结果，动态更新掌握度 + 图谱涟漪效应
 *   POST /api/loop/batch    — 批量反馈（考试模式结束后一次性提交）
 *   GET  /api/loop/mastery  — 获取学生全量掌握度概览
 *
 * 算法设计：
 *   1. 基础分数更新：根据 is_correct + hint_requested 组合计算 delta
 *   2. 图谱涟漪效应：通过 Apache AGE 查询前置/后置节点，传播微小奖惩
 *   3. 事务一致性：所有关系表写入在同一个 PostgreSQL 事务内完成
 *
 * 架构边界：
 *   - 读取方案 A 图谱（只读 Cypher）→ 发现涟漪节点
 *   - 写入 student_knowledge_mastery（方案 C 业务表）→ 不修改图谱拓扑
 */

import express from 'express';
import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';
import { queryStudentMastery } from './tutor-agent.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_NAME = 'knowledge_graph';
const AGE_INIT_SQL = `LOAD 'age'; SET search_path = ag_catalog, "$user", public;`;

/** 基础分数更新增量 */
const DELTA = {
  CORRECT_NO_HINT: 15,
  CORRECT_WITH_HINT: 5,
  INCORRECT: -20,
};

/** 涟漪效应增量（远小于直接反馈） */
const RIPPLE = {
  UPWARD_BOOST: 2, // 向上巩固：掌握当前 → 奖励前置
  DOWNWARD_PENALTY: -5, // 向下预警：当前薄弱 → 惩罚后置
};

/** 涟漪触发阈值 */
const RIPPLE_THRESHOLD = {
  UPWARD_MIN: 80, // 得分后 ≥ 80 才触发向上巩固
  DOWNWARD_MAX: 40, // 得分后 ≤ 40 才触发向下预警
};

// ─────────────────────────────────────────────────────────────────────────────
// Apache AGE 辅助（复用 tutor-agent.js 的查询模式，只读）
// ─────────────────────────────────────────────────────────────────────────────

async function borrowAgeClient(pool) {
  const client = await pool.connect();
  await client.query(AGE_INIT_SQL);
  return client;
}

function parseAgtype(val) {
  if (val === null || val === undefined) return null;
  try {
    return JSON.parse(val);
  } catch {
    return String(val);
  }
}

/**
 * 查询直接前置节点（当前节点依赖的，1 跳 DEPENDS_ON）
 * Cypher: (current)-[:DEPENDS_ON]->(pre)
 */
async function queryUpstreamNodes(client, knowledgePointId) {
  try {
    const result = await client.query(
      `SELECT * FROM cypher('${GRAPH_NAME}', $$
         MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(pre:KnowledgePoint)
         RETURN pre.id
       $$) AS (id agtype)`,
      [knowledgePointId]
    );
    return result.rows.map((r) => parseAgtype(r.id)).filter(Boolean);
  } catch (err) {
    console.warn(`[LearningLoop] 上游查询失败 (kp=${knowledgePointId}): ${err.message}`);
    return [];
  }
}

/**
 * 查询直接后置节点（依赖当前节点的，反向 1 跳）
 * Cypher: (post)-[:DEPENDS_ON]->(current)
 */
async function queryDownstreamNodes(client, knowledgePointId) {
  try {
    const result = await client.query(
      `SELECT * FROM cypher('${GRAPH_NAME}', $$
         MATCH (post:KnowledgePoint)-[:DEPENDS_ON]->(kp:KnowledgePoint {id: $1})
         RETURN post.id
       $$) AS (id agtype)`,
      [knowledgePointId]
    );
    return result.rows.map((r) => parseAgtype(r.id)).filter(Boolean);
  } catch (err) {
    console.warn(`[LearningLoop] 下游查询失败 (kp=${knowledgePointId}): ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心算法
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 计算基础分数增量
 * @param {boolean} isCorrect - 是否答对
 * @param {boolean} hintRequested - 是否请求了提示
 * @returns {number} delta 增量
 */
function computeDelta(isCorrect, hintRequested) {
  if (isCorrect) {
    return hintRequested ? DELTA.CORRECT_WITH_HINT : DELTA.CORRECT_NO_HINT;
  }
  return DELTA.INCORRECT;
}

/**
 * 将分数限制在 [0, 1] 区间
 */
function clampScore(score) {
  return Math.max(0, Math.min(1, score));
}

/**
 * 执行单次反馈的完整流水线：基础更新 + 图谱涟漪
 *
 * @param {object} client - AGE 已初始化的数据库客户端（同时用于 Cypher 和 SQL）
 * @param {object} feedback - 单条反馈
 * @param {string} feedback.userEmail - 学生邮箱
 * @param {string} feedback.knowledge_point_id - 知识点 ID
 * @param {boolean} feedback.is_correct - 是否答对
 * @param {number} feedback.time_spent_ms - 耗时（毫秒）
 * @param {boolean} feedback.hint_requested - 是否请求提示
 * @returns {Promise<object>} 更新结果摘要
 */
/**
 * ⚠️ 死代码（2026-09-21 标记）：本函数未被任何路由调用 —— 活路径是
 * `processSingleFeedbackSql`（见同文件 270/366 行的调用）。
 * 它还停留在旧的 **0..1 标度**（clampScore + DELTA/100），留着会误导下一个读者
 * 以为是活代码而照抄。删除需产品决策（Scope Discipline P2 → FOLLOW-UP）。
 */
async function processSingleFeedback(client, feedback) {
  const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested } = feedback;

  const delta = computeDelta(is_correct, hint_requested);

  // ── Step 1: 读取当前掌握度 ──
  const currentResult = await client.query(
    `SELECT mastery_score, attempt_count, correct_count
     FROM student_knowledge_mastery
     WHERE user_email = $1 AND knowledge_point_id = $2`,
    [userEmail, knowledge_point_id]
  );

  const currentRow = currentResult.rows[0];
  const oldScore = currentRow ? parseFloat(currentRow.mastery_score) : 0;
  const attemptCount = currentRow ? currentRow.attempt_count : 0;
  const correctCount = currentRow ? currentRow.correct_count : 0;

  // ── Step 2: 计算新分数 ──
  const newScore = clampScore(oldScore + delta);
  const newAttemptCount = attemptCount + 1;
  const newCorrectCount = correctCount + (is_correct ? 1 : 0);

  // ── Step 3: UPSERT 直接反馈（参数化，ON CONFLICT 幂等） ──
  await client.query(
    `INSERT INTO student_knowledge_mastery
       (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count, last_practice_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (user_email, knowledge_point_id)
     DO UPDATE SET
       mastery_score = $3,
       attempt_count = $4,
       correct_count = $5,
       last_practice_at = NOW(),
       updated_at = NOW()`,
    [userEmail, knowledge_point_id, newScore, newAttemptCount, newCorrectCount]
  );

  // ── Step 4: 图谱涟漪效应 ──
  const rippleResults = { upward: [], downward: [] };

  // 向上巩固：掌握度 ≥ 0.8 → 奖励直接前置节点
  if (newScore >= RIPPLE_THRESHOLD.UPWARD_MIN) {
    const upstreamIds = await queryUpstreamNodes(client, knowledge_point_id);

    for (const preId of upstreamIds) {
      await client.query(
        `INSERT INTO student_knowledge_mastery
           (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count, updated_at)
         VALUES ($1, $2, $3, 0, 0, NOW())
         ON CONFLICT (user_email, knowledge_point_id)
         DO UPDATE SET
           mastery_score = LEAST(100, student_knowledge_mastery.mastery_score + $3),
           updated_at = NOW()`,
        [userEmail, preId, RIPPLE.UPWARD_BOOST]);
      rippleResults.upward.push({ id: preId, delta: RIPPLE.UPWARD_BOOST });
    }
  }

  // 向下预警：掌握度 ≤ 0.4 → 惩罚直接后置节点
  if (newScore <= RIPPLE_THRESHOLD.DOWNWARD_MAX) {
    const downstreamIds = await queryDownstreamNodes(client, knowledge_point_id);

    for (const postId of downstreamIds) {
      await client.query(
        `INSERT INTO student_knowledge_mastery
           (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count, updated_at)
         VALUES ($1, $2, $3, 0, 0, NOW())
         ON CONFLICT (user_email, knowledge_point_id)
         DO UPDATE SET
           mastery_score = GREATEST(0, student_knowledge_mastery.mastery_score + $3),
           updated_at = NOW()`,
        [userEmail, postId, RIPPLE.DOWNWARD_PENALTY]);
      rippleResults.downward.push({ id: postId, delta: RIPPLE.DOWNWARD_PENALTY });
    }
  }

  return {
    knowledge_point_id,
    old_score: oldScore,
    new_score: parseFloat(newScore.toFixed(2)),
    delta,
    is_correct,
    hint_requested,
    time_spent_ms: time_spent_ms || 0,
    ripple: rippleResults,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Express 路由
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/loop/feedback — 单条学习反馈（核心接口）
 *
 * 请求体:
 *   { knowledge_point_id, is_correct, time_spent_ms?, hint_requested? }
 */
router.post('/feedback', authMiddleware, async (req, res) => {
  const pool = await getDb();
  let sqlClient = null;
  let ageClient = null;

  try {
    const { knowledge_point_id, is_correct, time_spent_ms, hint_requested } = req.body;

    if (!knowledge_point_id || typeof is_correct !== 'boolean') {
      return res.status(400).json(errorResponse('缺少必填字段: knowledge_point_id (string), is_correct (boolean)'));
    }

    const userEmail = req.user.email;

    // ── D080 (Sprint 1 R-AGE 修复): mastery 写入走纯 SQL 事务, 与 AGE 涟漪解耦 ──
    // 原则: 宁可只记录高置信度的学习行为, 也不要为了覆盖率制造错误学习数据
    // - mastery UPSERT + srs_review_log 写入: 强信号, 必须 commit
    // - ripple effect (AGE Cypher): 增强信号, 失败仅 warn, 不影响 mastery
    sqlClient = await pool.connect();
    await sqlClient.query('BEGIN');

    let result;
    try {
      result = await processSingleFeedbackSql(sqlClient, {
        userEmail,
        knowledge_point_id,
        is_correct,
        time_spent_ms: time_spent_ms || 0,
        hint_requested: hint_requested || false,
      });
      await sqlClient.query('COMMIT');
    } catch (sqlErr) {
      await sqlClient.query('ROLLBACK');
      throw new Error(`主写入事务回滚: ${sqlErr.message}`);
    }

    // ── 涟漪效应: best-effort, 失败仅 warn, 不影响主流程 ──
    let ripple = { upward: [], downward: [] };
    try {
      ageClient = await borrowAgeClient(pool);
      ripple = await processRippleEffect(ageClient, {
        userEmail,
        knowledge_point_id,
        newScore: result.new_score,
      });
    } catch (rippleErr) {
      console.warn(`[LearningLoop] ripple 失败 (kp=${knowledge_point_id}): ${rippleErr.message} — mastery 已保留`);
    }

    result.ripple = ripple;

    const rippleCount = ripple.upward.length + ripple.downward.length;
    console.log(
      `[LearningLoop] user=${userEmail} kp=${knowledge_point_id} ` +
        `score=${result.old_score}→${result.new_score} (Δ${result.delta}) ` +
        `ripple=${rippleCount}`
    );

    return res.json(
      successResponse(
        {
          feedback: result,
          ripple_summary: {
            upward_count: ripple.upward.length,
            upward_nodes: ripple.upward.map((r) => r.id),
            downward_count: ripple.downward.length,
            downward_nodes: ripple.downward.map((r) => r.id),
          },
        },
        '学习反馈已处理'
      )
    );
  } catch (err) {
    console.error('[LearningLoop] 反馈处理失败:', err.message);
    return res.status(500).json(errorResponse(`反馈处理失败: ${err.message}`));
  } finally {
    if (sqlClient) sqlClient.release();
    if (ageClient) ageClient.release();
  }
});

/**
 * POST /api/loop/batch — 批量反馈（考试模式结束后提交）
 *
 * 请求体:
 *   { feedbacks: [{ knowledge_point_id, is_correct, time_spent_ms?, hint_requested? }] }
 */
router.post('/batch', authMiddleware, async (req, res) => {
  const pool = await getDb();
  let sqlClient = null;
  let ageClient = null;

  try {
    const { feedbacks } = req.body;

    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return res.status(400).json(errorResponse('缺少必填字段: feedbacks (非空数组)'));
    }

    if (feedbacks.length > 100) {
      return res.status(400).json(errorResponse('单次批量反馈不超过 100 条'));
    }

    const userEmail = req.user.email;

    // D080: mastery 写入走纯 SQL 事务, 与 AGE 涟漪解耦
    sqlClient = await pool.connect();
    await sqlClient.query('BEGIN');

    const results = [];
    const succeeded = [];
    const failed = [];
    try {
      for (const fb of feedbacks) {
        if (!fb.knowledge_point_id || typeof fb.is_correct !== 'boolean') {
          failed.push({ ...fb, error: 'invalid' });
          continue;
        }
        try {
          const result = await processSingleFeedbackSql(sqlClient, {
            userEmail,
            knowledge_point_id: fb.knowledge_point_id,
            is_correct: fb.is_correct,
            time_spent_ms: fb.time_spent_ms || 0,
            hint_requested: fb.hint_requested || false,
          });
          results.push(result);
          succeeded.push(fb);
        } catch (itemErr) {
          failed.push({ ...fb, error: itemErr.message });
        }
      }
      await sqlClient.query('COMMIT');
    } catch (txErr) {
      await sqlClient.query('ROLLBACK');
      throw new Error(`批量主写入事务回滚: ${txErr.message}`);
    }

    // ripple effect: best-effort, 失败仅 warn
    for (const r of results) {
      try {
        if (!ageClient) ageClient = await borrowAgeClient(pool);
        await processRippleEffect(ageClient, {
          userEmail,
          knowledge_point_id: r.knowledge_point_id,
          newScore: r.new_score,
        });
      } catch (e) { /* ripple 失败不影响主流程 */ }
    }

    console.log(`[LearningLoop] batch user=${userEmail} processed=${results.length}/${feedbacks.length}`);

    return res.json(
      successResponse(
        {
          total: feedbacks.length,
          succeeded: succeeded.length,
          failed: failed.length,
          results,
          failures: failed,
        },
        `批量反馈已处理: ${succeeded.length}/${feedbacks.length}`
      )
    );
  } catch (err) {
    console.error('[LearningLoop] 批量反馈失败:', err.message);
    return res.status(500).json(errorResponse(`批量反馈失败: ${err.message}`));
  } finally {
    if (sqlClient) sqlClient.release();
    if (ageClient) ageClient.release();
  }
});

/**
 * GET /api/loop/mastery — 获取学生全量掌握度概览
 *
 * 查询参数:
 *   ?subject=physics&min_score=0.5&sort=mastery_score&order=asc&limit=50
 */
router.get('/mastery', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const userEmail = req.user.email;

    const { min_score, max_score, sort, order, limit } = req.query;

    const conditions = ['user_email = $1'];
    const params = [userEmail];
    let paramIdx = 2;

    if (typeof min_score === 'string' && !isNaN(parseFloat(min_score))) {
      conditions.push(`mastery_score >= $${paramIdx}`);
      params.push(parseFloat(min_score));
      paramIdx++;
    }

    if (typeof max_score === 'string' && !isNaN(parseFloat(max_score))) {
      conditions.push(`mastery_score <= $${paramIdx}`);
      params.push(parseFloat(max_score));
      paramIdx++;
    }

    const sortColumn = sort === 'attempt_count' ? 'attempt_count' : 'mastery_score';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);

    const whereClause = conditions.join(' AND ');
    params.push(safeLimit);

    const result = await pool.query(
      `SELECT knowledge_point_id, mastery_score, attempt_count, correct_count,
              last_practice_at, updated_at
       FROM student_knowledge_mastery
       WHERE ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIdx}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM student_knowledge_mastery WHERE ${whereClause}`,
      params.slice(0, -1)
    );

    return res.json(
      successResponse({
        items: result.rows.map((r) => ({
          ...r,
          mastery_score: parseFloat(r.mastery_score),
        })),
        total: parseInt(countResult.rows[0].total),
      })
    );
  } catch (err) {
    console.error('[LearningLoop] 掌握度查询失败:', err.message);
    return res.status(500).json(errorResponse(`查询失败: ${err.message}`));
  }
});

/**
 * GET /api/loop/graph — 获取知识图谱拓扑 + 当前用户掌握度
 * 返回 Cytoscape.js 兼容的 JSON 格式（节点 + 边）
 * 前端仅用于渲染，不包含任何图谱计算逻辑
 */
router.get('/graph', authMiddleware, async (req, res) => {
  const pool = await getDb();
  let ageClient = null;

  try {
    const userEmail = req.user.email;
    ageClient = await borrowAgeClient(pool);

    // ── 查询所有 KnowledgePoint 节点 ──
    const nodesResult = await ageClient.query(
      `SELECT * FROM cypher('${GRAPH_NAME}', $$
         MATCH (kp:KnowledgePoint)
         RETURN kp.id, kp.name, kp.subject, kp.module, kp.difficulty
       $$) AS (id agtype, name agtype, subject agtype, module agtype, difficulty agtype)`
    );

    const nodes = nodesResult.rows.map((r) => ({
      id: parseAgtype(r.id),
      name: parseAgtype(r.name),
      subject: parseAgtype(r.subject),
      module: parseAgtype(r.module),
      difficulty: parseAgtype(r.difficulty),
    }));

    // ── 查询所有 DEPENDS_ON 边 ──
    const edgesResult = await ageClient.query(
      `SELECT * FROM cypher('${GRAPH_NAME}', $$
         MATCH (a:KnowledgePoint)-[:DEPENDS_ON]->(b:KnowledgePoint)
         RETURN a.id, b.id
       $$) AS (source agtype, target agtype)`
    );

    const edges = edgesResult.rows.map((r) => ({
      source: parseAgtype(r.source),
      target: parseAgtype(r.target),
    }));

    // ── 获取当前用户的掌握度（批量查询关系表）──
    const nodeIds = nodes.map((n) => n.id).filter(Boolean);
    const masteryMap = await queryStudentMastery(pool, userEmail, nodeIds);

    // ── 组装 Cytoscape 格式 ──
    const cyNodes = nodes
      .filter((n) => n.id)
      .map((n) => ({
        data: {
          id: n.id,
          name: n.name || n.id,
          subject: n.subject || '未知',
          module: n.module || '未知',
          difficulty: n.difficulty || 3,
          mastery: masteryMap.get(n.id) ?? null,
        },
      }));

    const nodeIdSet = new Set(cyNodes.map((n) => n.data.id));
    const cyEdges = edges
      .filter((e) => e.source && e.target && nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target },
      }));

    return res.json(
      successResponse({
        nodes: cyNodes,
        edges: cyEdges,
        stats: {
          total_nodes: cyNodes.length,
          total_edges: cyEdges.length,
          // G6: mastery 来自 student_knowledge_mastery，标度 0..100
          mastered: cyNodes.filter((n) => n.data.mastery !== null && n.data.mastery >= 70).length,
          weak: cyNodes.filter((n) => n.data.mastery !== null && n.data.mastery < 40).length,
        },
      })
    );
  } catch (err) {
    console.error('[LearningLoop] 图谱拓扑查询失败:', err.message);
    return res.status(500).json(errorResponse(`图谱查询失败: ${err.message}`));
  } finally {
    if (ageClient) {
      ageClient.release();
    }
  }
});

// =============================================================================
// D080 (Sprint 1 R-AGE 修复): Mastery SQL 写入 + Ripple AGE 涟漪 — 解耦实现
// =============================================================================

/**
 * 纯 SQL 路径: mastery UPSERT + srs_review_log 写入
 * 不依赖 AGE / AGE Cypher 任何调用
 * 强信号, 事务必须 commit
 *
 * @param {object} client - 普通 pg client
 * @param {object} feedback - { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested }
 * @returns {Promise<{old_score, new_score, delta}>}
 */
async function processSingleFeedbackSql(client, feedback) {
  const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested } = feedback;
  const delta = computeDelta(is_correct, hint_requested);

  // Step 1: 读取当前 mastery
  const currentResult = await client.query(
    `SELECT mastery_score, attempt_count, correct_count
     FROM student_knowledge_mastery
     WHERE user_email = $1 AND knowledge_point_id = $2`,
    [userEmail, knowledge_point_id]
  );
  const currentRow = currentResult.rows[0];
  const oldScore = currentRow ? parseFloat(currentRow.mastery_score) : 0;
  const attemptCount = currentRow ? currentRow.attempt_count : 0;
  const correctCount = currentRow ? currentRow.correct_count : 0;

  // Step 2: 计算新分数
  // 2026-09-21 (G6): DELTA 已是 0..100 单位(15/5/-20)，此前误除 100 并 clamp 到 1，
  // 会把旧值 60 变成 1（见 docs/spec/SPEC-DATA.md §2.5）。
  const newScore = Math.max(0, Math.min(100, oldScore + delta));
  const newAttemptCount = attemptCount + 1;
  const newCorrectCount = correctCount + (is_correct ? 1 : 0);

  // Step 3: UPSERT mastery
  await client.query(
    `INSERT INTO student_knowledge_mastery
       (user_email, knowledge_point_id, mastery_score, attempt_count, correct_count, last_practice_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (user_email, knowledge_point_id)
     DO UPDATE SET
       mastery_score = $3,
       attempt_count = $4,
       correct_count = $5,
       last_practice_at = NOW(),
       updated_at = NOW()`,
    [userEmail, knowledge_point_id, newScore, newAttemptCount, newCorrectCount]
  );

  // Step 4: 写 srs_review_log (SM-2 quality 转换)
  const reviewQuality = isCorrectToQuality(is_correct, time_spent_ms);
  await client.query(
    `INSERT INTO srs_review_log
       (user_email, knowledge_point_id, is_correct, time_spent_ms, review_quality, old_mastery, new_mastery, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [userEmail, knowledge_point_id, is_correct, time_spent_ms, reviewQuality, oldScore, newScore]
  );

  return { old_score: oldScore, new_score: newScore, delta };
}

/**
 * is_correct + time_spent_ms → SM-2 quality (0-5)
 * 简化版: 对直接 SQL 路径足够, 不复用 srs-engine 复杂算法
 */
function isCorrectToQuality(isCorrect, timeSpentMs) {
  if (!isCorrect) {
    return timeSpentMs > 30000 ? 2 : 1;
  }
  if (timeSpentMs < 10000) return 5;
  if (timeSpentMs < 30000) return 4;
  if (timeSpentMs < 60000) return 3;
  return 2;
}

/**
 * AGE 路径: ripple effect (前置节点 +2, 后置节点 -5)
 * 独立事务, 失败不阻断主流程
 * 返回 { upward: [...], downward: [...] }
 */
async function processRippleEffect(client, { userEmail, knowledge_point_id, newScore }) {
  const ripple = { upward: [], downward: [] };

  if (newScore >= RIPPLE_THRESHOLD.UPWARD_MIN) {
    const upstreamIds = await queryUpstreamNodes(client, knowledge_point_id).catch(() => []);
    for (const preId of upstreamIds) {
      try {
        await client.query(
          `UPDATE student_knowledge_mastery
           SET mastery_score = LEAST(100, mastery_score + $3), updated_at = NOW()
           WHERE user_email = $1 AND knowledge_point_id = $2`,
          [userEmail, preId, RIPPLE.UPWARD_BOOST]
        );
        ripple.upward.push({ id: preId, delta: RIPPLE.UPWARD_BOOST });
      } catch (e) { /* 继续 */ }
    }
  }

  if (newScore <= RIPPLE_THRESHOLD.DOWNWARD_MAX) {
    const downstreamIds = await queryDownstreamNodes(client, knowledge_point_id).catch(() => []);
    for (const postId of downstreamIds) {
      try {
        await client.query(
          `UPDATE student_knowledge_mastery
           SET mastery_score = GREATEST(0, mastery_score + $3), updated_at = NOW()
           WHERE user_email = $1 AND knowledge_point_id = $2`,
          [userEmail, postId, RIPPLE.DOWNWARD_PENALTY]
        );
        ripple.downward.push({ id: postId, delta: RIPPLE.DOWNWARD_PENALTY });
      } catch (e) { /* 继续 */ }
    }
  }

  return ripple;
}

export default router;
