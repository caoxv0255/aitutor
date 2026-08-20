import express from 'express';
import { getProvinceTrends, getProvinceCompare } from '../../handlers/province-trends.js';
import { getSubjectTrends } from '../../handlers/subject-trends.js';
import { getExpertSummary } from '../../handlers/trend-summary.js';

const router = express.Router();

router.get('/expert-summary', getExpertSummary);

export default router;
