/* ==========================================================================
 * 登录页（批次 1）
 *
 * 状态：form / loading / success / error / offline
 *   —— 认证页没有"未登录"态，表单态即未登录态（SPEC-ROUTES §3 例外）
 *
 * 安全点：?next= 参数必须防开放重定向，只允许本站的 "名字.html"（见 sanitizeNext）。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['form', 'loading', 'success', 'error', 'offline'];
  const DEFAULT_NEXT = 'photo-solve.html';

  const els = {};
  let machine = null;
  let lastTarget = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  /**
   * 只接受本站页面名，杜绝 open redirect：
   *   允许 "photo-solve.html" / "/photo-solve.html" / "/v2/photo-solve.html"
   *   拒绝 "https://evil.com"、"//evil.com"、"../x"、含 ":" 或 "\\" 的一切
   */
  function sanitizeNext(raw) {
    if (!raw) return DEFAULT_NEXT;
    let v = String(raw).trim();
    if (v.indexOf(':') !== -1 || v.indexOf('\\') !== -1 || v.indexOf('..') !== -1) return DEFAULT_NEXT;
    v = v.replace(/^\/v2\//, '').replace(/^\//, '');
    return /^[A-Za-z0-9_-]+\.html$/.test(v) ? v : DEFAULT_NEXT;
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'form' && els.formError) {
      if (ctx.fieldMessage) {
        els.formError.textContent = ctx.fieldMessage;
        els.formError.hidden = false;
      } else {
        els.formError.textContent = '';
        els.formError.hidden = true;
      }
    }
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '邮箱或密码不正确。';
    }
    if (name === 'success' && els.successCopy) {
      els.successCopy.textContent = '正在跳转…';
    }
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  /* 真正跳转前先记录目标，便于验收断言（jsdom 不实现导航） */
  function go(target) {
    lastTarget = target;
    try {
      global.location.assign(target);
    } catch {
      /* jsdom / 受限环境 */
    }
  }

  function currentNext() {
    const params = new global.URLSearchParams(global.location.search || '');
    return sanitizeNext(params.get('next'));
  }

  function submit() {
    const email = (els.email.value || '').trim();
    const password = els.password.value || '';

    if (!email || !password) {
      setState('form', { fieldMessage: '请填写邮箱和密码' });
      return global.Promise.resolve('invalid');
    }
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));

    setState('loading');

    return global.AIAPI.login(email, password)
      .then(function (data) {
        global.AIAPI.saveSession(data);
        setState('success');
        go(currentNext());
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        // 401 是"凭据不对"，不是"需要登录" —— 留在错误态，不能用 auth 态
        if (err && err.status === 401) {
          return setState('error', { message: (err && err.message) || '邮箱或密码不正确。' });
        }
        if (mapped === 'offline') return setState('offline');
        return setState('error', { message: (err && err.message) || '登录失败，请稍后重试。' });
      });
  }

  function guest() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    setState('loading');
    return global.AIAPI.guestLogin()
      .then(function (data) {
        global.AIAPI.saveSession(data);
        setState('success');
        go(currentNext());
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped === 'offline') return setState('offline');
        return setState('error', { message: (err && err.message) || '游客登录失败，请稍后重试。' });
      });
  }

  function boot() {
    els.region = $('state-region');
    els.email = $('email');
    els.password = $('password');
    els.formError = $('form-error');
    els.errorCopy = $('error-copy');
    els.successCopy = $('success-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    $('guest-btn').addEventListener('click', function () {
      guest();
    });
    $('retry-btn').addEventListener('click', function () {
      setState('form');
    });
    $('offline-retry-btn').addEventListener('click', function () {
      submit();
    });

    // 已登录用户直接放行，避免重复登录
    if (global.AIAPI.getToken()) {
      go(currentNext());
      setState('success');
      return;
    }
    setState('form');
  }

  global.Login = {
    STATES: STATES,
    submit: submit,
    guest: guest,
    setState: setState,
    sanitizeNext: sanitizeNext,
    getState: function () {
      return machine.get();
    },
    getLastTarget: function () {
      return lastTarget;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
