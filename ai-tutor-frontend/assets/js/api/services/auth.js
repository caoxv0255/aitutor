// services/auth.js — 登录 / 注册 / 游客登录
import { request } from '../client.js';
import { setToken, setUser, clearToken, clearUser } from '../../auth.js';

export const auth = {
  async login({ email, password }) {
    const res = await request('POST', '/api/auth/login', { email, password }, { mockName: 'auth_login' });
    // 后端 envelope: { success, message, data: { token, user } }
    const payload = res && res.data ? res.data : res;
    if (payload && payload.token) setToken(payload.token);
    if (payload && payload.user) setUser(payload.user);
    return res;
  },

  async register({ email, password, name, grade }) {
    const res = await request('POST', '/api/auth/register', { email, password, name, grade }, { mockName: 'auth_register' });
    const payload = res && res.data ? res.data : res;
    if (payload && payload.token) setToken(payload.token);
    if (payload && payload.user) setUser(payload.user);
    return res;
  },

  async guestLogin() {
    const res = await request('POST', '/api/auth/guest-login', null, { mockName: 'auth_guest' });
    const payload = res && res.data ? res.data : res;
    if (payload && payload.token) setToken(payload.token);
    if (payload && payload.user) setUser(payload.user);
    return res;
  },

  async logout() {
    try { await request('POST', '/api/auth/logout', null, { silent: true }); } catch {}
    clearToken();
    clearUser();
    window.location.href = '/f3/pages/login.html';
  },

  async getCurrentUser() {
    return request('GET', '/api/auth/me', null, { mockName: 'auth_me' });
  },
};
