// services/knowledge.js — 知识图谱 + 掌握度
import { request } from '../client.js';

export const knowledge = {
  // Phase-G3-fix (2026-08-24): 针对练习题
  async getPracticeQuestions(kpId, { limit = 5 } = {}) {
    return request('GET', `/api/knowledge/${encodeURIComponent(kpId)}/practice?limit=${limit}`, null, { mockName: 'knowledge_practice' });
  },

  async getMastery({ subject } = {}) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request('GET', `/api/knowledge/mastery${q}`, null, { mockName: 'knowledge_mastery' });
  },

  async getKpDetail(kpId) {
    return request('GET', `/api/knowledge/mastery/${kpId}`, null, { mockName: 'knowledge_kp' });
  },

  async getKnowledgeMap({ subject } = {}) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request('GET', `/api/knowledge/map${q}`, null, { mockName: 'knowledge_map' });
  },

  async getKnowledgePoints({ subject } = {}) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request('GET', `/api/knowledge/points${q}`, null, { mockName: 'knowledge_points' });
  },

  async getSuggestions() {
    return request('GET', '/api/user/learning-suggestions', null, { mockName: 'knowledge_suggestions' });
  },

  async getProfile() {
    return request('GET', '/api/user/knowledge-profile', null, { mockName: 'knowledge_profile' });
  },

  // Phase-H1-fix (2026-08-24): 跨学科影响分析
  async getCrossSubjectImpact(subject) {
    return request('GET', `/api/knowledge/cross-subject-impact?subject=${encodeURIComponent(subject)}`, null, { mockName: 'knowledge_cross_subject' });
  },
};
