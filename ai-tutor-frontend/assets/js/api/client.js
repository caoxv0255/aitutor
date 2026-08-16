// api/client.js — fetch wrapper, token 管理, 401 重定向, mock toggle, retry/timeout.
//
// 设计 (D1 v0.7.1-dev):
//   - 6 类 ErrorType (NETWORK / TIMEOUT / AUTH / VALIDATION / BUSINESS / SERVER)
//   - BUSINESS 必须 .code 区分 (QUESTION_NOT_FOUND / DUPLICATE_SUBMIT / ...), 不唯一判断
//   - retry 只对 NETWORK / TIMEOUT / SERVER;  AUTH/VALIDATION/BUSINESS 不重试
//   - mock: 走 USE_MOCK.js 的 getMockEnabled() lazy;  切换 setUseMock(true) 下次 request 即生效
//
// 出口:  request() → 完整响应体 (envelope {success, message, data, ...}),
//        throws ApiError{ type, code, status, body, message }
// P0.7 (2026-08-15) 解包统一: mock 路径返回整个 mock 文件, real 路径也返回完整 body
//        (不再 unwrap envelope) — 两条路径形状一致, page 层统一 res.data.X.

import { getMockEnabled } from './USE_MOCK.js';
import { getToken, clearToken } from '../auth.js';
import { toast } from '../toast.js';

// ────────────────────────────────────────────────────────────────────
// 错误分类 (F2.1 轻量版)
// ────────────────────────────────────────────────────────────────────

/**
 * ErrorType — 6 类, 但 BUSINESS 必须 .code 由 backend 区分具体含义.
 * @typedef {'NETWORK'|'TIMEOUT'|'AUTH'|'VALIDATION'|'BUSINESS'|'SERVER'} ErrorType
 */
export const ErrorType = Object.freeze({
  NETWORK: 'NETWORK',       // CORS / 连接拒绝 / DNS 失败 / fetch TypeError
  TIMEOUT: 'TIMEOUT',       // fetch 超时 (abort)
  AUTH: 'AUTH',             // 401 / 403
  VALIDATION: 'VALIDATION', // 400 — 前端参数错
  BUSINESS: 'BUSINESS',     // 4xx 非 400/401/403 — 必须看 .code 区分
  SERVER: 'SERVER',         // 5xx / status 0
});

/**
 * Retry 策略表 — 按 ErrorType 决定是否重试 + 最多几次.
 * @type {Record<ErrorType, number>}
 */
export const RETRY_POLICY = Object.freeze({
  NETWORK: 2,      // 网络抖动 — 重试 2 次
  TIMEOUT: 1,      // timeout — 重试 1 次
  AUTH: 0,         // 登出, 不重试
  VALIDATION: 0,   // 前端传错, 重试不会修
  BUSINESS: 0,     // 业务错误, 必须看 .code, 重试只会重发同样的坑
  SERVER: 2,       // 5xx — 服务端抖, 重试 2 次
});

/**
 * 用户文案 — error.type → toast 文案前缀
 */
const USER_MESSAGE = {
  NETWORK: '网络异常, 请检查连接后重试',
  TIMEOUT: '请求超时, 请重试',
  AUTH: '登录已过期, 请重新登录',
  VALIDATION: '请求参数有误',
  BUSINESS: '',     // 业务错优先用 backend msg
  SERVER: '服务器暂时不可用, 请稍后重试',
};

