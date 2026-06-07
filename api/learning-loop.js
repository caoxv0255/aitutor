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
import { getDb } from './db.js';
import { successResponse, errorResponse } from './utils/response.js';
import { authMiddleware } from './auth.js';
import { queryStudentMastery } from './tutor-agent.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_NAME = 'knowledge_graph';
const AGE_INIT_SQL = `LOAD 'age'; SET search_path = ag_catalog, "$user", public;`;

/** 基础分数更新增量 */
const DELTA = {
  CORRECT_NO_HINT: 0.15,
  CORRECT_WITH_HINT: 0.05,
  INCORRECT: -0.2,
};

/** 涟漪效应增量（远小于直接反馈） */
const RIPPLE = {
  UPWARD_BOOST: 0.02, // 向上巩固：掌握当前 → 奖励前置
  DOWNWARD_PENALTY: -0.05, // 向下预警：当前薄弱 → 惩罚后置
};

/** 涟漪触发阈值 */
const RIPPLE_THRESHOLD = {
  UPWARD_MIN: 0.8, // 得分后 ≥ 0.8 才触发向上巩固
  DOWNWARD_MAX: 0.4, // 得分后 ≤ 0.4 才触发向下预警
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
           mastery_score = LEAST(1.0, student_knowledge_mastery.mastery_score + $3),
           updated_at = NOW()`,
        [userEmail, preId, RIPPLE.UPWARD_BOOST]
      );
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
           mastery_score = GREATEST(0.0, student_knowledge_mastery.mastery_score + $3),
           updated_at = NOW()`,
        [userEmail, postId, RIPPLE.DOWNWARD_PENALTY]
      );
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
  let ageClient = null;

  try {
    const { knowledge_point_id, is_correct, time_spent_ms, hint_requested } = req.body;

    if (!knowledge_point_id || typeof is_correct !== 'boolean') {
      return res.status(400).json(errorResponse('缺少必填字段: knowledge_point_id (string), is_correct (boolean)'));
    }

    const userEmail = req.user.email;

    // 借用 AGE 客户端（同时用于 Cypher 查询和 SQL 事务）
    ageClient = await borrowAgeClient(pool);

    // ── 开启事务：直接更新 + 涟漪效应在同一事务内 ──
    await ageClient.query('BEGIN');

    let result;
    try {
      result = await processSingleFeedback(ageClient, {
        userEmail,
        knowledge_point_id,
        is_correct,
        time_spent_ms: time_spent_ms || 0,
        hint_requested: hint_requested || false,
      });

      await ageClient.query('COMMIT');
    } catch (txErr) {
      await ageClient.query('ROLLBACK');
      throw new Error(`事务回滚: ${txErr.message}`);
    }

    // ── 构建日志 ──
    const rippleCount = result.ripple.upward.length + result.ripple.downward.length;
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
            upward_count: result.ripple.upward.length,
            upward_nodes: result.ripple.upward.map((r) => r.id),
            downward_count: result.ripple.downward.length,
            downward_nodes: result.ripple.downward.map((r) => r.id),
          },
        },
        '学习反馈已处理'
      )
    );
  } catch (err) {
    console.error('[LearningLoop] 反馈处理失败:', err.message);
    return res.status(500).json(errorResponse(`反馈处理失败: ${err.message}`));
  } finally {
    if (ageClient) {
      ageClient.release();
    }
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
    ageClient = await borrowAgeClient(pool);

    // 整个批量操作在一个事务内
    await ageClient.query('BEGIN');

    const results = [];
    try {
      for (const fb of feedbacks) {
        if (!fb.knowledge_point_id || typeof fb.is_correct !== 'boolean') {
          continue; // 跳过无效条目
        }

        const result = await processSingleFeedback(ageClient, {
          userEmail,
          knowledge_point_id: fb.knowledge_point_id,
          is_correct: fb.is_correct,
          time_spent_ms: fb.time_spent_ms || 0,
          hint_requested: fb.hint_requested || false,
        });
        results.push(result);
      }

      await ageClient.query('COMMIT');
    } catch (txErr) {
      await ageClient.query('ROLLBACK');
      throw new Error(`批量事务回滚: ${txErr.message}`);
    }

    console.log(`[LearningLoop] batch user=${userEmail} processed=${results.length}/${feedbacks.length}`);

    return res.json(
      successResponse(
        { processed: results.length, total: feedbacks.length, results },
        `批量反馈已处理: ${results.length}/${feedbacks.length}`
      )
    );
  } catch (err) {
    console.error('[LearningLoop] 批量反馈失败:', err.message);
    return res.status(500).json(errorResponse(`批量反馈失败: ${err.message}`));
  } finally {
    if (ageClient) {
      ageClient.release();
    }
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
          mastered: cyNodes.filter((n) => n.data.mastery !== null && n.data.mastery >= 0.7).length,
          weak: cyNodes.filter((n) => n.data.mastery !== null && n.data.mastery < 0.4).length,
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

export default router;
