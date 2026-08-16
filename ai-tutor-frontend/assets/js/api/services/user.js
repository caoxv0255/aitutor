// services/user.js — 用户 dashboard / 省份 / 学科
import { request } from '../client.js';

export const user = {
  /**
   * 学习仪表盘 (P0.7 真后端 + adapter).
   * 后端 /api/user/dashboard → data: {user, overview, subject_distribution, daily_practice,
   *   monthly_trend, weak_points, suggestions}
   * 页面契约 (user_dashboard.json 同构): data: {name, email, grade, province, exam_type,
   *   join_date, stats: {questions_solved, accuracy, weak_points_count, study_days}, ...}
   * 这里做 overview → stats 字段映射, 页面无需感知后端字段名.
   */
  async getDashboard() {
    const res = await request('GET', '/api/user/dashboard', null, { mockName: 'user_dashboard' });
    const body = (res && res.data) ? res.data : res;
    if (body && body.overview) {
      const acc = parseFloat(body.overview.avg_accuracy || '0') / 100; // 后端是百分比字符串
      body.name = (body.user && (body.user.name || body.user.email)) || '';
      body.email = body.user && body.user.email;
      body.grade = body.user && body.user.grade;
      body.join_date = body.user && body.user.join_date;
      body.stats = {
        questions_solved: body.overview.total_practice || 0,
        questions_correct: body.overview.total_practice ? Math.round(body.overview.total_practice * acc) : 0,
        accuracy: isNaN(acc) ? 0 : acc,
        weak_points_count: (body.weak_points || []).length,
        study_days: body.overview.study_days || 0,
        total_hours: 0,
      };
    }
    return res;
  },

  async getProvinces({ examLevel } = {}) {
    const q = examLevel ? `?exam_level=${encodeURIComponent(examLevel)}` : '';
    return request('GET', `/api/user/provinces${q}`, null, { mockName: 'user_provinces' });
  },

  async getUserProvince() {
    return request('GET', '/api/user/user-province', null, { mockName: 'user_userprovince' });
  },

  async setUserProvince({ provinceCode, examLevel }) {
    return request('POST', '/api/user/user-province', { province_code: provinceCode, exam_level: examLevel }, { mockName: 'user_userprovince_post' });
  },

  async getProfile() {
    return request('GET', '/api/user/profile', null, { mockName: 'user_profile' });
  },

  async getUserSubjects() {
    return request('GET', '/api/user/subjects', null, { mockName: 'user_subjects' });
  },
};
