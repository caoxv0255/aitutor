/**
 * api/rag-search.js — 方案B：微观向量检索 + 方案A混合检索
 *
 * 核心能力:
 *   1. ingestQuestion()      — 题目文本 → Embedding → 存入 rag_questions（含 knowledge_point_id 关联方案A）
 *   2. searchSimilarQuestions() — 语义检索 + 可选的图谱节点过滤（混合检索）
 *
 * 架构边界:
 *   - 本模块属于方案 B（Micro Vector RAG），仅操作 pgvector 表
 *   - 通过 knowledge_point_id 字段与方案 A（Apache AGE KnowledgePoint）实现逻辑关联
 *   - 不执行图遍历、不触发 LLM 推理（那是方案 C 的职责）
 *
 * 安全规范:
 *   - 所有 SQL 查询严格使用参数化占位符（$1, $2...），禁止字符串拼接用户输入
 *   - 动态 WHERE 子句仅追加预定义条件，参数索引自动递增
 */

import express from 'express';
import { getDb } from '../core/db.js';
import { getEmbedding } from '../../services/embedding.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

/** 相似度阈值：余弦相似度 > 此值的结果才返回 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/** 默认返回结果数 */
const DEFAULT_TOP_K = 10;

/** 最大返回结果数 */
const MAX_TOP_K = 50;

// ─────────────────────────────────────────────────────────────────────────────
// 核心服务函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将题目数据向量化并存入数据库
 *
 * @param {object} questionData - 题目数据
 * @param {string} questionData.content - 题目文本内容（必填）
 * @param {string} [questionData.knowledge_point_id] - 关联方案A的知识点ID（如 'PHYSICS-002'）
 * @param {string} [questionData.subject_code] - 学科代码（如 'physics'）
 * @param {number} [questionData.difficulty] - 难度 1-5
 * @param {string} [questionData.question_type] - 题型代码（如 'choice'）
 * @param {number} [questionData.source_paper_id] - 来源试卷 ID
 * @param {object} [questionData.metadata] - 额外元数据（JSON）
 * @returns {Promise<{id: number, embedding_dims: number}>} 入库记录 ID 和向量维度
 */
export async function ingestQuestion(questionData) {
  const {
    content,
    knowledge_point_id,
    subject_code,
    difficulty,
    question_type,
    source_paper_id,
    metadata = {},
  } = questionData;

  // ── 输入校验 ──
  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    throw new Error('题目内容（content）不能为空且长度至少 10 个字符');
  }

  // ── 获取 Embedding 向量 ──
  const embedding = await getEmbedding(content);

  // ── 参数化写入（所有字段均通过占位符传递，防止注入） ──
  const pool = await getDb();
  const result = await pool.query(
    `INSERT INTO rag_questions
       (content, embedding, knowledge_point_id, subject_code, difficulty, question_type, source_paper_id, metadata)
     VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      content,
      `[${embedding.join(',')}]`,
      knowledge_point_id || null,
      subject_code || null,
      difficulty || null,
      question_type || null,
      source_paper_id || null,
      JSON.stringify(metadata),
    ]
  );

  return {
    id: result.rows[0].id,
    embedding_dims: embedding.length,
  };
}

/**
 * 语义检索相似题目（支持混合检索：向量 + 图谱节点过滤）
 *
 * 核心 SQL 逻辑:
 *   SELECT ... FROM rag_questions
 *   WHERE 1 - (embedding <=> $1) > $threshold          -- 向量相似度过滤
 *     [AND knowledge_point_id = $kpId]                  -- 可选：方案A图谱节点过滤
 *     [AND subject_code = $subject]                     -- 可选：学科过滤
 *     [AND difficulty BETWEEN $minDiff AND $maxDiff]    -- 可选：难度范围
 *   ORDER BY embedding <=> $1                           -- 按余弦距离升序
 *   LIMIT $topK
 *
 * @param {string} queryText - 用户查询文本
 * @param {object} [options] - 检索选项
 * @param {string} [options.knowledge_point_id] - 方案A知识点ID，用于精确图谱节点过滤
 * @param {string} [options.subject_code] - 学科代码过滤
 * @param {number} [options.difficulty_min] - 最低难度 (1-5)
 * @param {number} [options.difficulty_max] - 最高难度 (1-5)
 * @param {number} [options.top_k] - 返回结果数 (默认 10, 最大 50)
 * @param {number} [options.threshold] - 相似度阈值 (默认 0.7)
 * @param {boolean} [options.exclude_id] - 排除指定题目 ID（用于去重）
 * @returns {Promise<Array>} 相似题目数组（含 similarity 分数）
 */
export async function searchSimilarQuestions(queryText, options = {}) {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    throw new Error('查询文本不能为空');
  }

  const {
    knowledge_point_id,
    subject_code,
    difficulty_min,
    difficulty_max,
    top_k = DEFAULT_TOP_K,
    threshold = DEFAULT_SIMILARITY_THRESHOLD,
    exclude_id,
  } = options;

  const limit = Math.min(Math.max(parseInt(top_k) || DEFAULT_TOP_K, 1), MAX_TOP_K);

  // ── 获取查询向量 ──
  const queryEmbedding = await getEmbedding(queryText);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // ── 动态构建参数化查询 ──
  // 核心原则：所有用户可控值通过 $N 占位符传递，WHERE 子句仅追加预定义结构
  const conditions = [`1 - (embedding <=> $1) > $2`];
  const params = [embeddingStr, threshold];
  let paramIdx = 3;

  // 方案A协同：知识点精确过滤（逻辑外键关联 Apache AGE KnowledgePoint）
  if (knowledge_point_id && typeof knowledge_point_id === 'string') {
    conditions.push(`knowledge_point_id = $${paramIdx}`);
    params.push(knowledge_point_id);
    paramIdx++;
  }

  // 学科过滤
  if (subject_code && typeof subject_code === 'string') {
    conditions.push(`subject_code = $${paramIdx}`);
    params.push(subject_code);
    paramIdx++;
  }

  // 难度范围过滤
  const hasMinDiff = typeof difficulty_min === 'number';
  const hasMaxDiff = typeof difficulty_max === 'number';

  if (hasMinDiff && hasMaxDiff) {
    conditions.push(`difficulty BETWEEN $${paramIdx} AND $${paramIdx + 1}`);
    params.push(difficulty_min, difficulty_max);
    paramIdx += 2;
  } else if (hasMinDiff) {
    conditions.push(`difficulty >= $${paramIdx}`);
    params.push(difficulty_min);
    paramIdx++;
  } else if (hasMaxDiff) {
    conditions.push(`difficulty <= $${paramIdx}`);
    params.push(difficulty_max);
    paramIdx++;
  }

  // 排除指定 ID（用于"更多相似题"场景）
  if (typeof exclude_id === 'number') {
    conditions.push(`id != $${paramIdx}`);
    params.push(exclude_id);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  params.push(limit);

  // 使用 <=> (余弦距离) 排序；1 - distance = similarity
  const sql = `
    SELECT
      id,
      content,
      knowledge_point_id,
      subject_code,
      difficulty,
      question_type,
      metadata,
      1 - (embedding <=> $1) AS similarity
    FROM rag_questions
    WHERE ${whereClause}
    ORDER BY embedding <=> $1
    LIMIT $${paramIdx}
  `;

  const pool = await getDb();
  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    knowledge_point_id: row.knowledge_point_id,
    subject_code: row.subject_code,
    difficulty: row.difficulty,
    question_type: row.question_type,
    metadata: row.metadata,
    similarity: parseFloat(row.similarity.toFixed(4)),
  }));
}

/**
 * 根据 ID 删除已入库的题目（连同其向量数据）
 * @param {number} questionId - rag_questions.id
 * @returns {Promise<boolean>} 是否成功删除
 */
export async function deleteQuestion(questionId) {
  const pool = await getDb();
  const result = await pool.query('DELETE FROM rag_questions WHERE id = $1', [questionId]);
  return result.rowCount > 0;
}

/**
 * 获取 rag_questions 表的统计信息
 * @returns {Promise<object>} 统计结果
 */
export async function getIngestStats() {
  const pool = await getDb();
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT subject_code) AS subjects,
      COUNT(DISTINCT knowledge_point_id) FILTER (WHERE knowledge_point_id IS NOT NULL) AS knowledge_points,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS embedded
    FROM rag_questions
  `);
  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Express 路由
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/rag/ingest — 录入题目到向量库
 */
