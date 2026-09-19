/* ============================================================================
 * tests/api/grade-v1.test.js — D086 §12 L4 V1.0 · Stage B 批改单测
 *
 * 目标: 锁死 gradeService.js 的行为契约, 防止以下回归:
 *   - formatTranscriptForPrompt (Patch 3) 格式失效
 *   - Zod 校验漏放 (scores.total != sum 等)
 *   - VLM 异常时, 错误码与状态码不一致
 *   - 类型覆盖缺失警告失效
 *
 * 覆盖矩阵:
 *   1. formatTranscriptForPrompt (直接单元测试)
 *   2. Zod 校验失败 (scores.total != sum, annotation 缺字段, type 非法)
 *   3. VLM 异常 (timeout, 500, JSON 解析失败)
 *   4. 入参校验 (exam_level / grade / subject 非法)
 *   5. 成功路径 (golden output, reconcile 集成)
 *
 * 运行: npx vitest run tests/api/grade-v1.test.js
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../api/core/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import {
  formatTranscriptForPrompt,
  gradeEssay,
} from '../../api/handlers/essay/gradeService.js';
import { EssayError } from '../../api/handlers/essay/errors.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

// ────────────────────────────────────────────────────────────────────────────
// Mock 工具
// ────────────────────────────────────────────────────────────────────────────

function mockFetchResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok, status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function vlmSuccessBody(content) {
  return {
    success: true,
    data: { choices: [{ message: { role: 'assistant', content } }] },
  };
}

function vlmFailureBody(message = 'upstream error') {
  return { success: false, message };
}

function mockReq() {
  return {
    protocol: 'http',
    get: (k) => (k === 'host' ? 'localhost:3002' : undefined),
    headers: { authorization: 'Bearer test-token' },
  };
}

const VALID_TRANSCRIPT = {
  paragraphs: [
    {
      paragraph_index: 0,
      lines: [
        { line_no: 0, text: '春天来了，万物复苏。', uncertain_chars: [] },
        { line_no: 1, text: '大地披上了绿装。', uncertain_chars: [] },
      ],
    },
    {
      paragraph_index: 1,
      lines: [
        { line_no: 0, text: '小明在田野上。', uncertain_chars: [] },
      ],
    },
  ],
  confidence: 0.92,
  uncertain_total: 0,
};

const VALID_GRADE_OUTPUT = {
  annotations: [
    { id: 'a1', type: 'highlight',     anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。', line_no: 0 }, comment: '好句' },
    { id: 'a2', type: 'masterstroke',  anchor: { paragraph_index: 0, quote: '大地披上了绿装',     line_no: 1 }, comment: '点睛' },
    { id: 'a3', type: 'grammar_error', anchor: { paragraph_index: 0, quote: '万物复苏。',           line_no: 0 }, comment: '语病' },
  ],
  scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
  comment: '本文以春天为背景, 画面感强, 但中段略空。建议增加细节。',
  rubric_id: 'chinese_gaokao_v1',
  meta: {
    model: 'qwen-plus',
    anchor_metrics: { raw_count: 3, anchor_success_count: 3, anchor_rate: 1, final_valid_count: 3 },
    prompt_version: '3.0.0',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// 1. formatTranscriptForPrompt (Patch 3 直接单元测试)
// ────────────────────────────────────────────────────────────────────────────
describe('formatTranscriptForPrompt() — Patch 3', () => {
  it('输出包含 [段落 N] 标记, 每段之间空行分隔', () => {
    // VALID_TRANSCRIPT 有 2 段, 段间应空行
    const out = formatTranscriptForPrompt(VALID_TRANSCRIPT);
    expect(out).toContain('[段落 0]');
    expect(out).toContain('[段落 1]');
    expect(out).toMatch(/\[段落 0\][\s\S]*\n\n\[段落 1\]/);  // 段间空行
  });

  it('每段内的多行用 \n 拼接 (无空格)', () => {
    const out = formatTranscriptForPrompt(VALID_TRANSCRIPT);
    // 段 0 第 0 行 "春天来了" + \n + 第 1 行 "大地披上了绿装"
    expect(out).toContain('春天来了，万物复苏。\n大地披上了绿装。');
  });

  it('空 transcript 返回空字符串 (防御)', () => {
    expect(formatTranscriptForPrompt(null)).toBe('');
    expect(formatTranscriptForPrompt(undefined)).toBe('');
    expect(formatTranscriptForPrompt({})).toBe('');
    expect(formatTranscriptForPrompt({ paragraphs: [] })).toBe('');
  });

  it('大段 (10+ 段) 仍能正确编号', () => {
    const big = {
      paragraphs: Array.from({ length: 12 }, (_, i) => ({
        paragraph_index: i,
        lines: [{ line_no: 0, text: `段${i}内容`, uncertain_chars: [] }],
      })),
    };
    const out = formatTranscriptForPrompt(big);
    expect(out).toContain('[段落 0]');
    expect(out).toContain('[段落 9]');
    expect(out).toContain('[段落 11]');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Zod 校验失败
// ────────────────────────────────────────────────────────────────────────────
describe('gradeEssay: Zod 校验失败', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('scores.total != sum: Zod refine 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = {
      ...VALID_GRADE_OUTPUT,
      scores: { content: 17, language: 16, structure: 15, development: 14, total: 999 },
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
      expect(err.statusCode).toBe(422);
    }
  });

  it('annotation 缺 comment: Zod min(2) 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '好句' }, comment: 'a' }, // 1 字符, < 2
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });

  it('annotation type 非法: Zod enum 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'invalid_type', anchor: { paragraph_index: 0, quote: '好句好句' }, comment: '...' },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });

  it('annotation quote < 2 字符: Zod min(2) 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: 'x' }, comment: '...' },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });

  it('annotations 为空数组: Zod min(1) 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = { ...VALID_GRADE_OUTPUT, annotations: [] };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });

  it('content 评分超 20: Zod max 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = {
      ...VALID_GRADE_OUTPUT,
      scores: { content: 25, language: 16, structure: 15, development: 14, total: 70 },
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });

  it('总评 < 10 字符: Zod min 失败 → ESSAY_GRADE_PARSE_FAILED', async () => {
    const bad = { ...VALID_GRADE_OUTPUT, comment: '太短' };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(bad)),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. VLM 异常
// ────────────────────────────────────────────────────────────────────────────
describe('gradeEssay: VLM 异常', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('AbortError → ESSAY_LLM_TIMEOUT (504)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    globalThis.fetch.mockRejectedValueOnce(abortErr);

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_LLM_TIMEOUT);
      expect(err.statusCode).toBe(504);
    }
  });

  it('500 上游错误 → ESSAY_LLM_UPSTREAM_ERROR (503)', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      ok: false, status: 500,
      body: vlmFailureBody('DashScope 5xx'),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
      expect(err.statusCode).toBe(503);
    }
  });

  it('LLM 返回乱码: parseJsonFromLLM 返回 null → ESSAY_GRADE_PARSE_FAILED', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody('这是无 JSON 结构的乱码文本'),
    }));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
      expect(err.statusCode).toBe(422);
    }
  });

  it('网络 TypeError → ESSAY_LLM_UPSTREAM_ERROR', async () => {
    globalThis.fetch.mockRejectedValueOnce(new TypeError('ECONNREFUSED'));

    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 入参校验
// ────────────────────────────────────────────────────────────────────────────
describe('gradeEssay: 入参校验', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('transcript 缺失: VALIDATION_REQUIRED_FIELD (短路 fetch)', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: null,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    }
  });

  it('exam_level 非法: VALIDATION_REQUIRED_FIELD', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'invalid_level', // ❌
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    }
  });

  it('grade 非法: VALIDATION_REQUIRED_FIELD', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '大四', // ❌
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    }
  });

  it('subject 非法: VALIDATION_REQUIRED_FIELD', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'japanese', // ❌
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    }
  });

  it('essay_title 缺失: VALIDATION_REQUIRED_FIELD', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    }
  });

  it('request_token 缺失: VALIDATION_REQUIRED_FIELD', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: '', // ❌
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    }
  });

  it('缺 Authorization: AUTH_NOT_LOGIN', async () => {
    try {
      await gradeEssay({
        user_email: 'test@uibe.edu.cn',
        transcript: VALID_TRANSCRIPT,
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        subject: 'chinese',
        request_token: 'tx_test_001',
        req: { protocol: 'http', get: () => 'localhost:3002', headers: {} },
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.AUTH_NOT_LOGIN);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 成功路径 (golden output + reconcile 集成)
// ────────────────────────────────────────────────────────────────────────────
describe('gradeEssay: 成功路径', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('正常 LLM 返回: report_id + 锚定后 annotations + scores', async () => {
    // 构造无重叠的 annotations (避免 Patch 4 干扰断言)
    const nonOverlapping = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'highlight',     anchor: { paragraph_index: 0, quote: '春天来了', line_no: 0 }, comment: '好词' },
        { id: 'a2', type: 'masterstroke',  anchor: { paragraph_index: 0, quote: '大地披上了绿装', line_no: 1 }, comment: '点睛' },
      ],
      scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(nonOverlapping)),
    }));

    const result = await gradeEssay({
      user_email: 'test@uibe.edu.cn',
      transcript: VALID_TRANSCRIPT,
      essay_title: '春天来了',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_test_001',
      req: mockReq(),
    });

    expect(result.report_id).toMatch(/^er_/);
    expect(result.annotations).toHaveLength(2);
    expect(result.annotations.every((a) => a.anchor_failed === false)).toBe(true);
    expect(result.scores.total).toBe(62);
    expect(result.rubric_id).toBe('chinese_gaokao_v1');
    expect(result.meta.anchor_metrics.anchor_rate).toBe(1);
    expect(result.meta.anchor_metrics.final_valid_count).toBe(2);
  });

  it('anchor 失败时降级, 不丢弃 (final_valid_count === raw_count)', async () => {
    // 2 个成功 + 1 个找不到, 不重叠
    const withFail = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了', line_no: 0 }, comment: '好词' },
        { id: 'a2', type: 'masterstroke', anchor: { paragraph_index: 0, quote: '大地披上了绿装', line_no: 1 }, comment: '点睛' },
        { id: 'fail', type: 'logic_issue', anchor: { paragraph_index: 0, quote: '完全不存在的内容xyzabc' }, comment: '建议' },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(withFail)),
    }));

    const result = await gradeEssay({
      user_email: 'test@uibe.edu.cn',
      transcript: VALID_TRANSCRIPT,
      essay_title: '春天来了',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_test_001',
      req: mockReq(),
    });

    // 3 条全部保留 (final_valid_count === raw_count)
    expect(result.annotations).toHaveLength(3);
    const failed = result.annotations.filter((a) => a.anchor_failed);
    expect(failed.length).toBe(1);
    expect(failed[0].failure_reason).toBe('quote_not_found');
    expect(result.meta.anchor_metrics.raw_count).toBe(3);
    expect(result.meta.anchor_metrics.final_valid_count).toBe(3);
    expect(result.meta.anchor_metrics.anchor_success_count).toBe(2);
  });

  it('comment 含 XSS 字符串: 不阻断 (Zod 接受, 不解析)', async () => {
    const xssOut = {
      ...VALID_GRADE_OUTPUT,
      annotations: [
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。' }, comment: '<img src=x onerror=alert(1)>' },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(xssOut)),
    }));

    // Zod schema 只校验 comment 长度, 不解析内容 (前端负责 escape)
    const result = await gradeEssay({
      user_email: 'test@uibe.edu.cn',
      transcript: VALID_TRANSCRIPT,
      essay_title: '春天来了',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_test_001',
      req: mockReq(),
    });
    // comment 完整保留 (含 XSS 字符串), 前端渲染时负责 escapeHtml
    expect(result.annotations[0].comment).toBe('<img src=x onerror=alert(1)>');
  });
});
