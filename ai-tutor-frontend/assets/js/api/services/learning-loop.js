// services/learning-loop.js — Learning Loop feedback 通道 (Sprint 1, 2026-Q4)
// 单一职责: 包装 /api/tutor/loop/* 3 个 endpoint (Sprint 1 不接 graph)
// D062: client.js 统一返回完整 envelope, page 层用 res.data.X
// 后端字段约束参考 api/routes/learning-loop.js line 252-256, 320-388
import { request } from '../client.js';

export const learningLoop = {
  /**
   * 单次答题反馈 (主入口)
   * 后端字段约束:
   *   - knowledge_point_id: string, 必填
   *   - is_correct: boolean, 必填 (严格 boolean, 不是 truthy)
   *   - time_spent_ms: integer, 可选, 默认 0
   *   - hint_requested: boolean, 可选, 默认 false
   *   - subject / user_email: 后端不接收, 从 JWT + KP id 取
   * @param {object} opts
   * @param {string} opts.knowledge_point_id
   * @param {boolean} opts.is_correct
   * @param {number} [opts.time_spent_ms=0]
   * @param {boolean} [opts.hint_requested=false]
   * @returns {Promise<{success, message, data: {feedback, ripple_summary}}>}
   */
  async submitFeedback({ knowledge_point_id, is_correct, time_spent_ms = 0, hint_requested = false } = {}) {
    if (!knowledge_point_id) {
      throw new Error('learningLoop.submitFeedback: knowledge_point_id required');
    }
    if (typeof is_correct !== 'boolean') {
      throw new Error('learningLoop.submitFeedback: is_correct (boolean) required');
    }
    return request('POST', '/api/tutor/loop/feedback', {
      knowledge_point_id,
      is_correct,
      time_spent_ms,
      hint_requested,
    }, { mockName: 'tutor_loop_feedback' });
  },

  /**
   * 批量反馈 (考试模式)
   * 后端字段约束:
   *   - feedbacks: 1-100 条
   *   - 单条结构: { knowledge_point_id, is_correct, time_spent_ms?, hint_requested? }
   *   - subject / exam_session_id: 后端不接收
   * @param {object} opts
   * @param {Array<{knowledge_point_id: string, is_correct: boolean, time_spent_ms?: number, hint_requested?: boolean}>} opts.feedbacks
   * @returns {Promise<{success, message, data: {total, succeeded, failed, summary}}>}
   */
  async submitBatch({ feedbacks } = {}) {
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      throw new Error('learningLoop.submitBatch: feedbacks array required');
    }
    if (feedbacks.length > 100) {
      throw new Error('learningLoop.submitBatch: max 100 feedbacks per batch');
    }
    // 过滤无效项 (避免后端 400 导致整批失败)
    const valid = feedbacks.filter((f) =>
      f && typeof f.knowledge_point_id === 'string' && f.knowledge_point_id.length > 0
        && typeof f.is_correct === 'boolean'
    );
    if (valid.length === 0) {
      throw new Error('learningLoop.submitBatch: no valid feedbacks (need knowledge_point_id + is_correct boolean)');
    }
    return request('POST', '/api/tutor/loop/batch', { feedbacks: valid }, { mockName: 'tutor_loop_batch' });
  },

  /**
   * 获取全量掌握度 (Sprint 1 不被任何页面消费, 但 service 保留以便 Sprint 2 dashboard 接)
   * @returns {Promise<{success, data: {masteries: Array}}>}
   */
  async getMastery() {
    return request('GET', '/api/tutor/loop/mastery', null, { mockName: 'tutor_loop_mastery' });
  },
};
