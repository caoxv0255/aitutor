/* ==========================================================================
 * 初始化引导（批次 4 · 第 1 页）
 *
 * 玩法与其余新树页面一致：ui.js 六态机 + api.js 数据层 + app.css 组件，
 * 本文件只写"5 步向导"的差异部分。
 *
 * 依赖接口（均已存在，见 api/modules/user/routes.js）：
 *   GET  /api/user/provinces   → { data:[{code,name,exam_type,…}], total }
 *   POST /api/user/initialize  → 入参 { grade_code, province_code, subjects:[{code,is_main}] }
 *
 * ⚠️ 端点方法没有加进 assets/js/api.js（该文件本批次被锁定），因此本页用
 *    AIAPI.request 直连 —— 仍然走统一数据层（鉴权/解包/错误分类），只是不新增
 *    共享方法。解禁后在 api.js 补 initialize/provinces 两个方法即可收敛。
 *
 * 已知缺口（不伪造数据糊 UI，只登记）：
 *   - 年级只有初中/高中六个 code（api/handlers/user-initialize.js:4 VALID_GRADE_CODES），
 *     PM §F.12 的"小学"学段没有后端代码 → 本页不提供小学选项
 *   - 省份只带 exam_type=gaokao/zhongkao，不带 3+3 / 3+1+2 → 选科模式按 PM §F.8 的
 *     省份名单在前端判定（后端补字段后可改为直接读）
 *   - 头像上传接口不存在 → 头像只显示昵称首字，不做上传控件
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  /** 与后端 VALID_GRADE_CODES 逐项对齐（api/handlers/user-initialize.js:4） */
  const GRADES = [
    { code: 'grade_7', name: '初一', level: 'zhongkao' },
    { code: 'grade_8', name: '初二', level: 'zhongkao' },
    { code: 'grade_9', name: '初三', level: 'zhongkao' },
    { code: 'grade_10', name: '高一', level: 'gaokao' },
    { code: 'grade_11', name: '高二', level: 'gaokao' },
    { code: 'grade_12', name: '高三', level: 'gaokao' },
  ];

  /** PM §F.8：3+3 六省市（浙江 7 选 3 含"技术"，后端 9 学科无此 code，按 3 选科处理） */
  const PROVINCES_3_3 = ['北京', '天津', '上海', '浙江', '山东', '海南'];

  const CORE = ['chinese', 'math', 'english'];
  const DEFAULT_ELECTIVE = ['physics', 'chemistry', 'biology'];

  const STEPS = [
    { label: '昵称', title: '怎么称呼你？' },
    { label: '年级', title: '你在哪个年级？' },
    { label: '省份', title: '你在哪个省份考试？' },
    { label: '选科', title: '你选了哪几科？' },
    { label: '首题', title: '拍下第一道错题' },
  ];

  const els = {};
  let machine = null;
  let step = 1;
  let provinces = [];
  let submitting = false;

  const data = {
    nickname: '',
    gradeCode: 'grade_10',
    level: 'gaokao',
    provinceCode: '',
    provinceName: '',
    subjects: new Set(CORE.concat(DEFAULT_ELECTIVE)),
  };

  function $(id) {
    return global.document.getElementById(id);
  }

  /* ── 数据层（走 AIAPI.request，不改共享 api.js） ───────────────────── */
  function fetchProvinces(level) {
    return global.AIAPI.request('/api/user/provinces?exam_level=' + encodeURIComponent(level));
  }

  function submitInitialize() {
    return global.AIAPI.request('/api/user/initialize', {
      method: 'POST',
      body: {
        grade_code: data.gradeCode,
        province_code: data.provinceCode,
        subjects: Array.from(data.subjects).map(function (code) {
          return { code: code, is_main: CORE.indexOf(code) >= 0 };
        }),
      },
    });
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
        ctx.reason === 'filtered' ? '该考试类型下没有可选的省份，换个年级试试。' : '没能取到省份列表，稍后再来一次。';
    }
  }

  /* ── 步骤条 ─────────────────────────────────────────────────────────── */
  function renderStepBar() {
    els.stepBar.innerHTML = '';
    STEPS.forEach(function (s, i) {
      const n = i + 1;
      const cell = global.AIUI.el('div', 'loop__step');
      if (n === step) cell.classList.add('step--on');
      else if (n < step) cell.classList.add('step--done');
      if (n === step) cell.setAttribute('aria-current', 'step');
      cell.appendChild(global.AIUI.el('div', 'loop__num', String(n)));
      cell.appendChild(global.AIUI.el('div', 'loop__lbl', s.label));
      els.stepBar.appendChild(cell);
    });
  }

  function showStep(n) {
    step = n;
    STEPS.forEach(function (s, i) {
      const panel = $('panel-' + (i + 1));
      if (panel) panel.hidden = i + 1 !== n;
    });
    els.stepEyebrow.textContent = 'STEP ' + n + ' / ' + STEPS.length;
    els.stepTitle.textContent = STEPS[n - 1].title;
    els.prevBtn.hidden = n === 1;
    els.nextBtn.hidden = n === STEPS.length;
    els.finishBtn.hidden = n !== STEPS.length;
    renderStepBar();
  }

  function setStepError(message) {
    if (!message) {
      els.stepError.hidden = true;
      els.stepError.textContent = '';
      return;
    }
    els.stepError.textContent = message;
    els.stepError.hidden = false;
  }

  /* ── 步骤 2：年级 ───────────────────────────────────────────────────── */
  function renderGrades() {
    els.gradeGrid.innerHTML = '';
    GRADES.forEach(function (g) {
      const btn = global.AIUI.el('button', 'pick-card', g.name);
      btn.type = 'button';
      btn.dataset.grade = g.code;
      if (g.code === data.gradeCode) {
        btn.classList.add('pick-card--on');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
      btn.addEventListener('click', function () {
        data.gradeCode = g.code;
        if (data.level !== g.level) {
          data.level = g.level;
          data.provinceCode = '';
          data.provinceName = '';
          applyDefaultSubjects();
          renderSubjects();
          reloadProvinces();
        } else {
          renderGrades();
        }
        els.gradeHint.textContent =
          g.level === 'zhongkao' ? '已判定为中考区：9 科全开。' : '已判定为高考区：语数外 + 3 门选考。';
      });
      els.gradeGrid.appendChild(btn);
    });
  }

  /* ── 步骤 3：省份 ───────────────────────────────────────────────────── */
  function renderProvinces() {
    const select = els.province;
    select.innerHTML = '';
    provinces.forEach(function (p) {
      const opt = global.document.createElement('option');
      opt.value = p.code;
      opt.textContent = p.name;
      if (p.code === data.provinceCode) opt.selected = true;
      select.appendChild(opt);
    });
    if (!data.provinceCode && provinces.length) {
      data.provinceCode = provinces[0].code;
      data.provinceName = provinces[0].name;
      select.value = provinces[0].code;
    }
    renderStrategy();
  }

  /** 选科模式：中考区 9 科全开；高考区按 PM §F.8 名单判 3+3 / 3+1+2 */
  function strategy() {
    if (data.level === 'zhongkao') return '9 科全开';
    return PROVINCES_3_3.indexOf(data.provinceName) >= 0 ? '3+3' : '3+1+2';
  }

  function renderStrategy() {
    const s = strategy();
    if (s === '9 科全开') {
      els.strategyHint.textContent = '中考区：9 科全开（语数英 + 物化生 + 史地政）。';
    } else if (s === '3+3') {
      els.strategyHint.textContent = data.provinceName + '：3+3 模式 · 语数外 + 3 门选考。';
    } else {
      els.strategyHint.textContent = (data.provinceName || '该地区') + '：3+1+2 模式 · 语数外 + 1 首选 + 2 再选。';
    }
  }

  /* ── 步骤 4：选科 ───────────────────────────────────────────────────── */
  function maxSubjects() {
    return data.level === 'zhongkao' ? 9 : 6;
  }

  function applyDefaultSubjects() {
    if (data.level === 'zhongkao') {
      data.subjects = new Set(
        global.AISubjects.LIST.map(function (s) {
          return s.code;
        })
      );
    } else {
      data.subjects = new Set(CORE.concat(DEFAULT_ELECTIVE));
    }
  }

  function renderSubjects() {
    els.subjectGrid.innerHTML = '';
    global.AISubjects.LIST.forEach(function (s) {
      const locked = CORE.indexOf(s.code) >= 0;
      const on = data.subjects.has(s.code);
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
        if (data.subjects.has(s.code)) {
          data.subjects.delete(s.code);
        } else if (data.subjects.size >= maxSubjects()) {
          setStepError(
            (data.level === 'zhongkao' ? '中考最多 9 科' : '高考只能选 6 科') + '，请先取消一门再选（PM §F.3 E8）'
          );
          return;
        } else {
          data.subjects.add(s.code);
        }
        setStepError('');
        renderSubjects();
      });
      els.subjectGrid.appendChild(btn);
    });
    els.subjectCount.textContent = String(data.subjects.size);
    els.subjectLimit.textContent = data.level === 'zhongkao' ? '（中考 9 科全开）' : '（高考最多 6 科）';
    els.subjectSub.textContent =
      data.level === 'zhongkao' ? '中考区 9 科全开，可按需取消。' : '语数外是主科，其余按你的选考组合挑。';
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function reloadProvinces() {
    return fetchProvinces(data.level)
      .then(function (payload) {
        const rows = (payload && payload.data) || [];
        provinces = rows;
        if (!rows.length) return setState('empty', { reason: 'filtered' });
        renderProvinces();
        return setState('success');
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取省份列表失败' });
      });
  }

  function load() {
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');
    return reloadProvinces();
  }

  /* ── 提交 ───────────────────────────────────────────────────────────── */
  function finish() {
    if (submitting) return global.Promise.resolve('busy');
    if (!data.gradeCode) return global.Promise.resolve(setStepError('请选择年级'));
    if (!data.provinceCode) return global.Promise.resolve(setStepError('请选择省份'));
    if (!data.subjects.size) return global.Promise.resolve(setStepError('请至少选择一门学科'));

    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));

    submitting = true;
    els.finishBtn.disabled = true;
    els.finishBtn.textContent = '提交中…';

    return submitInitialize()
      .then(function () {
        submitting = false;
        els.wizard.hidden = true;
        els.doneBlock.hidden = false;
        return 'success';
      })
      .catch(function (err) {
        submitting = false;
        els.finishBtn.disabled = false;
        els.finishBtn.textContent = '完成初始化';
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        setStepError((err && err.message) || '初始化失败');
        return 'error';
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.stepBar = $('step-bar');
    els.stepEyebrow = $('step-eyebrow');
    els.stepTitle = $('step-title');
    els.wizard = $('wizard');
    els.doneBlock = $('done-block');
    els.gradeGrid = $('grade-grid');
    els.gradeHint = $('grade-hint');
    els.province = $('province');
    els.strategyHint = $('strategy-hint');
    els.subjectGrid = $('subject-grid');
    els.subjectCount = $('subject-count');
    els.subjectLimit = $('subject-limit');
    els.subjectSub = $('subject-sub');
    els.stepError = $('step-error');
    els.prevBtn = $('prev-btn');
    els.nextBtn = $('next-btn');
    els.finishBtn = $('finish-btn');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    renderGrades();
    renderSubjects();
    showStep(1);

    $('nickname').addEventListener('input', function (e) {
      data.nickname = (e.target.value || '').trim();
      $('avatar-initial').textContent = data.nickname ? data.nickname.slice(0, 1) : '小';
    });

    els.province.addEventListener('change', function () {
      const hit = provinces.filter(function (p) {
        return p.code === els.province.value;
      })[0];
      data.provinceCode = els.province.value;
      data.provinceName = hit ? hit.name : '';
      renderStrategy();
    });

    els.prevBtn.addEventListener('click', function () {
      if (step > 1) showStep(step - 1);
    });
    els.nextBtn.addEventListener('click', function () {
      setStepError('');
      if (step < STEPS.length) showStep(step + 1);
    });
    els.finishBtn.addEventListener('click', function () {
      finish();
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

  global.Onboarding = {
    STATES: STATES,
    STEPS: STEPS,
    GRADES: GRADES,
    load: load,
    finish: finish,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    getStep: function () {
      return step;
    },
    showStep: showStep,
    strategy: strategy,
    data: data,
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
