/**
 * Legacy API 兼容层 (D-Bug-D 修复, 2026-08-23; v2 简化 2026-08-23)
 *
 * 背景:
 *   - 后端从 handlers/ 迁到 modules/ 后, 路径前缀从 /api/{x} 变成 /api/{module}/{x}
 *   - 旧 frontend/ + public/ (PWA) 仍在调旧路径
 *   - F3 (ai-tutor-frontend/) 已对齐新路径, 不需要 alias
 *
 * 设计:
 *   - server.js 把它装在 modulesRouter 之前
 *   - 大部分 handler 直接 import 调用 (兼容旧请求契约)
 *   - 不可用路径返回 410 Gone
 *   - Sunset: 2026-09-23 (D070 30 天兼容期)
 *
 * v2 简化 (2026-08-23):
 *   - 删 unwrapEnvelope (PWA 已迁 envelope 格式)
 *   - 删 /api/learning-path (改 410, 新路径 /api/analytics/learning-path)
 *   - /api/reports 保留 handler 转发 (compat 行为不变, 因为 frontend/PWA 还在调)
 */
import express from 'express';
import loginRouter from './handlers/login.js';
import registerRouter from './handlers/register.js';
import guestLoginRouter from './handlers/guest-login.js';
import { getUserProvince, setUserProvince, deleteUserProvince } from './handlers/user-province.js';
import { getWrongQuestions, addWrongQuestion, updateWrongQuestion, deleteWrongQuestion, getWrongQuestionStats } from './handlers/wrong-questions.js';
import reportsHandler from './handlers/reports.js';

const router = express.Router();

// 工具: 410 Gone
const gone = (oldPath, newPath) => (req, res) => {
  res.status(410).json({
    success: false,
    message: `API ${oldPath} 已废弃, 请改用 ${newPath}`,
    legacyGone: true,
    oldPath,
    newPath,
    sunset: '2026-09-23',
  });
};

// ===== 1. AUTH =====
router.post('/login', loginRouter);
router.post('/guest-login', guestLoginRouter);
router.post('/register', registerRouter);
router.post('/reset-password', gone('/api/reset-password', '请联系管理员重置'));

// ===== 2. USER-PROVINCE (旧路径 /api/user-province → 新 /api/auth/prefs/province) =====
router.get('/user-province', getUserProvince);
router.post('/user-province', setUserProvince);
router.delete('/user-province', deleteUserProvince);

// ===== 3. WRONG QUESTIONS =====
router.get('/questions', getWrongQuestions);
router.post('/questions', addWrongQuestion);
router.put('/questions/:id', updateWrongQuestion);
router.delete('/questions/:id', deleteWrongQuestion);
router.get('/questions/stats', getWrongQuestionStats);

// ===== 4. TASKS (旧 /api/tasks 已退役) =====
router.get('/tasks', gone('/api/tasks', '/api/user/wrong-questions (POST 上传, 列表直接读)'));
router.post('/tasks', gone('/api/tasks', '/api/user/wrong-questions'));

// ===== 5. REPORTS (compat 转发到 modules 里的 reports.js) =====
router.get('/reports', reportsHandler);
router.post('/reports', reportsHandler);

// ===== 6. WEAK POINTS (转发到 /api/review/weak-points) =====
router.get('/weak-points', (req, res, next) => {
  req.url = '/review/weak-points' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  req.baseUrl = '/api';
  next();
});

// ===== 6b. EXAM PAPERS (转发到 /api/exam/papers) =====
// D-Bug-D v3 (2026-08-24): frontend province-page.js 调 /api/exam-papers?province=...
// compat fallthrough 转发到 /api/exam/papers (modulesRouter 已挂载)
router.get('/exam-papers', (req, res, next) => {
  req.url = '/exam/papers' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  req.baseUrl = '/api';
  next();
});

// ===== 7. 学习路径 (转发到 /api/analytics/learning-path, 旧前端 JS 调 /api/learning-path) =====
router.get('/learning-path', (req, res, next) => {
  req.url = '/analytics/learning-path' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  req.baseUrl = '/api';
  next();
});

// ===== 8. 个性化试卷 (后端无等价品) =====
router.post('/generate-paper', gone(
  '/api/generate-paper',
  '/api/tutor/ask (按需生成练习题)'
));

// ===== 9. 题目讲解 (后端无等价品) =====
router.post('/explain-question', gone(
  '/api/explain-question',
  '/api/tutor/ask (通用 AI 讲解)'
));

// ===== 10. 访客统计 (后端从未实现) =====
router.get('/stats/visits', gone('/api/stats/visits', '客户端 analytics'));
router.post('/stats/visits/increment', gone('/api/stats/visits/increment', '客户端 analytics'));

// ===== 11. STUDY PLAN (frontend-legacy/redesign 探索目录, 未上线) =====
const studyPlanGone = gone('/api/user/study-plan/*', '/api/user/learning-suggestions');
router.get('/user/study-plan/daily-tasks', studyPlanGone);
router.get('/user/study-plan/plans', studyPlanGone);
router.post('/user/study-plan/plans', studyPlanGone);
router.get('/user/study-plan/tasks/:id', studyPlanGone);
router.post('/user/study-plan/generate', studyPlanGone);
router.post('/user/study-plan/mock-exam', studyPlanGone);

export default router;