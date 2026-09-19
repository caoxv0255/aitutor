import express from 'express';
import tutorRoutes from './tutor/routes.js';
import examRoutes from './exam/routes.js';
import ragRoutes from './rag/routes.js';
import srsRoutes from './srs/routes.js';
import visionRoutes from './vision/routes.js';
import analyticsRoutes from './analytics/routes.js';
import gamificationRoutes from './gamification/routes.js';
import authRoutes from './auth/routes.js';
import userRoutes from './user/routes.js';
import knowledgeRoutes from './knowledge/routes.js';
import reviewRoutes from './review/routes.js';
// Phase-G1-fix (2026-08-24): 用户反馈通道 (1-5 星 + 评论)
import feedbackRoutes from './feedback/routes.js';
// Round 8 (2026-09-15): Loop Hub 聚合端点 (Practice Hub 8 功能收口)
import loopRoutes from './loop/routes.js';
// Round 8 (2026-09-15): D082 Sprint 2 今日任务 lifecycle (GET / POST start / complete / skip)
import todayRoutes from './today/routes.js';
// P11 (2026-09): 今日学习页数据源 (原 server.js 直挂, 现移入 modules)
import learningPathRoutes from './learning-path/routes.js';

const router = express.Router();

router.use('/tutor', tutorRoutes);
router.use('/exam', examRoutes);
router.use('/rag', ragRoutes);
router.use('/srs', srsRoutes);
router.use('/vision', visionRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/review', reviewRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/loop', loopRoutes);
// P11: /api/learning-path/current
router.use('/learning-path', learningPathRoutes);
// today 是 user 模块的子路由, 独立出来避免 user routes.js 变长
// 调用: /api/user/today/... (user.js 内部 use '/today', todayRoutes)
export default router;
