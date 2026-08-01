// services/review.js — 复习报告 / 会话历史
import { request } from '../client.js';

export const review = {
  async getReports({ page = 1, pageSize = 20 } = {}) {
    return request('GET', `/api/review/reports?page=${page}&page_size=${pageSize}`, null, { mockName: 'review_reports' });
  },

  async getReport(id) {
    return request('GET', `/api/review/reports/${id}`, null, { mockName: 'review_report' });
  },

  async getSessionHistory({ limit = 20 } = {}) {
    return request('GET', `/api/review/session/history?limit=${limit}`, null, { mockName: 'review_session_history' });
  },

  async getWeakPoints({ subject } = {}) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request('GET', `/api/review/weak-points${q}`, null, { mockName: 'review_weakpoints' });
  },

  async getTrendSummary({ days = 30 } = {}) {
    return request('GET', `/api/review/trend-summary?days=${days}`, null, { mockName: 'review_trend' });
  },
};
