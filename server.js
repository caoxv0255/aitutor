import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import loginHandler from './api/handlers/login.js';
import registerHandler from './api/handlers/register.js';
import resetPasswordHandler, { sendResetCodeHandler } from './api/handlers/reset-password.js';
import guestLoginHandler from './api/handlers/guest-login.js';
import questionsHandler from './api/handlers/questions.js';
import reportsHandler from './api/handlers/reports.js';
import proxyHandler from './api/handlers/proxy.js';
import tasksHandler from './api/handlers/tasks.js';
import knowledgePointsHandler, { getWeakPointsHandler } from './api/handlers/knowledge-points.js';
import generatePaperHandler from './api/handlers/generate-paper.js';
import explainQuestionHandler from './api/handlers/explain-question.js';
import learningPathHandler from './api/handlers/learning-path.js';
import { getProvinces, getProvinceByCode, getProvinceStats } from './api/handlers/provinces.js';
import { getProvinceTrends, getProvinceCompare } from './api/handlers/province-trends.js';
import { getLearningDashboard } from './api/handlers/learning-dashboard.js';
import { seedProvinces } from './api/handlers/seed-provinces.js';
import { getUserProvince, setUserProvince, deleteUserProvince } from './api/handlers/user-province.js';
import { getExamPapers, getExamPaperById, createExamPaper } from './api/handlers/exam-papers.js';
import { getExamQuestions, createExamQuestion, batchCreateQuestions } from './api/handlers/exam-questions.js';
import { startExamSession, submitExamSession, getExamHistory } from './api/handlers/exam-session.js';
import adaptiveDifficultyHandler, {
  calculateUserAbility,
  calculateAdaptiveDifficulty,
} from './api/handlers/adaptive-difficulty.js';
import { getClassAnalysis, getTeacherDashboard, getClassDetail } from './api/handlers/class-analysis.js';
import { checkIn, getCheckinStatus, getPointsHistory, getBadges } from './api/handlers/gamification.js';
import { swaggerUI, swaggerSpec } from './api/core/swagger.js';
import { authMiddleware, validateJWTSecret } from './api/core/auth.js';
import { getDb } from './api/core/db.js';
import { startWorker } from './api/core/taskWorker.js';
import graphragRouter from './api/routes/graphrag.js';
import ragSearchRouter from './api/routes/rag-search.js';
import tutorAgentRouter from './api/routes/tutor-agent.js';
import learningLoopRouter from './api/routes/learning-loop.js';
import visionParseRouter from './api/routes/vision-parse.js';
import srsEngineRouter from './api/routes/srs-engine.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { securityHeaders, xssSanitizer, xssDetector, csrfProtection } from './api/middleware/security.js';

dotenv.config();

validateJWTSecret();

const app = express();
const PORT = process.env.PORT || 3002;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '请求过于频繁，请稍后再试' } });
const proxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: '请求过于频繁，请稍后再试' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求过于频繁，请稍后再试' } });

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(xssSanitizer);
app.use(xssDetector);
app.use(csrfProtection);

app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach((c) => {
      const idx = c.indexOf('=');
      if (idx > 0) {
        req.cookies[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
      }
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/aitutor')) {
    req.url = req.url.slice('/aitutor'.length) || '/';
  }
  next();
});

app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    res.sendFile('index.html', { root: 'frontend' });
  }
});

app.get('/index.html', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    res.sendFile('index.html', { root: 'frontend' });
  }
});

