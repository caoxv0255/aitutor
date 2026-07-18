import express from 'express';
import tutorAgentRouter from '../../routes/tutor-agent.js';
import learningLoopRouter from '../../routes/learning-loop.js';
import knowledgeGraphRouter from '../../routes/knowledge-graph.js';

const router = express.Router();

router.use('/agent', tutorAgentRouter);
router.use('/loop', learningLoopRouter);
router.use('/graph', knowledgeGraphRouter);

export default router;
