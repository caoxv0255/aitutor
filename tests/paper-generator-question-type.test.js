// tests/paper-generator-question-type.test.js — PaperGenerator 题型归一化回归闸门 (2026-09-24)
//
// 背景: exam_questions.question_type 实际存 DB 代码 (实测全表:
//   choice 25299 / unknown 14435 / solve 6952 / fill 2820, 共 49506),
//   而 paperGenerator 的权重表与 assemblePaper 用中文标签 (选择题/填空题/解答题)。
//   旧代码直接拿中文比对 / 当 SQL 参数 → 三条 section 恒空 (且 selectQuestions
//   的 `question_type='选择题'` 恒 0 行)。
//
// 回归: 归一化后, DB 代码形态的题必须能落入对应 section; 无法归一化的值
//   (如 'unknown') 必须 warn + 计数, 不得静默丢弃且不得让整卷崩。
//
// 跑: npm test -- paper-generator-question-type

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '../api/services/paperGenerator.js');

import { PaperGenerator } from '../api/services/paperGenerator.js';
import { normalizeQuestionType, toDbQuestionType } from '../api/services/questionType.js';
import { logger } from '../api/core/logger.js';

function kpCoverage() {
  return { all: [], weak: [], remaining: [], target: [] };
}

function makeQuestion(question_type, overrides = {}) {
  return {
    question_uid: `q-${Math.random().toString(36).slice(2, 8)}`,
    question_type,
    stem: '题干内容',
    answer: 'A',
    analysis: '解析',
    options: null,
    knowledge_point_name: 'kp_x',
    is_weak_point: false,
    difficulty_level: 'easy',
    difficulty: 2,
    ...overrides,
  };
}

function buildPaper(questions) {
  return PaperGenerator.assemblePaper(
    'math',
    questions,
    { byDifficulty: {}, byType: {} },
    3.5,
    120,
    [],
    kpCoverage(),
    false
  );
}

describe('questionType 归一化 (代码 ↔ 中文, 幂等)', () => {
  it('1. DB 代码 → 中文标签', () => {
    expect(normalizeQuestionType('choice')).toBe('选择题');
    expect(normalizeQuestionType('fill')).toBe('填空题');
    expect(normalizeQuestionType('solve')).toBe('解答题');
    expect(normalizeQuestionType('calculation')).toBe('计算题');
    expect(normalizeQuestionType('proof')).toBe('证明题');
  });

  it('2. 已是中文标签 → 幂等原样返回', () => {
    for (const zh of ['选择题', '填空题', '解答题']) {
      expect(normalizeQuestionType(zh)).toBe(zh);
    }
  });

  it('3. 无法识别 (unknown / 空 / null) → null', () => {
    expect(normalizeQuestionType('unknown')).toBeNull();
    expect(normalizeQuestionType('')).toBeNull();
    expect(normalizeQuestionType(null)).toBeNull();
    expect(normalizeQuestionType(undefined)).toBeNull();
  });

  it('4. toDbQuestionType: 中文 → 代码; 已是代码则原样', () => {
    expect(toDbQuestionType('选择题')).toBe('choice');
    expect(toDbQuestionType('解答题')).toBe('solve');
    expect(toDbQuestionType('choice')).toBe('choice');
  });
});

describe('assemblePaper 题型归一化: DB 代码形态不再恒空', () => {
  let warnSpy;

  beforeEach(() => {
    PaperGenerator.optionsParseFailureCount = 0;
    PaperGenerator.unmappedQuestionTypeCount = 0;
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('5. DB 代码 (choice/fill/solve) → 三条 section 均非空, 题目数正确', () => {
    const questions = [
      ...Array.from({ length: 10 }, () => makeQuestion('choice')),
      ...Array.from({ length: 3 }, () => makeQuestion('fill')),
      ...Array.from({ length: 9 }, () => makeQuestion('solve')),
    ];
    const paper = buildPaper(questions);

    expect(paper.sections).toHaveLength(3);
    const byName = Object.fromEntries(paper.sections.map((s) => [s.section_name, s.questions.length]));
    expect(byName['一、选择题']).toBe(10);
    expect(byName['二、填空题']).toBe(3);
    expect(byName['三、解答题']).toBe(9);
    expect(paper.sections.reduce((n, s) => n + s.questions.length, 0)).toBe(22);
    expect(PaperGenerator.unmappedQuestionTypeCount).toBe(0);
  });

  it('6. 中文标签入参 (旧测试形态) 仍工作 — 不回归', () => {
    const paper = buildPaper([makeQuestion('选择题'), makeQuestion('填空题'), makeQuestion('解答题')]);
    expect(paper.sections).toHaveLength(3);
  });

  it('7. 无法归一化的值 (unknown) → 排除出分卷 + warn + 计数自增, 不静默丢', () => {
    const paper = buildPaper([makeQuestion('choice'), makeQuestion('unknown'), makeQuestion('unknown')]);
    expect(paper.sections).toHaveLength(1); // 只有选择题
    expect(paper.sections[0].questions).toHaveLength(1);
    expect(PaperGenerator.unmappedQuestionTypeCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('无法归一化'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
  });

  it('8. 源码静态断言: selectQuestions 拼 SQL 前走 toDbQuestionType (不再直接绑中文)', () => {
    const src = readFileSync(SERVICE_PATH, 'utf8');
    expect(src).toMatch(/toDbQuestionType\(type\)/);
    // 兜底查询不得再拼出非法的 `NOT IN ()`
    expect(src).toMatch(/excludeIds\.length > 0/);
  });
});
