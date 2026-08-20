// services/rag.js — RAG 检索 (复用后端 pgvector + GraphRAG)
// 2026-08-20 DSH: 修 audit-routing.mjs 报告的 7 个 404 路径
//   - 前端之前都加了 /api/rag/search/ 前缀, 但后端 api/modules/rag/routes.js 是
//     router.use('/', ragSearchRouter), 实际端点直接是 /api/rag/...
//   - 改前端去掉 /search/ 多余前缀
//   - explain/ask 后端无对应端点, 标 mock-only 守卫
import { request } from '../client.js';
import { getMockEnabled } from '../USE_MOCK.js';

export const rag = {
  async search({ query, subject, topK = 10, threshold = 0.7 } = {}) {
    return request('POST', '/api/rag/search', {
      query, subject_code: subject, top_k: topK, threshold,
    }, { mockName: 'rag_search' });
  },

  async multiSearch({ query, subject, vectorType = 'q+s', topK = 10 } = {}) {
    return request('POST', '/api/rag/multi/search', {
      query, subject_code: subject, vector_type: vectorType, top_k: topK,
    }, { mockName: 'rag_multi_search' });
  },

  async similarQuestions({ questionId, question_id, topK = 5, subject } = {}) {
    const qid = questionId || question_id;
    if (!qid) throw new Error('rag.similarQuestions: questionId required');
    return request('POST', `/api/rag/multi/questions/${encodeURIComponent(qid)}`, {
      top_k: topK, subject_code: subject,
    }, { mockName: 'rag_similar' });
  },

  // 2026-08-20 DSH: 后端无 /api/rag/explain, 仅 mock 模式支持
  async explain({ questionId, question, context } = {}) {
    if (!getMockEnabled()) {
      throw new Error('rag.explain: 后端无此端点, 仅 mock 模式');
    }
    return request('POST', '/api/rag/explain', { question_id: questionId, question, context }, { mockName: 'rag_explain' });
  },

  // 2026-08-20 DSH: ask 应走 tutor.ask, 不是 rag.ask
  async ask({ question, history = [] } = {}) {
    if (!getMockEnabled()) {
      throw new Error('rag.ask: 后端无此端点, 请用 tutor.ask');
    }
    return request('POST', '/api/rag/ask', { question, history }, { mockName: 'rag_ask' });
  },

  async ingestQuestion({ content, subjectCode, knowledgePointId, metadata = {} }) {
    return request('POST', '/api/rag/ingest', {
      content, subject_code: subjectCode, knowledge_point_id: knowledgePointId, metadata,
    }, { mockName: 'rag_ingest' });
  },

  async getStats() {
    return request('GET', '/api/rag/stats', null, { mockName: 'rag_stats' });
  },
};