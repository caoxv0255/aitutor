/* ============================================================================
 * tests/api/essay-title-image.test.js — analyze 的 title_image (作文题目图)
 *
 * 背景 (2026-09-26): 前端已提交 title_image, 但 analyze 的 Zod schema 未含该
 * 字段 → unknown key 被静默丢弃 → essay_title 恒「未命名」, 判分也看不到真题。
 * 本文件锁死「完整语义」的行为契约:
 *   1. schema 接受 title_image; 拒绝空串/非字符串
 *   2. deriveEssayTitleFromTranscript: 转录 → 单行题目文本 (折叠空白, ≤255)
 *   3. runAnalyzeJob 带 title_image: 落盘 + MaaS 转写 + 写入 essay_title +
 *      作为 essay_requirement 传给 gradeService + meta.title_image_url
 *   4. 向后兼容: 不传 title_image 时, 视觉只调 1 次, essay_requirement 为 null,
 *      写回 essay_title 为 null, meta 不含 title_image_url (行为与改动前一致)
 *   5. 坏图 (落盘失败): 标 failed 且用其 uploadCode, 不触达批改
 *   6. 题目图转写失败: 标 failed(ESSAY_LLM_UPSTREAM_ERROR)
 *
 * 全 mock 外部依赖 (LLM / 存储 / sharp), 不真调外部服务, 不写 DB。
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertEssayReport: vi.fn(),
  updateEssayReportResult: vi.fn(),
  markEssayFailed: vi.fn(),
  reclaimStalePending: vi.fn(),
  gradeEssay: vi.fn(),
  maasVisionChatCompletion: vi.fn(),
  saveImageFromBase64: vi.fn(),
}));

vi.mock('../../api/handlers/essay/essayStorage.js', () => ({
  insertEssayReport: mocks.insertEssayReport,
  getEssayReport: vi.fn(),
  updateEssayReportResult: mocks.updateEssayReportResult,
  markEssayFailed: mocks.markEssayFailed,
  reclaimStalePending: mocks.reclaimStalePending,
  PENDING_TIMEOUT_MS: 180000,
}));
vi.mock('../../api/handlers/essay/gradeService.js', () => ({
  gradeEssay: mocks.gradeEssay,
}));
vi.mock('../../services/llm.js', () => ({
  maasVisionChatCompletion: mocks.maasVisionChatCompletion,
}));
vi.mock('../../api/handlers/upload/imageHandler.js', () => ({
  saveImageFromBase64: mocks.saveImageFromBase64,
}));
vi.mock('../../api/core/logger.js', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));

import {
  startAnalyze,
  runAnalyzeJob,
  deriveEssayTitleFromTranscript,
} from '../../api/handlers/essay/analyzeService.js';
import { EssayError } from '../../api/handlers/essay/errors.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

/** 复刻 imageHandler.uploadError 的形状 (该函数未导出; 只带 uploadCode 即可) */
function uploadError(uploadCode, message) {
  const err = new Error(message);
  err.uploadCode = uploadCode;
  return err;
}

// ── 固定输入 ────────────────────────────────────────────────────────────────

function transcribeJson(lines) {
  return JSON.stringify({
    paragraphs: [{ paragraph_index: 0, lines }],
    confidence: 0.9,
    uncertain_total: 0,
  });
}

const CONTENT_JSON = transcribeJson([{ line_no: 0, text: '春天来了。', uncertain_chars: [] }]);
const TITLE_JSON = transcribeJson([
  { line_no: 0, text: '那一刻，我长大了', uncertain_chars: [] },
  { line_no: 1, text: '要求：结合自身经历，写一篇不少于600字的记叙文。', uncertain_chars: [] },
]);
// deriveEssayTitleFromTranscript: 行间以空格连接
const EXPECTED_TITLE = '那一刻，我长大了 要求：结合自身经历，写一篇不少于600字的记叙文。';

const GRADED = {
  report_id: 'er_t_1',
  annotations: [
    { id: 'a1', type: 'highlight', paragraph_index: 0, start: 0, end: 5, original: '春天来了。', comment: '好' },
  ],
  scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
  comment: '不错',
  rubric_id: 'chinese_gaokao_v1',
  meta: {
    model: 'qwen-plus',
    anchor_metrics: { raw_count: 1, anchor_success_count: 1, anchor_rate: 1, final_valid_count: 1 },
  },
};

function mockReq(body = {}) {
  return {
    body,
    user: { email: 'student@example.com' },
    headers: { authorization: 'Bearer test-token' },
    traceId: 'tid-test',
    requestId: 'rid-test',
  };
}

