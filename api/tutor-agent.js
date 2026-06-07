/**
 * api/tutor-agent.js — 方案C：全局推理与学情诊断 Agent
 *
 * 核心教学推理接口，串联 Hybrid RAG 三层架构：
 *   方案 B（向量检索）→ 方案 A（图谱多跳）→ 方案 C（LLM 推理）
 *
 * 流水线：
 *   1. 接收学生问题 + knowledge_point_id
 *   2. 方案 B: searchSimilarQuestions → Top-3 相似题目（事实依据）
 *   3. 方案 A: Apache AGE 多跳查询 → 前置依赖节点（1-2 跳）
 *   4. 关系表: student_knowledge_mastery → 学生掌握度
 *   5. 上下文组装 + 防跳跃机制 → LLM 推理 → 结构化 JSON 输出
 *
 * 架构边界：方案 C 仅消费 A/B 数据，不修改图谱或向量索引。
 */

import express from 'express';
import { getDb } from './db.js';
import { searchSimilarQuestions } from './rag-search.js';
import { chatCompletion, streamChatCompletion, safeParseLLMJson } from '../services/llm.js';
import { successResponse, errorResponse } from './utils/response.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_NAME = 'knowledge_graph';

const AGE_INIT_SQL = `
  LOAD 'age';
  SET search_path = ag_catalog, "$user", public;
`;

/** 掌握度阈值：低于此值的前置节点标记为"薄弱" */
const MASTERY_THRESHOLD = 0.6;

/** LLM 推理默认模型 */
const TUTOR_MODEL = 'qwen-plus';

// ─────────────────────────────────────────────────────────────────────────────
// Apache AGE 图谱查询（方案 A）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 从连接池借用客户端并初始化 Apache AGE
 * @param {object} pool - 数据库连接池
 * @returns {Promise<object>} 已初始化 AGE 的数据库客户端
 */
async function borrowAgeClient(pool) {
  const client = await pool.connect();
  await client.query(AGE_INIT_SQL);
  return client;
}

/**
 * 执行 Cypher 查询（参数化）
 */
async function runCypher(client, cypher, params = [], resultDef = 'result agtype') {
  const sql = `SELECT * FROM cypher('${GRAPH_NAME}', $$ ${cypher} $$) AS (${resultDef})`;
  return client.query(sql, params);
}

/**
 * 解析 agtype 返回值（JSON 字符串 → JS 值）
 */
function parseAgtype(val) {
  if (val === null || val === undefined) return null;
  try {
    return JSON.parse(val);
  } catch {
    return String(val);
  }
}

/**
 * 方案 A 多跳查询：获取 knowledge_point_id 的前置依赖（1-2 跳）
 *
 * Cypher 逻辑：
 *   第 1 跳: MATCH (kp)-[:DEPENDS_ON]->(pre) — 直接前置
 *   第 2 跳: MATCH (kp)-[:DEPENDS_ON]->(mid)-[:DEPENDS_ON]->(pre2) — 间接前置
 *
 * @param {object} ageClient
 * @param {string} knowledgePointId
 * @returns {Promise<Array<{id: string, name: string, hop: number}>>}
 */
async function queryPrerequisites(ageClient, knowledgePointId) {
  const prereqs = [];
  const seenIds = new Set();

  try {
    // ── 第 1 跳：直接前置依赖 ──
    const hop1 = await runCypher(
      ageClient,
      `MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(pre:KnowledgePoint)
       RETURN pre.id, pre.name`,
      [knowledgePointId],
      'id agtype, name agtype'
    );

    for (const row of hop1.rows) {
      const id = parseAgtype(row.id);
      const name = parseAgtype(row.name);
      if (id) {
        prereqs.push({ id, name: name || id, hop: 1 });
        seenIds.add(id);
      }
    }

    // ── 第 2 跳：间接前置依赖（经中间节点）──
    const hop2 = await runCypher(
      ageClient,
      `MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(mid:KnowledgePoint)-[:DEPENDS_ON]->(pre2:KnowledgePoint)
       RETURN pre2.id, pre2.name`,
      [knowledgePointId],
      'id agtype, name agtype'
    );

    for (const row of hop2.rows) {
      const id = parseAgtype(row.id);
      const name = parseAgtype(row.name);
      if (id && !seenIds.has(id)) {
        prereqs.push({ id, name: name || id, hop: 2 });
        seenIds.add(id);
      }
    }
  } catch (err) {
    console.warn(`[TutorAgent] 图谱查询异常 (kp=${knowledgePointId}): ${err.message}`);
  }

  return prereqs;
}

