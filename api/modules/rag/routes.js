import express from 'express';
import ragSearchRouter from '../../routes/rag-search.js';
import graphragRouter from '../../routes/graphrag.js';

const router = express.Router();

router.use('/search', ragSearchRouter);
router.use('/graphrag', graphragRouter);

export default router;
