/**
 * question_type 双向归一化 (2026-09-24)。
 *
 * 背景: `exam_questions.question_type` 实际存的是 DB 代码 (实测全表分布:
 *   choice 25299 / unknown 14435 / solve 6952 / fill 2820, 共 49506),
 *   而 `paperGenerator` 的权重表 (QUESTION_TYPE_WEIGHTS) 与分卷逻辑 (assemblePaper)
 *   用的是中文标签 (选择题/填空题/解答题…)。
 *   旧代码直接拿中文去比对 / 当 SQL 参数, 导致:
 *     - selectQuestions 的 `question_type = 选择题` 恒 0 行 (题型分布失效)
 *     - assemblePaper 按中文过滤恒空 (sections 永为空)
 *
 * 本模块提供唯一映射真源: 代码 ↔ 中文双向归一化; 调用方据此比对 / 拼 SQL。
 * 同时提供 `normalizeQuestionType` 的「不可映射」返回 null, 由调用方做可观测
 * (warn + 计数), 不静默丢题。
 */

// DB 代码 → 中文标签 (与 exam-pdf.js:QUESTION_TYPE_MAP / question_types 种子数据对齐)
export const QUESTION_TYPE_CODE_TO_ZH = {
  choice: '选择题',
  multiple_choice: '多选题',
  fill: '填空题',
  solve: '解答题',
  calculation: '计算题',
  proof: '证明题',
  short_answer: '简答题',
  essay: '论述题',
  comprehensive: '综合题',
  experiment: '实验题',
  reading: '阅读理解',
  cloze: '完形填空',
  grammar_fill: '语法填空',
  translation: '翻译题',
  listening: '听力题',
  correction: '短文改错',
};

// 中文标签 → DB 代码 (QUESTION_TYPE_CODE_TO_ZH 的反向; 用于拼 SQL 参数)
export const QUESTION_TYPE_ZH_TO_CODE = Object.fromEntries(
  Object.entries(QUESTION_TYPE_CODE_TO_ZH).map(([code, zh]) => [zh, code])
);

/**
 * 把任意形态的 question_type 归一化为中文标签; 无法识别返回 null。
 * 幂等: 传入已是中文标签 → 原样返回。
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeQuestionType(raw) {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (v === '') return null;
  if (QUESTION_TYPE_CODE_TO_ZH[v]) return QUESTION_TYPE_CODE_TO_ZH[v]; // 代码 → 中文
  if (QUESTION_TYPE_ZH_TO_CODE[v]) return v; // 已是中文 (幂等)
  return null; // 不可映射 (如 'unknown')
}

/**
 * 把中文标签转回 DB 代码, 供 SQL 参数使用; 若传入的已是代码则原样返回,
 * 无法识别则原样返回 (交由调用方/DB 决定, 不在此处吞掉)。
 * @param {string} type
 * @returns {string}
 */
export function toDbQuestionType(type) {
  return QUESTION_TYPE_ZH_TO_CODE[type] || type;
}
