/**
 * learning-path 模块路由 (P11, 2026-09)
 *
 * 今日学习页数据源: 4 阶段时间轴 + AI 推荐理由 + 今日任务
 *
 * 从 server.js 直挂迁移过来 —— release-gate.sh 第 4 项守「直挂 endpoint ≤ 12」,
 * 新增端点必须走 api/modules/* (见 scripts/release-gate.sh 注释).
 * 挂载: api/modules/index.js → router.use('/learning-path') → /api/learning-path/current
 */
import express from 'express';
import { getCurrentLearningPath } from '../../handlers/learning-path.js';
import { authMiddleware } from '../../core/auth.js';

const router = express.Router();

// 等价 server.js 的 wrapHandler (未在 server.js 导出):
// Express 4 只在 handler 返回 promise 时才把 rejection 转给 error middleware,
// 同步 throw 需要显式 try/catch.
const wrap = (handler) => async (req, res, next) => {
  try {
    const ret = handler(req, res, next);
    if (ret && typeof ret.then === 'function') await ret;
  } catch (error) {
    next(error);
  }
};

router.get('/current', authMiddleware, wrap(getCurrentLearningPath));

export default router;
