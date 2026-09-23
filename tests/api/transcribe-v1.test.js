/* ============================================================================
 * tests/api/transcribe-v1.test.js — D086 §12 L4 V1.0 · Stage A 转录单测
 *
 * 目标: 锁死 transcribeService.js 的行为契约, 防止以下回归:
 *   - inferLineNumbers 推断逻辑失效
 *   - Zod 校验漏放, 导致静默降级
 *   - VLM 调用异常时, 错误码与状态码不一致
 *
 * 覆盖矩阵:
 *   1. inferLineNumbers (3 种状态)
 *   2. Zod 校验失败 (paragraph_index 不连续, data: URL)
 *   3. VLM 异常 (timeout, 500)
 *
 * 注 (M-3, 2026-09-23): 所有 fixture 图片地址用回环地址 127.0.0.1:3002 ——
 *   ImageUrlSchema 现在校验宿主白名单 (自身基址 + ALLOWED_ORIGINS + loopback),
 *   任意外网域名会被判 VALIDATION_REQUIRED_FIELD 而到不了被测分支。
 *
 * 运行: npx vitest run tests/api/transcribe-v1.test.js
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 静默 logger
vi.mock('../../api/core/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import { inferLineNumbers, transcribeEssay } from '../../api/handlers/essay/transcribeService.js';
import { EssayError } from '../../api/handlers/essay/errors.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

// ────────────────────────────────────────────────────────────────────────────
// Mock fetch 工具
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构造一个 mock fetch response
 * @param {object} opts
 * @param {boolean} [opts.ok=true]
 * @param {number} [opts.status=200]
 * @param {object} [opts.body={}]
 * @returns {object} mock fetch 返回的 Response-like 对象
 */
function mockFetchResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * 构造一个成功 VLM 调用的 body (DashScope 兼容格式)
 * @param {string} content - LLM 输出的 content 字段
 */
function vlmSuccessBody(content) {
  return {
    success: true,
    data: {
      choices: [
        { message: { role: 'assistant', content } },
      ],
    },
  };
}

/**
 * 构造一个失败的 VLM 响应
 */
function vlmFailureBody(message = 'upstream error') {
  return { success: false, message };
}

/**
 * 构造一个 mock req 对象
 */
