/* ==========================================================================
 * 知识掌握度（批次 2 第二页）
 *
 * 契约（api/modules/knowledge/routes.js:17）:
 *   GET /api/knowledge/mastery[?subject=]
 *     → { subject, overall, by_topic:[{kp_id,topic,mastery,questions_done,accuracy}],
 *         weak_points:[{topic,mastery,recommendation}] }
 *
 * ⚠️ 标度（SPEC-DATA G6-b）：本端点的 overall / by_topic[].mastery 是 **0..1**，
 * 与 /api/srs/engine/queue 的 mastery_score(0..100) 不同。归一化只在本文件 pct() 做一次，
 * 不要在别处重复乘 —— 重复乘就是 G6 那类标度分裂的起点。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const els = {};
  let machine = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  /** 0..1 → 整数百分比。全页唯一的标度转换点。 */
  function pct(v) {
    const n = typeof v === 'number' && isFinite(v) ? v : 0;
    return Math.round(n * 100);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent =
        ctx.reason === 'filtered'
          ? '该学科下还没有练习记录，换个学科试试。'
          : '做完一组题或复习一次，掌握度就会出现在这里。';
    }
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderOverall(data, weakCount) {
    const overall = pct(data.overall);
    els.overallValue.textContent = String(overall);

    const topicCount = (data.by_topic || []).length;
    els.overallMeta.innerHTML = '';
    const line1 = global.AIUI.el('div');
    line1.appendChild(document.createTextNode('已练习知识点 '));
    line1.appendChild(global.AIUI.el('b', null, String(topicCount)));
    line1.appendChild(document.createTextNode(' 个 · 薄弱 '));
    line1.appendChild(global.AIUI.el('b', null, String(weakCount)));
    line1.appendChild(document.createTextNode(' 个'));
    els.overallMeta.appendChild(line1);
    els.overallMeta.appendChild(
      global.AIUI.el('div', null, overall >= 80 ? '整体掌握良好，保持复习节奏。' : '还有提升空间，优先攻克薄弱项。')
    );
  }

  function renderTopics(topics, weakNames) {
    els.topicList.innerHTML = '';
    topics.forEach(function (t) {
      const isWeak = weakNames.has(t.topic);
      const p = pct(t.mastery);

      const row = global.AIUI.el('div', 'topic-row');

      const head = global.AIUI.el('div', 'topic-head');
      head.appendChild(global.AIUI.el('span', 'topic-name', t.topic || t.kp_id || '未命名知识点'));
      head.appendChild(global.AIUI.el('span', isWeak ? 'topic-pct topic-pct--weak' : 'topic-pct', p + '%'));
      row.appendChild(head);

      const bar = global.AIUI.el('div', 'bar');
      const fill = global.AIUI.el('div', isWeak ? 'bar-fill bar-fill--weak' : 'bar-fill');
      fill.style.width = p + '%'; // 唯一的数值驱动样式；不做 HTML 字符串拼接
      bar.appendChild(fill);
      row.appendChild(bar);

      const sub = global.AIUI.el(
        'p',
        'topic-sub',
        '做过 ' + (t.questions_done || 0) + ' 题 · 正确率 ' + pct(t.accuracy) + '%'
      );
      row.appendChild(sub);

      els.topicList.appendChild(row);
    });
  }

  function renderAdvice(weakPoints) {
    if (!weakPoints || !weakPoints.length) {
      els.adviceBlock.hidden = true;
      els.adviceList.innerHTML = '';
      return;
    }
    els.adviceList.innerHTML = '';
    weakPoints.forEach(function (w) {
      const li = global.AIUI.el('li');
      li.appendChild(global.AIUI.el('span', 'advice-dot'));
      li.appendChild(document.createTextNode(w.recommendation || '建议复习 ' + (w.topic || '该知识点')));
      els.adviceList.appendChild(li);
    });
    els.adviceBlock.hidden = false;
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');
    const subject = els.subjectFilter.value;

    return global.AIAPI.knowledgeMastery(subject)
      .then(function (data) {
        const topics = (data && data.by_topic) || [];
        if (!topics.length) return setState('empty', { reason: subject ? 'filtered' : 'no-data' });

        const weakPoints = (data && data.weak_points) || [];
        // 用后端自己的薄弱判定(weak_points)，不在前端重复实现阈值
        const weakNames = new Set(
          weakPoints.map(function (w) {
            return w.topic;
          })
        );

        renderOverall(data || {}, weakPoints.length);
        renderTopics(topics, weakNames);
        renderAdvice(weakPoints);
        return setState('success');
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '统计失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.subjectFilter = $('subject-filter');
    global.AISubjects.fillSelect(els.subjectFilter, { includeAll: true });
    els.overallValue = $('overall-value');
    els.overallMeta = $('overall-meta');
    els.topicList = $('topic-list');
    els.adviceBlock = $('advice-block');
    els.adviceList = $('advice-list');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('filter-form').addEventListener('submit', function (e) {
      e.preventDefault();
      load();
    });
    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    load();
  }

  global.Mastery = {
    STATES: STATES,
    load: load,
    pct: pct,
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
