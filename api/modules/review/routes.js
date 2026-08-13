import express from 'express';
import { getDb } from '../../core/db.js';
import { successResponse } from '../../utils/response.js';
import { authMiddleware } from '../../core/auth.js';
const router = express.Router();
router.use(authMiddleware);
router.get('/reports', (req, res) => res.json({ok: true}));
export default router;