function mockReq({ authHeader = 'Bearer test-token' } = {}) {
  return {
    protocol: 'http',
    get: (k) => (k === 'host' ? 'localhost:3002' : undefined),
    headers: { authorization: authHeader },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. inferLineNumbers (3 种状态)
// ────────────────────────────────────────────────────────────────────────────
describe('inferLineNumbers()', () => {
  it('全缺省 (line_no = -1): 按句末标点切分并分配 0,1,2...', () => {
    const input = [
      {
        paragraph_index: 0,
        lines: [
          { line_no: -1, text: '春天来了，万物复苏。大地披上了绿装。', uncertain_chars: [] },
        ],
      },
    ];
    const out = inferLineNumbers(input);
    expect(out[0].lines.length).toBeGreaterThanOrEqual(2);
    // 第一行应为 0
    expect(out[0].lines[0].line_no).toBe(0);
    // 后续行单调递增
    for (let i = 1; i < out[0].lines.length; i++) {
      expect(out[0].lines[i].line_no).toBe(i);
    }
    // 文本应保留句末标点
    expect(out[0].lines[0].text).toMatch(/[。！？]$/);
  });

  it('部分缺省: 混合有效/无效 line_no, 走兜底推断', () => {
    // 全部 line_no = -1, 触发重新切分
    const input = [
      {
        paragraph_index: 0,
        lines: [
          { line_no: -1, text: '第一句。第二句！', uncertain_chars: [] },
          { line_no: -1, text: '第三句？', uncertain_chars: [] },
        ],
      },
    ];
    const out = inferLineNumbers(input);
    expect(out[0].lines.length).toBeGreaterThanOrEqual(3);
    expect(out[0].lines[0].line_no).toBe(0);
  });

  it('全正常 (连续有效 line_no 0,1,2): 函数直接透传不修改', () => {
    const input = [
      {
        paragraph_index: 0,
        lines: [
          { line_no: 0, text: '第一行', uncertain_chars: [] },
          { line_no: 1, text: '第二行', uncertain_chars: [] },
          { line_no: 2, text: '第三行', uncertain_chars: [] },
        ],
      },
    ];
    const out = inferLineNumbers(input);
    // 全有效时直接返回原对象 (引用相同或结构相同)
    expect(out[0].lines).toHaveLength(3);
    expect(out[0].lines[0].line_no).toBe(0);
    expect(out[0].lines[1].line_no).toBe(1);
    expect(out[0].lines[2].line_no).toBe(2);
  });

  it('边界: 空数组返回空数组', () => {
    expect(inferLineNumbers([])).toEqual([]);
  });

  it('边界: 非数组输入不崩', () => {
    expect(inferLineNumbers(null)).toEqual([]);
    expect(inferLineNumbers(undefined)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Zod 校验失败路径
// ────────────────────────────────────────────────────────────────────────────
describe('transcribeEssay: Zod 校验失败', () => {
  beforeEach(() => {
    // 每次测试前 stub fetch
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('paragraph_index 不连续 (0, 2): 抛 ESSAY_TRANSCRIBE_PARSE_FAILED', async () => {
    // Zod 不检查连续性, 但业务层会
    const malformed = JSON.stringify({
      paragraphs: [
        { paragraph_index: 0, lines: [{ line_no: 0, text: '好句', uncertain_chars: [] }] },
        { paragraph_index: 2, lines: [{ line_no: 0, text: '又一句', uncertain_chars: [] }] },
      ],
      confidence: 0.9,
      uncertain_total: 0,
    });
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(malformed),
    }));

    try {
      await transcribeEssay({
        images: ['http://127.0.0.1:3002/img1.jpg'],
        subject: 'chinese',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      expect(err.code).toBe(ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED);
      expect(err.statusCode).toBe(422);
      expect(err.message).toMatch(/paragraph_index/);
    }
  });

  it('paragraphs 为空数组: 抛 ESSAY_TRANSCRIBE_PARSE_FAILED (Zod min(1))', async () => {
    const malformed = JSON.stringify({
      paragraphs: [],
      confidence: 0.9,
      uncertain_total: 0,
    });
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(malformed),
    }));

    await expect(
      transcribeEssay({
        images: ['http://127.0.0.1:3002/img1.jpg'],
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
      statusCode: 422,
    });
  });

  it('images 包含 data: 协议: 抛 VALIDATION_REQUIRED_FIELD (Patch 2)', async () => {
    // 不应调 VLM, 在入参校验阶段直接失败
    await expect(
      transcribeEssay({
        images: ['data:image/jpeg;base64,abc123'], // ❌ 违反 Patch 2: 必须 http(s)
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_REQUIRED_FIELD,
      statusCode: 400,
    });

    // 确认 fetch 未被调用 (短路)
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('images 包含 ftp: 协议: 同样拒绝', async () => {
    await expect(
      transcribeEssay({
        images: ['ftp://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_REQUIRED_FIELD,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('subject 为非法枚举值 (如 "french"): 抛 VALIDATION_REQUIRED_FIELD', async () => {
    await expect(
      transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'french', // ❌ 只允许 chinese | english
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_REQUIRED_FIELD,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('images 超过 5 张: 抛 VALIDATION_REQUIRED_FIELD', async () => {
    await expect(
      transcribeEssay({
        images: [
          'http://127.0.0.1:3002/1.jpg', 'http://127.0.0.1:3002/2.jpg', 'http://127.0.0.1:3002/3.jpg',
          'http://127.0.0.1:3002/4.jpg', 'http://127.0.0.1:3002/5.jpg', 'http://127.0.0.1:3002/6.jpg',
        ],
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_REQUIRED_FIELD,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('缺少 Authorization 头: 抛 AUTH_NOT_LOGIN', async () => {
    await expect(
      transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: { protocol: 'http', get: () => 'localhost:3002', headers: {} }, // 无 authorization
      })
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_NOT_LOGIN,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. VLM 调用异常
// ────────────────────────────────────────────────────────────────────────────
describe('transcribeEssay: VLM 异常', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('模拟 30s 超时 (fetch 抛 AbortError): 抛 ESSAY_LLM_TIMEOUT', async () => {
    // 直接模拟 AbortError 抛出
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    globalThis.fetch.mockRejectedValueOnce(abortError);

    await expect(
      transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.ESSAY_LLM_TIMEOUT,
      statusCode: 504,
    });
  });

  it('模拟 500 上游错误: 抛 ESSAY_LLM_UPSTREAM_ERROR', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      ok: false,
      status: 500,
      body: vlmFailureBody('DashScope 5xx'),
    }));

    try {
      await transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      expect(err.code).toBe(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
      expect(err.statusCode).toBe(503);
    }
  });

  it('模拟 401 网关未授权: 抛 INTERNAL_ERROR (业务级 4xx 不归 LLM 错误)', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      ok: false,
      status: 401,
      body: vlmFailureBody('API key invalid'),
    }));

    try {
      await transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      // 401 < 500 走 INTERNAL_ERROR 分支
      expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(err.statusCode).toBe(500);
    }
  });

  it('模拟 LLM 返回 content 为空: 抛 ESSAY_TRANSCRIBE_PARSE_FAILED', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: { success: true, data: { choices: [{ message: { content: '' } }] } },
    }));

    await expect(
      transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      })
    ).rejects.toMatchObject({
      code: ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
    });
  });

  it('模拟 JSON 解析失败 (LLM 返回乱码): 抛 ESSAY_TRANSCRIBE_PARSE_FAILED', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody('这是模型返回的乱码, 无 JSON 结构, 完全不能 parse'),
    }));

    try {
      await transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      expect(err.code).toBe(ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED);
      expect(err.statusCode).toBe(422);
    }
  });

  it('模拟网络连接失败 (fetch TypeError): 抛 ESSAY_LLM_UPSTREAM_ERROR', async () => {
    globalThis.fetch.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'));

    try {
      await transcribeEssay({
        images: ['http://127.0.0.1:3002/img.jpg'],
        subject: 'chinese',
        req: mockReq(),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EssayError);
      expect(err.code).toBe(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
      expect(err.statusCode).toBe(503);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 成功路径 (golden path)
// ────────────────────────────────────────────────────────────────────────────
describe('transcribeEssay: 成功路径', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('正常 LLM 返回: 返回结构化 transcript + request_token + raw_metrics', async () => {
    const validOutput = {
      paragraphs: [
        {
          paragraph_index: 0,
          lines: [
            { line_no: 0, text: '春天来了。', uncertain_chars: [] },
            { line_no: 1, text: '万物复苏。', uncertain_chars: [] },
          ],
        },
      ],
      confidence: 0.95,
      uncertain_total: 0,
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(validOutput)),
    }));

    const result = await transcribeEssay({
      images: ['http://127.0.0.1:3002/img.jpg'],
      subject: 'chinese',
      req: mockReq(),
    });

    expect(result.transcript).toBeDefined();
    expect(result.transcript.paragraphs).toHaveLength(1);
    expect(result.transcript.paragraphs[0].lines).toHaveLength(2);
    expect(result.transcript.confidence).toBe(0.95);
    expect(result.request_token).toMatch(/^tx_/);
    expect(result.raw_metrics.model).toBe('qwen-vl-max');
    expect(result.raw_metrics.task_type).toBe('essay_transcribe');
  });

  it('line_no 缺失的合法 JSON: inferLineNumbers 兜底推断', async () => {
    // LLM 没填 line_no (我们 prompt 允许省略)
    const outputNoLineNo = {
      paragraphs: [
        {
          paragraph_index: 0,
          lines: [
            { line_no: -1, text: '第一段。第一句。第二句！', uncertain_chars: [] },
          ],
        },
      ],
      confidence: 0.9,
      uncertain_total: 0,
    };
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse({
      body: vlmSuccessBody(JSON.stringify(outputNoLineNo)),
    }));

    const result = await transcribeEssay({
      images: ['http://127.0.0.1:3002/img.jpg'],
      subject: 'chinese',
      req: mockReq(),
    });

    // 推断后应有多行
    expect(result.transcript.paragraphs[0].lines.length).toBeGreaterThanOrEqual(2);
    expect(result.transcript.paragraphs[0].lines[0].line_no).toBe(0);
  });
});
