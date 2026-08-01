// api/client.js — fetch wrapper, token 管理, 401 重定向, mock toggle.
// 所有 page 调 services, services 调 client, client 调真实 /api/* 或 mock/*.json.

import { USE_MOCK, USE_MOCK_OVERRIDE, MOCK_DELAY_MS } from './USE_MOCK.js';
import { getToken, clearToken } from '../auth.js';
import { toast } from '../toast.js';

const API_BASE = '';  // 同源
const TOKEN_KEY = 'aitutor.token';
const USER_KEY = 'aitutor.user';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function loadMock(name) {
  const url = `./mock/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Mock ${name} 加载失败: ${res.status}`, res.status, null);
  }
  const data = await res.json();
  if (MOCK_DELAY_MS > 0) {
    await new Promise(r => setTimeout(r, MOCK_DELAY_MS));
  }
  return data;
}

async function realFetch(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = API_BASE + path;
  const init = { method, headers };
  if (body !== undefined && body !== null) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError('网络错误: ' + e.message, 0, null);
  }

  if (res.status === 401) {
    clearToken();
    localStorage.removeItem(USER_KEY);
    if (!opts.silent) {
      toast.error('登录已过期, 请重新登录');
      setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    }
    throw new ApiError('未登录或登录已过期', 401, null);
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
}

function shouldUseMock() {
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

export { ApiError, TOKEN_KEY, USER_KEY, API_BASE };
