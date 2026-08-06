// assets/js/api/services/wrong.js — 用户错题本 (F3 Slice 3 read-only MVP)
// 域: user-uploaded wrong questions (跟 exam.questions 题库不混)
// 后端: api/handlers/questions.js → wrong_questions 表
// envelope: backend createPaginatedResponse (data: array + pagination 子对象)
// 纪律: 不拆信封, page 层做 res.data / res.pagination
// Slice 3.2 (deferred): delete / markMastered 不在 R1
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
};