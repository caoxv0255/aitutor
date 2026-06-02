/**
 * GraphRAG API 路由
 * Express 后端对外的 GraphRAG 接口，做鉴权、限流后转发到内部 GraphRAG 服务
 */
import express from 'express';
import axios from 'axios';
import { authMiddleware } from './auth.js';
import { errorResponse } from './utils/response.js';

const router = express.Router();

// GraphRAG 内部服务地址
const GRAPHRAG_SERVICE_URL = process.env.GRAPHRAG_SERVICE_URL || 'http://127.0.0.1:8100';

// 简单内存限流
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1分钟
const RATE_LIMIT_MAX = 10; // 每用户每分钟最多10次

function checkRateLimit(userEmail) {
  const now = Date.now();
  const userLimit = rateLimits.get(userEmail);

  if (!userLimit || now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(userEmail, { windowStart: now, count: 1 });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count += 1;
  return true;
}

// 通用转发函数
async function forwardToGraphRAG(req, res, endpoint, data = {}) {
  const userEmail = req.user?.email;

  if (!checkRateLimit(userEmail || 'anonymous')) {
    return res.status(429).json(errorResponse('请求过于频繁，请稍后再试'));
  }

  try {
    const response = await axios.post(
      `${GRAPHRAG_SERVICE_URL}${endpoint}`,
      { ...data, user_email: userEmail },
      { timeout: 60000 }
    );
    return res.json(response.data);
  } catch (error) {
    console.error(`GraphRAG 请求失败: ${endpoint}`, error.message);
    if (error.response) {
      return res.status(error.response.status).json(errorResponse(error.response.data?.detail || 'GraphRAG 服务错误'));
    }
    return res.status(503).json(errorResponse('GraphRAG 服务暂不可用'));
  }
}

async function forwardGetToGraphRAG(req, res, endpoint) {
  const userEmail = req.user?.email;

  if (!checkRateLimit(userEmail || 'anonymous')) {
    return res.status(429).json(errorResponse('请求过于频繁，请稍后再试'));
  }

  try {
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${GRAPHRAG_SERVICE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
    const response = await axios.get(url, { timeout: 30000 });
    return res.json(response.data);
  } catch (error) {
    console.error(`GraphRAG GET 请求失败: ${endpoint}`, error.message);
    if (error.response) {
      return res.status(error.response.status).json(errorResponse(error.response.data?.detail || 'GraphRAG 服务错误'));
    }
    return res.status(503).json(errorResponse('GraphRAG 服务暂不可用'));
  }
}

// ===== 公开查询接口（需要登录） =====

/**
 * POST /api/graphrag/query
 * 通用 GraphRAG 查询
 */
router.post('/query', authMiddleware, async (req, res) => {
  const { query, index_name, method } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json(errorResponse('查询内容不能为空'));
  }

  // 智能选择索引
  let targetIndex = index_name || 'gaokao_all';
  const { subject, province, exam_level } = req.body;

  if (exam_level === '中考' && province === '北京') {
    targetIndex = 'zhongkao_beijing';
  } else if (subject === '数学') {
    targetIndex = 'subject_math';
  } else if (subject === '语文') {
    targetIndex = 'subject_chinese';
  }

  await forwardToGraphRAG(req, res, '/api/graphrag/query', {
    query: query.trim(),
    index_name: targetIndex,
    method: method || 'local',
  });
});

/**
 * POST /api/graphrag/explain
 * 题目讲解
 */
router.post('/explain', authMiddleware, async (req, res) => {
  const { question, subject, index_name } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json(errorResponse('题目内容不能为空'));
  }

  await forwardToGraphRAG(req, res, '/api/graphrag/explain', {
    question: question.trim(),
    subject: subject || '数学',
    index_name: index_name,
  });
});

/**
 * POST /api/graphrag/similar-questions
 * 查找相似真题
 */
router.post('/similar-questions', authMiddleware, async (req, res) => {
  const { question_text, subject, province, year_range, top_k } = req.body;

  if (!question_text || question_text.trim().length === 0) {
    return res.status(400).json(errorResponse('题目内容不能为空'));
  }

  await forwardToGraphRAG(req, res, '/api/graphrag/similar-questions', {
    question_text: question_text.trim(),
    subject,
    province,
    year_range,
    top_k: top_k || 5,
  });
});

/**
 * GET /api/graphrag/knowledge-map
 * 知识图谱
 */
router.get('/knowledge-map', authMiddleware, async (req, res) => {
  const { subject, exam_level, province } = req.query;

  if (!subject) {
    return res.status(400).json(errorResponse('学科参数必填'));
  }

  await forwardGetToGraphRAG(req, res, '/api/graphrag/knowledge-map');
});

/**
 * GET /api/graphrag/paper-source
 * 试卷溯源
 */
router.get('/paper-source', authMiddleware, async (req, res) => {
  const { province, year, subject } = req.query;

  if (!province || !year || !subject) {
    return res.status(400).json(errorResponse('省份、年份、学科参数均为必填'));
  }

  await forwardGetToGraphRAG(req, res, '/api/graphrag/paper-source');
});

// ===== 管理接口（仅管理员） =====

/**
 * GET /api/admin/graphrag/jobs
 * 索引任务状态
 */
router.get('/admin/jobs', authMiddleware, async (req, res) => {
  if (req.user?.email !== 'admin@uibe.edu.cn') {
    return res.status(403).json(errorResponse('权限不足'));
  }

  await forwardGetToGraphRAG(req, res, '/api/admin/graphrag/jobs');
});

/**
 * GET /api/admin/graphrag/stats
 * 统计信息
 */
router.get('/admin/stats', authMiddleware, async (req, res) => {
  if (req.user?.email !== 'admin@uibe.edu.cn') {
    return res.status(403).json(errorResponse('权限不足'));
  }

  await forwardGetToGraphRAG(req, res, '/api/admin/graphrag/stats');
});

/**
 * POST /api/admin/graphrag/reindex
 * 触发重新索引
 */
router.post('/admin/reindex', authMiddleware, async (req, res) => {
  if (req.user?.email !== 'admin@uibe.edu.cn') {
    return res.status(403).json(errorResponse('权限不足'));
  }

  const { index_name } = req.body;
  if (!index_name) {
    return res.status(400).json(errorResponse('索引名称必填'));
  }

  await forwardToGraphRAG(req, res, '/api/admin/graphrag/reindex', { index_name });
});

export default router;
