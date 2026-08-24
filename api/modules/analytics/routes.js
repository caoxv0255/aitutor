/**
 * analytics 模块路由 (D-Bug-D v2, 2026-08-23)
 *
 * 背景: 之前 routes.js 是空 router, 导入 handler 但未挂载 (e2e fail 4 个之二)
 *
 * 设计:
 *   - 挂载 5 个 handler: learning-path / reports / class-analysis / teacher-dashboard / class-detail
 *   - 路径前缀 /api/analytics/* (F3 等新前端可调)
 *   - 旧路径 /api/learning-path /api/reports 仍走 compat 层 (向后兼容)
 *
 * 注意:
 *   - server.js 已挂载 /api/adaptive-difficulty (直挂, 不在本路由)
 *   - server.js 已挂载 /api/province-stats /province-trends (直挂, 不在本路由)
 */
import express from 'express';
import learningPathRouter from '../../handlers/learning-path.js';
import reportsHandler from '../../handlers/reports.js';
import { getClassAnalysis, getTeacherDashboard, getClassDetail } from '../../handlers/class-analysis.js';
import { authMiddleware } from '../../core/auth.js';

const router = express.Router();

router.get('/learning-path', authMiddleware, learningPathRouter); // /api/analytics/learning-path
router.get('/reports', authMiddleware, reportsHandler);             // /api/analytics/reports
router.get('/class/analysis', authMiddleware, getClassAnalysis);
router.get('/class/teacher', authMiddleware, getTeacherDashboard);
router.get('/class/detail', authMiddleware, getClassDetail);

export default router;