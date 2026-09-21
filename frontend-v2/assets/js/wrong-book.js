/* ==========================================================================
 * 错题本（阶段 3 横向铺开的第一页）
 *
 * 玩法：沿用 photo-solve 抽出来的三件套 ——
 *   ui.js 的六态机 · api.js 的错误分类 · app.css 的 clay token
 * 页面本身只写"列表 + 筛选 + 翻页"的差异部分。
 *
 * 已知接口缺口（记入 SPEC-DATA）：后端未挂载 PUT/DELETE /api/user/wrong-questions/:id，
 * 因此"标记已复习 / 删除"暂不可实现，页面只做展示。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];
  const PAGE_SIZE = 10;

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
  let page = 1;
  let total = 0;

  function $(id) {
    return global.document.getElementById(id);
  }

  /** 如有学科中文名就用后端的，否则本地兜底 */
  function subjectLabel(row) {
    return row.subject_name || SUBJECT_NAMES[row.subject_code] || row.subject_code || '未分类';
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    );
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
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent =
        ctx.reason === 'filtered'
          ? '当前筛选条件下没有错题，换个学科或状态试试。'
          : '用「拍照解题」解析一张卷子，把结果存进来。';
    }
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderStats(stats) {
    if (!stats || !els.statRegion) return;
    const items = [
      ['总错题', stats.total_count],
      ['未复习', stats.unreviewed_count],
      ['已复习', stats.reviewed_count],
    ];
    els.statRegion.innerHTML = '';
    items.forEach(function (pair) {
      const chip = global.AIUI.el('span', 'stat-chip');
      chip.appendChild(global.AIUI.el('b', null, String(pair[1] === undefined || pair[1] === null ? '-' : pair[1])));
      chip.appendChild(document.createTextNode(' ' + pair[0]));
      els.statRegion.appendChild(chip);
    });
  }

  function renderList(rows) {
    els.list.innerHTML = '';
    rows.forEach(function (row, i) {
      const li = global.AIUI.el('li', 'q-card');
      li.style.animationDelay = i * 40 + 'ms';

      const head = global.AIUI.el('div', 'q-head');
      head.appendChild(global.AIUI.el('span', 'tag', subjectLabel(row)));

      const tags = [
        row.category_name,
        row.difficulty ? '难度 ' + row.difficulty : '',
        row.reviewed ? '已复习' : '未复习',
      ].filter(Boolean);
      tags.forEach(function (t) {
        head.appendChild(global.AIUI.el('span', 'tag', t));
      });
      li.appendChild(head);

      li.appendChild(global.AIUI.el('p', 'q-body', row.content || row.question || '（无题干）'));

      if (row.error_analysis) {
        li.appendChild(global.AIUI.el('p', 'q-analysis', row.error_analysis));
      }

      const meta = global.AIUI.el('p', 'q-meta');
      const bits = [row.knowledge_point_name, row.created_at ? '收录于 ' + formatDate(row.created_at) : ''].filter(
        Boolean
      );
      meta.textContent = bits.join(' · ');
      li.appendChild(meta);

      // G1 闭环操作：标记复习 / 删除（PUT、DELETE 于 2026-09-21 挂载）
      const actions = global.AIUI.el('div', 'q-actions');

      const reviewBtn = global.AIUI.el('button', 'btn btn-ghost', row.reviewed ? '标记未复习' : '标记已复习');
      reviewBtn.type = 'button';
      reviewBtn.addEventListener('click', function () {
        act('update', row, reviewBtn, { reviewed: row.reviewed ? 0 : 1 });
      });

      const delBtn = global.AIUI.el('button', 'btn btn-ghost btn-danger', '删除');
      delBtn.type = 'button';
      delBtn.addEventListener('click', function () {
        act('delete', row, delBtn);
      });

      actions.appendChild(reviewBtn);
      actions.appendChild(delBtn);
      li.appendChild(actions);

      els.list.appendChild(li);
    });
  }

  /**
   * 行级写操作。成功即静默刷新列表；失败按 mapError 的判据落到全局状态。
   * 404 是"这条已被删或不属于你"，同样归到 error 态并把后端文案带出来。
   */
  function act(kind, row, btn, payload) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = kind === 'delete' ? '删除中…' : '提交中…';

    const call =
      kind === 'delete' ? global.AIAPI.deleteWrongQuestion(row.id) : global.AIAPI.updateWrongQuestion(row.id, payload);

    return call
      .then(function () {
        return load({ withStats: true });
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = original;
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '操作失败' });
      });
  }

  function renderPager(data) {
    const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
    els.pageInfo.textContent =
      '第 ' + (data.page || page) + ' / ' + totalPages + ' 页 · 共 ' + (data.total || 0) + ' 条';
    els.prevBtn.disabled = (data.page || page) <= 1;
    els.nextBtn.disabled = (data.page || page) >= totalPages;
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function query() {
    return {
      page: page,
      page_size: PAGE_SIZE,
      subject: els.subjectFilter.value,
      reviewed: els.reviewedFilter.value,
    };
  }

  function load(options) {
    options = options || {};
    if (global.navigator && global.navigator.onLine === false) return Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return Promise.resolve(setState('auth'));

    setState('loading');

    return global.AIAPI.getWrongQuestions(query())
      .then(function (data) {
        total = data && data.total ? data.total : 0;
        if (!((data && data.questions) || []).length) {
          const filtering = Boolean(els.subjectFilter.value || els.reviewedFilter.value);
          return setState('empty', { reason: filtering ? 'filtered' : 'no-data' });
        }
        renderList(data.questions);
        renderPager(data);
        // 统计失败不影响列表本身
        return setState('success');
      })
      .then(function () {
        if (options.withStats === false) return null;
        return global.AIAPI.getWrongQuestionStats()
          .then(renderStats)
          .catch(function () {
            return null;
          });
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '加载错题失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.statRegion = $('stat-region');
    els.list = $('list');
    els.pageInfo = $('page-info');
    els.prevBtn = $('prev-btn');
    els.nextBtn = $('next-btn');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');
    els.subjectFilter = $('subject-filter');
    els.reviewedFilter = $('reviewed-filter');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('filter-form').addEventListener('submit', function (e) {
      e.preventDefault();
      page = 1;
      load();
    });
    els.prevBtn.addEventListener('click', function () {
      if (page > 1) {
        page -= 1;
        load({ withStats: false });
      }
    });
    els.nextBtn.addEventListener('click', function () {
      if (page * PAGE_SIZE < total) {
        page += 1;
        load({ withStats: false });
      }
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

  global.WrongBook = {
    STATES: STATES,
    load: load,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    getPage: function () {
      return page;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
