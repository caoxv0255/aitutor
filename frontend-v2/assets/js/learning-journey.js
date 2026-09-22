/* ==========================================================================
 * 学习闭环（批次 4 · 第 8 页，dev-only）
 *
 * 规格出处：
 *   - PM-BRIEF B.1:144-147  dev-only /learning-journey =「Loop 闭环可视化」
 *   - PM-BRIEF F.11:546     同上，移出主树
 *   - SPEC-ROUTES:58        依赖 GET /api/analytics/learning-path、GET /api/loop/summary
 *
 * 实际可用接口：
 *   GET /api/analytics/learning-path（analytics/routes.js:24，与
 *       /api/learning-path/current 同一个 handler）
 *       → { global_progress_pct, stages[4], today_task, cited_stats,
 *           recommendation_reason, empty_state? }
 *   GET /api/loop/summary（loop/routes.js:88）
 *       → { date, streak_days, stats:{overall_score, weak_points_total,
 *           today_questions_done, today_questions_target, today_minutes_*},
 *           subject_distribution[], hot_kps[], next_actions[], today_tasks[] }
 *
 * G8（SPEC-DATA）：loop/summary 的 next_actions[].href 全是旧树 /f3/pages/...
 *   链接 —— 一律过 resolveTarget()：认识的映射到新树，不认识的渲染成
 *   不可点文字，绝不放死链。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  /** 后端 URL → 新树 URL。键为去掉 query 的路径（与 learning-path.js 同一套约定）。 */
  const URL_MAP = {
    '/wrong-book.html': '/wrong-book.html',
    '/dashboard.html': '/dashboard.html',
    '/review.html': '/review-session.html',
    '/photo-search.html': '/photo-solve.html',
    '/photo-solve.html': '/photo-solve.html',
    '/mastery.html': '/mastery.html',
    '/practice-hub.html': '/practice-hub.html',
    '/learning-path.html': '/learning-path.html',
    '/essay.html': '/essay.html',
    '/predictive-paper.html': '/predictive-paper.html',
    // F3 旧树页面（loop/routes.js buildNextActions）
    '/f3/pages/exam-simulation.html': '/practice-hub.html',
    '/f3/pages/personalized-paper.html': '/predictive-paper.html',
    '/f3/pages/learning-path.html': '/learning-path.html',
    '/f3/pages/vision.html': '/photo-solve.html',
    '/f3/pages/wrong-book.html': '/wrong-book.html',
    '/f3/pages/mastery.html': '/mastery.html',
    '/f3/pages/essay.html': '/essay.html',
  };

  const els = {};
  let machine = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'empty') {
      els.emptyTitle.textContent = (ctx && ctx.title) || '闭环还没有开始';
      els.emptyCopy.textContent = (ctx && ctx.copy) || '先拍一道题入库，Loop 才能转起来。';
    }
  }

  /** 后端 URL → 新树可点路径；不认识则返回 null（渲染成纯文字，不放死链）。 */
  function resolveTarget(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const q = raw.indexOf('?');
    const path = q === -1 ? raw : raw.slice(0, q);
    const query = q === -1 ? '' : raw.slice(q);
    const mapped = URL_MAP[path];
    return mapped ? mapped + query : null;
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderStats(summary) {
    const s = (summary && summary.stats) || {};
    els.loopStats.innerHTML = '';
    [
      [s.overall_score != null ? s.overall_score : 0, '综合得分'],
      [summary && summary.streak_days != null ? summary.streak_days : 0, '连续天数'],
      [s.today_questions_done != null ? s.today_questions_done : 0, '今日已答' + (s.today_questions_target ? ' / ' + s.today_questions_target : '')],
      [s.weak_points_total != null ? s.weak_points_total : 0, '薄弱点'],
    ].forEach(function (pair) {
      const cell = global.AIUI.el('div', 'stat-cell');
      cell.appendChild(global.AIUI.el('b', null, String(pair[0])));
      cell.appendChild(global.AIUI.el('span', null, pair[1]));
      els.loopStats.appendChild(cell);
    });
  }

  function renderStages(path) {
    els.pathReason.textContent = (path && path.recommendation_reason) || '';
    els.stageList.innerHTML = '';
    const stages = (path && path.stages) || [];
    stages.forEach(function (st) {
      const li = global.AIUI.el('li', 'stage' + (st.status === 'completed' ? ' stage--completed' : st.status === 'current' ? ' stage--current' : ''));
      li.appendChild(global.AIUI.el('div', 'stage-name', st.name || st.id || ''));
      li.appendChild(global.AIUI.el('p', 'stage-desc', (st.description || '') + (st.progress_pct != null ? ' · ' + Math.round(st.progress_pct) + '%' : '')));
      els.stageList.appendChild(li);
    });
    if (!stages.length) {
      els.stageList.appendChild(global.AIUI.el('li', 'form-hint', '后端暂未返回路径阶段。'));
    }
  }

  function renderActions(summary) {
    els.actionList.innerHTML = '';
    const actions = (summary && summary.next_actions) || [];
    actions.forEach(function (a) {
      const target = resolveTarget(a.href);
      const row = global.AIUI.el('div', 'task-row');
      const main = global.AIUI.el('div');
      main.appendChild(global.AIUI.el('div', 'task-name', a.title || a.kind || ''));
      main.appendChild(global.AIUI.el('span', 'topic-sub', a.desc || ''));
      row.appendChild(main);

      if (target) {
        const link = global.AIUI.el('a', 'btn btn-ghost', '前往');
        link.setAttribute('href', target);
        row.appendChild(link);
      } else {
        // 不给死链：说明原因
        row.appendChild(global.AIUI.el('span', 'form-hint', '该入口尚未在新版提供（' + (a.href || '未知') + '）'));
      }
      els.actionList.appendChild(row);
    });
  }

  function renderKps(summary) {
    els.kpList.innerHTML = '';
    const kps = (summary && summary.hot_kps) || [];
    kps.forEach(function (k) {
      const row = global.AIUI.el('div', 'topic-row');
      row.appendChild(global.AIUI.el('span', 'topic-name', k.name || k.kp_id));
      row.appendChild(global.AIUI.el('span', 'topic-sub', (k.subject || '') + ' · 薄弱指数 ' + (k.weight != null ? k.weight : '-')));
      row.appendChild(global.AIUI.el('span', 'topic-pct topic-pct--weak', k.mastery_score != null ? Math.round(k.mastery_score) + '%' : '-'));
      els.kpList.appendChild(row);
    });
    if (!kps.length) els.kpList.appendChild(global.AIUI.el('p', 'form-hint', '暂无薄弱知识点数据。'));
  }

  function renderDist(summary) {
    els.distList.innerHTML = '';
    const dist = (summary && summary.subject_distribution) || [];
    dist.forEach(function (d) {
      const row = global.AIUI.el('div', 'dist-row');
      row.appendChild(global.AIUI.el('span', 'dist-label', d.subject || d.subject_code || ''));
      const bar = global.AIUI.el('div', 'dist-bar');
      const fill = global.AIUI.el('div', 'bar-fill');
      const total = dist.reduce(function (acc, x) {
        return acc + (Number(x.count) || 0);
      }, 0);
      fill.style.width = (total ? Math.round(((Number(d.count) || 0) / total) * 100) : 0) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(global.AIUI.el('span', 'dist-count', String(d.count != null ? d.count : 0)));
      els.distList.appendChild(row);
    });
    if (!dist.length) els.distList.appendChild(global.AIUI.el('p', 'form-hint', '暂无错题分布数据。'));
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const path = global.AIAPI.request('/api/analytics/learning-path');
    const summary = global.AIAPI.request('/api/loop/summary');

    return global.Promise.all([path, summary])
      .then(function (all) {
        const pathData = all[0] || {};
        const summaryData = all[1] || {};

        // 学习路径自己声明空态（无数据 / 本周 100%）→ 按规格落空态
        if (pathData.empty_state) {
          const es = pathData.empty_state;
          setState('empty', {
            title: es.title || '闭环还没有开始',
            copy: es.description || '先拍一道题入库，Loop 才能转起来。',
          });
          return 'empty';
        }

        renderStats(summaryData);
        renderStages(pathData);
        renderActions(summaryData);
        renderKps(summaryData);
        renderDist(summaryData);
        setState('success');
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取闭环数据失败' });
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.loopStats = $('loop-stats');
    els.pathReason = $('path-reason');
    els.stageList = $('stage-list');
    els.actionList = $('action-list');
    els.kpList = $('kp-list');
    els.distList = $('dist-list');
    els.emptyTitle = $('empty-title');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    setState('empty');
    load();
  }

  global.LearningJourney = {
    STATES: STATES,
    URL_MAP: URL_MAP,
    load: load,
    resolveTarget: resolveTarget,
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
