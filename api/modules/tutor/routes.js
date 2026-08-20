import express from 'express';
import tutorAgentRouter from '../../routes/tutor-agent.js';
import learningLoopRouter from '../../routes/learning-loop.js';
import knowledgeGraphRouter from '../../routes/knowledge-graph.js';

const router = express.Router();

// 2026-08-20 DSH 修复: 之前 router.use('/agent', ...) 让端点变成 /api/tutor/agent/ask,
// 但前端 (tutor.js:41) 调 /api/tutor/ask → 404. 改成 router.use('/', ...) 跟 rag / vision 模块一致
// (D068 教训注释明确写'Use / not /search — avoid double prefix'). 后端改动 0 行代码,
// 1 行字符串, 不动 tutor-agent.js 内部路由.
router.use('/', tutorAgentRouter);
router.use('/loop', learningLoopRouter);
router.use('/graph', knowledgeGraphRouter);

export default router;
