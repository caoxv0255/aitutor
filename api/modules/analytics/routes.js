import express from 'express';
import { getProvinceTrends, getProvinceCompare } from '../../handlers/province-trends.js';
import { getLearningDashboard } from '../../handlers/learning-dashboard.js';
import learningPathRouter from '../../handlers/learning-path.js';
import { getClassAnalysis, getTeacherDashboard, getClassDetail } from '../../handlers/class-analysis.js';
import adaptiveDifficultyRouter from '../../handlers/adaptive-difficulty.js';
import reportsRouter from '../../handlers/reports.js';

const router = express.Router();

router.get('/province/trends', getProvinceTrends);
router.get('/province/compare', getProvinceCompare);
router.get('/dashboard', getLearningDashboard);
router.use('/path', learningPathRouter);
router.get('/class/analysis', getClassAnalysis);
router.get('/class/teacher-dashboard', getTeacherDashboard);
router.get('/class/detail', getClassDetail);
router.use('/adaptive', adaptiveDifficultyRouter);
router.use('/reports', reportsRouter);

export default router;
