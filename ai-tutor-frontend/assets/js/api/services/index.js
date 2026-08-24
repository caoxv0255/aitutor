// services/index.js — 统一导出 11 个 service (Phase F-fix, 2026-08-24: 新增 gamification + srs)
export { auth } from './auth.js';
export { user } from './user.js';
export { exam } from './exam.js';
export { rag } from './rag.js';
export { knowledge } from './knowledge.js';
export { review } from './review.js';
export { vision } from './vision.js';
export { wrong } from './wrong.js';
export { tutor } from './tutor.js';
// Phase-F-fix (2026-08-24): F1 — 打卡 + 积分 + 徽章, F2 — SRS 间隔重复
export { gamification } from './gamification.js';
export { srs } from './srs.js';
// Phase-G1-fix (2026-08-24): G1 — 用户反馈通道
export { feedback } from './feedback.js';
// Phase-I-fix (2026-08-24): 教师/家长视角 (PM P1-9)
export { classAnalysis } from './class-analysis.js';
