// auth.js — token 存 localStorage, 401 自动跳 login
const TOKEN_KEY='***';
const USER_KEY = 'aitutor.user';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
export function clearUser() { localStorage.removeItem(USER_KEY); }
export function isLoggedIn() { return !!getToken(); }

export function logout() {
  clearToken();
  clearUser();
  window.location.href = '/login.html';
}

// 路由守卫: 未登录跳 login
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}
