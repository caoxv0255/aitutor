/* ==========================================================================
 * frontend-v2 共享 UI 层
 *
 * 从 phase-2 切片 photo-solve 里抽出来的状态机 —— 阶段 3 横向复制时，
 * 每页都需要"同一时刻只显示一个状态面板"，不该每页重写一遍。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  /**
   * 状态机：把 [data-state] 面板做成互斥显示。
   * @param {Element} region  容器
   * @param {string[]} states 状态名，需与子节点 data-state 一致
   * @param {{render?: function(string, object)}} options
   */
  function createStateMachine(region, states, options) {
    const hooks = options || {};
    let current = null;

    function set(name, ctx) {
      ctx = ctx || {};
      states.forEach(function (s) {
        const panel = region.querySelector('[data-state="' + s + '"]');
        if (panel) panel.classList.toggle('is-on', s === name);
      });
      if (hooks.render) hooks.render(name, ctx);
      current = name;
      return name;
    }

    function get() {
      const on = region.querySelector('.state.is-on');
      return on ? on.getAttribute('data-state') : current;
    }

    return { set: set, get: get };
  }

  /**
   * 接口错误 → 状态名。三个页面共用同一套判据：
   *   401/403 → auth · 网络失败 → offline · 其余 → error
   */
  function mapError(err) {
    if (err && (err.status === 401 || err.status === 403)) return 'auth';
    if (err && err.kind === 'network') return 'offline';
    return 'error';
  }

  function el(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  global.AIUI = {
    createStateMachine: createStateMachine,
    mapError: mapError,
    el: el,
  };
})(window);
