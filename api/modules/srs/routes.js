/**
 * srs 模块路由 (Audit-2026-08-24 Fix-4 标注)
 *
 * 状态: 3 个 endpoint 已实现 (daily-tasks/complete/stats), 但前端无消费者
 *   - F3 service 目录 (ai-tutor-frontend/assets/js/api/services/) 无 srs.js
 *   - audit 报告 P1.7: 56% endpoint 未引用
 *   - 保留 mount 以便未来 review.html (D071 Immersive Shell) 接 SRS 复习调度
 */
import express from 'express';
import srsEngineRouter from '../../routes/srs-engine.js';

const router = express.Router();

router.use('/engine', srsEngineRouter);

export default router;
