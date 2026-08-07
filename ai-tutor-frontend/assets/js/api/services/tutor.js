// services/tutor.js — 教学 Agent (F3 Slice 4 Phase 1 read-only MVP)
// 域: pedagogical chat agent (跟 rag.ask 不同, 走 /api/tutor/ask, 有 diagnosis/learning_path)
// 后端: api/routes/tutor-agent.js → askTutorAgent()
// envelope: backend successResponse (data + message, 无 pagination)
// Slice 4.1/4.2/4.3 (deferred): askStream / getHistory / getMastery / session 持久化
// Phase 1 不接 SSE, 不接 history 持久化, 不接 cross-page
import { request } from '../client.js';

export const tutor = {
  /**
   * 单次问答 (non-streaming)
   * @param {object} opts
   * @param {string} opts.question       — 必填
   * @param {string} [opts.knowledgePointId]
   * @param {string} [opts.subject]      — '数学' 等 (backend 自己处理中文/英文)
   * @param {string} [opts.currentTopicName]
   * @returns {Promise<{success, message, data: TutorResponse}>}
   */
  async ask({ question, knowledgePointId, subject, currentTopicName } = {}) {
    if (!question) throw new Error('tutor.ask: question required');
    return request('POST', '/api/tutor/ask', {
      question,
      knowledge_point_id: knowledgePointId,
      subject,
      current_topic_name: currentTopicName,
    }, { mockName: 'tutor_ask' });
  },
  // Slice 4.1/4.2/4.3 (deferred):
  // async getMastery(kpId) { ... }   → GET /api/tutor/mastery/:kpId
  // async getHistory(sessionId) { ... }  → session 持久化 backend 调研后
  // async askStream(...) { ... }      → SSE (Slice 4.3)
};