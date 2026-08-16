// api/core/questionUid.js — question_uid 生成的唯一来源 (Phase 3, 2026-08-15)
//
// 背景: 之前 UID 规则散落三处且不一致 —
//   - scripts/parse-questions-v4.js  generateQuestionUID (Rule A)
//   - database/migrations/008_*.sql    SQL 内联 Rule A
//   - scripts/backfill-question-uid.js 自定义 Rule B (subject_year_paperId_qn 优先)
//   同一题在不同路径会得到不同 uid → 数据分裂灾难.
//
// 规范 (Rule A, 与 parse 管线 + migration 008 对齐):
//   primary:   {subject}_{year}_{provinceCode|xx}_{questionNumber}
//   fallback1: q_{paperId}_{questionNumber}
//   fallback2: legacy_{id}
//
// 新代码一律 import 本模块, 禁止再手写拼接.
// migration 008 的 SQL 保持 Rule A 不变 (SQL 无法 import JS, 但规则由本文件权威定义).

/**
 * 生成 question_uid (单一规则, 幂等).
 * @param {object} p
 * @param {string} [p.subject]        — subject_code (math/chinese/...)
 * @param {number|string} [p.year]
 * @param {string} [p.provinceCode]   — 缺省 'xx'
 * @param {number|string} [p.questionNumber]
 * @param {number|string} [p.paperId] — fallback 用
 * @param {number|string} [p.id]      — 最终兜底
 * @returns {string|null}
 */
export function generateQuestionUid({ subject, year, provinceCode, questionNumber, paperId, id } = {}) {
  if (subject && year != null && questionNumber != null) {
    return `${subject}_${year}_${provinceCode || 'xx'}_${questionNumber}`;
  }
  if (paperId != null && questionNumber != null) {
    return `q_${paperId}_${questionNumber}`;
  }
  if (id != null) {
    return `legacy_${id}`;
  }
  return null;
}
