// services/srs.js — SRS 间隔重复系统 (Phase F-fix, 2026-08-24)
// Phase-F-fix (2026-08-24): F2 — 新建 frontend service, 接后端 api/routes/srs-engine.js (mounted at /api/srs/engine)
//   修复 P1.7 audit: 3 个 endpoint 此前无前端消费者, 用户看不到"今日待复习".
//
// 后端端点 (api/routes/srs-engine.js, mounted at /api/srs/engine via api/modules/srs/routes.js):
//   GET  /api/srs/engine/daily-tasks  — 今日必复习任务 (limit/subject 参数)
//   POST /api/srs/engine/complete     — 记录一次复习, 更新 SRS 状态 + 复习日志
//   GET  /api/srs/engine/stats        — 累计 / 待复习 / 30 日活跃天数
//
// 出口契约 (D062 envelope, 2026-08-15): 返回完整 envelope {success, message, data}
//   page 层统一 res.data.X 消费
//
// mock 文件: assets/js/api/mock/srs_{daily_tasks,complete,stats}.json

import { request } from '../client.js';

export const srs = {
  /**
   * 获取今日必复习任务列表 (按优先级降序).
   * @param {{limit?: number, subject?: string}} [opts]
   * @returns {Promise<{success: boolean, data: {tasks: Array, stats: object, generated_at: string}}>}
   */
  async getDailyTasks({ limit = 20, subject } = {}) {
    const params = [];
    if (limit) params.push(`limit=${encodeURIComponent(limit)}`);
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return request('GET', `/api/srs/engine/daily-tasks${qs}`, null, { mockName: 'srs_daily_tasks' });
  },

  /**
   * 记录一次复习 (SM-2 算法更新 EF/interval/mastery).
   * @param {string} taskId        — knowledge_point_id
   * @param {boolean} isCorrect    — 是否答对
   * @param {number} [timeSpentMs] — 答题耗时 (毫秒, SM-2 quality 信号)
   * @returns {Promise<{success: boolean, data: {old_mastery, new_mastery, mastery_delta, quality, new_interval, next_review_at, ...}}>}
   */
  async completeTask(taskId, isCorrect, timeSpentMs = 0) {
    return request(
      'POST',
      '/api/srs/engine/complete',
      { task_id: taskId, is_correct: isCorrect, time_spent_ms: timeSpentMs },
      { mockName: 'srs_complete' }
    );
  },

  /**
   * SRS 复习统计 (总数 / 今日 / 待复习 / 30 日活跃).
   * @returns {Promise<{success: boolean, data: {total_reviews: number, today_reviews: number, due_count: number, active_days_30d: number}}>}
   */
  async getStats() {
    return request('GET', '/api/srs/engine/stats', null, { mockName: 'srs_stats' });
  },
};