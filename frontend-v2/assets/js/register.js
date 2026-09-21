/* ==========================================================================
 * 注册页（批次 1）
 *
 * 状态：form / loading / success / error / offline
 *
 * 密码强度：客户端只做"提前提醒"，**真正的判据在服务端**
 * (api/utils/validator.js validatePassword strict: ≥8 位 + 大小写 + 数字)。
 * 本地这份是为了少一次往返，不是权威。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['form', 'loading', 'success', 'error', 'offline'];
  const NEXT_PAGE = 'onboarding.html';

  const els = {};
  let machine = null;
  let lastTarget = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  /** 与服务端 strict 规则对齐的最小预检（服务端仍是权威） */
  function precheckPassword(pwd) {
    if (!pwd || pwd.length < 8) return '密码至少 8 位';
    if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd)) return '密码需含大小写字母';
    if (!/\d/.test(pwd)) return '密码需含数字';
    return null;
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
      els.errorCopy.textContent = ctx.message || '请检查填写的信息。';
    }
    if (name === 'success' && els.successCopy) {
      els.successCopy.textContent = '正在进入引导…';
    }
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function go(target) {
    lastTarget = target;
    try {
      global.location.assign(target);
    } catch {
      /* jsdom / 受限环境 */
    }
  }

  function submit() {
    const email = (els.email.value || '').trim();
    const password = els.password.value || '';
    const grade = els.grade.value || '';

    if (!email || !password || !grade) {
      setState('form', { fieldMessage: '请填写邮箱、密码并选择年级' });
      return global.Promise.resolve('invalid');
    }
    const pwdIssue = precheckPassword(password);
    if (pwdIssue) {
      setState('form', { fieldMessage: pwdIssue });
      return global.Promise.resolve('invalid');
    }
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));

    setState('loading');

    return global.AIAPI.register({ email: email, password: password, grade: grade })
      .then(function (data) {
        global.AIAPI.saveSession(data);
        setState('success');
        go(NEXT_PAGE);
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped === 'offline') return setState('offline');
        return setState('error', { message: (err && err.message) || '注册失败，请稍后重试。' });
      });
  }

  function boot() {
    els.region = $('state-region');
    els.email = $('email');
    els.password = $('password');
    els.grade = $('grade');
    els.formError = $('form-error');
    els.errorCopy = $('error-copy');
    els.successCopy = $('success-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('register-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    $('retry-btn').addEventListener('click', function () {
      setState('form');
    });
    $('offline-retry-btn').addEventListener('click', function () {
      submit();
    });

    setState('form');
  }

  global.Register = {
    STATES: STATES,
    submit: submit,
    precheckPassword: precheckPassword,
    setState: setState,
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
