/**
 * feedback 模块路由 (Phase-G1-fix, 2026-08-24)
 *
 * 挂载点: /api/feedback
 * 端点:
 *   POST /api/feedback         submitFeedback   (auth 必填)
 *   GET  /api/feedback/stats   getFeedbackStats (auth 必填)
 */
import express from 'express';
import { authMiddleware } from '../../core/auth.js';
import { submitFeedback, getFeedbackStats } from '../../handlers/ai-feedback.js';

const router = express.Router();

router.post('/', authMiddleware, submitFeedback);
router.get('/stats', authMiddleware, getFeedbackStats);

export default router;