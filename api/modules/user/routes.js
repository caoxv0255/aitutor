import express from 'express';
import userProfileHandler from '../../handlers/user-profile.js';
import userSubjectsHandler from '../../handlers/user-subjects.js';
import userInitializeHandler from '../../handlers/user-initialize.js';
import subjectsHandler from '../../handlers/subjects.js';
import { getProvinces as provincesHandler } from '../../handlers/provinces.js';
import { getWrongQuestions, addWrongQuestion, updateWrongQuestion, deleteWrongQuestion, getWrongQuestionStats, exportWrongQuestions } from '../../handlers/wrong-questions.js';
import { getKnowledgeProfile, updateKnowledgeMastery, getLearningSuggestions } from '../../handlers/knowledge-profile.js';
import { getLearningDashboard } from '../../handlers/learning-dashboard.js';
// Round 8 (2026-09-15): D082 Sprint 2 今日任务 lifecycle
import todayRoutes from '../today/routes.js';

const router = express.Router();

// P0.7 (2026-08-15): F3 user.getDashboard() 契约端点 (之前缺失 → dashboard 真后端 404)
router.get('/dashboard', getLearningDashboard);

router.get('/profile', userProfileHandler);
router.post('/profile', userProfileHandler);

router.get('/subjects', userSubjectsHandler);
router.post('/subjects', userSubjectsHandler);
router.delete('/subjects', userSubjectsHandler);

router.post('/initialize', userInitializeHandler);

router.get('/wrong-questions', getWrongQuestions);
router.post('/wrong-questions', addWrongQuestion);

// G1 (2026-09-21): 错题闭环 —— 标记复习 / 删除
// updateWrongQuestion / deleteWrongQuestion 早已实现(sql 以 user_email 兜底, 越权或不存在 → 404),
// 但此前从未挂载路由 → 错题"只能进不能出", 错题本无法闭环(见 docs/spec/SPEC-DATA.md G1).
// 放在 /stats 与 /export 之后: 两者是 GET, 与这里的 PUT/DELETE 不冲突.
router.put('/wrong-questions/:id', updateWrongQuestion);
router.delete('/wrong-questions/:id', deleteWrongQuestion);

router.get('/wrong-questions/stats', getWrongQuestionStats);
router.get('/wrong-questions/export', exportWrongQuestions);

router.get('/knowledge-profile', getKnowledgeProfile);

router.get('/learning-suggestions', getLearningSuggestions);

// P0-fix (2026-08-24): Phase D — D3
// PM 报告: F3 service.user.getProvinces() 调 /api/user/provinces, 返回 404.
// server.js 里有 /api/provinces 直挂, 但 F3 走 /user/provinces, 需要补挂.
// provincesHandler 已在文件头 import (getProvinces as provincesHandler).
router.get('/provinces', provincesHandler);

// Round 8 (2026-09-15): 今日任务 lifecycle (D082 Sprint 2)
// 路径: /api/user/today/*  →  GET list, POST generate, POST /:id/start|complete|skip
router.use('/today', todayRoutes);

export default router;