class ApiError extends Error {
  /**
   * @param {string} message
   * @param {ErrorType} type
   * @param {object} [opts]
   * @param {number} [opts.status]
   * @param {string} [opts.code]   — backend 错误码 (BUSINESS 必填)
   * @param {*} [opts.body]
   */
  constructor(message, type, { status = 0, code = null, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

// ────────────────────────────────────────────────────────────────────
// 基础配置
// ────────────────────────────────────────────────────────────────────

export function getApiBase() {
  let base = '';
  try {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta?.content) base = meta.content;
    else {
      const ls = localStorage.getItem('aitutor.apiBase');
      if (ls) base = ls;
      else base = 'http://localhost:3002';
    }
  } catch (_) {
    base = 'http://localhost:3002';
  }
  return base;
}
const API_BASE = getApiBase();
console.log(`[client.js] API_BASE = ${API_BASE || '(同源)'}`);

const TOKEN_KEY = 'aitutor.token';  // legacy 保留 (auth.js 可能引用)
const USER_KEY = 'aitutor.user';
const DEFAULT_TIMEOUT_MS = 30000;  // v0.7: bge 1024 慢, 默认 10s 不够, 改 30s
const RETRY_BACKOFF_MS = 600;      // 1st retry: 600ms, 2nd: 1200ms

// 用 import.meta.url 算 mock 绝对路径
const MOCK_BASE = new URL('./mock/', import.meta.url).href;

// ────────────────────────────────────────────────────────────────────
// Mock path
// ────────────────────────────────────────────────────────────────────

export async function loadMock(name) {
  const url = `${MOCK_BASE}${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(
      `Mock ${name} 加载失败: ${res.status} (url: ${url})`,
      ErrorType.SERVER,
      { status: res.status }
    );
  }
  const data = await res.json();
  return data;
}

// ────────────────────────────────────────────────────────────────────
// 真实 fetch — 含 retry, 错误分类
// ────────────────────────────────────────────────────────────────────

/**
 * 单次 fetch 尝试; 抛出 ApiError with type/code/status
 */
async function tryOnce(method, path, body, opts) {
  const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
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

    // === 读 body 一次 (text → json, 后续可复用) ===
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    // === 状态码 → 错误分类 ===

    // 401: AUTH, 立即清 token + 跳登录 (不重试)
    if (res.status === 401) {
      clearToken();
      localStorage.removeItem(USER_KEY);
      return { type: ErrorType.AUTH, retry: false, status: 401, code: null, data };
    }

    // 403: AUTH-ish, 不重试
    if (res.status === 403) {
      return { type: ErrorType.AUTH, retry: false, status: 403, code: null, data };
    }

    // 400: VALIDATION
    if (res.status === 400) {
      return { type: ErrorType.VALIDATION, retry: false, status: 400, code: null, data };
    }

    // 5xx: SERVER, 可重试
    if (res.status >= 500 && res.status < 600) {
      return { type: ErrorType.SERVER, retry: true, status: res.status, code: null, data };
    }

    // 0 (网络): NETWORK, 可重试
    if (res.status === 0) {
      return { type: ErrorType.NETWORK, retry: true, status: 0, code: null, data };
    }

    // 4xx (非 400/401/403): BUSINESS — 必须看 backend .code
    if (res.status >= 400 && res.status < 500) {
      const code = (data && (data.code || data.error_code)) || null;
      return { type: ErrorType.BUSINESS, retry: false, status: res.status, code, data };
    }

    // 2xx/3xx: 成功 — 返回完整响应体 (envelope {success, message, data, ...}).
    // P0.7 解包统一: 不再 unwrap data.data, 与 mock 路径 (loadMock 返回整个文件) 形状一致,
    // page 层统一 res.data.X (F3 文档化约定 "services return {success,data}").
    return { type: 'OK', retry: false, status: res.status, code: null, data };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { type: ErrorType.TIMEOUT, retry: true, status: 0, code: null, data: null, error: e };
    }
    // TypeError: fetch 失败 (CORS / DNS / 连接拒绝)
    return { type: ErrorType.NETWORK, retry: true, status: 0, code: null, data: null, error: e };
  }
}

/**
 * 带 retry 的真实 fetch
 */
async function realFetch(method, path, body, opts = {}) {
  let attempt = 0;
  let lastResult = null;

  while (true) {
    attempt++;
    const result = await tryOnce(method, path, body, opts);
    lastResult = result;

    // 成功
    if (result.type === 'OK') return result.data;

    // 失败 — 看 retry 策略
    const maxRetries = RETRY_POLICY[result.type] ?? 0;
    if (!result.retry || attempt > maxRetries) {
      // 用尽 retry 或不该 retry, 抛 ApiError
      const msg = (result.data && (result.data.message || result.data.error)) ||
                  result.error?.message ||
                  USER_MESSAGE[result.type] ||
                  `请求失败 (${result.type})`;
      throw new ApiError(msg, result.type, {
        status: result.status,
        code: result.code,
        body: result.data,
      });
    }

    // 还可重试, backoff
    await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS * attempt));
  }
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

/**
 * 统一 request 入口.  page → services → client.request.
 * 行为:
 *   - 走 mock 时: loadMock(name) (无 retry)
 *   - 走真后端时: realFetch(...)
 * 错误: 抛 ApiError{ type, code, status, body, message }
 * toast: 默认开启. opts.silent = true 不弹 toast.
 */
export async function request(method, path, body, opts = {}) {
  if (getMockEnabled()) {
    const mockName = opts.mockName || path.replace(/^\/+/, '').replace(/\//g, '_') || 'root';
    return loadMock(mockName);
  }
  try {
    return await realFetch(method, path, body, opts);
  } catch (e) {
    // 默认非 silent 时弹 toast (除非 caller 已 silent)
    if (!(opts.silent || e instanceof ApiError && e.type === ErrorType.AUTH && (() => {
      // AUTH: toast.error + 跳登录 (silent 也弹, 因为重要)
      toast.error('登录已过期, 请重新登录');
      setTimeout(() => { window.location.href = '/f3/pages/login.html'; }, 1000);
      return true;
    })())) {
      // BUSINESS 优先用 backend msg;  否则用 USER_MESSAGE 默认
      const userMsg = e.type === ErrorType.BUSINESS && e.body && (e.body.message || e.body.error)
        ? (e.body.message || e.body.error)
        : e.message;
      toast.error(userMsg);
    }
    throw e;
  }
}

export { ApiError, TOKEN_KEY, USER_KEY, API_BASE, DEFAULT_TIMEOUT_MS };
