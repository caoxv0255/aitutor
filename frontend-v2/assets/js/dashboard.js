/* ==========================================================================
 * 学习仪表盘（标准实现样板 · 2026-09-21）
 *
 * 渲染契约（与 assets/css/system.css 的标准组件一一对应）：
 *   .float-card.float-card--static          KPI 卡（icon + num + sub）
 *   .loop > .loop__step                     步骤条（icon + num + lbl + status）
 *   .feature                                feature 卡（icon + num + title + desc）
 *   .trust > .trust__item > b.trust__b      页头信任行
 *   .section(.section--cream) > .container  全宽区块交替 + 居中容器
 *   图标一律内联 SVG（ui-ux-pro-max skill 明令禁止 emoji 当图标）
 *
 * 标度（G6-b 同类，方向相反）：本端点的 avg_accuracy / percentage 是**后端算好的
 * 百分比字符串**（"73.3"），直接显示，不要再乘 —— 与 /api/knowledge/mastery 的 0..1 不同。
 *
 * 部分失败策略：今日任务属次要信息，取不到只降级提示，不把整页踢到 error。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const SUBJECT_NAMES = {
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    chinese: '语文',
    english: '英语',
    politics: '政治',
  };

  /** 内联 SVG 图标（24×24 stroke，禁止 emoji） */
  const ICONS = {
    wrong:
      '<path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>',
    practice: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    accuracy: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    days: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    review: '<path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="13" y="8" width="3" height="10"/>',
  };

  function svgIcon(name) {
    const path = ICONS[name] || ICONS.practice;
    return (
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      '</svg>'
    );
  }

  const els = {};
  let machine = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function subjectLabel(code) {
    return SUBJECT_NAMES[code] || code || '未分类';
  }

  /** 后端返回的百分比字符串 → 显示串，缺失显示 '—' */
  function pctText(v) {
    if (v === undefined || v === null || v === '') return '—';
    const s = String(v);
    return s === 'N/A' ? '—' : s + '%';
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent =
        ctx.reason === 'no-data' ? '先拍一张卷子，或从今日复习开始。' : '这一块暂时没有数据。';
    }
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  /* ── 页头：信任行（hero .trust 规格） ───────────────────────────────── */
  function renderTrust(overview) {
    if (!els.trustRow) return;
    const items = [
      ['错题', overview.total_wrong_questions],
      ['练习', overview.total_practice],
      ['正确率', pctText(overview.avg_accuracy)],
      ['坚持', (overview.study_days || 0) + ' 天'],
    ];

    els.trustRow.innerHTML = '';
    items.forEach(function (pair, i) {
      if (i > 0) els.trustRow.appendChild(global.AIUI.el('span', 'trust__sep'));
      const item = global.AIUI.el('span', 'trust__item');
      item.appendChild(global.AIUI.el('b', 'trust__b', String(pair[1])));
      item.appendChild(document.createTextNode(' ' + pair[0]));
      els.trustRow.appendChild(item);
    });
  }

  function renderGreeting(data) {
    const grade = (data.user && data.user.grade) || '';
    if (grade && els.greeting) els.greeting.textContent = grade + ' · 看看今天的任务与最近的练习情况。';
  }

  /* ── KPI：float-card 静态变体 ───────────────────────────────────────── */
  function renderStats(overview) {
    const items = [
      ['wrong', '错题总数', overview.total_wrong_questions],
      ['practice', '累计练习', overview.total_practice],
      ['accuracy', '平均正确率', pctText(overview.avg_accuracy)],
      ['days', '学习天数', overview.study_days],
    ];
    els.statGrid.innerHTML = '';
    items.forEach(function (row) {
      const card = global.AIUI.el('div', 'float-card float-card--static stat-cell');

      const icon = global.AIUI.el('div', 'float-card__icon');
      icon.innerHTML = svgIcon(row[0]);
      card.appendChild(icon);

      const body = global.AIUI.el('div', 'float-card__body');
      const v = row[2] === undefined || row[2] === null ? '—' : String(row[2]);
      body.appendChild(global.AIUI.el('div', 'float-card__num', v));
      body.appendChild(global.AIUI.el('div', 'float-card__sub', row[1]));
      card.appendChild(body);

      els.statGrid.appendChild(card);
    });
  }

  /* ── 今日任务：loop 步骤条 ──────────────────────────────────────────── */
  function renderTasks(tasks) {
    els.taskList.innerHTML = '';
    if (!tasks || !tasks.length) {
      els.taskList.appendChild(global.AIUI.el('p', 'section__sub', '今天还没有生成任务，去今日复习看看吧。'));
      return;
    }
    tasks.forEach(function (t, i) {
      const step = global.AIUI.el('div', 'loop__step task-row');
      const done = t.status === 'completed' || t.status === 'done';

      const icon = global.AIUI.el('div', 'loop__icon');
      icon.innerHTML = svgIcon(done ? 'accuracy' : 'review');
      step.appendChild(icon);

      step.appendChild(global.AIUI.el('div', 'loop__num', String(i + 1)));
      step.appendChild(
        global.AIUI.el(
          'div',
          'loop__lbl task-name',
          t.knowledge_point_name || t.title || t.kp_name || t.type || '学习任务'
        )
      );
      step.appendChild(
        global.AIUI.el('span', done ? 'task-status task-status--done' : 'task-status', done ? '已完成' : '待完成')
      );

      els.taskList.appendChild(step);
    });
  }

  /* ── 薄弱知识点 / 学科分布：feature 卡 ─────────────────────────────── */
  function renderWeakPoints(weak) {
    els.weakList.innerHTML = '';
    if (!weak || !weak.length) {
      els.weakList.appendChild(global.AIUI.el('p', 'section__sub', '暂时没有薄弱知识点，保持住。'));
      return;
    }
    weak.slice(0, 6).forEach(function (w, i) {
      const card = global.AIUI.el('div', 'feature topic-row');
      card.style.animationDelay = i * 60 + 'ms';

      const icon = global.AIUI.el('div', 'feature__icon');
      icon.innerHTML = svgIcon('wrong');
      card.appendChild(icon);
      card.appendChild(global.AIUI.el('div', 'feature__num topic-pct topic-pct--weak', pctText(w.accuracy)));
      card.appendChild(global.AIUI.el('div', 'feature__title topic-name', w.name || '未命名知识点'));
      card.appendChild(
        global.AIUI.el(
          'div',
          'feature__desc topic-sub',
          subjectLabel(w.subject) + ' · 错 ' + (w.wrong_count || 0) + ' 次 · 练 ' + (w.practice_count || 0) + ' 次'
        )
      );
      els.weakList.appendChild(card);
    });
  }

  function renderDistribution(dist) {
    els.distList.innerHTML = '';
    const list = (dist || []).filter(function (d) {
      return (d.count || 0) > 0;
    });
    if (!list.length) {
      els.distList.appendChild(global.AIUI.el('p', 'section__sub', '还没有错题分布数据。'));
      return;
    }
    const maxCount = Math.max.apply(
      null,
      list.map(function (d) {
        return d.count || 0;
      })
    );
    list.forEach(function (d) {
      const card = global.AIUI.el('div', 'feature dist-row');

      const icon = global.AIUI.el('div', 'feature__icon');
      icon.innerHTML = svgIcon('chart');
      card.appendChild(icon);
      card.appendChild(global.AIUI.el('div', 'feature__num', String(d.count || 0)));
      card.appendChild(global.AIUI.el('div', 'feature__title dist-label', subjectLabel(d.subject)));

      const bar = global.AIUI.el('div', 'bar');
      const fill = global.AIUI.el('div', 'bar-fill');
      fill.style.width = (maxCount > 0 ? Math.round(((d.count || 0) / maxCount) * 100) : 0) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);

      els.distList.appendChild(card);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    return global.AIAPI.userDashboard()
      .then(function (data) {
        const overview = (data && data.overview) || {};
        const hasAny =
          (overview.total_practice || 0) > 0 ||
          (overview.total_wrong_questions || 0) > 0 ||
          ((data && data.weak_points) || []).length > 0;
        if (!hasAny) return setState('empty', { reason: 'no-data' });

        renderGreeting(data || {});
        renderTrust(overview);
        renderStats(overview);
        renderWeakPoints((data && data.weak_points) || []);
        renderDistribution((data && data.subject_distribution) || []);
        setState('success');

        return global.AIAPI.todayTasks()
          .then(function (t) {
            renderTasks((t && t.tasks) || []);
          })
          .catch(function () {
            renderTasks([]);
          });
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '加载失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.greeting = $('greeting');
    els.trustRow = $('trust-row');
    els.statGrid = $('stat-grid');
    els.taskList = $('task-list');
    els.weakList = $('weak-list');
    els.distList = $('dist-list');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    load();
  }

  global.Dashboard = {
    STATES: STATES,
    load: load,
    pctText: pctText,
    setState: setState,
    getState: function () {
      return machine.get();
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
