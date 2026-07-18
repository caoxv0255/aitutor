import express from 'express';
import { checkIn, getCheckinStatus, getPointsHistory, getBadges } from '../../handlers/gamification.js';

const router = express.Router();

router.post('/checkin', checkIn);
router.get('/checkin/status', getCheckinStatus);
router.get('/points/history', getPointsHistory);
router.get('/badges', getBadges);

export default router;
