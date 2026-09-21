/* ==========================================================================
 * 练习中心（批次 3 第二页）
 *
 * 契约:
 *   POST /api/exam/session/start   { subject, time_limit, question_count } → { sessionId, questions[] }
 *   POST /api/exam/session/submit  { sessionId, answers:[{questionId, answer}] } → { accuracy, correctCount, … }
 *   GET  /api/exam/session/history ?limit&offset
 *
 * ⚠️ 标度（接新端点必查）：
 *   - accuracy 是**后端算好的百分比字符串**（"82.5"），直接显示，不要再乘。
 *   - 且它是**按得分加权**（earnedScore/totalScore），不是按题数 ——
 *     所以页面同时给出"答对 N/M"，否则用户会把加权分当正确率。
 *   - options 可能是字符串数组 / 对象数组 / null（主观题），三种都要处理。
 *
 * 状态：success 面板内含三个子视图（组卷 / 答题 / 结果），共享同一套状态语义。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const els = {};
  let machine = null;
  let session = null; // { sessionId, questions[] }
  let index = 0;
  const answers = new Map(); // questionId → answer
  let submitting = false;

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
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent = '该学科下暂时没有匹配的题目，换个学科试试。';
    }
    if (name === 'loading' && els.loadingTitle) {
      els.loadingTitle.textContent = ctx.title || '正在组卷…';
    }
  }

  function toggleView(view) {
    els.viewSetup.hidden = view !== 'setup';
    els.viewQuiz.hidden = view !== 'quiz';
    els.viewResult.hidden = view !== 'result';
    setState('success');
  }

  /* ── 历史 ───────────────────────────────────────────────────────────── */
  function renderHistory(rows) {
    els.historyList.innerHTML = '';
    if (!rows || !rows.length) {
      els.historyList.appendChild(global.AIUI.el('p', 'topic-sub', '还没有练习记录，从上面开始第一组吧。'));
      return;
    }
    rows.slice(0, 5).forEach(function (r) {
      const row = global.AIUI.el('div', 'task-row');
      const subject = r.subject || '练习';
      const date = (r.started_at || r.created_at || '').slice(0, 10);
      row.appendChild(global.AIUI.el('span', 'task-name', subject + (date ? ' · ' + date : '')));
      const acc = r.accuracy === undefined || r.accuracy === null ? '—' : String(r.accuracy) + '%';
      row.appendChild(global.AIUI.el('span', 'task-status', acc));
      els.historyList.appendChild(row);
    });
  }

  /* ── 答题 ───────────────────────────────────────────────────────────── */
  function renderQuestion() {
    const q = session.questions[index];
    const total = session.questions.length;
    els.quizProgress.textContent = `第 ${index + 1} / ${total} 题`;
    els.quizMeta.textContent = [q.province_name, q.year ? q.year + '年' : '', q.question_type]
      .filter(Boolean)
      .join(' · ');
    els.quizStem.textContent = q.stem || '（无题干）';

    // options 可能是：字符串数组 / 对象数组 / null（主观题）
    els.quizOptions.innerHTML = '';
    const opts = normalizeOptions(q.options);
    if (opts.length) {
      els.quizTextWrap.hidden = true;
      opts.forEach(function (opt) {
        const btn = global.AIUI.el('button', 'quality-btn', opt.label);
        btn.type = 'button';
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        if (answers.get(q.id) === opt.value) btn.classList.add('quality-btn--best');
        btn.addEventListener('click', function () {
          answers.set(q.id, opt.value);
          renderQuestion();
        });
        els.quizOptions.appendChild(btn);
      });
    } else {
      els.quizTextWrap.hidden = false;
      els.quizText.value = answers.get(q.id) || '';
    }

    els.prevBtn.disabled = index === 0;
    els.nextBtn.disabled = index === total - 1;
    els.answerHint.textContent = `已作答 ${answers.size} / ${total} 题`;
  }

  function normalizeOptions(raw) {
    if (!raw) return [];
    let list = raw;
    if (typeof raw === 'string') {
      try {
        list = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(list)) return [];
    return list
      .map(function (o, i) {
        if (typeof o === 'string') {
          return { value: String.fromCharCode(65 + i), label: `${String.fromCharCode(65 + i)}. ${o}` };
        }
        if (o && typeof o === 'object') {
          const key = o.key || o.label || String.fromCharCode(65 + i);
          return { value: String(key), label: `${key}. ${o.text || o.content || ''}` };
        }
        return null;
      })
      .filter(Boolean);
  }

  /* ── 结果 ───────────────────────────────────────────────────────────── */
  function renderResult(data) {
    const acc = data.accuracy === undefined || data.accuracy === null ? '0' : String(data.accuracy);
    els.resultScore.textContent = acc;

    els.resultMeta.innerHTML = '';
    const l1 = global.AIUI.el('div');
    l1.appendChild(document.createTextNode('答对 '));
    l1.appendChild(global.AIUI.el('b', null, String(data.correctCount || 0)));
    l1.appendChild(document.createTextNode(' / '));
    l1.appendChild(global.AIUI.el('b', null, String(data.totalQuestions || 0)));
    l1.appendChild(document.createTextNode(' 题'));
    els.resultMeta.appendChild(l1);
    els.resultMeta.appendChild(
      global.AIUI.el('div', null, `得分 ${data.earnedScore || 0} / ${data.totalScore || 0}（上面的百分比按得分加权）`)
    );

    els.resultList.innerHTML = '';
    (data.results || []).forEach(function (r, i) {
      const row = global.AIUI.el('div', 'topic-row');
      const head = global.AIUI.el('div', 'topic-head');
      head.appendChild(global.AIUI.el('span', 'topic-name', `第 ${i + 1} 题`));
      head.appendChild(
        global.AIUI.el('span', r.isCorrect ? 'topic-pct' : 'topic-pct topic-pct--weak', r.isCorrect ? '正确' : '错误')
      );
      row.appendChild(head);
      if (!r.isCorrect && r.correctAnswer) {
        row.appendChild(global.AIUI.el('p', 'topic-sub', `正确答案：${r.correctAnswer}`));
      }
      els.resultList.appendChild(row);
    });
    toggleView('result');
  }

  /* ── 动作 ───────────────────────────────────────────────────────────── */
  function loadHistory() {
    return global.AIAPI.practiceHistory({ limit: 5 })
      .then(function (data) {
        const rows = (data && (data.sessions || data.data)) || [];
        renderHistory(rows);
      })
      .catch(function () {
        renderHistory([]); // 次要信息，失败不影响组卷
      });
  }

  function boot2() {
    // 进入页面：先展示组卷视图（历史失败不阻塞）
    if (global.navigator && global.navigator.onLine === false) return setState('offline');
    if (!global.AIAPI.getToken()) return setState('auth');
    setState('loading', { title: '正在加载…' });
    return loadHistory().then(function () {
      toggleView('setup');
    });
  }

  function start() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading', { title: '正在组卷…' });
    return global.AIAPI.startPractice({
      subject: els.subjectSelect.value,
      time_limit: 120,
      question_count: Number(els.countSelect.value),
    })
      .then(function (data) {
        session = data || {};
        if (!(session.questions || []).length) return setState('empty');
        index = 0;
        answers.clear();
        renderQuestion();
        toggleView('quiz');
        return 'quiz';
      })
      .catch(function (err) {
        // 无匹配题目：后端 404，语义上是"空"而不是"错误"
        if (err && err.status === 404) return setState('empty');
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '组卷失败' });
      });
  }

  function submit() {
    if (submitting) return global.Promise.resolve('busy');
    if (!session || !session.sessionId) return global.Promise.resolve('no-session');

    submitting = true;
    els.submitPaperBtn.disabled = true;

    const payload = {
      sessionId: session.sessionId,
      answers: session.questions
        .filter(function (q) {
          return answers.has(q.id);
        })
        .map(function (q) {
          return { questionId: q.id, answer: answers.get(q.id) };
        }),
    };

    return global.AIAPI.submitPractice(payload)
      .then(function (data) {
        submitting = false;
        els.submitPaperBtn.disabled = false;
        renderResult(data || {});
        return 'result';
      })
      .catch(function (err) {
        submitting = false;
        els.submitPaperBtn.disabled = false;
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '交卷失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.viewSetup = $('view-setup');
    els.viewQuiz = $('view-quiz');
    els.viewResult = $('view-result');
    els.subjectSelect = $('subject-select');
    els.countSelect = $('count-select');
    els.historyList = $('history-list');
    els.quizProgress = $('quiz-progress');
    els.quizMeta = $('quiz-meta');
    els.quizStem = $('quiz-stem');
    els.quizOptions = $('quiz-options');
    els.quizTextWrap = $('quiz-text-wrap');
    els.quizText = $('quiz-text');
    els.resultScore = $('result-score');
    els.resultMeta = $('result-meta');
    els.resultList = $('result-list');
    els.prevBtn = $('prev-btn');
    els.nextBtn = $('next-btn');
    els.submitPaperBtn = $('submit-paper-btn');
    els.answerHint = $('answer-hint');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');
    els.loadingTitle = $('loading-title');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('start-btn').addEventListener('click', function () {
      start();
    });
    $('prev-btn').addEventListener('click', function () {
      if (index > 0) {
        index -= 1;
        renderQuestion();
      }
    });
    $('next-btn').addEventListener('click', function () {
      if (session && index < session.questions.length - 1) {
        index += 1;
        renderQuestion();
      }
    });
    els.submitPaperBtn.addEventListener('click', function () {
      submit();
    });
    $('again-btn').addEventListener('click', function () {
      start();
    });
    $('empty-back-btn').addEventListener('click', function () {
      toggleView('setup');
    });
    $('retry-btn').addEventListener('click', function () {
      boot2();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      boot2();
    });
    // 主观题输入
    els.quizText.addEventListener('input', function () {
      if (!session) return;
      const q = session.questions[index];
      if (els.quizText.value) answers.set(q.id, els.quizText.value);
      else answers.delete(q.id);
      els.answerHint.textContent = `已作答 ${answers.size} / ${session.questions.length} 题`;
    });

    boot2();
  }

  global.PracticeHub = {
    STATES: STATES,
    start: start,
    submit: submit,
    setState: setState,
    normalizeOptions: normalizeOptions,
    getAnswersSize: function () {
      return answers.size;
    },
    getIndex: function () {
      return index;
    },
    getState: function () {
      return machine.get();
    },
    getSession: function () {
      return session;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
