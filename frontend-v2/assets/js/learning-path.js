/* ==========================================================================
 * 学习路径（批次 3 第四页）
 *
 * 契约: GET /api/learning-path/current?subject=
 *   → { subject, recommendation_reason, cited_stats:[{icon,label}],
 *       global_progress_pct(0..100), stages[4]:{id,name,status,description,progress_pct?},
 *       today_task|null, empty_state? }
 *
 * ⚠️ 标度：global_progress_pct 与 stage.progress_pct 都是 **0..100**（后端按 25 分档算的），
 * 直接显示，不要再乘 —— 与 /api/knowledge/mastery 的 0..1 不同。
 *
 * ⚠️ 跨树链接（SPEC-DATA G8）：后端给的动作 URL 用的是第三套命名，
 * 实测 /onboarding.html 与 /photo-search.html **生产 404**、/review.html 落到旧树页面。
 * 因此本页把所有后端 URL 过一道 resolveTarget()：
 *   - 认识的 → 映射到新树对应页
 *   - 不认识的 → **渲染成不可点的文字**，绝不放死链给用户
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  /** 后端 URL → 新树 URL。键为去掉 query 的路径。 */
  const URL_MAP = {
    '/wrong-book.html': '/wrong-book.html',
    '/dashboard.html': '/dashboard.html',
    '/review.html': '/review-session.html',
    '/photo-search.html': '/photo-solve.html',
    '/photo-solve.html': '/photo-solve.html',
    '/onboarding.html': '/photo-solve.html', // 诊断入口在新树尚未重建 → 先引导到拍照解题
    '/mastery.html': '/mastery.html',
    '/practice-hub.html': '/practice-hub.html',
  };

  const els = {};
  let machine = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  /**
   * 后端 URL → 新树可点路径；不认识则返回 null（调用方渲染成纯文字，不放死链）。
   * 关键：保留原 query（如 /review.html?session=auto&kp=xxx 的 kp 参数）。
   */
  function resolveTarget(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const q = raw.indexOf('?');
    const path = q === -1 ? raw : raw.slice(0, q);
    const query = q === -1 ? '' : raw.slice(q);
    const mapped = URL_MAP[path];
    return mapped ? mapped + query : null;
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'empty') {
      // 空态内容来自后端的 empty_state（无数据 / 本周 100%）
      const es = ctx.emptyState || {};
      els.emptyTitle.textContent = es.title || '学习路径还没准备好';
      els.emptyCopy.textContent = es.description || '先做几道题，系统才能为你定制路径。';
      els.emptyActions.innerHTML = '';
      [es.primary_action, es.secondary_action].forEach(function (action, i) {
        if (!action || !action.label) return;
        const target = resolveTarget(action.target_url);
        const node = global.document.createElement(target ? 'a' : 'span');
        node.textContent = action.label;
        node.className = i === 0 ? 'btn' : 'btn btn-ghost';
        if (target) node.setAttribute('href', target);
        else node.setAttribute('title', `目标页尚未在新版中提供：${action.target_url || '未知'}`);
        els.emptyActions.appendChild(node);
        els.emptyActions.appendChild(global.document.createTextNode(' '));
      });
    }
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderProgress(data) {
    const pct = typeof data.global_progress_pct === 'number' ? data.global_progress_pct : 0;
    els.progressValue.textContent = String(Math.round(pct));

    const stages = data.stages || [];
    const done = stages.filter(function (s) {
      return s.status === 'completed';
    }).length;
    els.progressMeta.textContent = '';
    const line1 = global.AIUI.el('div');
    line1.appendChild(document.createTextNode('已完成阶段 '));
    line1.appendChild(global.AIUI.el('b', null, String(done)));
    line1.appendChild(document.createTextNode(' / '));
    line1.appendChild(global.AIUI.el('b', null, String(stages.length)));
    els.progressMeta.appendChild(line1);
    els.progressMeta.appendChild(global.AIUI.el('div', null, pct >= 100 ? '本阶段目标已达成。' : '继续按阶段推进。'));

    // 引用统计 chips（元素形状是 {icon,label}，icon 名不保证前端有对应图标 → 只渲染 label）
    els.citedStats.innerHTML = '';
    (data.cited_stats || []).forEach(function (c) {
      els.citedStats.appendChild(global.AIUI.el('span', 'chip', c.label || ''));
    });

    els.reason.textContent = data.recommendation_reason || '';
  }

  function renderStages(stages) {
    els.stageList.innerHTML = '';
    (stages || []).forEach(function (s) {
      const li = global.AIUI.el('li', `stage stage--${s.status || 'pending'}`);
      li.appendChild(global.AIUI.el('span', 'stage-dot'));
      li.appendChild(global.AIUI.el('div', 'stage-name', s.name || s.id || '阶段'));
      if (s.description) li.appendChild(global.AIUI.el('p', 'stage-desc', s.description));
      if (s.status === 'current' && typeof s.progress_pct === 'number') {
        const bar = global.AIUI.el('div', 'bar stage-bar');
        const fill = global.AIUI.el('div', 'bar-fill');
        fill.style.width = Math.max(0, Math.min(100, s.progress_pct)) + '%';
        bar.appendChild(fill);
        li.appendChild(bar);
      }
      els.stageList.appendChild(li);
    });
  }

  function renderTask(task) {
    if (!task) {
      els.taskBlock.hidden = true;
      return;
    }
    els.taskBlock.hidden = false;
    els.taskTitle.textContent = task.title || '今日任务';
    els.taskTopic.textContent = task.topic || '';
    els.taskReason.textContent = task.reason || '';

    els.taskAction.innerHTML = '';
    const target = resolveTarget(task.target_url);
    if (target) {
      const a = global.document.createElement('a');
      a.className = 'btn btn-ghost';
      a.textContent = '开始';
      a.setAttribute('href', target);
      els.taskAction.appendChild(a);
    } else {
      // 不给死链：说明原因而不是放一个 404 按钮
      els.taskAction.appendChild(
        global.AIUI.el('span', 'form-hint', `该任务的目标页尚未在新版中提供（${task.target_url || '未知'}）`)
      );
    }
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');
    return global.AIAPI.learningPath(els.subjectFilter.value)
      .then(function (data) {
        const d = data || {};
        if (d.empty_state) return setState('empty', { emptyState: d.empty_state });

        renderProgress(d);
        renderStages(d.stages);
        renderTask(d.today_task);
        return setState('success');
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
    els.subjectFilter = $('subject-filter');
    // 无「全部」项（后端必填 subject），默认保持改动前的数学
    global.AISubjects.fillSelect(els.subjectFilter, { selected: 'math' });
    els.progressValue = $('progress-value');
    els.progressMeta = $('progress-meta');
    els.citedStats = $('cited-stats');
    els.reason = $('reason');
    els.stageList = $('stage-list');
    els.taskBlock = $('task-block');
    els.taskTitle = $('task-title');
    els.taskTopic = $('task-topic');
    els.taskReason = $('task-reason');
    els.taskAction = $('task-action');
    els.emptyTitle = $('empty-title');
    els.emptyCopy = $('empty-copy');
    els.emptyActions = $('empty-actions');
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

  global.LearningPath = {
    STATES: STATES,
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
