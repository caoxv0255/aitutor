/* ============================================================================
 * tests/api/grade-requirement-slot.test.js — 批改 prompt 的「题目/要求」槽位
 *
 * 背景 (2026-09-26): analyze 把 title_image 转写为题目文本后, 需要作为一个
 * **明确的槽位**喂进批改 prompt, 让判分参考真实作文题。硬约束:
 *   - 有题目 → prompt 含「- 题目/要求: <文本>」;
 *   - 无题目 (老调用方) → prompt 与改动前**逐字节一致** (不展开该行)。
 *
 * 覆盖:
 *   1. renderEssayRequirementBlock: 有值/空值
 *   2. gradeEssay 带 essay_requirement → 捕获到的 system prompt 含题目文本
 *   3. gradeEssay 不带 essay_requirement → prompt 无「题目/要求」行, 且「标题」
 *      与「学段」两行严格相邻 (证明槽位展开为空, 未插入任何内容)
 *   4. schema: essay_requirement 缺省放行; 超长 (>255) 拒绝
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../api/core/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import { gradeEssay, renderEssayRequirementBlock } from '../../api/handlers/essay/gradeService.js';
import { EssayError } from '../../api/handlers/essay/errors.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

const VALID_TRANSCRIPT = {
  paragraphs: [
    {
      paragraph_index: 0,
      lines: [
        { line_no: 0, text: '春天来了，万物复苏。', uncertain_chars: [] },
        { line_no: 1, text: '大地披上了绿装。', uncertain_chars: [] },
      ],
    },
  ],
  confidence: 0.92,
  uncertain_total: 0,
};

const VALID_GRADE_OUTPUT = {
  annotations: [
    { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了', line_no: 0 }, comment: '好词' },
    {
      id: 'a2',
      type: 'masterstroke',
      anchor: { paragraph_index: 0, quote: '大地披上了绿装', line_no: 1 },
      comment: '点睛',
    },
  ],
  scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
  comment: '本文以春天为背景, 画面感强。建议增加细节。',
  rubric_id: 'chinese_gaokao_v1',
  meta: {
    model: 'qwen-plus',
    anchor_metrics: { raw_count: 2, anchor_success_count: 2, anchor_rate: 1, final_valid_count: 2 },
    prompt_version: '3.1.0',
  },
};

function mockReq() {
  return { headers: { authorization: 'Bearer test-token' } };
}

function fetchOk(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: 'qwen-plus',
      choices: [{ message: { role: 'assistant', content } }],
      usage: {},
    }),
  };
}

/** 捕获 gradeEssay 发给 /api/proxy 的 system prompt */
async function captureSystemPrompt(extra = {}) {
  globalThis.fetch.mockResolvedValueOnce(fetchOk(JSON.stringify(VALID_GRADE_OUTPUT)));
  await gradeEssay({
    user_email: 'test@uibe.edu.cn',
    transcript: VALID_TRANSCRIPT,
    essay_title: '春天来了',
    exam_level: 'gaokao',
    grade: '高三',
    subject: 'chinese',
    request_token: 'tx_slot_001',
    req: mockReq(),
    ...extra,
  });
  const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
  return body.messages[0].content[0].text;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. renderEssayRequirementBlock
// ────────────────────────────────────────────────────────────────────────────

describe('renderEssayRequirementBlock()', () => {
  it('有文本 → 换行 + 「- 题目/要求: …」', () => {
    expect(renderEssayRequirementBlock('那一刻，我长大了')).toBe('\n- 题目/要求: 那一刻，我长大了');
  });

  it('空/缺省/空白 → 空串 (槽位不展开)', () => {
    expect(renderEssayRequirementBlock('')).toBe('');
    expect(renderEssayRequirementBlock('   ')).toBe('');
    expect(renderEssayRequirementBlock(undefined)).toBe('');
    expect(renderEssayRequirementBlock(null)).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 有题目 → 进 prompt
// ────────────────────────────────────────────────────────────────────────────

describe('gradeEssay · essay_requirement 存在', () => {
  it('system prompt 含「题目/要求: <文本>」槽位', async () => {
    const system = await captureSystemPrompt({ essay_requirement: '那一抹微笑' });
    expect(system).toContain('- 题目/要求: 那一抹微笑');
    // 槽位紧跟标题行 (未打乱结构)
    expect(system).toMatch(/- 标题: 春天来了\n- 题目\/要求: 那一抹微笑\n- 学段: 高考/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 无题目 → prompt 不变
// ────────────────────────────────────────────────────────────────────────────

describe('gradeEssay · 无 essay_requirement (向后兼容)', () => {
  it('prompt 不含「题目/要求」行, 也不残留占位符; 标题与学段严格相邻', async () => {
    const system = await captureSystemPrompt();
    expect(system).not.toContain('题目/要求');
    expect(system).not.toContain('{{ESSAY_REQUIREMENT_BLOCK}}');
    expect(system).not.toContain('ESSAY_REQUIREMENT_BLOCK');
    // 槽位展开为空 → 原有两行之间没有任何插入内容
    expect(system).toContain('- 标题: 春天来了\n- 学段: 高考');
  });

  it('缺省与显式 undefined 的 prompt 逐字节一致 (无隐藏差异)', async () => {
    const a = await captureSystemPrompt();
    const b = await captureSystemPrompt({ essay_requirement: undefined });
    expect(a).toBe(b);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. schema
// ────────────────────────────────────────────────────────────────────────────

describe('gradeEssay · essay_requirement schema', () => {
  it('缺省 → 放行 (正常成功)', async () => {
    globalThis.fetch.mockResolvedValueOnce(fetchOk(JSON.stringify(VALID_GRADE_OUTPUT)));
    const r = await gradeEssay({
      user_email: 't@uibe.edu.cn',
      transcript: VALID_TRANSCRIPT,
      essay_title: '春天来了',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_slot_002',
      req: mockReq(),
    });
    expect(r.scores.total).toBe(62);
  });

  it('显式 null → 放行 (nullish 容错; 真实链路曾因传 null 触发 VALIDATION_REQUIRED_FIELD)', async () => {
    globalThis.fetch.mockResolvedValueOnce(fetchOk(JSON.stringify(VALID_GRADE_OUTPUT)));
    const r = await gradeEssay({
      user_email: 't@uibe.edu.cn',
      transcript: VALID_TRANSCRIPT,
      essay_title: '春天来了',
      essay_requirement: null,
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_slot_null',
      req: mockReq(),
    });
    expect(r.scores.total).toBe(62);
  });

  it('超过 255 字符 → VALIDATION_REQUIRED_FIELD (不触达 LLM)', async () => {
    await expect(
      gradeEssay({
        user_email: 't@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        essay_requirement: '题'.repeat(256),
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_slot_003',
        req: mockReq(),
      })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