function jobOf(overrides = {}) {
  return {
    reportId: 'er_t_1',
    email: 'student@example.com',
    authHeader: 'Bearer test-token',
    image: 'CONTENT_B64',
    titleImage: null,
    subject: 'chinese',
    essayTitle: '未命名',
    examLevel: 'gaokao',
    grade: '高三',
    requestId: 'tid-test',
    ...overrides,
  };
}

/** 第一次视觉=内容转录, 第二次=题目转录 */
function mockVisionContentThenTitle() {
  mocks.maasVisionChatCompletion
    .mockResolvedValueOnce({ content: CONTENT_JSON, provider: 'maas' })
    .mockResolvedValueOnce({ content: TITLE_JSON, provider: 'maas' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveImageFromBase64.mockResolvedValue({ url: '/uploads/essay/2026/09/x.jpg', width: 900, height: 1200 });
  mocks.gradeEssay.mockResolvedValue(GRADED);
  mocks.insertEssayReport.mockResolvedValue('er_t_1');
  mocks.updateEssayReportResult.mockResolvedValue(undefined);
  mocks.markEssayFailed.mockResolvedValue(undefined);
  mocks.reclaimStalePending.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.DEV_AUTH_BYPASS;
});

// ────────────────────────────────────────────────────────────────────────────
// 1. schema: 接受 / 拒绝
// ────────────────────────────────────────────────────────────────────────────

describe('AnalyzeRequestSchema · title_image', () => {
  const base = { image: 'BASE64', subject: 'chinese', grade: 'junior' };

  it('接受 title_image (base64 字符串) 并带进后台任务', async () => {
    const dispatch = vi.fn();
    await startAnalyze({ req: mockReq({ ...base, title_image: 'TITLE_B64' }), dispatch });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].titleImage).toBe('TITLE_B64');
  });

  it('title_image 为空串 → VALIDATION_REQUIRED_FIELD, 不落库', async () => {
    await expect(startAnalyze({ req: mockReq({ ...base, title_image: '' }), dispatch: vi.fn() })).rejects.toMatchObject(
      { code: ErrorCode.VALIDATION_REQUIRED_FIELD }
    );
    expect(mocks.insertEssayReport).not.toHaveBeenCalled();
  });

  it('title_image 为数字 (非字符串) → VALIDATION_REQUIRED_FIELD', async () => {
    await expect(
      startAnalyze({ req: mockReq({ ...base, title_image: 123 }), dispatch: vi.fn() })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
  });

  it('不传 title_image → job.titleImage 为 null (向后兼容)', async () => {
    const dispatch = vi.fn();
    await startAnalyze({ req: mockReq(base), dispatch });
    expect(dispatch.mock.calls[0][0].titleImage).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. deriveEssayTitleFromTranscript (纯函数)
// ────────────────────────────────────────────────────────────────────────────

describe('deriveEssayTitleFromTranscript()', () => {
  it('多段多行 → 单行、空白折叠', () => {
    const t = {
      paragraphs: [
        { paragraph_index: 0, lines: [{ text: '那一刻，' }, { text: '我长大了' }] },
        { paragraph_index: 1, lines: [{ text: '  要求：写一篇记叙文。  ' }] },
      ],
    };
    expect(deriveEssayTitleFromTranscript(t)).toBe('那一刻， 我长大了 要求：写一篇记叙文。');
  });

  it('超过 255 字符 → 截断到 255 (与 DB 列 / grade schema 上限一致)', () => {
    const long = '题'.repeat(400);
    const out = deriveEssayTitleFromTranscript({
      paragraphs: [{ paragraph_index: 0, lines: [{ text: long }] }],
    });
    expect(out.length).toBe(255);
  });

  it('空/非法 transcript → 空串', () => {
    expect(deriveEssayTitleFromTranscript(null)).toBe('');
    expect(deriveEssayTitleFromTranscript({})).toBe('');
    expect(deriveEssayTitleFromTranscript({ paragraphs: [] })).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. runAnalyzeJob: 带 title_image 的完整语义
// ────────────────────────────────────────────────────────────────────────────

describe('runAnalyzeJob() · title_image 存在', () => {
  it('落盘两张图 + 两次视觉转写 + 写入 essay_title + 传 essay_requirement', async () => {
    mockVisionContentThenTitle();

    const out = await runAnalyzeJob(jobOf({ titleImage: 'TITLE_B64' }));

    expect(out.status).toBe('completed');
    // 两张图都落盘 (内容 + 题目)
    expect(mocks.saveImageFromBase64).toHaveBeenCalledTimes(2);
    expect(mocks.saveImageFromBase64).toHaveBeenCalledWith(
      'CONTENT_B64',
      expect.objectContaining({ purpose: 'essay' })
    );
    expect(mocks.saveImageFromBase64).toHaveBeenCalledWith('TITLE_B64', expect.objectContaining({ purpose: 'essay' }));

    // 两次视觉: 内容 essay_transcribe + 题目 essay_transcribe_title
    expect(mocks.maasVisionChatCompletion).toHaveBeenCalledTimes(2);
    const taskTypes = mocks.maasVisionChatCompletion.mock.calls.map((c) => c[0].options.task_type);
    expect(taskTypes).toEqual(['essay_transcribe', 'essay_transcribe_title']);
    // 题目图用原始 base64 字节进视觉
    expect(mocks.maasVisionChatCompletion.mock.calls[1][0].images).toEqual([{ base64: 'TITLE_B64' }]);

    // 批改拿到 OCR 出的真实题目 (同时是 essay_title 与 essay_requirement)
    expect(mocks.gradeEssay).toHaveBeenCalledWith(
      expect.objectContaining({
        essay_title: EXPECTED_TITLE,
        essay_requirement: EXPECTED_TITLE,
      })
    );

    // 写回 essay_title + meta.title_image_url
    const written = mocks.updateEssayReportResult.mock.calls[0][1];
    expect(written.essay_title).toBe(EXPECTED_TITLE);
    expect(written.meta.title_image_url).toBe('/uploads/essay/2026/09/x.jpg');
    expect(written.status).toBe('completed');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 向后兼容: 不传 title_image
// ────────────────────────────────────────────────────────────────────────────

describe('runAnalyzeJob() · 不传 title_image (行为完全不变)', () => {
  it('只落 1 张图 / 只调 1 次视觉 / requirement=null / 不覆盖标题 / meta 无 title_image_url', async () => {
    mocks.maasVisionChatCompletion.mockResolvedValue({ content: CONTENT_JSON, provider: 'maas' });

    const out = await runAnalyzeJob(jobOf({ titleImage: null, essayTitle: '我的春天' }));

    expect(out.status).toBe('completed');
    expect(mocks.saveImageFromBase64).toHaveBeenCalledTimes(1);
    expect(mocks.maasVisionChatCompletion).toHaveBeenCalledTimes(1);
    expect(mocks.maasVisionChatCompletion.mock.calls[0][0].options.task_type).toBe('essay_transcribe');

    // 标题走原逻辑 (显式 essay_title); prompt 题目槽位为 undefined (不展开)
    // 必须是 undefined 而非 null —— GradeRequestSchema 对 null 不宽容 (真实链路回归点)
    expect(mocks.gradeEssay).toHaveBeenCalledWith(
      expect.objectContaining({
        essay_title: '我的春天',
        essay_requirement: undefined,
      })
    );

    const written = mocks.updateEssayReportResult.mock.calls[0][1];
    expect(written.essay_title).toBeNull(); // COALESCE 保留 pending 行的原值
    expect('title_image_url' in written.meta).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 坏图 (题目图落盘失败)
// ────────────────────────────────────────────────────────────────────────────

describe('runAnalyzeJob() · 题目图非法', () => {
  it('非 base64 → 标 failed 且用 uploadCode, 不触达视觉/批改', async () => {
    // 内容图正常落盘, 题目图落盘抛 uploadCode
    mocks.saveImageFromBase64
      .mockResolvedValueOnce({ url: '/uploads/essay/2026/09/c.jpg', width: 900, height: 1200 })
      .mockRejectedValueOnce(uploadError(ErrorCode.UPLOAD_INVALID_BASE64, 'bad'));

    const out = await runAnalyzeJob(jobOf({ titleImage: 'not-base64!!' }));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_t_1', ErrorCode.UPLOAD_INVALID_BASE64);
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
    // 错误码不含 err.message 细节 (第 11 段)
    const code = mocks.markEssayFailed.mock.calls[0][1];
    expect(String(code)).not.toMatch(/bad|base64 格式/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. 题目图转写失败
// ────────────────────────────────────────────────────────────────────────────

describe('runAnalyzeJob() · 题目图转写失败', () => {
  it('题目转录返回非 JSON → 标 failed(ESSAY_TRANSCRIBE_PARSE_FAILED)', async () => {
    mocks.maasVisionChatCompletion
      .mockResolvedValueOnce({ content: CONTENT_JSON, provider: 'maas' })
      .mockResolvedValueOnce({ content: 'not json', provider: 'maas' });

    const out = await runAnalyzeJob(jobOf({ titleImage: 'TITLE_B64' }));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_t_1', ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED);
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it('题目视觉调用抛错 → 标 failed(ESSAY_LLM_UPSTREAM_ERROR)', async () => {
    mocks.maasVisionChatCompletion
      .mockResolvedValueOnce({ content: CONTENT_JSON, provider: 'maas' })
      .mockRejectedValueOnce(new EssayError(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR, 'upstream'));

    const out = await runAnalyzeJob(jobOf({ titleImage: 'TITLE_B64' }));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_t_1', ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
  });
});
