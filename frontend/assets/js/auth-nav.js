/* ═══════════════════════════════════════════════════════════
   auth-nav.js — 登录后跳转工具 (ADDED 2026-09-17, frontend-hygiene-loop P2-3)
   - 支持 ?next= 参数跳回原页面
   - 安全: 只允许站内 .html 相对路径, 防止 open redirect
   - register.html 跳 login.html 时自动带 next
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const SAFE_NEXT = /^([A-Za-z0-9._/-]+\.html)(\?.*)?$/;

  function getNext() {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get('next');
      if (!raw) return null;
      // Reject absolute URLs / protocols / javascript: / data:
      if (/^[a-z]+:/i.test(raw) || raw.startsWith('//') || raw.startsWith('javascript:')) return null;
      // Only allow .html relative paths
      return SAFE_NEXT.test(raw.split('?')[0]) ? raw : null;
    } catch (_) { return null; }
  }

  function goAfterAuth(fallback) {
    const next = getNext();
    location.href = next || fallback || 'dashboard.html';
  }

  /**
   * Attach ?next= to any <a data-preserve-next> link so that downstream
   * pages (e.g. register.html "去登录" link) carry the redirect param.
   */
  function attachNextToLinks() {
    const next = getNext();
    if (!next) return;
    document.querySelectorAll('a[data-preserve-next]').forEach(a => {
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        url.searchParams.set('next', next);
        a.setAttribute('href', url.pathname.split('/').pop() + url.search);
      } catch (_) { /* ignore */ }
    });
  }

  /**
   * Build href string with ?next= appended (for server-rendered or inline HTML).
   */
  function withNext(href) {
    const next = getNext();
    if (!next) return href;
    const sep = href.includes('?') ? '&' : '?';
    return href + sep + 'next=' + encodeURIComponent(next);
  }

  root.AIT_AUTH_NAV = { getNext, goAfterAuth, attachNextToLinks, withNext };
})(typeof window !== 'undefined' ? window : this);
