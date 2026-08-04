// services/rag.js — RAG 检索 (复用后端 pgvector + GraphRAG)
// 路径对齐 backend /api/rag/search/* (modules/rag/ragSearchRouter)
import { request } from '../client.js';

export const rag = {
  async search({ query, subject, topK = 10, threshold = 0.7 } = {}) {
    return request('POST', '/api/rag/search/search', {
      query, subject_code: subject, top_k: topK, threshold,
    }, { mockName: 'rag_search' });
  },

  async multiSearch({ query, subject, vectorType = 'q+s', topK = 10 } = {}) {
    return request('POST', '/api/rag/search/multi/search', {
      query, subject_code: subject, vector_type: vectorType, top_k: topK,
    }, { mockName: 'rag_multi_search' });
  },

  async similarQuestions({ questionId, topK = 5, subject } = {}) {
    return request('POST', '/api/rag/search/multi/questions', {
      question_id: questionId, top_k: topK, subject_code: subject,
    }, { mockName: 'rag_similar' });
  },

  async explain({ questionId, question, context } = {}) {
    return request('POST', '/api/rag/explain', { question_id: questionId, question, context }, { mockName: 'rag_explain' });
  },

  async ask({ question, history = [] } = {}) {
    return request('POST', '/api/rag/ask', { question, history }, { mockName: 'rag_ask' });
  },

  async ingestQuestion({ content, subjectCode, knowledgePointId, metadata = {} }) {
    return request('POST', '/api/rag/search/ingest', {
      content, subject_code: subjectCode, knowledge_point_id: knowledgePointId, metadata,
    }, { mockName: 'rag_ingest' });
  },

  async getStats() {
    return request('GET', '/api/rag/search/stats', null, { mockName: 'rag_stats' });
  },
};