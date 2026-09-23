// tests/paper-options-safe.test.js — paperGenerator options 容错解析回归闸门 (2026-09-24)
//
// 背景: exam_questions.options 并非总是合法 JSON 数组。实测形态:
//   - 纯文本 (如 "A. ①\tB. ②...")     → JSON.parse 直接抛错
//   - 合法但非数组 (对象 {"A":...})     → JSON.parse 返回对象, 前端 q.options.forEach 崩
//   - 合法数组 / 空
// paperGenerator.assemblePaper 旧代码三处 `JSON.parse(q.options)` 无保护:
//   纯文本炸弹会让整张试卷生成抛出 (assemblePaper 无 try/catch) → 试卷生成整条失败。
//
// 策略 (与同源消费方 exam-pdf.js:parseOptions 一致): options 必须最终是数组,
//   解析失败 / 非数组 → 按「无选项」([]) 处理 + warn + 累计计数, 绝不把原始
//   字符串塞回 (前端 guarded by `q.options && q.options.length > 0` 后调 forEach,
//   字符串有 length 会让守卫通过然后 TypeError)。
//
// 跑: npm test -- paper-options-safe

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '../api/services/paperGenerator.js');

import { PaperGenerator } from '../api/services/paperGenerator.js';
import { logger } from '../api/core/logger.js';

const PURE_TEXT_OPTIONS = 'A. ①\tB. ②\tC. ③\tD. ④';
const ARRAY_OPTIONS = JSON.stringify(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
const OBJECT_OPTIONS = JSON.stringify({ A: '①', B: '②', C: '③', D: '④' });

function kpCoverage() {
  return { all: [], weak: [], remaining: [], target: [] };
}

function makeQuestion(overrides = {}) {
  return {
    question_uid: 'q-uid-001',
    stem: '题干内容',
    answer: 'A',
    analysis: '解析内容',
    options: null,
    knowledge_point_name: 'kp_x',
    is_weak_point: false,
    difficulty_level: 'easy',
    difficulty: 2,
    ...overrides,
  };
}

function buildPaper(questions, includeAnswer = false) {
  return PaperGenerator.assemblePaper(
    'math',
    questions,
    { byDifficulty: {}, byType: {} },
    3.5,
    120,
    [],
    kpCoverage(),
    includeAnswer
  );
}

function firstQuestion(paper, sectionNamePart) {
  const section = paper.sections.find((s) => s.section_name.includes(sectionNamePart));
  return section.questions[0];
}

describe('PaperGenerator options 容错解析 (纯文本/非数组不得让整卷崩)', () => {
  let warnSpy;

  beforeEach(() => {
    PaperGenerator.optionsParseFailureCount = 0;
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('1. 选择题 options 为纯文本 → 不抛错, 按无选项([])处理, warn + 计数', () => {
    const paper = buildPaper([makeQuestion({ question_type: '选择题', options: PURE_TEXT_OPTIONS })]);
    const q0 = firstQuestion(paper, '选择题');
    expect(q0.options).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(1);
  });

  it('2. 填空题 options 为纯文本 → 不抛错, 按无选项([])处理, warn + 计数', () => {
    const paper = buildPaper([makeQuestion({ question_type: '填空题', options: PURE_TEXT_OPTIONS })]);
    const q0 = firstQuestion(paper, '填空题');
    expect(q0.options).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(1);
  });

  it('3. 解答题 options 为纯文本 → 不抛错, 按无选项([])处理, warn + 计数', () => {
    const paper = buildPaper([makeQuestion({ question_type: '解答题', options: PURE_TEXT_OPTIONS })]);
    const q0 = firstQuestion(paper, '解答题');
    expect(q0.options).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(1);
  });

  it('4. 合法 JSON 数组 → 原样解析为数组, 不 warn 不计数 (对照组)', () => {
    const paper = buildPaper([makeQuestion({ question_type: '选择题', options: ARRAY_OPTIONS })]);
    const q0 = firstQuestion(paper, '选择题');
    expect(q0.options).toEqual(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(0);
  });

  it('5. 合法 JSON 但非数组 (对象) → 仍按无选项([])处理, warn + 计数', () => {
    const paper = buildPaper([makeQuestion({ question_type: '选择题', options: OBJECT_OPTIONS })]);
    const q0 = firstQuestion(paper, '选择题');
    expect(Array.isArray(q0.options)).toBe(true);
    expect(q0.options).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(1);
  });

  it('6. options 为空/null → [] 且不 warn 不计数', () => {
    const paper = buildPaper([
      makeQuestion({ question_type: '选择题', options: null }),
      makeQuestion({ question_type: '选择题', options: '' }),
    ]);
    const section = paper.sections.find((s) => s.section_name.includes('选择题'));
    expect(section.questions[0].options).toEqual([]);
    expect(section.questions[1].options).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(PaperGenerator.optionsParseFailureCount).toBe(0);
  });

  it('7. 源码静态断言: 三处不再裸调 JSON.parse(q.options), 一律走 parseOptionsSafe', () => {
    const src = readFileSync(SERVICE_PATH, 'utf8');
    expect(src).not.toMatch(/JSON\.parse\(q\.options\)/);
    const calls = src.match(/PaperGenerator\.parseOptionsSafe\(/g) || [];
    expect(calls.length).toBe(3);
  });
});
