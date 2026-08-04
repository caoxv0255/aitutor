// api/client.js — fetch wrapper, token 管理, 401 重定向, mock toggle, retry/timeout.
// 所有 page 调 services, services 调 client, client 调真实 /api/* 或 mock/*.json.

import { USE_MOCK, USE_MOCK_OVERRIDE, MOCK_DELAY_MS } from './USE_MOCK.js';
import { getToken, clearToken } from '../auth.js';
import { toast } from '../toast.js';

// API_BASE: 跨域后端地址
// 优先级: meta[name=api-base] > localStorage.aitutor.apiBase > 默认 'http://localhost:3002' (dev)
// 生产部署时: 改默认 '' 即可, 或设 LS: localStorage.setItem('aitutor.apiBase', '')
function getApiBase() {
  let base = '';
  try {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta?.content) base = meta.content;
    else {
      const ls = localStorage.getItem('aitutor.apiBase');
      if (ls) base = ls;
      else base = 'http://localhost:3002';  // dev 默认
    }
  } catch (_) {
    base = 'http://localhost:3002';
  }
  return base;
}
const API_BASE = getApiBase();
console.log(`[client.js] API_BASE = ${API_BASE || '(同源)'}`);
const TOKEN_KEY = 'aitutor.token';
const USER_KEY = 'aitutor.user';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 600;  // 1st: 600ms, 2nd: 1200ms, 3rd: 1800ms

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// 用 import.meta.url 算 mock 绝对路径, 避免 services/ vs mock/ 不同级
const MOCK_BASE = new URL('./mock/', import.meta.url).href;

async function loadMock(name) {
  const url = `${MOCK_BASE}${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Mock ${name} 加载失败: ${res.status} (url: ${url})`, res.status, null);
  }
  const data = await res.json();
  if (MOCK_DELAY_MS > 0) {
    await new Promise(r => setTimeout(r, MOCK_DELAY_MS));
  }
  return data;
}

async function realFetch(method, path, body, opts = {}) {
  const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = (opts.retry ?? 0) + 1;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      // backoff: 600ms * (attempt-1)
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS * (attempt - 1)));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = API_BASE + path;
    const init = { method, headers, signal: controller.signal };
    if (body !== undefined && body !== null) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(url, init);
      clearTimeout(timer);

      // 401: 不重试, 立即清 token + 跳登录
      if (res.status === 401) {
        clearToken();
        localStorage.removeItem(USER_KEY);
        if (!opts.silent) {
          toast.error('登录已过期, 请重新登录');
          setTimeout(() => { window.location.href = '/login.html'; }, 1000);
        }
        throw new ApiError('未登录或登录已过期', 401, null);
      }

      // 5xx + 0 (网络错误): 重试
      if (res.status === 0 || (res.status >= 500 && res.status < 600)) {
        if (attempt < maxAttempts) continue;
        throw new ApiError(`服务器错误 (${res.status})`, res.status, null);
      }

      let data = null;
      const text = await res.text();
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }

      if (!res.ok) {
        const msg = (data && data.message) || (data && data.error) || `${res.status} ${res.statusText}`;
        if (!opts.silent) {
          toast.error(msg);
        }
        throw new ApiError(msg, res.status, data);
      }
      return data;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // AbortError (timeout) 或 fetch reject: 重试
      if (e.name === 'AbortError') {
        lastErr = new ApiError(`请求超时 (${timeoutMs}ms)`, 0, null);
        if (attempt < maxAttempts) continue;
        throw lastErr;
      }
      if (e instanceof ApiError && e.status === 401) throw e;  // 401 不重试
      if (e instanceof TypeError && attempt < maxAttempts) continue;  // fetch 失败
      if (e instanceof ApiError && e.status >= 500 && attempt < maxAttempts) continue;
      throw e;
    }
  }
  throw lastErr ?? new ApiError('未知错误', 0, null);
}

function shouldUseMock() {
  // 优先级: URL ?mock=true > LS aitutor.useMock > USE_MOCK_OVERRIDE > 常量 USE_MOCK
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const p = new URLSearchParams(window.location.search);
      if (p.has('mock')) return p.get('mock') !== 'false';
    }
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('aitutor.useMock');
      if (ls !== null) return ls === 'true' || ls === '1';
    }
  } catch (_) {}
  if (USE_MOCK_OVERRIDE !== null) return USE_MOCK_OVERRIDE;
  return USE_MOCK;
}

export async function request(method, path, body, opts = {}) {
  const isMock = shouldUseMock();
  if (isMock) {
    const mockName = (opts.mockName) || (path.replace(/^\/+/, '').replace(/\//g, '_') || 'root');
    return loadMock(mockName);
  }
  return realFetch(method, path, body, opts);
}

export { ApiError, TOKEN_KEY, USER_KEY, API_BASE, DEFAULT_TIMEOUT_MS, MAX_RETRIES };