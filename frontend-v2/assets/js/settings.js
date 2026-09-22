/* ==========================================================================
 * 设置页（批次 4 · 优先页 2）
 *
 * 玩法与其余新树页面一致：ui.js 六态机 + api.js 数据层 + app.css 组件，
 * 本文件只写"7 tab 设置"的差异部分。
 *
 * 依赖接口（均已存在）：
 *   GET  /api/auth/me          → 账号 tab（api/modules/auth/routes.js:18）
 *   GET  /api/user/profile     → { data:{ initialized, grade_code, province_code,
 *                                 exam_level, target_score, study_hours_per_day,
 *                                 weak_subjects[], preferences{} } }（handlers/user-profile.js）
 *   POST /api/user/profile     → 局部字段 COALESCE 更新（同上）
 *   GET  /api/user/provinces   → { data:[{code,name,exam_type,…}] }（handlers/user-provinces.js）
 *   POST /api/auth/logout      → 200（JWT 无状态，前端清 token）
 *
 * ⚠️ 端点方法没有加进 assets/js/api.js（该文件本批次被锁定），因此本页用
 *    AIAPI.request 直连 —— 仍走统一数据层（鉴权/解包/错误分类）。
 *
 * 已知缺口（不伪造数据糊 UI，只登记）：
 *   - 修改密码：api/handlers/reset-password.js 的 handler 存在但未挂载任何路由，
 *     legacy 路由已 410 → 密码 tab 只做缺口说明，不渲染假表单
 *   - 订阅/支付：后端无接口 → 订阅 tab 只做缺口说明
 *   - 通知/隐私开关按 PM §F.10 契约形状存入 profile.preferences；开关本身真实
 *     持久化，但推送行为的生效依赖后端通知系统（页面内有提示）
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const TABS = ['account', 'password', 'study', 'notifications', 'privacy', 'billing', 'about'];

  /** 与后端 VALID_GRADE_CODES 逐项对齐（api/handlers/user-initialize.js:4） */
  const GRADES = [
    { code: 'grade_7', name: '初一', level: 'zhongkao' },
    { code: 'grade_8', name: '初二', level: 'zhongkao' },
    { code: 'grade_9', name: '初三', level: 'zhongkao' },
    { code: 'grade_10', name: '高一', level: 'gaokao' },
    { code: 'grade_11', name: '高二', level: 'gaokao' },
    { code: 'grade_12', name: '高三', level: 'gaokao' },
  ];

  /** PM §F.10 通知/隐私开关的默认值与元素映射 */
  const NOTIF_TOGGLES = [
    { key: 'review', el: 'ntf-review', fallback: true },
    { key: 'weak', el: 'ntf-weak', fallback: true },
    { key: 'achievement', el: 'ntf-achievement', fallback: true },
    { key: 'weekly', el: 'ntf-weekly', fallback: false },
  ];
  const PRIVACY_TOGGLES = [
    { key: 'leaderboard', el: 'prv-leaderboard', fallback: true },
    { key: 'algo_opt', el: 'prv-algo-opt', fallback: true },
    { key: 'parent_view', el: 'prv-parent-view', fallback: false },
  ];

  const els = {};
  let machine = null;
  let tab = 'account';
  let provinces = [];
  let saving = false;
  let loggedIn = false;

  const data = {
    email: '',
    name: '',
    grade: '',
    gradeCode: '',
    provinceCode: '',
    examLevel: '',
    targetScore: null,
    studyHoursPerDay: 2,
    initialized: false,
    preferences: {},
  };

  function $(id) {
    return global.document.getElementById(id);
  }

  function gradeName(code) {
    for (let i = 0; i < GRADES.length; i += 1) {
      if (GRADES[i].code === code) return GRADES[i].name;
    }
    return '';
  }

  /** 省份列表按考试类型拉取；exam_level 缺失时从年级推导 */
  function levelForProvinces() {
    if (data.examLevel === 'gaokao' || data.examLevel === 'zhongkao') return data.examLevel;
    const g = gradeName(data.gradeCode);
    return g && g.indexOf('初') === 0 ? 'zhongkao' : 'gaokao';
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

  /* ── Tab ────────────────────────────────────────────────────────────── */
  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = 'account';
    tab = name;
    TABS.forEach(function (t) {
      const btn = $('tab-' + t);
      const panel = $('panel-' + t);
      if (btn) {
        btn.classList.toggle('tab--on', t === name);
        btn.setAttribute('aria-selected', t === name ? 'true' : 'false');
      }
      if (panel) panel.hidden = t !== name;
    });
  }

  function getTab() {
    return tab;
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────── */
  function renderAccount() {
    els.meEmail.textContent = data.email || '—';
    els.meName.textContent = data.name || '—';
    els.meGrade.textContent = gradeName(data.gradeCode) || data.grade || '—';
  }

  function fillGrades() {
    const select = els.gradeSelect;
    select.innerHTML = '';
    GRADES.forEach(function (g) {
      const opt = global.document.createElement('option');
      opt.value = g.code;
      opt.textContent = g.name;
      if (g.code === data.gradeCode) opt.selected = true;
      select.appendChild(opt);
    });
    if (!data.gradeCode && select.options.length) select.value = select.options[0].value;
  }

  function fillProvinces() {
    const select = els.provinceSelect;
    select.innerHTML = '';
    provinces.forEach(function (p) {
      const opt = global.document.createElement('option');
      opt.value = p.code;
      opt.textContent = p.name;
      if (p.code === data.provinceCode) opt.selected = true;
      select.appendChild(opt);
    });
    if (data.provinceCode && !select.value) {
      // 档案里的省份不在当前考试类型的列表里（如中考档案）→ 兜底置一个占位项
      const opt = global.document.createElement('option');
      opt.value = data.provinceCode;
      opt.textContent = data.provinceCode;
      opt.selected = true;
      select.insertBefore(opt, select.firstChild);
    }
    els.provinceHint.textContent = provinces.length
      ? '省份决定考试类型与选科模式。'
      : '省份列表没能取到，保存前请重试。';
  }

  function renderToggles() {
    const prefs = data.preferences || {};
    const notif = prefs.notifications || {};
    const privacy = prefs.privacy || {};
    NOTIF_TOGGLES.forEach(function (t) {
      const node = $(t.el);
      if (node) node.checked = typeof notif[t.key] === 'boolean' ? notif[t.key] : t.fallback;
    });
    PRIVACY_TOGGLES.forEach(function (t) {
      const node = $(t.el);
      if (node) node.checked = typeof privacy[t.key] === 'boolean' ? privacy[t.key] : t.fallback;
    });
  }

  function flashSaved(node) {
    node.hidden = false;
    global.setTimeout(function () {
      node.hidden = true;
    }, 2500);
  }

  function setInlineError(node, message) {
    if (!message) {
      node.hidden = true;
      node.textContent = '';
      return;
    }
    node.textContent = message;
    node.hidden = false;
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const me = global.AIAPI.request('/api/auth/me').catch(function () {
      // 账号信息拉取失败不拖垮整页（对齐 dashboard 的做法）
      return null;
    });
    const profile = global.AIAPI.request('/api/user/profile');
    const provincesReq = global.AIAPI.request(
      '/api/user/provinces?exam_level=' + encodeURIComponent(levelForProvinces())
    );

    return global.Promise.all([
      me,
      profile,
      provincesReq.catch(function () {
        return null;
      }),
    ])
      .then(function (all) {
        const mePayload = all[0];
        const profilePayload = all[1];
        const provincePayload = all[2];

        const profileData = (profilePayload && profilePayload.data) || {};
        if (!profileData.initialized) {
          return setState('empty');
        }

        data.email = (mePayload && mePayload.data && mePayload.data.email) || '';
        data.name = (mePayload && mePayload.data && mePayload.data.name) || '';
        data.grade = (mePayload && mePayload.data && mePayload.data.grade) || '';
        data.gradeCode = profileData.grade_code || '';
        data.provinceCode = profileData.province_code || '';
        data.examLevel = profileData.exam_level || '';
        data.targetScore = profileData.target_score;
        data.studyHoursPerDay = profileData.study_hours_per_day;
        data.initialized = true;
        data.preferences = profileData.preferences || {};
        loggedIn = true;

        const rows = (provincePayload && provincePayload.data) || [];
        provinces = rows;

        renderAccount();
        fillGrades();
        fillProvinces();
        els.targetScore.value =
          data.targetScore === null || data.targetScore === undefined ? '' : String(data.targetScore);
        els.studyHours.value =
          data.studyHoursPerDay === null || data.studyHoursPerDay === undefined ? '' : String(data.studyHoursPerDay);
        renderToggles();
        showTab(tab);
        return setState('success');
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '读取设置失败' });
      });
  }

  /* ── 保存：学习档案 ─────────────────────────────────────────────────── */
  function saveStudy() {
    if (!saving) {
      saving = true;
      setInlineError(els.studyError, '');
      els.studySaveBtn.disabled = true;
      const gradeCode = els.gradeSelect.value;
      const body = {
        grade_code: gradeCode,
        province_code: els.provinceSelect.value,
        target_score: els.targetScore.value === '' ? null : Number(els.targetScore.value),
        study_hours_per_day: els.studyHours.value === '' ? null : Number(els.studyHours.value),
        initialized: true,
      };
      if (body.target_score !== null && !isFinite(body.target_score)) body.target_score = null;
      if (body.study_hours_per_day !== null && !isFinite(body.study_hours_per_day)) {
        body.study_hours_per_day = null;
      }
      return global.AIAPI.request('/api/user/profile', { method: 'POST', body: body })
        .then(function () {
          data.gradeCode = body.grade_code;
          data.provinceCode = body.province_code;
          data.targetScore = body.target_score;
          data.studyHoursPerDay = body.study_hours_per_day;
          flashSaved(els.studySaved);
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
          setInlineError(els.studyError, (err && err.message) || '保存失败，请稍后再试。');
          return 'error';
        })
        .then(function (outcome) {
          saving = false;
          els.studySaveBtn.disabled = false;
          return outcome;
        });
    }
    return global.Promise.resolve('busy');
  }

  /* ── 保存：通知 / 隐私偏好（写入 profile.preferences） ───────────────── */
  function savePrefs(kind) {
    const errNode = kind === 'notifications' ? els.notifError : els.privacyError;
    const savedNode = kind === 'notifications' ? els.notifSaved : els.privacySaved;
    const btnNode = kind === 'notifications' ? els.notifSaveBtn : els.privacySaveBtn;
    if (saving) return global.Promise.resolve('busy');
    saving = true;
    setInlineError(errNode, '');
    btnNode.disabled = true;

    const prefs = data.preferences || {};
    if (kind === 'notifications') {
      const next = {};
      NOTIF_TOGGLES.forEach(function (t) {
        const node = $(t.el);
        next[t.key] = node ? !!node.checked : t.fallback;
      });
      prefs.notifications = next;
    } else {
      const next = {};
      PRIVACY_TOGGLES.forEach(function (t) {
        const node = $(t.el);
        next[t.key] = node ? !!node.checked : t.fallback;
      });
      prefs.privacy = next;
    }

    return global.AIAPI.request('/api/user/profile', { method: 'POST', body: { preferences: prefs } })
      .then(function () {
        data.preferences = prefs;
        flashSaved(savedNode);
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
        setInlineError(errNode, (err && err.message) || '保存失败，请稍后再试。');
        return 'error';
      })
      .then(function (outcome) {
        saving = false;
        btnNode.disabled = false;
        return outcome;
      });
  }

  /* ── 退出登录 ───────────────────────────────────────────────────────── */
  function logout() {
    setInlineError(els.logoutError, '');
    return global.AIAPI.request('/api/auth/logout', { method: 'POST' })
      .catch(function () {
        // JWT 无状态，端点保证 200；失败也继续清本地
        return null;
      })
      .then(function () {
        global.localStorage.removeItem('authToken');
        loggedIn = false;
        if (global.location) global.location.href = '/login.html';
        return 'done';
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.meEmail = $('me-email');
    els.meName = $('me-name');
    els.meGrade = $('me-grade');
    els.gradeSelect = $('grade-select');
    els.provinceSelect = $('province-select');
    els.provinceHint = $('province-hint');
    els.targetScore = $('target-score');
    els.studyHours = $('study-hours');
    els.studyError = $('study-error');
    els.studySaved = $('study-saved');
    els.studySaveBtn = $('study-save-btn');
    els.notifError = $('notif-error');
    els.notifSaved = $('notif-saved');
    els.notifSaveBtn = $('notif-save-btn');
    els.privacyError = $('privacy-error');
    els.privacySaved = $('privacy-saved');
    els.privacySaveBtn = $('privacy-save-btn');
    els.logoutError = $('logout-error');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    TABS.forEach(function (t) {
      const btn = $('tab-' + t);
      if (btn) {
        btn.addEventListener('click', function () {
          showTab(t);
        });
      }
    });

    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });
    els.studySaveBtn.addEventListener('click', function () {
      saveStudy();
    });
    els.notifSaveBtn.addEventListener('click', function () {
      savePrefs('notifications');
    });
    els.privacySaveBtn.addEventListener('click', function () {
      savePrefs('privacy');
    });
    $('logout-btn').addEventListener('click', function () {
      logout();
    });

    setState('empty');
    load();
  }

  global.Settings = {
    STATES: STATES,
    TABS: TABS,
    GRADES: GRADES,
    load: load,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    showTab: showTab,
    getTab: getTab,
    saveStudy: saveStudy,
    savePrefs: savePrefs,
    logout: logout,
    data: data,
    _loggedIn: function () {
      return loggedIn;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
