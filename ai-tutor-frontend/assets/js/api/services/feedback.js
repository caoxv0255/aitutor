// services/feedback.js — 用户反馈通道 (Phase-G1-fix, 2026-08-24)
// 1-5 星评分 + 可选评论, request_id 关联 ai_trace.
// envelope: backend successResponse (data + message, 无 pagination).
// D062: client.js 统一返回完整 envelope, page 层用 res.data.X.
import { request } from '../client.js';

export const feedback = {
  /**
   * 提交反馈
   * @param {object} opts
   * @param {string} opts.task_type   — 必填, e.g. 'tutor_ask'
   * @param {number} opts.rating      — 必填, 1-5
   * @param {string} [opts.comment]   — 可选, ≤2000 字
   * @param {string} [opts.request_id]— 可选, 关联 ai_trace
   * @returns {Promise<{success, message, data: {id, created_at}}>}
   */
  async submit({ task_type, rating, comment, request_id } = {}) {
    if (!task_type) throw new Error('feedback.submit: task_type required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('feedback.submit: rating must be integer 1-5');
    }
    return request('POST', '/api/feedback', { task_type, rating, comment, request_id }, { mockName: 'feedback_submit' });
  },
  /**
   * 获取统计 (avg_rating, total_count, distribution)
   * @param {object} [opts]
   * @param {number} [opts.days=7] — 时间窗口 1-90
   * @returns {Promise<{success, data: {avg_rating, total_count, distribution}}>}
   */
  async getStats({ days = 7 } = {}) {
    return request('GET', `/api/feedback/stats?days=${days}`, null, { mockName: 'feedback_stats' });
  },
};