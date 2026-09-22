/* ==========================================================================
 * 知识星图（批次 4 · 第 5 页）
 *
 * 玩法与其余新树页面一致：ui.js 六态机 + api.js 数据层 + app.css 组件，
 * 本文件只写"node-link / 热力双视图 + 学科钻取"的差异部分。
 *
 * 依赖接口（已存在，见 api/modules/knowledge/routes.js:324）：
 *   GET /api/knowledge/star-map →
 *     { subjects:[9 {code,name,color}],
 *       nodes:[{kp_id,name,subject_code,level,difficulty,
 *               mastery(0..100|null),is_weak(<50),attempt_count}],
 *       edges:[{from,to,strength,type}],   // 表缺失时后端降级为空数组
 *       heatmap:{ [subject_code]:{ [6 类别]: 最低熟练度|null } } }
 *
 * ⚠️ 端点方法没有加进 assets/js/api.js（该文件本批次被锁定），因此本页用
 *    AIAPI.request 直连 —— 仍走统一数据层（鉴权/解包/错误分类）。
 *
 * 标度（G6）：mastery 与薄弱阈值同标度 0..100，直接显示，不要除以 100。
 * 学科钻取作用于星图视图；热力矩阵固定展示 9 学科全量。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const els = {};
  let machine = null;
  let view = 'node';
  let subject = '';
  let payload = null;

  function $(id) {
    return global.document.getElementById(id);
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

  /* ── 视图与筛选 ─────────────────────────────────────────────────────── */
  function setView(next) {
    view = next === 'heat' ? 'heat' : 'node';
    const tabs = els.viewTabs.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i += 1) {
      const on = tabs[i].dataset.view === view;
      tabs[i].classList.toggle('tab--on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    els.nodeView.hidden = view !== 'node';
    els.heatView.hidden = view !== 'heat';
  }

  function setSubject(next) {
    subject = next || '';
    const tabs = els.subjectTabs.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i += 1) {
      const on = (tabs[i].dataset.subject || '') === subject;
      tabs[i].classList.toggle('tab--on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    renderNodes();
  }

  function getView() {
    return view;
  }

  function getSubject() {
    return subject;
  }

  /* ── 星图布局：节点按环状均匀分布，连线用 SVG 百分比坐标 ─────────────── */
  function visibleNodes() {
    const nodes = (payload && payload.nodes) || [];
    if (!subject) return nodes;
    return nodes.filter(function (n) {
      return n.subject_code === subject;
    });
  }

  function nodeColor(subjectCode) {
    const list = (payload && payload.subjects) || [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].code === subjectCode) return list[i].color;
    }
    return 'var(--ink-3)';
  }

  function renderNodes() {
    const sky = els.starSky;
    sky.innerHTML = '';
    const rows = visibleNodes();
    if (!rows.length) {
      sky.appendChild(global.AIUI.el('p', 'form-hint', '该学科下暂无知识点，练一练就会亮起来。'));
      return;
    }

    const n = rows.length;
    const edges = (payload && payload.edges) || [];
    const idSet = new Set(
      rows.map(function (r) {
        return r.kp_id;
      })
    );

    // SVG 连线（按节点坐标绘制；只在当前可见节点内连线）
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = global.document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'star-edges');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const pos = {};
    rows.forEach(function (r, i) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      pos[r.kp_id] = {
        x: 50 + 42 * Math.cos(angle),
        y: 50 + 42 * Math.sin(angle),
      };
    });
    edges.forEach(function (e) {
      if (!idSet.has(e.from) || !idSet.has(e.to)) return;
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) return;
      const line = global.document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', a.x.toFixed(2));
      line.setAttribute('y1', a.y.toFixed(2));
      line.setAttribute('x2', b.x.toFixed(2));
      line.setAttribute('y2', b.y.toFixed(2));
      const aNode = rows.find(function (r) {
        return r.kp_id === e.from;
      });
      const bNode = rows.find(function (r) {
        return r.kp_id === e.to;
      });
      if ((aNode && aNode.is_weak) || (bNode && bNode.is_weak)) {
        line.setAttribute('class', 'edge--weak');
      }
      svg.appendChild(line);
    });
    sky.appendChild(svg);

    rows.forEach(function (r, i) {
      const p = pos[r.kp_id];
      const node = global.AIUI.el('div', 'star-node');
      node.style.left = p.x.toFixed(2) + '%';
      node.style.top = p.y.toFixed(2) + '%';
      // 大小 = 练习题数；明暗 = 熟练度
      const size = 44 + Math.min(r.attempt_count || 0, 30) * 0.8;
      node.style.width = Math.round(size) + 'px';
      node.style.height = Math.round(size) + 'px';
      node.style.background = nodeColor(r.subject_code);
      node.style.opacity =
        r.mastery === null || r.mastery === undefined ? '0.35' : String(0.45 + (r.mastery / 100) * 0.55);
      if (r.is_weak) node.classList.add('star-node--weak');
      if (r.mastery === null || r.mastery === undefined) node.classList.add('star-node--empty');
      node.title = r.name + ' · ' + r.subject_code + ' · 熟练度 ' + (r.mastery === null ? '—' : r.mastery);
      const label = r.name && r.name.length > 4 ? r.name.slice(0, 4) : r.name;
      node.textContent = label || r.kp_id;
      node.setAttribute('data-kp', r.kp_id);
      sky.appendChild(node);
      if (i > 60) return; // 安全阀：节点过多时不继续铺（后端 limit 由接口决定）
    });
  }

  /* ── 热力矩阵 ───────────────────────────────────────────────────────── */
  function renderHeat() {
    const grid = els.heatGrid;
    grid.innerHTML = '';
    const subjects = (payload && payload.subjects) || [];
    const heatmap = (payload && payload.heatmap) || {};
    const cats = subjects.length && heatmap[subjects[0].code] ? Object.keys(heatmap[subjects[0].code]) : [];

    grid.appendChild(global.AIUI.el('div', '', '学科'));
    cats.forEach(function (c) {
      grid.appendChild(global.AIUI.el('div', '', c));
    });

    subjects.forEach(function (s) {
      grid.appendChild(global.AIUI.el('div', '', s.name));
      const row = heatmap[s.code] || {};
      cats.forEach(function (c) {
        const v = row[c];
        const cell = global.AIUI.el('div', 'heat-cell');
        cell.textContent = v === null || v === undefined ? '—' : String(Math.round(v));
        if (v !== null && v !== undefined) {
          // 越薄弱越红（0..100 标度）
          cell.style.background = 'rgba(215,25,32,' + (0.08 + (1 - v / 100) * 0.4).toFixed(2) + ')';
        }
        grid.appendChild(cell);
      });
    });
  }

  /* ── 摘要 ───────────────────────────────────────────────────────────── */
  function renderSummary() {
    const nodes = (payload && payload.nodes) || [];
    const edges = (payload && payload.edges) || [];
    const weak = nodes.filter(function (n) {
      return n.is_weak;
    });
    els.summaryLine.textContent = '共 ' + nodes.length + ' 个知识点 · ' + edges.length + ' 条跨学科连线。';
    els.weakLine.textContent = weak.length
      ? '薄弱预警 ' +
        weak.length +
        ' 个：' +
        weak
          .slice(0, 5)
          .map(function (n) {
            return n.name;
          })
          .join('、') +
        (weak.length > 5 ? ' 等' : '') +
        '（熟练度 < 50）。'
      : '暂无薄弱预警，继续保持。';
    els.edgeLegend.textContent = edges.length ? '连线 = 跨学科关联' : '';
  }

  function renderAll() {
    renderSubjectTabs();
    renderNodes();
    renderHeat();
    renderSummary();
  }

  function renderSubjectTabs() {
    // 保留"全部"，学科 tab 按后端 subjects 清单重建（9 科固定顺序）
    const tabs = els.subjectTabs.querySelectorAll('.tab');
    for (let i = 1; i < tabs.length; i += 1) tabs[i].remove();
    ((payload && payload.subjects) || []).forEach(function (s) {
      const li = global.document.createElement('li');
      const btn = global.AIUI.el('button', 'tab', s.name);
      btn.type = 'button';
      btn.dataset.subject = s.code;
      btn.setAttribute('role', 'tab');
      const on = s.code === subject;
      if (on) btn.classList.add('tab--on');
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      li.appendChild(btn);
      els.subjectTabs.appendChild(li);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    return global.AIAPI.request('/api/knowledge/star-map')
      .then(function (res) {
        payload = (res && res.data) || {};
        const nodes = payload.nodes || [];
        if (!nodes.length) return setState('empty');
        renderAll();
        setView(view);
        return setState('success');
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '星图查询失败' });
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.viewTabs = $('view-tabs');
    els.subjectTabs = $('subject-tabs');
    els.starSky = $('star-sky');
    els.nodeView = $('node-view');
    els.heatView = $('heat-view');
    els.heatGrid = $('heat-grid');
    els.summaryLine = $('summary-line');
    els.weakLine = $('weak-line');
    els.edgeLegend = $('edge-legend');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    els.viewTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.tab');
      if (btn && btn.dataset.view) setView(btn.dataset.view);
    });
    els.subjectTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.tab');
      if (btn) setSubject(btn.dataset.subject || '');
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

  global.KnowledgeStar = {
    STATES: STATES,
    load: load,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    setView: setView,
    getView: getView,
    setSubject: setSubject,
    getSubject: getSubject,
    data: {
      get payload() {
        return payload;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
