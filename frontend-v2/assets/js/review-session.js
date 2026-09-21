/* ==========================================================================
 * 今日复习（批次 2）
 *
 * 契约（api/routes/srs-engine.js）:
 *   GET  /api/srs/engine/queue   → { queue:[{wrong_id,subject_code,kp_name,stem,
 *                                    user_answer,correct_answer,mastery_score,is_weak,…}], total }
 *   POST /api/srs/engine/review  → { wrong_id, quality(0-5), time_spent_ms, group_results }
 *                                  返回 { new_interval, mastery_delta, group_bonus, next_review_at }
 *   GET  /api/srs/engine/stats   → { total_reviews, today_reviews, due_count, active_days_30d }
 *
 * 两处刻意的设计：
 * 1. **防重复提交**：review 会真实改写 mastery 与下次间隔，重复提交等于刷分。
 *    提交期间所有自评按钮禁用，并用 submitting 标志兜住并发点击。
 * 2. **作答计时**：进入卡片时记时间戳，提交时算 time_spent_ms ——
 *    该字段会写进 srs_review_log，造假没有意义，所以按真实经过时间上报。
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
  let queue = [];
  let index = 0;
  let submitting = false;
  let shownAt = 0;

  function $(id) {
    return global.document.getElementById(id);
  }

  function subjectLabel(code) {
    return SUBJECT_NAMES[code] || code || '未分类';
  }

  /* ── 状态机 ─────────────────────────────────────────────────────────── */
  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'empty') {
      const done = ctx.reason === 'done';
      els.emptyTitle.textContent = done ? '今日复习完成' : '今日没有待复习的错题';
      els.emptyCopy.textContent = done
        ? '这一轮排期已清空。下次到期的错题会自动出现在这里。'
        : '去错题本看看，或先拍照解析一张卷子。';
    }
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
  }

  /* ── 渲染当前组 ─────────────────────────────────────────────────────── */
  function renderStats(stats) {
    if (!stats || !els.statRegion) return;
    const items = [
      ['待复习', stats.due_count],
      ['今日已复习', stats.today_reviews],
      ['累计复习', stats.total_reviews],
    ];
    els.statRegion.innerHTML = '';
    items.forEach(function (pair) {
      const chip = global.AIUI.el('span', 'stat-chip');
      chip.appendChild(global.AIUI.el('b', null, String(pair[1] === undefined || pair[1] === null ? '-' : pair[1])));
      chip.appendChild(document.createTextNode(' ' + pair[0]));
      els.statRegion.appendChild(chip);
    });
  }

  function renderCard() {
    const item = queue[index];
    if (!item) return;

    const total = queue.length;
    els.progress.textContent = '第 ' + (index + 1) + ' / ' + total + ' 组';
    els.kpLabel.textContent = item.kp_name || '';
    els.subjectTag.textContent = subjectLabel(item.subject_code);

    const mastery = Math.round((item.mastery_score || 0) * 100);
    els.masteryTag.textContent = '掌握度 ' + mastery + '%';
    els.weakTag.hidden = !item.is_weak;

    els.stem.textContent = item.stem || '（无题干）';

    const hasAnswer = Boolean(item.user_answer || item.correct_answer);
    els.answerBlock.hidden = !hasAnswer;
    els.userAnswer.textContent = item.user_answer ? '你的答案：' + item.user_answer : '';
    els.correctAnswer.textContent = item.correct_answer ? '正确答案：' + item.correct_answer : '';

    els.feedback.hidden = true;
    els.feedback.innerHTML = '';
    els.qualityLabel.textContent = '做完后自评：这题你掌握得怎么样？';
    setButtonsDisabled(false);

    shownAt = Date.now();
  }

  function setButtonsDisabled(disabled) {
    Array.prototype.forEach.call(els.grid.querySelectorAll('button'), function (b) {
      b.disabled = disabled;
    });
  }

  /* ── 取队列 ─────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');
    index = 0;

    return global.AIAPI.srsQueue(10)
      .then(function (data) {
        queue = (data && data.queue) || [];
        if (!queue.length) return setState('empty', { reason: 'none' });
        renderCard();
        setState('success');
        // 统计失败不影响复习本身
        return global.AIAPI.srsStats()
          .then(renderStats)
          .catch(function () {
            return null;
          });
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '取队列失败' });
      });
  }

  /* ── 提交自评 ───────────────────────────────────────────────────────── */
  function rate(quality) {
    if (submitting) return global.Promise.resolve('busy');
    const item = queue[index];
    if (!item) return global.Promise.resolve('no-item');

    submitting = true;
    setButtonsDisabled(true);

    const payload = {
      wrong_id: item.wrong_id,
      quality: quality,
      time_spent_ms: Math.max(0, Date.now() - shownAt),
      group_results: [],
    };

    return global.AIAPI.srsReview(payload)
      .then(function (data) {
        submitting = false;
        const delta = data && typeof data.mastery_delta === 'number' ? data.mastery_delta : null;
        els.feedback.hidden = false;
        els.feedback.innerHTML =
          '下次复习：<b>' +
          (data && data.new_interval !== undefined ? data.new_interval : '?') +
          '</b> 天后' +
          (delta === null ? '' : ' · 掌握度 <b>' + (delta >= 0 ? '+' : '') + delta + '</b>') +
          (data && data.group_bonus ? ' · 相似题加分 <b>+' + data.group_bonus + '</b>' : '');
        els.qualityLabel.textContent = '已记录，0.8 秒后进入下一组…';

        return new global.Promise(function (resolve) {
          global.setTimeout(function () {
            index += 1;
            if (index >= queue.length) return resolve(setState('empty', { reason: 'done' }));
            renderCard();
            resolve('next');
          }, 800);
        });
      })
      .catch(function (err) {
        submitting = false;
        setButtonsDisabled(false);
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '提交复习失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.statRegion = $('stat-region');
    els.progress = $('progress');
    els.kpLabel = $('kp-label');
    els.subjectTag = $('subject-tag');
    els.masteryTag = $('mastery-tag');
    els.weakTag = $('weak-tag');
    els.stem = $('stem');
    els.answerBlock = $('answer-block');
    els.userAnswer = $('user-answer');
    els.correctAnswer = $('correct-answer');
    els.feedback = $('feedback');
    els.qualityLabel = $('quality-label');
    els.grid = $('quality-grid');
    els.emptyTitle = $('empty-title');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    els.grid.addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('button[data-quality]') : null;
      if (!btn) return;
      rate(Number(btn.getAttribute('data-quality')));
    });
    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    load();
  }

  global.ReviewSession = {
    STATES: STATES,
    load: load,
    rate: rate,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    getIndex: function () {
      return index;
    },
    getQueueSize: function () {
      return queue.length;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
