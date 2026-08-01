// services/exam.js — 题目 / 考试 / PDF
import { request } from '../client.js';

export const exam = {
  async getQuestions({ subject, year, paperType, page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (year) params.set('year', year);
    if (paperType) params.set('paper_type', paperType);
    if (page) params.set('page', page);
    if (pageSize) params.set('page_size', pageSize);
    return request('GET', `/api/exam/questions?${params}`, null, { mockName: 'exam_questions' });
  },

  async getQuestion(id) {
    return request('GET', `/api/exam/questions/${id}`, null, { mockName: 'exam_question' });
  },

  async startSession({ subject, mode = 'exam', count = 10, paperId } = {}) {
    return request('POST', '/api/exam/session/start', { subject, mode, count, paper_id: paperId }, { mockName: 'exam_session_start' });
  },

  async submitSession({ sessionId, answers }) {
    return request('POST', '/api/exam/session/submit', { session_id: sessionId, answers }, { mockName: 'exam_session_submit' });
  },

  async getExamPdf(paperId) {
    return request('GET', `/api/exam-pdf/${paperId}`, null, { mockName: 'exam_pdf' });
  },

  async getPapers({ subject, year } = {}) {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (year) params.set('year', year);
    return request('GET', `/api/exam/papers?${params}`, null, { mockName: 'exam_papers' });
  },
};
