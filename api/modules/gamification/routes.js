/**
 * gamification 模块路由 (D-Bug-D v2, 2026-08-23)
 *
 * 背景: 之前 routes.js 是空 router, handler 文件存在但未挂载.
 * 这里挂载 4 个 handler: checkin / checkin status / points / badges.
 */
import express from 'express';
import { checkIn, getCheckinStatus, getPointsHistory, getBadges } from '../../handlers/gamification.js';
import { authMiddleware } from '../../core/auth.js';

const router = express.Router();

router.post('/checkin', authMiddleware, checkIn);
router.get('/checkin/status', authMiddleware, getCheckinStatus);
router.get('/points', authMiddleware, getPointsHistory);
router.get('/badges', authMiddleware, getBadges);

export default router;