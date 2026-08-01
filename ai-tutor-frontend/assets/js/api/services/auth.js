// services/auth.js — 登录 / 注册 / 游客登录
import { request } from '../client.js';
import { setToken, setUser, clearToken, clearUser } from '../../auth.js';

export const auth = {
  async login({ email, password }) {
    const res = await request('POST', '/api/auth/login', { email, password }, { mockName: 'auth_login' });
    if (res.token) setToken(res.token);
    if (res.user) setUser(res.user);
    return res;
  },

  async register({ email, password, name, grade }) {
    const res = await request('POST', '/api/auth/register', { email, password, name, grade }, { mockName: 'auth_register' });
    if (res.token) setToken(res.token);
    if (res.user) setUser(res.user);
    return res;
  },

  async guestLogin() {
    const res = await request('POST', '/api/auth/guest-login', null, { mockName: 'auth_guest' });
    if (res.token) setToken(res.token);
    if (res.user) setUser(res.user);
    return res;
  },

  async logout() {
    try { await request('POST', '/api/auth/logout', null, { silent: true }); } catch {}
    clearToken();
    clearUser();
    window.location.href = '/login.html';
  },

  async getCurrentUser() {
    return request('GET', '/api/auth/me', null, { mockName: 'auth_me' });
  },
};
