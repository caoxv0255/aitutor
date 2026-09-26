/* ==========================================================================
 * 学科单一数据源（frontend-v2）
 *
 * 权威清单：PM-BRIEF §B.2「9 学科色（顺序: 语文橙 / 数学红 / 英语紫 / 物理蓝 /
 * 化学绿 / 生物青 / 历史琥珀 / 地理青柠 / 政治粉）」+ §F.8「9 科 = 语数英 +
 * 物化生 + 史地政」。顺序即 PM-BRIEF 给的顺序，不要按代码习惯重排。
 *
 * code（value/key）PM-BRIEF **没有定义**（§F.2 只写了 `subject_code: 'chinese'|
 * 'math'|...` 就省略了），这里取后端事实标准：
 *   api/core/db.js:885 subjects(code,name,category,sort_order) 的种子数据，
 *   以及 api/modules/knowledge/routes.js:388 的 9 学科定义、api/handlers/
 *   learning-path.js:39 的 VALID_SUBJECTS。三者是同一套 9 个 code。
 *
 * 用法：页面不要在 HTML 里再写一遍 <option>，boot 时调 AISubjects.fillSelect()。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const LIST = [
    { code: 'chinese', name: '语文' },
    { code: 'math', name: '数学' },
    { code: 'english', name: '英语' },
    { code: 'physics', name: '物理' },
    { code: 'chemistry', name: '化学' },
    { code: 'biology', name: '生物' },
    { code: 'history', name: '历史' },
    { code: 'geography', name: '地理' },
    { code: 'politics', name: '政治' },
  ];

  const NAMES = {};
  LIST.forEach(function (s) {
    NAMES[s.code] = s.name;
  });

  /* ── 拍照解题专用学科清单（与全站 9 科 LIST 分开）─────────────────────
   * 拍照解题的下拉是「原 9 科 + 语文/英语各拆两档（除作文 / 作文）」，共 11 项：
   *   - essay:true  → 走作文批改链路 POST /api/essay/analyze，需**两张图**
   *                   （作文题目 title_image + 我写的作文内容 image）
   *   - essay:false → 走既有单图解析链路 POST /api/vision/batch-parse，学科码
   *                   即 code 本身（chinese/math/english/... 均为后端合法 subject）
   *   - backendSubject 是提交给作文接口的真实学科码（analyze 只认 chinese|english，
   *     作文与否靠前端拆成两张图表达，故 *_essay 需映射回 chinese/english）；
   *     非作文项 backendSubject 与 code 相同，仅为形状统一（submitSolve 实际直接用 value）
   * 顺序即产品给定顺序，不要按代码习惯重排。
   * 不改 LIST：其余页面仍消费 9 科语义（fillSelect 保持原样）。
   * ──────────────────────────────────────────────────────────────────────── */
  const PHOTO_SOLVE_LIST = [
    { code: 'chinese', name: '语文（除作文）', essay: false, backendSubject: 'chinese' },
    { code: 'chinese_essay', name: '语文作文', essay: true, backendSubject: 'chinese' },
    { code: 'math', name: '数学', essay: false, backendSubject: 'math' },
    { code: 'english', name: '英语（除作文）', essay: false, backendSubject: 'english' },
    { code: 'english_essay', name: '英语作文', essay: true, backendSubject: 'english' },
    { code: 'physics', name: '物理', essay: false, backendSubject: 'physics' },
    { code: 'chemistry', name: '化学', essay: false, backendSubject: 'chemistry' },
    { code: 'biology', name: '生物', essay: false, backendSubject: 'biology' },
    { code: 'history', name: '历史', essay: false, backendSubject: 'history' },
    { code: 'geography', name: '地理', essay: false, backendSubject: 'geography' },
    { code: 'politics', name: '政治', essay: false, backendSubject: 'politics' },
  ];

  /** 拍照解题学科码 → 清单项；未知 code 返回 null（调用方自行兜底） */
  function photoSolve(code) {
    for (let i = 0; i < PHOTO_SOLVE_LIST.length; i++) {
      if (PHOTO_SOLVE_LIST[i].code === code) return PHOTO_SOLVE_LIST[i];
    }
    return null;
  }

  /** code → 中文名；未知 code 原样返回，由调用方决定兜底文案 */
  function name(code) {
    return NAMES[code] || code || '';
  }

  /**
   * 用 9 学科填充 <select>，覆盖原有 option。
   * @param {HTMLSelectElement} select
   * @param {{includeAll?: boolean, selected?: string}} options
   *        includeAll 前置一个 value="" 的「全部」（筛选页用）
   *        selected   指定默认选中项（无「全部」且要保留原默认时用）
   */
  function fillSelect(select, options) {
    if (!select) return select;
    options = options || {};

    select.textContent = '';

    if (options.includeAll) {
      const all = global.document.createElement('option');
      all.value = '';
      all.textContent = '全部';
      select.appendChild(all);
    }

    LIST.forEach(function (s) {
      const opt = global.document.createElement('option');
      opt.value = s.code;
      opt.textContent = s.name;
      if (options.selected === s.code) opt.selected = true;
      select.appendChild(opt);
    });

    return select;
  }

  /**
   * 用拍照解题 11 项清单填充 <select>（覆盖原有 option）。
   * @param {HTMLSelectElement} select
   * @param {{selected?: string}} [options] 默认选中项（推荐 'math'）
   */
  function fillPhotoSolveSelect(select, options) {
    if (!select) return select;
    options = options || {};

    select.textContent = '';

    PHOTO_SOLVE_LIST.forEach(function (s) {
      const opt = global.document.createElement('option');
      opt.value = s.code;
      opt.textContent = s.name;
      if (options.selected === s.code) opt.selected = true;
      select.appendChild(opt);
    });

    return select;
  }

  global.AISubjects = {
    LIST: LIST,
    NAMES: NAMES,
    PHOTO_SOLVE_LIST: PHOTO_SOLVE_LIST,
    name: name,
    fillSelect: fillSelect,
    fillPhotoSolveSelect: fillPhotoSolveSelect,
    photoSolve: photoSolve,
  };
})(window);
