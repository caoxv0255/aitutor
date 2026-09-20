// assets/js/api/services/loop.js — Loop Hub 服务聚合层
//
// Round 1 (2026-09-15): 把 8 个功能的数据源收口到一个 service,
// Practice Hub 页面只需调 loop.summary() 一个方法即可拿到全部 UI 数据.
//
// 后端端点:
//   GET  /api/user/dashboard                — 用户 dashboard 汇总 (含 streak/stats)
//   GET  /api/review/weak-points             — 薄弱知识点列表 (加权评分)
//   GET  /api/srs/engine/daily-tasks         — SRS 今日复习任务
//   GET  /api/exam/questions/similar?kp=...   — 按知识点查相似题 (推荐)
//   GET  /api/user/wrong-questions           — 用户错题本 (按学科)
//   GET  /api/essay/list                     — 作文批改列表
//
// mock 文件: assets/js/api/mock/loop_summary.json + 各个子 mock
//
// 出口契约 (D062 envelope): 返回完整 envelope, page 层 res.data.X
// USE_MOCK: 走 USE_MOCK.js 的 lazy toggle, 真后端 / mock 自动切换.

import { request } from '../client.js';

// 9 学科固定顺序: 语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 政治
export const SUBJECT_ORDER = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];
export const SUBJECT_NAME = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  history: '历史', geography: '地理', politics: '政治',
};

const MOCK_PREFIX = 'mock/';

async function fetchOne(method, url, body, mockName) {
  return request(method, url, body, { mockName });
}

/**
 * Loop Hub 汇总 — Practice Hub 主页一次拿全数据
 *
 * @returns {Promise<{
 *   success: boolean,
 *   data: {
 *     date: string,
 *     streak_days: number,
 *     stats: {
 *       overall_score: number, overall_score_delta: number,
 *       weak_points_total: number, weak_points_delta: number,
 *       today_questions_done: number, today_questions_target: number,
 *       today_minutes_done: number, today_minutes_target: number
 *     },
 *     subject_distribution: Array<{subject, count, level}>,
 *     hot_kps: Array<{kp_id, name, subject, weight}>,
 *     next_actions: Array<{id, kind, title, desc, href, featured, icon}>
 *   }
 * }>}
 */
export async function getLoopSummary() {
  // 单端点聚合, 后端在 D082 Sprint 2 落地, 此处 mock-first
  return fetchOne('GET', '/api/loop/summary', null, 'loop_summary');
}

/**
 * 今日任务 (D082 Sprint 2 形状, today_* lifecycle)
 * @returns {Promise<{success, data: {date, streak_days, tasks: Array}}>}
 */
export async function getToday() {
  return fetchOne('GET', '/api/user/today', null, 'today_get');
}

/**
 * 启动一个今日任务
 * @param {string} taskId
 */
export async function startTodayTask(taskId) {
  return fetchOne('POST', `/api/user/today/${encodeURIComponent(taskId)}/start`, {}, 'today_start');
}

/**
 * 完成一个今日任务
 * @param {string} taskId
 * @param {{ score?: number, time_spent_ms?: number }} payload
 */
export async function completeTodayTask(taskId, payload = {}) {
  return fetchOne('POST', `/api/user/today/${encodeURIComponent(taskId)}/complete`, payload, 'today_complete');
}

/**
 * 跳过任务
 * @param {string} taskId
 * @param {string} reason
 */
export async function skipTodayTask(taskId, reason) {
  return fetchOne('POST', `/api/user/today/${encodeURIComponent(taskId)}/skip`, { reason }, 'today_skip');
}

/**
 * 按知识点查相似题 (用于"薄弱点 → 相似题推荐")
 * @param {string} kpId
 * @param {{ limit?: number }} [opts]
 */
export async function getSimilarByKp(kpId, { limit = 3 } = {}) {
  return fetchOne(
    'GET',
    `/api/exam/questions/similar?kp_id=${encodeURIComponent(kpId)}&limit=${limit}`,
    null,
    'similar_recommendations'
  );
}

/**
 * 作文批改汇总 (Loop 终点)
 */
export async function getEssaySummary() {
  return fetchOne('GET', '/api/essay/list?limit=10', null, 'essay_summary');
}

/**
 * 单学科大屏 — mastery → subject → KP → practice 闭环的关键下钻
 * @param {string} code - 学科代码 (chinese/math/english/physics/chemistry/biology/history/geography/politics)
 */
export async function getSubjectDetail(code) {
  return fetchOne('GET', `/api/loop/subject/${encodeURIComponent(code)}`, null, `subject_${code}`);
}

/**
 * 暴露聚合器 + 子方法, 兼容 service 模块默认导出
 */
export const loop = {
  getLoopSummary,
  getToday,
  startTodayTask,
  completeTodayTask,
  skipTodayTask,
  getSimilarByKp,
  getEssaySummary,
  getSubjectDetail,
};

export default loop;