router.post('/ingest', authMiddleware, async (req, res) => {
  try {
    const { content, knowledge_point_id, subject_code, difficulty, question_type, source_paper_id, metadata } =
      req.body;

    if (!content) {
      return res.status(400).json(errorResponse('缺少必填字段: content'));
    }

    const result = await ingestQuestion({
      content,
      knowledge_point_id,
      subject_code,
      difficulty,
      question_type,
      source_paper_id,
      metadata,
    });

    return res
      .status(201)
      .json(successResponse({ id: result.id, embedding_dims: result.embedding_dims }, '题目已成功录入向量库'));
  } catch (err) {
    console.error('[RAG] 录入失败:', err.message);
    const status = err.message.includes('API Key') ? 503 : 500;
    return res.status(status).json(errorResponse(`录入失败: ${err.message}`));
  }
});

/**
 * POST /api/rag/search — 语义检索相似题目（支持混合检索）
 */
router.post('/search', authMiddleware, async (req, res) => {
  try {
    const { query, knowledge_point_id, subject_code, difficulty_min, difficulty_max, top_k, threshold, exclude_id } =
      req.body;

    if (!query) {
      return res.status(400).json(errorResponse('缺少必填字段: query'));
    }

    const results = await searchSimilarQuestions(query, {
      knowledge_point_id,
      subject_code,
      difficulty_min,
      difficulty_max,
      top_k,
      threshold,
      exclude_id,
    });

    return res.json(
      successResponse(
        {
          query,
          filters: {
            knowledge_point_id: knowledge_point_id || null,
            subject_code: subject_code || null,
            difficulty_range:
              typeof difficulty_min === 'number' || typeof difficulty_max === 'number'
                ? { min: difficulty_min ?? 1, max: difficulty_max ?? 5 }
                : null,
          },
          results,
          total: results.length,
        },
        `找到 ${results.length} 道相似题目`
      )
    );
  } catch (err) {
    console.error('[RAG] 检索失败:', err.message);
    const status = err.message.includes('API Key') ? 503 : 500;
    return res.status(status).json(errorResponse(`检索失败: ${err.message}`));
  }
});

/**
 * DELETE /api/rag/questions/:id — 删除已入库题目
 */
router.delete('/questions/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的 ID'));
    }

    const deleted = await deleteQuestion(id);
    if (!deleted) {
      return res.status(404).json(errorResponse('题目不存在'));
    }

    return res.json(successResponse(null, '题目已删除'));
  } catch (err) {
    console.error('[RAG] 删除失败:', err.message);
    return res.status(500).json(errorResponse(`删除失败: ${err.message}`));
  }
});

/**
 * GET /api/rag/stats — 获取向量库统计
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await getIngestStats();
    return res.json(successResponse(stats));
  } catch (err) {
    console.error('[RAG] 统计查询失败:', err.message);
    return res.status(500).json(errorResponse(`统计查询失败: ${err.message}`));
  }
});

export default router;
