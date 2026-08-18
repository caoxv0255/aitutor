import express from 'express';
import ragSearchRouter from '../../routes/rag-search.js';
import graphragRouter from '../../routes/graphrag.js';

const router = express.Router();

// Use '/' not '/search' — routes inside rag-search.js are already POST /search, /ingest, etc.
// D068-fix (2026-08-17): avoid /api/rag/search/search double prefix
router.use('/', ragSearchRouter);
router.use('/graphrag', graphragRouter);

export default router;
