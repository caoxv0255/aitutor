// assets/js/api/services/wrong.js — 用户错题本 (F3 Slice 3 read-only MVP)
// 域: user-uploaded wrong questions (跟 exam.questions 题库不混)
// 后端: api/handlers/questions.js → wrong_questions 表
// envelope: backend createPaginatedResponse (data: array + pagination 子对象)
// 纪律: 不拆信封, page 层做 res.data / res.pagination
// Slice 3.2 (R1 write MVP): deleteQuestion + createQuestion. markMastered deferred
// (backend questions.js 无 PUT/PATCH route, 待 backend 实现)
import { request } from '../client.js';

export const wrong = {
  async getQuestions({ subject, difficulty, knowledgePointId, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (difficulty) params.set('difficulty', String(difficulty));
    if (knowledgePointId) params.set('knowledge_point_id', knowledgePointId);
    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));
    return request('GET', `/api/questions?${params}`, null, { mockName: 'wrong_questions' });
  },
  /**
   * 删除单条错题 (Slice 3.2: write op)
   * @param {string|number} id
   * @returns {Promise<{success, message}>}
   */
  async deleteQuestion(id) {
    if (!id) throw new Error('wrong.deleteQuestion: id required');
    return request('DELETE', '/api/questions', { id }, { mockName: 'wrong_delete' });
  },
  /**
   * 创建错题 (Slice 3.2: 供 tutor '加入错题本' 触发, cross-page workflow)
   * @param {object} payload
   * @param {string} payload.question      — 必填
   * @param {string} payload.subject       — '数学' 等
   * @param {string} [payload.answer]
   * @param {string} [payload.analysis]
   * @param {string} [payload.knowledge_point_id]
   * @param {number} [payload.difficulty]
   * @param {string} [payload.question_id]  — 关联 exam bank qid
   * @returns {Promise<{success, message, data: {id: string}}>}
   */
  async createQuestion(payload) {
    if (!payload || !payload.question) throw new Error('wrong.createQuestion: question required');
    return request('POST', '/api/questions', payload, { mockName: 'wrong_create' });
  },
  /**
   * 标记错题掌握状态 (P0.4 commit 4)
   * 后端: PUT /api/wrong-questions/:id { is_correct, mastered, ... }
   * 实际挂在 api/modules/user/routes.js (modulesRouter 自动挂 /api/ 前缀)
   * @param {string|number} id
   * @param {{ is_correct?: boolean, mastered?: boolean, analysis_note?: string }} patch
   * @returns {Promise<{success, message}>}
   */
  async markMastered(id, patch = {}) {
    if (!id) throw new Error('wrong.markMastered: id required');
    const payload = { ...patch };
    if (typeof payload.is_correct === 'boolean') payload.is_correct = payload.is_correct;
    if (typeof payload.mastered === 'boolean') payload.mastered = payload.mastered;
    return request('PUT', `/api/wrong-questions/` + id, payload, { mockName: 'wrong_mark_mastered' });
  },
};