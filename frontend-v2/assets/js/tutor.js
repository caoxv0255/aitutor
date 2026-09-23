/* global window, document */
/* ==========================================================================
 * AI 导师讲题（frontend-v2）
 *
 * 消费 /api/tutor/ask（非流式）与 /api/tutor/ask/stream（SSE）。
 *
 * 接地契约（F1/G4，字段由后端 api/routes/tutor-agent.js 产出）：
 *   grounded        boolean        — false 表示本次回答未依据题库内容
 *   citations       array          — 命中题号列表，无则 []
 *   groundingNotice string|null    — 未接地时的**后端原文说明**；已接地 → null
 *
 * 本页只做两件事，且都不得违背“不编造”：
 *   1) grounded===false 且有 groundingNotice → 在回答区上方显示说明横幅，文案**逐字**取后端原文；
 *   2) grounded===true 且 citations 非空 → 轻量展示出处题号（可选增强）。
 *   三个字段缺失（如后端尚未下发）→ 视为“未知”，什么都不显示，绝不伪造接地状态。
 *
 * 安全（永久闸门 check-no-ai-innerhtml.mjs）：回答文本、groundingNotice、题号均为
 * AI/后端产出，一律走 textContent / createTextNode，**不得**进 innerHTML。
 *
 * 状态机：empty / loading / success / error / auth / offline（复用 assets/js/ui.js）。
 * ========================================================================== */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const els = {};
  let machine = null;
  let controller = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  /* ── 接地横幅 + 出处 ───────────────────────────────────────────────────
   * 由后端字段驱动；文案/题号只经 textContent 写入（AI 输出禁入 innerHTML）。
   * ──────────────────────────────────────────────────────────────────── */
  function renderCitations(citations) {
    const list = Array.isArray(citations) ? citations : [];
    els.citations.textContent = '';
    if (!list.length) {
      els.citations.hidden = true;
      return;
    }
    const parts = list.map(function (c) {
      if (c && typeof c === 'object') {
        const sim = typeof c.similarity === 'number' ? '（相似度 ' + Math.round(c.similarity * 100) + '%）' : '';
        return '题号 ' + c.question_id + sim;
      }
      return '题号 ' + c;
    });
    els.citations.textContent = '出处：' + parts.join('、');
    els.citations.hidden = false;
  }

  /**
   * 应用接地三字段。可接受非流式响应体，也可接受流式 metadata 事件体。
   * @param {{grounded?: boolean, citations?: Array, groundingNotice?: string|null}} g
   */
  function applyGrounding(g) {
    g = g || {};
    const notice = g.groundingNotice;
    if (g.grounded === false && typeof notice === 'string' && notice) {
      els.notice.textContent = notice; // 后端原文，逐字展示，前端不改写
      els.notice.hidden = false;
    } else {
      els.notice.textContent = '';
      els.notice.hidden = true;
    }
    // 出处只在已接地时展示；未接地时 citations 依契约为空
    renderCitations(g.grounded === true ? g.citations : []);
  }

  function resetAnswer() {
    els.answer.textContent = '';
    els.notice.textContent = '';
    els.notice.hidden = true;
    els.citations.textContent = '';
    els.citations.hidden = true;
  }

  function appendAnswer(delta) {
    if (delta === undefined || delta === null) return;
    els.answer.textContent += String(delta);
  }

  /** 非流式：用完整响应体一次渲染 */
  function renderAnswer(data) {
    data = data || {};
    els.answer.textContent = String(data.response || '');
    applyGrounding(data);
    setState('success');
  }

  /**
   * 流式事件处理。metadata 事件携带接地三字段 → 一次性决定横幅（不在流过程中反复闪动）。
   * @param {{event: string, data: object}} ev
   */
  function onStreamEvent(ev) {
    if (!ev || !ev.event) return;
    if (ev.event === 'metadata') {
      applyGrounding(ev.data || {});
      setState('success');
    } else if (ev.event === 'content') {
      appendAnswer(ev.data && ev.data.delta);
    } else if (ev.event === 'error') {
      const msg = (ev.data && ev.data.message) || '导师暂时无法回答';
      // 已开始输出内容就保留（部分回答），否则如实切错误态
      if (!els.answer.textContent) setState('error', { message: msg });
    }
  }

  /* ── 状态渲染 ───────────────────────────────────────────────────────── */
  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent =
        ctx.reason === 'no-question'
          ? '先写下你的问题，再请教导师。'
          : '在上方写下你的问题，导师的回答会出现在这里。';
    }
    if (name === 'loading' && els.loadingTitle) {
      els.loadingTitle.textContent = ctx.title || '正在思考…';
    }
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (els.cancelBtn) els.cancelBtn.hidden = name !== 'loading';
    if (els.askBtn) els.askBtn.disabled = name === 'loading';
  }

  /* ── 主流程 ─────────────────────────────────────────────────────────── */
  function submit() {
    const question = els.input.value.trim();
    if (!question) return setState('empty', { reason: 'no-question' });
    if (global.navigator && global.navigator.onLine === false) return setState('offline');
    if (!global.AIAPI.getToken()) return setState('auth');

    resetAnswer();
    setState('loading');
    controller = new global.AbortController();

    const payload = { question: question, subject: els.subject.value };
    const canStream =
      typeof global.AIAPI.askTutorStream === 'function' && typeof global.TextDecoderStream === 'function';

    const request = canStream
      ? global.AIAPI.askTutorStream(payload, { onEvent: onStreamEvent, signal: controller.signal })
      : global.AIAPI.askTutor(payload, controller.signal).then(function (data) {
          renderAnswer(data);
        });

    return request
      .then(function () {
        controller = null;
      })
      .catch(function (err) {
        controller = null;
        if (err && err.name === 'AbortError') {
          // 中断：回到空态（已渲染的部分回答不保留，避免误导）
          return setState('empty', { reason: 'no-question' });
        }
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '导师暂时无法回答' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function init() {
    els.region = $('state-region');
    els.input = $('question-input');
    els.subject = $('subject-select');
    // 学科下拉统一到 9 科（单一数据源 subjects.js）；显式选中数学（顺序首位是语文）
    global.AISubjects.fillSelect(els.subject, { selected: 'math' });
    els.askBtn = $('ask-btn');
    els.cancelBtn = $('cancel-btn');
    els.emptyCopy = $('empty-copy');
    els.loadingTitle = $('loading-title');
    els.errorCopy = $('error-copy');
    els.answer = $('tutor-answer');
    els.notice = $('grounding-notice');
    els.citations = $('tutor-citations');

    $('tutor-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    $('retry-btn').addEventListener('click', function () {
      submit();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      submit();
    });
    els.cancelBtn.addEventListener('click', function () {
      if (controller) controller.abort();
    });

    setState('empty');
  }

  function boot() {
    els.region = $('state-region');
    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });
    init();
  }

  // 供 jsdom 验收驱动（浏览器里同样可调试）
  global.Tutor = {
    STATES: STATES,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    applyGrounding: applyGrounding,
    onStreamEvent: onStreamEvent,
    appendAnswer: appendAnswer,
    renderAnswer: renderAnswer,
    submit: submit,
    setQuestion: function (text) {
      els.input.value = text;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