// ─────────────────────────────────────────────────────────────────────────────
// 学生掌握度查询（关系型表）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 批量查询学生在指定知识点上的掌握度
 * @param {object} pool - 数据库连接池
 * @param {string} userEmail
 * @param {string[]} kpIds - 知识点 ID 数组
 * @returns {Promise<Map<string, number>>} kp_id → mastery_score
 */
export async function queryStudentMastery(pool, userEmail, kpIds) {
  const mastery = new Map();
  if (!kpIds || kpIds.length === 0) return mastery;

  try {
    const result = await pool.query(
      `SELECT knowledge_point_id, mastery_score
       FROM student_knowledge_mastery
       WHERE user_email = $1 AND knowledge_point_id = ANY($2)`,
      [userEmail, kpIds]
    );

    for (const row of result.rows) {
      mastery.set(row.knowledge_point_id, parseFloat(row.mastery_score));
    }
  } catch (err) {
    console.warn(`[TutorAgent] 掌握度查询异常: ${err.message}`);
  }

  return mastery;
}

// ─────────────────────────────────────────────────────────────────────────────
// 上下文组装 & 防跳跃检测
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 组装完整的学情上下文（方案 A 图谱 + 关系型掌握度）
 */
async function assembleLearningContext(pool, ageClient, userEmail, knowledgePointId) {
  // 方案 A：多跳图查询
  const prereqs = await queryPrerequisites(ageClient, knowledgePointId);

  // 收集所有需要查询掌握度的知识点 ID
  const allKpIds = [knowledgePointId, ...prereqs.map((p) => p.id)];
  const masteryMap = await queryStudentMastery(pool, userEmail, allKpIds);

  // 当前知识点掌握度
  const currentMastery = masteryMap.get(knowledgePointId) ?? null;

  // 组装前置依赖列表（含掌握度 + 薄弱标记）
  const weakPrereqs = [];
  const prerequisites = prereqs.map((p) => {
    const score = masteryMap.get(p.id) ?? null;
    const isWeak = score !== null && score < MASTERY_THRESHOLD;
    const entry = {
      id: p.id,
      name: p.name,
      hop: p.hop,
      mastery_score: score,
      is_weak: isWeak,
    };
    if (isWeak) weakPrereqs.push(entry);
    return entry;
  });

  return { prereqs: prerequisites, currentMastery, weakPrereqs };
}

/**
 * 构建教学 Agent 的 System Prompt（含防跳跃机制）
 */
