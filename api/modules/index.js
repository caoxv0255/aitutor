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

export default router;
