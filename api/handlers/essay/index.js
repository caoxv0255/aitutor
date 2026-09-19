/* ============================================================================
 * essay/index.js — D086 §12 L4 · HTTP handler exports
 *
 * POST /api/essay/grade    拍照 / 上传 → AI 批改
 * GET  /api/essay          列出当前用户的报告
 * GET  /api/essay/:id      查询单条报告详情
 * ============================================================================ */

'use strict';

import { gradeEssay } from './essayService.js';
import { getEssayReport, listEssayReports } from './essayStorage.js';
import { successJson, errorJson } from '../../utils/response.js';
import { ErrorCode } from '../../utils/errorCodes.js';

/**
 * POST /api/essay/grade
 * Body: { images: string[] (data: URL), essay_title?, exam_level, grade }
 */
export async function gradeEssayHandler(req, res) {
  if (req.method !== 'POST') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }
  const email = req.user && req.user.email;
  if (!email) {
    return errorJson(res, ErrorCode.AUTH_NOT_LOGIN);
  }
  const { images, essay_title, exam_level, grade } = req.body || {};
  const result = await gradeEssay({
    user_email: email,
    images, essay_title, exam_level, grade,
    req,
  });
  if (!result.success) {
    return errorJson(res, ErrorCode.INTERNAL_ERROR, result.message || '批改失败');
  }
  return successJson(res, result.data, '批改完成', { requestId: req.requestId });
}

/**
 * GET /api/essay
 * Query: ?limit=20
 */
export async function listEssaysHandler(req, res) {
  if (req.method !== 'GET') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }
  const email = req.user && req.user.email;
  if (!email) {
    return errorJson(res, ErrorCode.AUTH_NOT_LOGIN);
  }
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const rows = await listEssayReports(email, limit);
  return successJson(res, { reports: rows }, 'ok', { requestId: req.requestId });
}

/**
 * GET /api/essay/:id
 */
export async function getEssayHandler(req, res) {
  if (req.method !== 'GET') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }
  const email = req.user && req.user.email;
  if (!email) {
    return errorJson(res, ErrorCode.AUTH_NOT_LOGIN);
  }
  const id = req.params.id;
  const row = await getEssayReport(id);
  if (!row) {
    return errorJson(res, ErrorCode.NOT_FOUND, '报告不存在');
  }
  // 权限检查：只允许本人访问
  if (row.user_email && row.user_email !== email) {
    return errorJson(res, ErrorCode.AUTH_PERMISSION_DENIED, '无权访问该报告');
  }
  return successJson(res, row, 'ok', { requestId: req.requestId });
}