function buildSystemPrompt(context) {
  const { currentTopic, prerequisites, currentMastery, weakPrereqs, similarQuestions } = context;

  // ── 格式化前置依赖（标注薄弱节点）──
  const prereqsText =
    prerequisites.length > 0
      ? prerequisites
          .map((p) => {
            const tag = p.is_weak ? ' ⚠️ [薄弱]' : '';
            const score = p.mastery_score !== null ? p.mastery_score.toFixed(2) : '未评估';
            return `  - ${p.name}（${p.id}，${p.hop}跳前置，掌握度: ${score}）${tag}`;
          })
          .join('\n')
      : '  （无已知前置依赖）';

  // ── 格式化薄弱节点（防跳跃触发器）──
  const weakText =
    weakPrereqs.length > 0
      ? weakPrereqs
          .map((p) => `  ⚠️ **${p.name}**（掌握度: ${p.mastery_score.toFixed(2)}，低于阈值 ${MASTERY_THRESHOLD}）`)
          .join('\n')
      : '  （无薄弱前置节点）';

  // ── 格式化相似题目（方案 B 事实依据）──
  const similarText =
    similarQuestions.length > 0
      ? similarQuestions
          .map(
            (q, i) =>
              `  【题目${i + 1}】(相似度: ${q.similarity}, 知识点: ${q.knowledge_point_id || '未知'})\n  ${q.content.slice(0, 400)}`
          )
          .join('\n\n')
      : '  （未找到相似题目）';

  const masteryText = currentMastery !== null ? currentMastery.toFixed(2) : '未评估（首次接触）';

  return `你是一位经验丰富的AI导师，精通新高考全科教学。你正在使用"知识图谱驱动的教学推理系统"进行个性化辅导。

## 🛡️ 防跳跃教学机制（最高优先级）
以下是必须严格遵守的教学规则：
1. 若存在标记为 ⚠️ [薄弱] 的前置知识点，你**绝对不能**直接解答当前问题。
2. 你必须首先明确指出薄弱前置节点，用通俗易懂的语言解释为什么需要掌握它们。
3. 然后提供针对性的复习引导（概念回顾 + 简单例题），帮助学生补齐知识链。
4. 只有当所有前置节点掌握度均 ≥ ${MASTERY_THRESHOLD} 时，才能完整解答当前问题。
5. 即使学生要求"直接告诉我答案"，也必须先完成前置知识的复习引导。

## 📊 当前学生学情上下文

### 当前知识点
- 名称: ${currentTopic}
- 学生掌握度: ${masteryText}

### 前置依赖链（来自知识图谱）
${prereqsText}

### 薄弱前置节点（需优先复习）
${weakText}

### 相似题目参考（来自向量检索，作为事实依据）
${similarText}

## 📤 输出要求
你必须严格按照以下 JSON 格式输出，不得添加任何 Markdown 标记或非 JSON 内容：
{
  "response": "你的教学回复（主文本，支持 LaTeX 公式如 $x^2$ 和 $$\\\\sum_{i=1}^{n}$$，段落用 \\\\n\\\\n 分隔）",
  "diagnosis": {
    "summary": "学情诊断摘要（一句话概括当前学习状态）",
    "weak_points": ["薄弱知识点1", "薄弱知识点2"],
    "strong_points": ["已掌握的知识点1"],
    "skip_allowed": false
  },
  "learning_path": [
    {"step": 1, "action": "复习/练习/解答", "target": "知识点名称", "reason": "为什么需要这一步"}
  ],
  "metadata": {
    "teaching_depth": "review_only | guided_review | full_solution",
    "weak_kp_ids": ["薄弱知识点的ID数组"],
    "prerequisites_covered": ["本次涉及的前置知识点ID"]
  }
}

## 字段说明
- skip_allowed: 当且仅当无任何薄弱前置时为 true，否则必须为 false
- teaching_depth:
  - "review_only": 存在严重薄弱前置（掌握度 < 0.3），仅引导复习，不提供任何解答线索
  - "guided_review": 存在薄弱前置（0.3 ≤ 掌握度 < 0.6），先复习再给予部分提示
  - "full_solution": 所有前置均已掌握（≥ 0.6），提供完整解答`;
}

/**
 * 构建 User Prompt
 */
function buildUserPrompt(question, subject) {
  const subjectText = subject ? `（学科: ${subject}）` : '';
  return `学生提问${subjectText}：\n\n${question}\n\n请根据你的学情上下文进行教学推理。记住：如果有薄弱的前置知识点，必须先引导复习，不能直接解答。`;
}

/**
 * 从流水线数据中确定性计算元数据（不依赖 LLM）
 * 诊断信息和学习路径由图谱 + 掌握度数据直接推导
 */
function buildStreamMetadata(promptContext) {
  const { prerequisites, currentMastery, weakPrereqs, similarQuestions, currentTopic } = promptContext;

  // 学情诊断
  const weakNames = weakPrereqs.map((p) => p.name);
  const strongNames = prerequisites.filter((p) => !p.is_weak).map((p) => p.name);

  let teachingDepth;
  if (weakPrereqs.some((p) => p.mastery_score !== null && p.mastery_score < 0.3)) {
    teachingDepth = 'review_only';
  } else if (weakPrereqs.length > 0) {
    teachingDepth = 'guided_review';
  } else {
    teachingDepth = 'full_solution';
  }

  const summary =
    weakPrereqs.length > 0
      ? `你在「${currentTopic}」的前置知识中仍有 ${weakPrereqs.length} 个薄弱点，需要先补齐基础。`
      : currentMastery !== null && currentMastery >= 0.7
        ? `你在「${currentTopic}」上已掌握良好，可以继续深入学习。`
        : `你在「${currentTopic}」上的学习仍在进行中，AI 导师将为你提供引导。`;

  // 学习路径
  const learningPath = [];
  if (weakPrereqs.length > 0) {
    weakPrereqs.forEach((p, i) => {
      learningPath.push({
        step: i + 1,
        action: '复习',
        target: p.name,
        reason: `掌握度 ${p.mastery_score !== null ? p.mastery_score.toFixed(2) : '未评估'}，低于阈值 ${MASTERY_THRESHOLD}`,
      });
    });
  }
  learningPath.push({
    step: learningPath.length + 1,
    action: teachingDepth === 'full_solution' ? '解答' : '引导练习',
    target: currentTopic,
    reason: '补齐前置后，进入当前知识点的学习',
  });

  return {
    diagnosis: {
      summary,
      weak_points: weakNames,
      strong_points: strongNames,
      skip_allowed: weakPrereqs.length === 0,
    },
    learning_path: learningPath,
    metadata: {
      teaching_depth: teachingDepth,
      weak_kp_ids: weakPrereqs.map((p) => p.id),
      prerequisites_covered: prerequisites.map((p) => p.id),
      current_mastery: currentMastery,
      similar_questions_count: similarQuestions.length,
    },
  };
}

