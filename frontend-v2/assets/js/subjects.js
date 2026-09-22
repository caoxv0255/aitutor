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

    select.innerHTML = '';

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

  global.AISubjects = {
    LIST: LIST,
    NAMES: NAMES,
    name: name,
    fillSelect: fillSelect,
  };
})(window);
