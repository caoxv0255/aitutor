/* ==========================================================================
 * 学科大屏（批次 4 · 第 7 页）
 *
 * 规格出处：
 *   - PM-BRIEF B.3:179   「subject-detail?subject=math 单科深度诊断 / 大圆环 +
 *                         tabs (概览/知识点/错题/趋势) / tabs skeleton /
 *                         空态'本学科暂未练习'」
 *   - PM-BRIEF F.4:403   「大圆环 + 4 tab + 跨学科」
 *   - SPEC-ROUTES:55     依赖 GET /api/knowledge/mastery、GET /api/knowledge/points
 *
 * 实际可用接口（api/modules/knowledge/routes.js + api/modules/user）：
 *   GET /api/knowledge/mastery?subject=  → { subject, overall(0..1), by_topic[],
 *         weak_points[] }（⚠️ G6-b：本端点 0..1，展示层 ×100，只乘一次）
 *   GET /api/knowledge/points?subject=   → data:[{id,name,subject,difficulty,
 *         frequency,mastery}]（mastery 已 Math.round，0..100 整数）
 *   GET /api/user/wrong-questions?subject=&page_size=  → 错题列表
 *   GET /api/knowledge/cross-subject-impact?subject=   → { root_causes[] }（可选，
 *         失败静默，不拖垮整页）
 *
 * ⚠️ 缺接口不伪造：无按学科过滤的练习趋势端点 → 「趋势」tab 说明态登记。
 * 学科参数 ?subject= 沿用 PM-BRIEF B.3 的 query-param 约定；学科清单来自
 * global.AISubjects（9 科）。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];
  const TABS = ['overview', 'points', 'wrong', 'trend'];

  const els = {};
  let machine = null;
  let subject = 'math';

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
  }

  /* ── tabs ───────────────────────────────────────────────────────────── */
  function switchTab(name) {
    TABS.forEach(function (t) {
      const panel = $('tab-' + t);
      if (panel) panel.hidden = t !== name;
    });
    els.detailTabs.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('tab--on', btn.getAttribute('data-tab') === name);
    });
    return name;
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderOverview(mastery, cross) {
    // G6-b：overall 0..1 → 百分比，页面里只乘这一次
    const overall = Math.round((Number(mastery && mastery.overall) || 0) * 100);
    els.overallValue.textContent = String(overall);
    els.overallRing.style.setProperty('--ring-pct', String(Math.max(0, Math.min(100, overall))));

    const byTopic = (mastery && mastery.by_topic) || [];
    els.overviewSub.textContent =
      global.AISubjects.name(subject) +
      ' · ' + byTopic.length + ' 个知识点已练习' +
      (byTopic.length ? ' · 薄弱 ' + ((mastery && mastery.weak_points) || []).length + ' 个' : '');

    // 薄弱点（复用 mastery 端点的 weak_points）
    els.weakPoints.innerHTML = '';
    const weak = (mastery && mastery.weak_points) || [];
    if (weak.length) {
      const head = global.AIUI.el('div', 'section__eyebrow', 'WEAK POINTS');
      els.weakPoints.appendChild(head);
    }
    weak.forEach(function (w) {
      const row = global.AIUI.el('div', 'topic-row');
      const pct = Math.round((Number(w.mastery) || 0) * 100);
      row.appendChild(global.AIUI.el('span', 'topic-name', w.topic || w.kp_id || ''));
      row.appendChild(global.AIUI.el('span', 'topic-pct topic-pct--weak', pct + '%'));
      els.weakPoints.appendChild(row);
      if (w.recommendation) {
        els.weakPoints.appendChild(global.AIUI.el('p', 'form-hint', w.recommendation));
      }
    });

    // 跨学科联动（F.4）：失败静默
    els.crossNote.hidden = true;
    const causes = (cross && cross.root_causes) || [];
    if (causes.length) {
      els.crossCopy.textContent =
        '可能拖累' + global.AISubjects.name(subject) + '的先决知识点：' +
        causes
          .map(function (c) {
            return global.AISubjects.name(c.subject) + '·' + c.name;
          })
          .join('、') + '（' + (cross.note || '') + '）';
      els.crossNote.hidden = false;
    }
  }

  function renderPoints(items) {
    els.pointsList.innerHTML = '';
    (items || []).forEach(function (p) {
      const row = global.AIUI.el('div', 'topic-row');
      row.appendChild(global.AIUI.el('span', 'topic-name', p.name || p.id));
      const sub = [
        '难度 ' + (p.difficulty != null ? p.difficulty : '-'),
        '频次 ' + (p.frequency || '-'),
      ].join(' · ');
      row.appendChild(global.AIUI.el('span', 'topic-sub', sub));
      row.appendChild(global.AIUI.el('span', 'topic-pct', (p.mastery != null ? p.mastery : 0) + '%'));
      els.pointsList.appendChild(row);
    });
    if (!(items || []).length) {
      els.pointsList.appendChild(
        global.AIUI.el('p', 'form-hint', '后端知识点库暂未覆盖该学科。')
      );
    }
  }

  function renderWrong(payload) {
    els.wrongList.innerHTML = '';
    const rows = (payload && (payload.data || payload.questions || payload)) || [];
    if (!Array.isArray(rows) || !rows.length) {
      els.wrongList.appendChild(global.AIUI.el('p', 'form-hint', '本学科暂无错题，继续保持。'));
      return;
    }
    rows.slice(0, 10).forEach(function (w) {
      const row = global.AIUI.el('div', 'task-row');
      const main = global.AIUI.el('div');
      main.appendChild(global.AIUI.el('div', 'task-name', w.content || w.stem || w.title || '（无题干）'));
      const meta = [w.created_at ? String(w.created_at).slice(0, 10) : '', w.reviewed ? '已复习' : '未复习']
        .filter(Boolean)
        .join(' · ');
      main.appendChild(global.AIUI.el('span', 'topic-sub', meta));
      row.appendChild(main);
      const link = global.AIUI.el('a', 'btn btn-ghost', '错题本');
      link.setAttribute('href', '/wrong-book.html');
      row.appendChild(link);
      els.wrongList.appendChild(row);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const s = global.encodeURIComponent(subject);
    const mastery = global.AIAPI.request('/api/knowledge/mastery?subject=' + s);
    const points = global.AIAPI.request('/api/knowledge/points?subject=' + s);
    const wrong = global.AIAPI.request('/api/user/wrong-questions?subject=' + s + '&page_size=10');
    // 跨学科联动是加分项：失败静默，不拖垮整页
    const cross = global.AIAPI.request('/api/knowledge/cross-subject-impact?subject=' + s).catch(function () {
      return null;
    });

    return global.Promise.all([mastery, points, wrong, cross])
      .then(function (all) {
        const masteryData = all[0] || {};
        const pointsData = (all[1] && all[1].data) || [];
        const byTopic = masteryData.by_topic || [];

        renderOverview(masteryData, all[3]);
        renderPoints(pointsData);
        renderWrong(all[2]);

        els.detailEyebrow.textContent = 'SUBJECT · ' + subject.toUpperCase();
        els.detailTitle.textContent = global.AISubjects.name(subject) + ' · 深度诊断';

        // 空判据：没有练习过任何知识点（by_topic 空 且 错题为空）→ 不伪造数据
        const wrongRows = ((all[2] && (all[2].data || all[2])) || []);
        const hasWrong = Array.isArray(wrongRows) && wrongRows.length > 0;
        if (!byTopic.length && !hasWrong) {
          setState('empty');
          return 'empty';
        }

        switchTab('overview');
        setState('success');
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取学科诊断失败' });
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.detailEyebrow = $('detail-eyebrow');
    els.detailTitle = $('detail-title');
    els.subjectSelect = $('subject-select');
    els.detailTabs = $('detail-tabs');
    els.overallRing = $('overall-ring');
    els.overallValue = $('overall-value');
    els.overviewSub = $('overview-sub');
    els.weakPoints = $('weak-points');
    els.crossNote = $('cross-note');
    els.crossCopy = $('cross-copy');
    els.pointsList = $('points-list');
    els.wrongList = $('wrong-list');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    // ?subject= 参数（PM B.3 约定）；未知学科回退 math，不伪造数据
    const param = new global.URLSearchParams(global.location.search).get('subject');
    if (param && global.AISubjects.LIST.some(function (s) { return s.code === param; })) {
      subject = param;
    } else if (param) {
      subject = 'math';
    }

    global.AISubjects.fillSelect(els.subjectSelect, { selected: subject });
    els.subjectSelect.value = subject;
    els.subjectSelect.addEventListener('change', function () {
      subject = els.subjectSelect.value;
      const url = new global.URL(global.location.href);
      url.searchParams.set('subject', subject);
      global.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString());
      load();
    });

    els.detailTabs.addEventListener('click', function (ev) {
      const btn = ev.target.closest('.tab');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });

    els.authLink = $('auth-link');
    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    setState('empty');
    load();
  }

  global.SubjectDetail = {
    STATES: STATES,
    TABS: TABS,
    load: load,
    setState: setState,
    switchTab: switchTab,
    getState: function () {
      return machine.get();
    },
    data: {
      get subject() {
        return subject;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
