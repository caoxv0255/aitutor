import express from 'express';
import { getProvinceTrends, getProvinceCompare } from '../../handlers/province-trends.js';
import { getLearningDashboard } from '../../handlers/learning-dashboard.js';
import learningPathRouter from '../../handlers/learning-path.js';
import { getClassAnalysis, getTeacherDashboard, getClassDetail } from '../../handlers/class-analysis.js';
import adaptiveDifficultyRouter from '../../handlers/adaptive-difficulty.js';
import reportsRouter from '../../handlers/reports.js';

const router = express.Router();

export default router;
