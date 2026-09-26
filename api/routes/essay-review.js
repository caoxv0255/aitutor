/* ============================================================================
 * api/routes/essay-review.js — 作文智能批改路由 (2026-09-25)
 *
 * 端点 (挂载于 /api/essay):
 *   POST /api/essay/analyze            一张图片 → OCR + 批改 (复用 V1.0 两阶段服务)
 *   POST /api/essay/report/:reviewId   返回完整报告 (含图片 URL, 仅本人)
 *   GET  /api/essay/list               当前用户批改历史 (分页)
 *
 * 复用: authMiddleware (api/core/auth.js) / 统一响应 (api/utils/response.js) /
 *       essayStorage (essay_reports) / analyzeService (V1.0 服务编排)。
 *
 * 为什么挂在 server.js 的 app.use 而非 api/modules:
 *   现有 GET /api/essay/:id 直挂在 server.js, 会先把 /api/essay/list 当成 id 吃掉;
 *   新路由必须**先于**它注册。用 app.use('/api/essay', router) 追加挂载即满足,
 *   且不增加 release-gate「直挂 endpoint ≤ 12」计数 (该计数只数 app.get/post/...) 。
 *
 * 门禁: 错误对象 message 不进响应体 (第 11 段); logger meta 传对象 (第 12 段)。
 * ============================================================================ */

'use strict';

import express from 'express';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from '../core/auth.js';
import { logger } from '../core/logger.js';
import { successJson, errorJson } from '../utils/response.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { EssayError } from '../handlers/essay/errors.js';
import { startAnalyze, startPendingReclaimer } from '../handlers/essay/analyzeService.js';
import { getEssayReport, listEssayReports } from '../handlers/essay/essayStorage.js';

const router = express.Router();

// analyze 是重 LLM 调用, 单独限流 (与 server.js 的 essayLimiter 同口径: 5/min/用户)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req /*, res */) => (req.user && req.user.email) ? `u:${req.user.email}` : `ip:${req.ip}`,
  message: { error: '请求过于频繁，请稍后再试' },
});

/**
 * 统一错误出口: 记录 err 对象 (第 12 段), 对外只回固定文案 (第 11 段)。
 * 状态码/文案由 ErrorCode 的 ErrorMap 决定。
 */
function sendError(res, e, req, scope) {
  const code = (e instanceof EssayError && e.code) ? e.code : ErrorCode.INTERNAL_ERROR;
  logger.error(`[essay-review] ${scope} failed`, { error: e, requestId: req.requestId });
  return errorJson(res, code);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/essay/analyze  (2026-09-26 起为**异步**)
// Body: { image: dataURL|base64|http(s) URL,
//         title_image?: dataURL|base64|http(s) URL (作文题目图, 可选),
//         subject: 'chinese'|'english',
//         grade: 'junior'|'senior'(兼容具体年级), essay_title?, exam_level? }
// title_image 存在时: 落盘 + MaaS qwen3-vl 转写为题目文本, 写入 essay_title 且
// 作为「题目/要求」槽位喂进批改 prompt; 不传时行为与改动前一致。
// → 200 { data: { report_id, status: 'pending' } }
//
// 返回码取 200 (而非 202): 仓库统一响应工具 successJson 恒 200, 全仓无 202 先例;
// AIAPI.request 以 res.ok 判成功, 对 2xx 无差别。异步语义由 data.status 承载,
// 客户端轮询 /api/essay/report/:reviewId 直到它不再是 pending。
// ────────────────────────────────────────────────────────────────────────────
router.post('/analyze', authMiddleware, analyzeLimiter, async (req, res) => {
  try {
    const data = await startAnalyze({ req });
    return successJson(res, data, '批改已提交', { requestId: req.requestId });
  } catch (e) {
    return sendError(res, e, req, 'analyze');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/essay/report/:reviewId — 完整报告 (含图片 URL)
//
// 异步化后本端点**必须立即返回当前状态**: pending 就回 pending (行内 status 列),
// 绝不阻塞等后台跑完。前端据此轮询。
// ────────────────────────────────────────────────────────────────────────────
router.post('/report/:reviewId', authMiddleware, async (req, res) => {
  try {
    const email = req.user?.email;
    const row = await getEssayReport(req.params.reviewId);
    if (!row) {
      return errorJson(res, ErrorCode.REPORT_NOT_FOUND);
    }
    // 只允许本人访问 (report.user_email 为空的历史行放行, 与 V0 handler 一致)
    if (row.user_email && row.user_email !== email) {
      return errorJson(res, ErrorCode.AUTH_PERMISSION_DENIED);
    }
    return successJson(res, withImageUrl(row), 'ok', { requestId: req.requestId });
  } catch (e) {
    return sendError(res, e, req, 'report');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/essay/list?limit=20&page=1 — 当前用户批改历史 (分页)
// ────────────────────────────────────────────────────────────────────────────
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const email = req.user?.email;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    // 多取 1 条判断是否还有下一页 (避免额外 COUNT 查询)
    const rows = await listEssayReports(email, limit + 1, offset);
    const hasMore = rows.length > limit;
    const reports = hasMore ? rows.slice(0, limit) : rows;

    return successJson(
      res,
      { reports, pagination: { page, limit, has_more: hasMore } },
      'ok',
      { requestId: req.requestId }
    );
  } catch (e) {
    return sendError(res, e, req, 'list');
  }
});

/** 把 meta.image_url 提升为报告顶层字段 (无则 null), 方便前端统一取用 */
function withImageUrl(row) {
  const imageUrl = (row && row.meta && row.meta.image_url) || null;
  return { ...row, image_url: imageUrl };
}

// ────────────────────────────────────────────────────────────────────────────
// 孤儿回收: 本模块被 server.js 在启动时 import —— 在这里挂上即等价于「进程启动
// 扫一次 + 之后每 60s 扫一次」, 不改动 server.js 的任何挂载逻辑。
// 服务重启后上一进程遗留的 pending 行会被标 failed(pending_timeout), 不留悬空。
// ────────────────────────────────────────────────────────────────────────────
startPendingReclaimer();

export default router;
