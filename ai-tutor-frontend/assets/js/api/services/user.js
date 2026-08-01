// services/user.js — 用户 dashboard / 省份 / 学科
import { request } from '../client.js';

export const user = {
  async getDashboard() {
    return request('GET', '/api/user/dashboard', null, { mockName: 'user_dashboard' });
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
