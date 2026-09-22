/* ==========================================================================
 * 选科策略（批次 4 · 第 4 页）
 *
 * 玩法与其余新树页面一致：ui.js 六态机 + api.js 数据层 + app.css 组件，
 * 本文件只写"查看/调整选科"的差异部分。
 *
 * 依赖接口（均已存在，见 api/modules/user/routes.js:21-23）：
 *   GET  /api/user/subjects → { data:[{subject_code, is_main, subject_name,…}] }
 *   POST /api/user/subjects → body { subjects:[{code,is_main}] }
 *                             400: 至少 1 门 / 最多 10 门 / 无效学科代码
 *   GET  /api/user/profile  → { data:{ exam_level } }（决定最多可选科数）
 *
 * ⚠️ 端点方法没有加进 assets/js/api.js（该文件本批次被锁定），因此本页用
 *    AIAPI.request 直连 —— 仍走统一数据层（鉴权/解包/错误分类）。
 *
 * 学科清单来自共享数据源 global.AISubjects（9 科，顺序即 PM §B.2）。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const CORE = ['chinese', 'math', 'english'];

  const els = {};
  let machine = null;
  let selected = new Set(CORE);
  let maxSubjects = 6; // 高考默认 6；中考区放宽到 9
  let saving = false;

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

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderSubjects() {
    els.subjectGrid.innerHTML = '';
    global.AISubjects.LIST.forEach(function (s) {
      const locked = CORE.indexOf(s.code) >= 0;
      const on = selected.has(s.code);
      const btn = global.AIUI.el('button', 'pick-card', s.name);
      btn.type = 'button';
      btn.dataset.subject = s.code;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) btn.classList.add('pick-card--on');
      if (locked) {
        btn.classList.add('pick-card--locked');
        btn.title = '主科必选';
      }
      btn.addEventListener('click', function () {
        if (locked) return;
        if (selected.has(s.code)) {
          selected.delete(s.code);
        } else if (selected.size >= maxSubjects) {
          setInlineError((maxSubjects === 9 ? '中考最多 9 科' : '高考只能选 6 科') + '，请先取消一门再选。');
          return;
        } else {
          selected.add(s.code);
        }
        setInlineError('');
        renderSubjects();
      });
      els.subjectGrid.appendChild(btn);
    });
    els.subjectCount.textContent = String(selected.size);
    els.subjectLimit.textContent = maxSubjects === 9 ? '（中考 9 科全开）' : '（高考最多 6 科）';
  }

  function setInlineError(message) {
    if (!message) {
      els.pickerError.hidden = true;
      els.pickerError.textContent = '';
      return;
    }
    els.pickerError.textContent = message;
    els.pickerError.hidden = false;
  }

  function flashSaved() {
    els.pickerSaved.hidden = false;
    global.setTimeout(function () {
      els.pickerSaved.hidden = true;
    }, 2500);
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const subjects = global.AIAPI.request('/api/user/subjects');
    // 档案只用来判考试类型（决定选科上限），失败按高考兜底，不拖垮整页
    const profile = global.AIAPI.request('/api/user/profile').catch(function () {
      return null;
    });

    return global.Promise.all([subjects, profile])
      .then(function (all) {
        const rows = (all[0] && all[0].data) || [];
        const profileData = (all[1] && all[1].data) || {};

        maxSubjects = profileData.exam_level === 'zhongkao' ? 9 : 6;

        if (!rows.length) {
          // 首次使用：不伪造"已有选科"，落到空态，由用户点"用默认组合开始"
          selected = new Set(CORE.concat(['physics', 'chemistry', 'biology']));
          renderSubjects();
          setState('empty');
          return 'empty';
        }

        selected = new Set(
          rows.map(function (r) {
            return r.subject_code;
          })
        );
        renderSubjects();
        setState('success');
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取用户选科失败' });
      });
  }

  /* ── 保存 ───────────────────────────────────────────────────────────── */
  function save() {
    if (saving) return global.Promise.resolve('busy');
    saving = true;
    setInlineError('');
    els.saveBtn.disabled = true;

    const body = {
      subjects: global.AISubjects.LIST.filter(function (s) {
        return selected.has(s.code);
      }).map(function (s) {
        return { code: s.code, is_main: CORE.indexOf(s.code) >= 0 };
      }),
    };

    return global.AIAPI.request('/api/user/subjects', { method: 'POST', body: body })
      .then(function () {
        flashSaved();
        return 'saved';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped === 'auth') {
          setState('auth');
          return 'auth';
        }
        if (mapped === 'offline') {
          setState('offline');
          return 'offline';
        }
        setInlineError((err && err.message) || '保存失败，请稍后再试。');
        return 'error';
      })
      .then(function (outcome) {
        saving = false;
        els.saveBtn.disabled = false;
        return outcome;
      });
  }

  /* ── 空态出口 ───────────────────────────────────────────────────────── */
  function startWithDefaults() {
    selected = new Set(CORE.concat(['physics', 'chemistry', 'biology']));
    renderSubjects();
    setState('success');
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.subjectGrid = $('subject-grid');
    els.subjectCount = $('subject-count');
    els.subjectLimit = $('subject-limit');
    els.pickerError = $('picker-error');
    els.pickerSaved = $('picker-saved');
    els.saveBtn = $('save-btn');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    els.saveBtn.addEventListener('click', function () {
      save();
    });
    $('empty-start-btn').addEventListener('click', function () {
      startWithDefaults();
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

  global.SubjectPicker = {
    STATES: STATES,
    CORE: CORE,
    load: load,
    save: save,
    startWithDefaults: startWithDefaults,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    data: {
      get selected() {
        return selected;
      },
      get maxSubjects() {
        return maxSubjects;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