/**
 * 构建流式模式下的 System Prompt（仅要求输出教学文本，不要求 JSON）
 */
function buildStreamSystemPrompt(context) {
  const { currentTopic, prerequisites, currentMastery, weakPrereqs, similarQuestions } = context;

  const prereqsText =
    prerequisites.length > 0
      ? prerequisites
          .map((p) => {
            const tag = p.is_weak ? ' ⚠️ [薄弱]' : '';
            const score = p.mastery_score !== null ? p.mastery_score.toFixed(2) : '未评估';
            return `  - ${p.name}（${p.id}，${p.hop}跳前置，掌握度: ${score}）${tag}`;
          })
          .join('\n')
      : '  （无已知前置依赖）';

  const weakText =
    weakPrereqs.length > 0
      ? weakPrereqs
          .map(
            (p) =>
              `  ⚠️ **${p.name}**（掌握度: ${p.mastery_score !== null ? p.mastery_score.toFixed(2) : '未评估'}，低于阈值 ${MASTERY_THRESHOLD}）`
          )
          .join('\n')
      : '  （无薄弱前置节点）';

  const similarText =
    similarQuestions.length > 0
      ? similarQuestions
          .map(
            (q, i) =>
              `  【题目${i + 1}】(相似度: ${q.similarity}, 知识点: ${q.knowledge_point_id || '未知'})\n  ${q.content.slice(0, 400)}`
          )
          .join('\n\n')
      : '  （未找到相似题目）';

  const masteryText = currentMastery !== null ? currentMastery.toFixed(2) : '未评估（首次接触）';

  return `你是一位经验丰富的AI导师，精通新高考全科教学。你正在使用"知识图谱驱动的教学推理系统"进行个性化辅导。

## 🛡️ 防跳跃教学机制（最高优先级）
1. 若存在标记为 ⚠️ [薄弱] 的前置知识点，你**绝对不能**直接解答当前问题。
2. 你必须首先明确指出薄弱前置节点，用通俗易懂的语言解释为什么需要掌握它们。
3. 然后提供针对性的复习引导（概念回顾 + 简单例题），帮助学生补齐知识链。
4. 只有当所有前置节点掌握度均 ≥ ${MASTERY_THRESHOLD} 时，才能完整解答当前问题。
5. 即使学生要求"直接告诉我答案"，也必须先完成前置知识的复习引导。

## 📊 当前学生学情上下文

### 当前知识点
- 名称: ${currentTopic}
- 学生掌握度: ${masteryText}

### 前置依赖链
${prereqsText}

### 薄弱前置节点（需优先复习）
${weakText}

### 相似题目参考
${similarText}

## 📝 输出要求
请直接输出你的教学内容（纯文本，不要包裹在 JSON 中）。支持 LaTeX 公式（$x^2$）和 Markdown 格式。段落之间用空行分隔。
教学深度规则：
- 存在严重薄弱前置（掌握度 < 0.3）：仅引导复习，不提供任何解答线索
- 存在薄弱前置（0.3 ≤ 掌握度 < 0.6）：先复习再给予部分提示
- 所有前置均已掌握（≥ 0.6）：提供完整解答`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主编排函数（A → B → C 串联）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 教学 Agent 核心流水线
 *
 * @param {object} params
 * @param {string} params.question - 学生提问
 * @param {string} params.knowledge_point_id - 当前知识点 ID（方案 A 节点）
 * @param {string} params.user_email - 学生邮箱
 * @param {string} [params.subject] - 学科
 * @param {string} [params.current_topic_name] - 当前知识点名称
 * @returns {Promise<object>} 结构化教学响应
 */
export async function askTutorAgent({ question, knowledge_point_id, user_email, subject, current_topic_name }) {
  const pool = await getDb();
  const startTime = Date.now();

  // ── Step 1: 方案 B — 向量检索 Top-3 相似题目 ──
  let similarQuestions = [];
  try {
    similarQuestions = await searchSimilarQuestions(question, {
      knowledge_point_id,
      subject_code: subject,
      top_k: 3,
      threshold: 0.5,
    });
  } catch (err) {
    console.warn(`[TutorAgent] 方案B向量检索失败: ${err.message}`);
  }

  // ── Step 2: 方案 A — Apache AGE 多跳图查询 + 学生掌握度 ──
  let learningContext = { prereqs: [], currentMastery: null, weakPrereqs: [] };
  let ageClient = null;

  if (knowledge_point_id) {
    try {
      ageClient = await borrowAgeClient(pool);
      learningContext = await assembleLearningContext(pool, ageClient, user_email, knowledge_point_id);
    } catch (err) {
      console.warn(`[TutorAgent] 方案A图谱查询失败: ${err.message}`);
    } finally {
      if (ageClient) {
        ageClient.release();
        ageClient = null;
      }
    }
  }

  // ── Step 3: 上下文组装 ──
  const promptContext = {
    currentTopic: current_topic_name || knowledge_point_id || '未指定',
    prerequisites: learningContext.prereqs,
    currentMastery: learningContext.currentMastery,
    weakPrereqs: learningContext.weakPrereqs,
    similarQuestions,
  };

  const systemPrompt = buildSystemPrompt(promptContext);
  const userPrompt = buildUserPrompt(question, subject);

  // ── Step 4: 方案 C — LLM 推理（强制 JSON 模式）──
  const llmResult = await chatCompletion(systemPrompt, userPrompt, {
    model: TUTOR_MODEL,
    temperature: 0.3,
    max_tokens: 4000,
    jsonMode: true,
  });

  // ── Step 5: 结构化输出解析（容错）──
  let parsed;
  try {
    parsed = safeParseLLMJson(llmResult.content);
  } catch (err) {
    console.error(`[TutorAgent] JSON 解析失败: ${err.message}`);
    parsed = {
      response: llmResult.content,
      diagnosis: { summary: '学情诊断解析失败', weak_points: [], strong_points: [], skip_allowed: false },
      learning_path: [],
      metadata: {
        teaching_depth: 'unknown',
        weak_kp_ids: [],
        prerequisites_covered: [],
      },
    };
  }

  const durationMs = Date.now() - startTime;

  return {
    ...parsed,
    context: {
      similar_questions_count: similarQuestions.length,
      prerequisites_count: learningContext.prereqs.length,
      weak_prerequisites_count: learningContext.weakPrereqs.length,
      current_mastery: learningContext.currentMastery,
    },
    usage: llmResult.usage,
    duration_ms: durationMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Express 路由
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/tutor/ask — 教学 Agent 推理接口
 */
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { question, knowledge_point_id, subject, current_topic_name } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json(errorResponse('缺少必填字段: question'));
    }

    const userEmail = req.user.email;

    const result = await askTutorAgent({
      question,
      knowledge_point_id,
      user_email: userEmail,
      subject,
      current_topic_name,
    });

    return res.json(successResponse(result, '教学推理完成'));
  } catch (err) {
    console.error('[TutorAgent] 推理失败:', err.message);
    const status = err.message.includes('API Key') ? 503 : err.message.includes('超时') ? 504 : 500;
    return res.status(status).json(errorResponse(`推理失败: ${err.message}`));
  }
});

