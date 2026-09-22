/* ==========================================================================
 * 通知中心（批次 4 · 优先页 3）
 *
 * 玩法与其余新树页面一致：ui.js 六态机 + api.js 数据层 + app.css 组件，
 * 本文件只写"feed 筛选 + 快捷入口"的差异部分。
 *
 * 依赖接口（均已存在，见 api/modules/loop/routes.js）：
 *   GET /api/loop/feed?limit= → { data:{ items:[{id,kind,subject,text,ts,time}] } }
 *   GET /api/loop/actions     → { data:[{id,kind,title,desc,href,…}] }
 *
 * ⚠️ 端点方法没有加进 assets/js/api.js（该文件本批次被锁定），因此本页用
 *    AIAPI.request 直连 —— 仍走统一数据层（鉴权/解包/错误分类）。
 *
 * ⚠️ 跨树链接（SPEC-DATA G8）：actions 的 href 是旧树 /f3/pages/* 路径，
 *    过一道 resolveTarget()：认识的映射到新树，不认识的渲染成不可点卡片，
 *    绝不放死链。
 *
 * 已知缺口（不伪造数据糊 UI，只登记）：
 *   - PM §B.3 的"5 类通知 + 已读/未读"没有后端接口。feed 只有 wrong/review
 *     两种真实 kind，筛选 tab 只按真实 kind 提供，不做假的已读切换
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const KIND_LABELS = {
    wrong: '错题入库',
    review: '复习完成',
  };

  /** 后端 URL → 新树 URL（对齐 learning-path.js 的 resolveTarget 做法） */
  const URL_MAP = {
    '/f3/pages/exam-simulation.html': '/practice-hub.html',
    '/f3/pages/vision.html': '/photo-solve.html',
    '/f3/pages/wrong-book.html': '/wrong-book.html',
    '/f3/pages/learning-path.html': '/learning-path.html',
    '/f3/pages/mastery.html': '/mastery.html',
    '/f3/pages/essay.html': '/essay.html',
  };

  const els = {};
  let machine = null;
  let kind = 'all';
  let items = [];
  let actions = [];

  function $(id) {
    return global.document.getElementById(id);
  }

  function subjectLabel(code) {
    return global.AISubjects.name(code) || code || '';
  }

  function resolveTarget(href) {
    if (!href) return '';
    const path = String(href).split('?')[0];
    return URL_MAP[path] || '';
  }

  /* ── 状态机 ─────────────────────────────────────────────────────────── */
  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
  }

  /* ── 筛选 ───────────────────────────────────────────────────────────── */
  function setKind(next) {
    kind = next;
    const tabs = els.kindTabs.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i += 1) {
      const btn = tabs[i];
      const on = btn.dataset.kind === kind;
      btn.classList.toggle('tab--on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    renderFeed();
  }

  function getKind() {
    return kind;
  }

  function filteredItems() {
    if (kind === 'all') return items;
    return items.filter(function (it) {
      return it.kind === kind;
    });
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderFeed() {
    els.feedList.innerHTML = '';
    const rows = filteredItems();
    if (!rows.length) {
      const li = global.AIUI.el('li', 'stage stage--pending');
      li.appendChild(global.AIUI.el('span', 'stage-dot'));
      li.appendChild(global.AIUI.el('div', 'stage-name', '该类型下暂时没有动态。'));
      els.feedList.appendChild(li);
      return;
    }
    rows.forEach(function (it) {
      const li = global.document.createElement('li');
      li.className = it.kind === 'review' ? 'stage stage--completed' : 'stage';
      li.appendChild(global.AIUI.el('span', 'stage-dot'));
      li.appendChild(global.AIUI.el('div', 'stage-name', it.text || ''));
      const bits = [it.kind in KIND_LABELS ? KIND_LABELS[it.kind] : it.kind];
      if (it.subject) bits.push(subjectLabel(it.subject));
      if (it.time) bits.push(it.time);
      li.appendChild(global.AIUI.el('div', 'stage-desc', bits.join(' · ')));
      els.feedList.appendChild(li);
    });
  }

  function renderActions() {
    els.actionsGrid.innerHTML = '';
    actions.forEach(function (a) {
      const target = resolveTarget(a.href);
      let node;
      if (target) {
        node = global.document.createElement('a');
        node.className = 'pick-card';
        node.href = target;
      } else {
        // 不认识的旧树 URL → 渲染成不可点卡片，绝不放死链（G8）
        node = global.document.createElement('span');
        node.className = 'pick-card pick-card--locked';
      }
      node.textContent = a.title || '';
      node.title = a.desc || '';
      els.actionsGrid.appendChild(node);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const feed = global.AIAPI.request('/api/loop/feed?limit=20');
    // actions 是静态入口清单，失败不拖垮整页
    const actionsReq = global.AIAPI.request('/api/loop/actions').catch(function () {
      return null;
    });

    return global.Promise.all([feed, actionsReq])
      .then(function (all) {
        const feedPayload = all[0];
        const actionsPayload = all[1];

        items = (feedPayload && feedPayload.data && feedPayload.data.items) || [];
        actions = (actionsPayload && actionsPayload.data) || [];

        renderFeed();
        renderActions();
        return setState(items.length ? 'success' : 'empty');
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取通知失败' });
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.feedList = $('feed-list');
    els.actionsGrid = $('actions-grid');
    els.kindTabs = $('kind-tabs');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    els.kindTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.tab');
      if (btn && btn.dataset.kind) setKind(btn.dataset.kind);
    });

    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    setState('empty');
    load();
  }

  global.Notifications = {
    STATES: STATES,
    KIND_LABELS: KIND_LABELS,
    load: load,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    setKind: setKind,
    getKind: getKind,
    resolveTarget: resolveTarget,
    data: {
      get items() {
        return items;
      },
      get actions() {
        return actions;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
