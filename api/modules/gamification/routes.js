import express from 'express';
import { checkIn, getCheckinStatus, getPointsHistory, getBadges } from '../../handlers/gamification.js';

const router = express.Router();

export default router;