/**
 * GET /api/tutor/mastery/:kpId — 查询学生对某知识点的掌握度
 */
router.get('/mastery/:kpId', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT knowledge_point_id, mastery_score, attempt_count, correct_count, last_practice_at
       FROM student_knowledge_mastery
       WHERE user_email = $1 AND knowledge_point_id = $2`,
      [req.user.email, req.params.kpId]
    );

    const mastery = result.rows[0] || {
      knowledge_point_id: req.params.kpId,
      mastery_score: 0,
      attempt_count: 0,
      correct_count: 0,
      last_practice_at: null,
    };

    return res.json(successResponse(mastery));
  } catch (err) {
    console.error('[TutorAgent] 掌握度查询失败:', err.message);
    return res.status(500).json(errorResponse(`查询失败: ${err.message}`));
  }
});

/**
 * POST /api/tutor/ask/stream — SSE 流式教学 Agent 推理接口
 *
 * 事件协议：
 *   event: metadata  — 包含 diagnosis, learning_path 等结构化数据
 *   event: content   — 流式推送 LLM 教学文本 delta
 *   event: done      — 流结束，包含 duration_ms 统计
 *   event: error     — 错误信息
 */
router.post('/ask/stream', authMiddleware, async (req, res) => {
  // ── SSE 响应头 ──
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx 禁用缓冲
  res.flushHeaders?.();

  const startTime = Date.now();
  const userEmail = req.user.email;
  let closed = false;

  // ── 客户端断开检测（防止内存泄漏）──
  req.on('close', () => {
    closed = true;
  });

  /** SSE 事件发送器 */
  function sendEvent(event, data) {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const { question, knowledge_point_id, subject, current_topic_name } = req.body;

    if (!question || typeof question !== 'string') {
      sendEvent('error', { message: '缺少必填字段: question' });
      return res.end();
    }

    // ── Step 1: 方案 B — 向量检索 Top-3 相似题目 ──
    let similarQuestions = [];
    try {
      similarQuestions = await searchSimilarQuestions(question, {
        knowledge_point_id,
        subject_code: subject,
        top_k: 3,
        threshold: 0.5,
      });
    } catch (err) {
      console.warn(`[TutorAgent/Stream] 方案B向量检索失败: ${err.message}`);
    }

    if (closed) return res.end();

    // ── Step 2: 方案 A — Apache AGE 多跳图查询 + 学生掌握度 ──
    let learningContext = { prereqs: [], currentMastery: null, weakPrereqs: [] };
    let ageClient = null;

    if (knowledge_point_id) {
      try {
        ageClient = await borrowAgeClient(await getDb());
        learningContext = await assembleLearningContext(await getDb(), ageClient, userEmail, knowledge_point_id);
      } catch (err) {
        console.warn(`[TutorAgent/Stream] 方案A图谱查询失败: ${err.message}`);
      } finally {
        if (ageClient) {
          ageClient.release();
          ageClient = null;
        }
      }
    }

    if (closed) return res.end();

    // ── Step 3: 上下文组装 + 确定性元数据计算 ──
    const promptContext = {
      currentTopic: current_topic_name || knowledge_point_id || '未指定',
      prerequisites: learningContext.prereqs,
      currentMastery: learningContext.currentMastery,
      weakPrereqs: learningContext.weakPrereqs,
      similarQuestions,
    };

    const streamMeta = buildStreamMetadata(promptContext);

    // ── 立即发送 metadata 事件（前端可马上渲染诊断卡片）──
    sendEvent('metadata', {
      ...streamMeta,
      context: {
        similar_questions_count: similarQuestions.length,
        prerequisites_count: learningContext.prereqs.length,
        weak_prerequisites_count: learningContext.weakPrereqs.length,
        current_mastery: learningContext.currentMastery,
      },
    });

    if (closed) return res.end();

    // ── Step 4: 方案 C — LLM 流式推理 ──
    const systemPrompt = buildStreamSystemPrompt(promptContext);
    const userPrompt = buildUserPrompt(question, subject);

    let fullContent = '';
    try {
      for await (const chunk of streamChatCompletion(systemPrompt, userPrompt, {
        model: TUTOR_MODEL,
        temperature: 0.3,
        max_tokens: 4000,
        signal: { addEventListener: (_, fn) => req.on('close', fn) },
      })) {
        if (closed) break;
        fullContent += chunk;
        sendEvent('content', { delta: chunk });
      }
    } catch (llmErr) {
      if (!closed) {
        sendEvent('error', { message: `LLM 推理失败: ${llmErr.message}` });
      }
    }

    // ── Step 5: 发送完成事件 ──
    if (!closed) {
      sendEvent('done', {
        duration_ms: Date.now() - startTime,
        content_length: fullContent.length,
      });
    }

    res.end();
  } catch (err) {
    console.error('[TutorAgent/Stream] 流式推理失败:', err.message);
    if (!closed) {
      sendEvent('error', { message: `推理失败: ${err.message}` });
      res.end();
    }
  }
});

export default router;
