import express from 'express';
import srsEngineRouter from '../../routes/srs-engine.js';

const router = express.Router();

router.use('/engine', srsEngineRouter);

export default router;
