// api/core/questionBank.js — Gate B shared question-bank logic (QB-P0-AUDIT, 2026-09-03)
//
// 单一事实来源, 供三处共用:
//   - api/handlers/exam-questions.js   (createQuestion / batchCreateQuestions 写入修复)
//   - scripts/qb/qb-ingest.mjs          (canonical ingest)
//   - tests/api/qb-*.test.js            (vitest 纯函数单测)
//
// 规则来源:
//   - question_uid: D063 api/core/questionUid.js (禁手写拼接, Rule A)
//   - question_type: question_types 字典 18 code + 解析层遗留枚举 solve / multi_choice
//     (migration 008 注释: 后两者为 parser 层枚举, question_type 列是自由 varchar)
import { generateQuestionUid } from './questionUid.js';

// 字典 18 code (api/core/db.js 963 行) + solve / multi_choice
export const QUESTION_TYPE_SET = new Set([
  'choice', 'fill', 'true_false', 'short_answer', 'calculation', 'proof',
  'essay', 'reading', 'cloze', 'grammar_fill', 'correction', 'translation',
  'listening', 'seven_choose_five', 'continuation', 'experiment',
  'comprehensive', 'other', 'solve', 'multi_choice',
]);

// 中文/别名 → code (仅覆盖语料中出现的写法, 未知一律 other 并置 changed=true)
const TYPE_SYNONYMS = {
  选择题: 'choice', 单选: 'choice', choice: 'choice', single_choice: 'choice',
  多选: 'multi_choice', 多选题: 'multi_choice', multi_choice: 'multi_choice', multiple_choice: 'multi_choice',
  填空: 'fill', 填空题: 'fill', fill: 'fill', fill_blank: 'fill',
  解答: 'solve', 解答题: 'solve', solve: 'solve', 简答: 'short_answer',
  计算: 'calculation', 计算题: 'calculation',
  证明: 'proof', 证明题: 'proof',
  实验: 'experiment', 实验题: 'experiment',
  阅读: 'reading', 阅读理解: 'reading',
  完形: 'cloze', 完形填空: 'cloze',
  作文: 'essay', 作文题: 'essay', writing: 'essay',
  翻译: 'translation', 语法填空: 'grammar_fill', 七选五: 'seven_choose_five',
  读后续写: 'continuation', 短文改错: 'correction', 听力: 'listening', 听力题: 'listening',
  判断: 'true_false', 判断题: 'true_false', 综合: 'comprehensive', 其他: 'other',
};

/**
 * 归一化 question_type.
 * @param {*} raw
 * @returns {{type: string, changed: boolean}}
 */
export function normalizeQuestionType(raw) {
  if (raw == null) return { type: 'other', changed: true };
  const trimmed = String(raw).trim();
  if (QUESTION_TYPE_SET.has(trimmed)) return { type: trimmed, changed: false };
  const mapped = TYPE_SYNONYMS[trimmed];
  if (mapped && QUESTION_TYPE_SET.has(mapped)) return { type: mapped, changed: trimmed !== mapped };
  return { type: 'other', changed: true };
}

/**
 * 从 paper 行 + question_number 生成 canonical question_uid (D063 Rule A).
 * paper 需含 subject / year / province_code.
 * @param {{subject:string, year:number, province_code?:string|null}} paper
 * @param {number|string} questionNumber
 * @returns {string}
 */
export function buildQuestionUid(paper, questionNumber) {
  const uid = generateQuestionUid({
    subject: paper.subject,
    year: paper.year,
    provinceCode: paper.province_code || 'xx',
    questionNumber,
  });
  if (!uid) {
    throw new Error(`buildQuestionUid: cannot build uid for paper=${JSON.stringify(paper)} qn=${questionNumber}`);
  }
  return uid;
}

/**
 * options 数组 → DB TEXT (JSON 字符串). 非数组 → null.
 */
export function jsonCol(value) {
  return Array.isArray(value) ? JSON.stringify(value) : null;
}

/**
 * score → numeric(5,2) 或 null.
 */
export function parseScore(value) {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(String(value));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * difficulty → int 1..5 或 null (列 CHECK 1-5).
 */
export function parseDifficulty(value) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(1, Math.min(5, n));
}

export const QUESTION_TYPES_LEGACY_PARSE = ['solve', 'multi_choice'];
