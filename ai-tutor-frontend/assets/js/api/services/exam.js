// services/exam.js — 题目 / 考试 / PDF
import { request, getApiBase } from '../client.js';
import { getMockEnabled } from '../USE_MOCK.js';
import { loadMock } from '../client.js';
import { getToken } from '../../auth.js';

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

  /**
   * F3.7.4: 下载试卷 PDF
   * - 真后端: 直接 fetch 拿 blob, 返回 { blob, filename, contentType }
   * - mock 模式: 返回 { url, expiresAt } (前端 window.open 触发)
   */
  async getExamPdf(paperId) {
    if (getMockEnabled()) {
      const mock = loadMock('exam_pdf');
      const data = mock && mock.data ? mock.data : mock;
      return { mock: true, url: data.url, expiresAt: data.expires_at };
    }
    // 2026-08-20 DSH: 之前 GET /api/exam-pdf/ (audit 404), 改 POST /api/exam/pdf/generate/:paperId
    // 后端 handler 用 req.params.paperId, 但路由之前漏了 :paperId 占位符
    const base = getApiBase();
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(base + '/api/exam/pdf/generate/' + encodeURIComponent(paperId), {
      method: 'POST', headers,
    });
    if (!res.ok) {
      const ct = res.headers.get('content-type') || '';
      let msg = 'PDF 生成失败 (HTTP ' + res.status + ')';
      if (ct.includes('application/json')) {
        try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    let filename = 'exam.pdf';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/);
    if (m) filename = decodeURIComponent(m[1]);
    else {
      const m2 = cd.match(/filename="?([^";]+)/);
      if (m2) filename = m2[1];
    }
    return { mock: false, blob, filename, contentType: blob.type };
  },

  async getPapers({ subject, year } = {}) {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (year) params.set('year', year);
    return request('GET', `/api/exam/papers?${params}`, null, { mockName: 'exam_papers' });
  },
};