app.get('/app', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.use(express.static('public'));
app.use('/vendor', express.static('public/vendor'));
app.use(express.static('frontend'));
app.use('/frontend', express.static('frontend'));
app.use('/icons', express.static('public/icons'));
app.use(
  '/src',
  express.static('public/src', {
    setHeaders(res, path) {
      if (path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use('/uploads', express.static('uploads'));

const wrapHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
};

app.get('/api/health', async (_req, res) => {
  let dbReady = false;
  let dbError = '';
  try {
    await getDb();
    dbReady = true;
  } catch (e) {
    dbError = e && e.message ? String(e.message) : 'db_error';
  }
  res.json({ ok: true, dbReady, dbError });
});

app.get('/api-docs', swaggerUI);
app.get('/api-docs.json', swaggerSpec);

app.post('/api/login', authLimiter, wrapHandler(loginHandler));
app.post('/api/register', authLimiter, wrapHandler(registerHandler));
app.post('/api/guest-login', wrapHandler(guestLoginHandler));
app.post('/api/reset-password', wrapHandler(resetPasswordHandler));
app.post('/api/send-reset-code', wrapHandler(sendResetCodeHandler));

app.get('/api/provinces', wrapHandler(getProvinces));
app.get('/api/provinces/:code', wrapHandler(getProvinceByCode));
app.get('/api/province-stats/:code', wrapHandler(getProvinceStats));
app.get('/api/province-trends/:code', wrapHandler(getProvinceTrends));
app.get('/api/province-compare', wrapHandler(getProvinceCompare));
app.post('/api/provinces/seed', async (req, res) => {
  try {
    const result = await seedProvinces();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '种子导入失败' });
  }
});

app.get('/api/exam-papers', wrapHandler(getExamPapers));
app.get('/api/exam-papers/:id', wrapHandler(getExamPaperById));
app.get('/api/exam-questions/:paperId', wrapHandler(getExamQuestions));

app.all('/api/questions', authMiddleware, wrapHandler(questionsHandler));
app.all('/api/reports', authMiddleware, wrapHandler(reportsHandler));
app.all('/api/tasks', authMiddleware, wrapHandler(tasksHandler));
app.post('/api/proxy', authMiddleware, proxyLimiter, wrapHandler(proxyHandler));
app.get('/api/knowledge-points', authMiddleware, wrapHandler(knowledgePointsHandler));
app.get('/api/weak-points', authMiddleware, wrapHandler(getWeakPointsHandler));
app.post('/api/generate-paper', authMiddleware, wrapHandler(generatePaperHandler));
app.post('/api/explain-question', authMiddleware, wrapHandler(explainQuestionHandler));
app.get('/api/learning-path', authMiddleware, wrapHandler(learningPathHandler));
app.get('/api/learning-dashboard', authMiddleware, wrapHandler(getLearningDashboard));
app.post('/api/knowledge-points/seed', authMiddleware, wrapHandler(knowledgePointsHandler));

app.get('/api/user-province', authMiddleware, wrapHandler(getUserProvince));
app.post('/api/user-province', authMiddleware, wrapHandler(setUserProvince));
app.delete('/api/user-province/:exam_level', authMiddleware, wrapHandler(deleteUserProvince));

app.post('/api/exam-papers', authMiddleware, wrapHandler(createExamPaper));
app.post('/api/exam-questions', authMiddleware, wrapHandler(createExamQuestion));
app.post('/api/exam-questions/batch', authMiddleware, wrapHandler(batchCreateQuestions));

app.post('/api/exam-session/start', authMiddleware, apiLimiter, wrapHandler(startExamSession));
app.post('/api/exam-session/submit', authMiddleware, wrapHandler(submitExamSession));
app.get('/api/exam-session/history', authMiddleware, wrapHandler(getExamHistory));
app.get('/api/adaptive-difficulty', authMiddleware, wrapHandler(adaptiveDifficultyHandler));

app.get('/api/class-analysis', authMiddleware, wrapHandler(getClassAnalysis));
app.get('/api/teacher-dashboard', authMiddleware, wrapHandler(getTeacherDashboard));
app.get('/api/class-detail', authMiddleware, wrapHandler(getClassDetail));

app.post('/api/checkin', authMiddleware, wrapHandler(checkIn));
app.get('/api/checkin/status', authMiddleware, wrapHandler(getCheckinStatus));
app.get('/api/points', authMiddleware, wrapHandler(getPointsHistory));
app.get('/api/badges', authMiddleware, wrapHandler(getBadges));

app.use('/api/graphrag', graphragRouter);
app.use('/api/rag', ragSearchRouter);
app.use('/api/tutor', tutorAgentRouter);
app.use('/api/loop', learningLoopRouter);
app.use('/api/vision', visionParseRouter);
app.use('/api/srs', srsEngineRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API 端点不存在' });
});

app.use(errorHandler);

async function start() {
  try {
    await getDb();
    startWorker();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}

start();
