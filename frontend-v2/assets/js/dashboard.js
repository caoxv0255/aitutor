/* ==========================================================================
 * 学习仪表盘（批次 3 第一页）
 *
 * 契约:
 *   GET /api/user/dashboard  → 见 api.js 注释（overview / weak_points / subject_distribution …）
 *   GET /api/user/today      → { date, streak_days, tasks[] }
 *
 * ⚠️ 标度（G6-b 同类，但方向相反）：本端点的 avg_accuracy / percentage 是
 * **后端已经算好的百分比字符串**（"60.0" / "12.5"），不是 0..1 —— 页面直接显示，不要再乘。
 * 与 /api/knowledge/mastery（返回 0..1，展示时 ×100）不同。每次接新端点都要先确认这一点。
 *
 * 部分失败策略：今日任务 / 签到属于**次要信息**，取不到不应拖垮整个仪表盘
 * —— 各自 catch 后降级为空，不把页面踢到 error 态（与 wrong-book 的统计接口同策略）。
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

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderGreeting(data) {
    const grade = (data.user && data.user.grade) || '';
    if (grade) els.greeting.textContent = `${grade} · 看看今天的任务与最近的练习情况。`;
  }

  function renderStats(overview) {
    const items = [
      ['错题总数', overview.total_wrong_questions],
      ['累计练习', overview.total_practice],
      ['平均正确率', pctText(overview.avg_accuracy)],
      ['学习天数', overview.study_days],
    ];
    els.statGrid.innerHTML = '';
    items.forEach(function (pair) {
      const cell = global.AIUI.el('div', 'stat-cell');
      const v = pair[1] === undefined || pair[1] === null ? '—' : String(pair[1]);
      cell.appendChild(global.AIUI.el('b', null, v));
      cell.appendChild(global.AIUI.el('span', null, pair[0]));
      els.statGrid.appendChild(cell);
    });
  }

  function renderTasks(tasks) {
    els.taskList.innerHTML = '';
    if (!tasks || !tasks.length) {
      els.taskList.appendChild(global.AIUI.el('p', 'topic-sub', '今天还没有生成任务，去今日复习看看吧。'));
      return;
    }
    tasks.forEach(function (t) {
      const row = global.AIUI.el('div', 'task-row');
      const name = t.knowledge_point_name || t.title || t.kp_name || t.type || '学习任务';
      row.appendChild(global.AIUI.el('span', 'task-name', name));

      const done = t.status === 'completed' || t.status === 'done';
      row.appendChild(
        global.AIUI.el('span', done ? 'task-status task-status--done' : 'task-status', done ? '已完成' : '待完成')
      );
      els.taskList.appendChild(row);
    });
  }

  function renderWeakPoints(weak) {
    els.weakList.innerHTML = '';
    if (!weak || !weak.length) {
      els.weakList.appendChild(global.AIUI.el('p', 'topic-sub', '暂时没有薄弱知识点，保持住。'));
      return;
    }
    weak.slice(0, 6).forEach(function (w, i) {
      const row = global.AIUI.el('div', 'topic-row');
      row.style.animationDelay = i * 40 + 'ms';

      const head = global.AIUI.el('div', 'topic-head');
      head.appendChild(global.AIUI.el('span', 'topic-name', w.name || '未命名知识点'));
      head.appendChild(global.AIUI.el('span', 'topic-pct topic-pct--weak', pctText(w.accuracy)));
      row.appendChild(head);
      row.appendChild(
        global.AIUI.el(
          'p',
          'topic-sub',
          `${subjectLabel(w.subject)} · 错 ${w.wrong_count || 0} 次 · 练 ${w.practice_count || 0} 次`
        )
      );
      els.weakList.appendChild(row);
    });
  }

  function renderDistribution(dist) {
    els.distList.innerHTML = '';
    const list = (dist || []).filter(function (d) {
      return (d.count || 0) > 0;
    });
    if (!list.length) {
      els.distList.appendChild(global.AIUI.el('p', 'topic-sub', '还没有错题分布数据。'));
      return;
    }
    // percentage 是后端算好的百分比字符串；这里只用它作为条形宽度（数值化后 clamp 0..100）
    const maxCount = Math.max.apply(
      null,
      list.map(function (d) {
        return d.count || 0;
      })
    );
    list.forEach(function (d) {
      const row = global.AIUI.el('div', 'dist-row');
      row.appendChild(global.AIUI.el('span', 'dist-label', subjectLabel(d.subject)));

      const bar = global.AIUI.el('div', 'bar dist-bar');
      const fill = global.AIUI.el('div', 'bar-fill');
      const widthPct = maxCount > 0 ? Math.round(((d.count || 0) / maxCount) * 100) : 0;
      fill.style.width = widthPct + '%';
      bar.appendChild(fill);
      row.appendChild(bar);

      row.appendChild(global.AIUI.el('span', 'dist-count', String(d.count || 0)));
      els.distList.appendChild(row);
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
        renderStats(overview);
        renderWeakPoints((data && data.weak_points) || []);
        renderDistribution((data && data.subject_distribution) || []);
        setState('success');

        // 次要信息：取不到不影响仪表盘本身
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
