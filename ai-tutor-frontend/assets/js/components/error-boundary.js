// assets/js/components/error-boundary.js — 全局错误兜底 (F3 基础)
//
// 防止任何 page 写错就白屏. 用法: 任意 page <script type="module"> 顶部加一行
//   import { mountErrorBoundary } from '../assets/js/components/error-boundary.js';
//   mountErrorBoundary();
//
// 行为:
//   - 注册 window 'error' (同步错, 含 resource 加载失败)
//   - 注册 window 'unhandledrejection' (async 错, 兜 Promise reject)
//   - 抓到的错: 默认 toast.error + 创建/累加顶部红色 banner
//   - 同 message 的错累计, banner 显示 (×count)
//   - 主动报告: eb.handleError(err, 'API') — 业务代码 (如 ApiError) 也走这里
//   - mountErrorBoundary() idempotent: 二次调用返回同一 instance
//   - eb.unmount() 解注册 (测试 / SPA route 切换用)
//
// SSR / 测试 / Node: window 不存在时 mountErrorBoundary() 返回 null.
//
// 自定义: opts.onError 替换默认 toast 调用 (单测); opts.banner 替换默认 banner.

import { toast } from '../toast.js';

/**
 * @typedef {Object} ErrorBoundary
 * @property {(err: any, kind?: string, meta?: object) => void} handleError
 * @property {() => Array<{err: any, message: string, kind: string, meta: object, count: number}>} events
 * @property {() => Map<string, number>} counts
 * @property {{ show: Function, hide: Function, _el: HTMLElement|null }} banner
 * @property {() => void} unmount
 */

/**
 * @param {object} [opts]
 * @param {Function} [opts.onError]   — 替换默认 toast.error(err.message)
 * @param {object}   [opts.banner]    — 替换默认顶部 banner (单测)
 * @returns {ErrorBoundary | null}
 */
export function mountErrorBoundary(opts = {}) {
  if (typeof window === 'undefined') return null;
  if (window.__AIT_ERROR_BOUNDARY__) return window.__AIT_ERROR_BOUNDARY__;

  const banner = opts.banner || createBanner();
  const onError = opts.onError || ((err, kind /* , meta */) => {
    try { toast.error(err && err.message || String(err)); } catch (_) { /* 测试下 toast 可能未初始化 */ }
  });
  const seen = new Map();          // message → count
  const _events = [];              // FIFO, 单测观察

  function show(err, kind = 'ERROR', meta = {}) {
    if (!err) return;
    const message = String(err.message || err);
    const key = message.slice(0, 200);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    const payload = { err, message, kind, meta, count };
    _events.push(payload);
    try { banner.show(payload); } catch (_) { /* UI 失败不影响计数 */ }
    try { onError(err, kind, meta); } catch (_) { /* hook 失败不影响计数 */ }
  }

  function onWindowError(event) {
    const err =
      event?.error ||
      event?.reason ||
      new Error(event?.message || 'Unknown error');
    const kind = event?.reason ? 'PROMISE' : 'ERROR';
    const meta = { filename: event?.filename, lineno: event?.lineno };
    show(err, kind, meta);
  }

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onWindowError);

  /** @type {ErrorBoundary} */
  const eb = {
    handleError: show,
    events: () => _events.slice(),
    counts: () => new Map(seen),
    banner,
    _unmounted: false,
    unmount() {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onWindowError);
      try { banner.hide && banner.hide(); } catch (_) { /* ignore */ }
      if (window.__AIT_ERROR_BOUNDARY__ === eb) delete window.__AIT_ERROR_BOUNDARY__;
      // unmount 后调用 handleError 应是 noop (避免被遗忘引用继续推 events)
      this.handleError = () => {};
      this._unmounted = true;
    },
  };

  window.__AIT_ERROR_BOUNDARY__ = eb;
  return eb;
}

/**
 * Banner factory — 顶部红色横条, 显示当前最近错误 + 累计次数.
 * @returns {{ show: Function, hide: Function, _el: HTMLElement|null, _text: HTMLElement|null }}
 */
function createBanner() {
  if (typeof document === 'undefined') {
    return { show: () => {}, hide: () => {}, _el: null, _text: null };
  }

  const el = document.createElement('div');
  el.id = 'ait-error-banner';
  el.setAttribute('role', 'alert');
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
    'background:var(--color-error,#d71920)', 'color:#fff',
    'padding:12px 16px', 'font-family:system-ui,sans-serif',
    'display:none', 'align-items:center', 'justify-content:space-between',
    'gap:16px', 'box-shadow:0 2px 8px rgba(0,0,0,0.2)',
  ].join(';');

  const text = document.createElement('div');
  text.style.cssText = 'flex:1; font-size:14px; line-height:1.4;';
  el.appendChild(text);

  const btn = document.createElement('button');
  btn.textContent = '×';
  btn.style.cssText = 'background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px;';
  btn.onclick = () => { el.style.display = 'none'; };
  el.appendChild(btn);

  function appendToBody() {
    if (document.body && !document.body.contains(el)) {
      document.body.appendChild(el);
    }
  }
  if (document.body) appendToBody();
  else document.addEventListener('DOMContentLoaded', appendToBody, { once: true });

  return {
    _el: el,
    _text: text,
    show({ message, kind, count }) {
      text.textContent = `[${kind}] ${message}${count > 1 ? `  (×${count})` : ''}`;
      el.style.display = 'flex';
    },
    hide() { el.style.display = 'none'; },
  };
}
