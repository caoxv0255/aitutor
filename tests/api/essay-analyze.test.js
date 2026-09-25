/* ============================================================================
 * tests/api/essay-analyze.test.js — 作文 analyze 编排 + 路由 (2026-09-25)
 *
 * 覆盖:
 *   1. analyzeEssay 参数校验 / 未登录
 *   2. 成功路径 (复用 V1.0 服务; 落库 status=completed)
 *   3. 批改 Schema 校验失败 → 重试一次 → 成功
 *   4. 两次校验失败 → 落 status=failed + 抛**固定文案** (不泄露 err.message)
 *   5. MaaS 视觉失败 → ESSAY_LLM_UPSTREAM_ERROR
 *   6. 路由层: 400/503 状态码 + 固定文案 (不把内部 message 回显给客户端)
 *
 * 全 mock 外部依赖 (LLM / 存储 / sharp), 不真调外部服务, 不写 DB。
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';

const mocks = vi.hoisted(() => ({
  insertEssayReport: vi.fn(),
  getEssayReport: vi.fn(),
  gradeEssay: vi.fn(),
  maasVisionChatCompletion: vi.fn(),
  saveImageFromBase64: vi.fn(),
}));

vi.mock('../../api/handlers/essay/essayStorage.js', () => ({
  insertEssayReport: mocks.insertEssayReport,
  getEssayReport: mocks.getEssayReport,
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

import { analyzeEssay, mapGradedToMeta, buildReportMeta } from '../../api/handlers/essay/analyzeService.js';
import essayReviewRouter from '../../api/routes/essay-review.js';
import { EssayError } from '../../api/handlers/essay/errors.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

const VALID_TRANSCRIBE_JSON = JSON.stringify({
  paragraphs: [{ paragraph_index: 0, lines: [{ line_no: 0, text: '春天来了。', uncertain_chars: [] }] }],
  confidence: 0.9,
  uncertain_total: 0,
});

const GRADED = {
  report_id: 'er_test_1',
  annotations: [{ id: 'a1', type: 'highlight', paragraph_index: 0, start: 0, end: 5, original: '春天来了。', comment: '好' }],
  scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
  comment: '不错',
  rubric_id: 'chinese_gaokao_v1',
  meta: { model: 'qwen-plus', anchor_metrics: { raw_count: 1, anchor_success_count: 1, anchor_rate: 1, final_valid_count: 1 } },
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maasVisionChatCompletion.mockResolvedValue({ content: VALID_TRANSCRIBE_JSON, provider: 'maas' });
  mocks.saveImageFromBase64.mockResolvedValue({ url: '/uploads/essay/2026/09/abc.jpg', width: 20, height: 20 });
  mocks.gradeEssay.mockResolvedValue(GRADED);
  mocks.insertEssayReport.mockResolvedValue('er_test_1');
});

afterEach(() => {
  delete process.env.DEV_AUTH_BYPASS;
});

describe('analyzeEssay()', () => {
  it('未登录 → AUTH_NOT_LOGIN', async () => {
    const req = mockReq({});
    delete req.user;
    await expect(analyzeEssay({ req })).rejects.toMatchObject({ code: ErrorCode.AUTH_NOT_LOGIN });
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
  });

  it('subject 非法 → VALIDATION_REQUIRED_FIELD (不触达 LLM)', async () => {
    await expect(
      analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'math', grade: 'junior' }) })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
  });

  it('grade 非法 → VALIDATION_REQUIRED_FIELD', async () => {
    await expect(
      analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: '大一' }) })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
  });

  it('成功: junior 映射 zhongkao + 落库 completed + 返回报告', async () => {
    const res = await analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'junior' }) });

    expect(res.report_id).toBe('er_test_1');
    expect(res.image_url).toBe('/uploads/essay/2026/09/abc.jpg');
    expect(res.transcript.paragraphs[0].lines[0].text).toBe('春天来了。');
    // grade 参数: junior → zhongkao/初三
    expect(mocks.gradeEssay).toHaveBeenCalledWith(expect.objectContaining({ exam_level: 'zhongkao', grade: '初三' }));
    expect(mocks.insertEssayReport).toHaveBeenCalledWith(expect.objectContaining({
      report_id: 'er_test_1', status: 'completed', exam_level: 'zhongkao', grade: '初三',
    }));
    // 落库 meta 必须带上 scores(对象, 对齐 V0) + summary(comment 映射, 对齐 V0)
    const stored = mocks.insertEssayReport.mock.calls[0][0];
    expect(stored.meta.scores).toEqual(GRADED.scores);
    expect(stored.meta.scores.total).toBe(62);
    expect(stored.meta.summary).toBe(GRADED.comment);
    expect(stored.meta.image_url).toBe('/uploads/essay/2026/09/abc.jpg');
    expect(stored.meta.subject).toBe('chinese');
  });

  it('base64 会落盘取 URL (复用存储), 并把 base64 交给视觉通路', async () => {
    await analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'senior' }) });
    expect(mocks.saveImageFromBase64).toHaveBeenCalledWith('BASE64DATA', expect.objectContaining({ purpose: 'essay' }));
    expect(mocks.maasVisionChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ images: [{ base64: 'BASE64DATA' }] })
    );
  });

  it('批改校验失败 → 重试一次 → 成功', async () => {
    mocks.gradeEssay
      .mockRejectedValueOnce(new EssayError(ErrorCode.ESSAY_GRADE_PARSE_FAILED, 'AI 输出不符合批改 Schema', { raw_excerpt: 'RAW' }))
      .mockResolvedValueOnce(GRADED);

    const res = await analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'senior' }) });

    expect(mocks.gradeEssay).toHaveBeenCalledTimes(2);
    expect(res.report_id).toBe('er_test_1');
    expect(mocks.insertEssayReport).toHaveBeenCalledTimes(1);
    expect(mocks.insertEssayReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('两次都失败 → 落 failed 报告 + 抛固定文案 (不回显 err.message)', async () => {
    mocks.gradeEssay.mockRejectedValue(
      new EssayError(ErrorCode.ESSAY_GRADE_PARSE_FAILED, 'AI 输出不符合批改 Schema: scores.total 不匹配', { raw_excerpt: 'RAW_INTERNAL' })
    );

    let thrown = null;
    try {
      await analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'senior' }) });
    } catch (e) {
      thrown = e;
    }

    expect(mocks.gradeEssay).toHaveBeenCalledTimes(2); // 重试一次
    expect(thrown).toBeInstanceOf(EssayError);
    expect(thrown.code).toBe(ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    // 固定对外文案, 不含内部细节
    expect(thrown.message).toBe('AI 老师暂时无法完成这次批改，请稍后重试');
    expect(thrown.message).not.toMatch(/Schema|scores|total/);
    expect(thrown.details).toBeNull();
    // failed 报告落库
    expect(mocks.insertEssayReport).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', error_message: 'grading_validation_failed',
    }));
  });

  it('MaaS 视觉失败 → ESSAY_LLM_UPSTREAM_ERROR (不触达批改)', async () => {
    mocks.maasVisionChatCompletion.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(
      analyzeEssay({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'senior' }) })
    ).rejects.toMatchObject({ code: ErrorCode.ESSAY_LLM_UPSTREAM_ERROR });
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// meta 映射 (增量兼容 V0 —— 缺口的直接回归)
// ────────────────────────────────────────────────────────────────────────────

describe('mapGradedToMeta()', () => {
  it('scores(对象) → meta.scores; comment → meta.summary (键名对齐 V0)', () => {
    const meta = mapGradedToMeta({
      scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
      comment: '立意清晰, 结构完整。',
    });
    expect(meta.scores).toEqual({ content: 17, language: 16, structure: 15, development: 14, total: 62 });
    expect(meta.scores.total).toBe(62);
    expect(meta.summary).toBe('立意清晰, 结构完整。');
    expect(Object.keys(meta).sort()).toEqual(['scores', 'summary']); // 不夹带其它键
  });

  it('模型未给 scores / comment → 不写占位 (空对象)', () => {
    expect(mapGradedToMeta({})).toEqual({});
    expect(mapGradedToMeta({ scores: null, comment: null })).toEqual({});
    expect(mapGradedToMeta({ scores: undefined, comment: undefined })).toEqual({});
  });

  it('comment 为空白字符串 → 不写 summary (不造占位总评)', () => {
    const meta = mapGradedToMeta({ scores: { total: 0 }, comment: '   ' });
    expect(meta.summary).toBeUndefined();
    expect('summary' in meta).toBe(false);
  });

  it('非法 graded (null/非对象 scores) → 安全降级', () => {
    expect(mapGradedToMeta(null)).toEqual({});
    expect(mapGradedToMeta({ scores: 'not-an-object', comment: 'hi' })).toEqual({ summary: 'hi' });
  });
});

describe('buildReportMeta()', () => {
  it('保留 Stage B meta, 并叠加 V0 兼容 scores/summary + image/subject/prompt_version', () => {
    const meta = buildReportMeta(
      {
        scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
        comment: '总评。',
        meta: { model: 'qwen-plus', anchor_metrics: { raw_count: 1, anchor_success_count: 1, anchor_rate: 1, final_valid_count: 1 } },
      },
      { imageUrl: '/uploads/essay/a.jpg', subject: 'chinese' }
    );
    expect(meta.scores.total).toBe(62);
    expect(meta.summary).toBe('总评。');
    expect(meta.model).toBe('qwen-plus');
    expect(meta.anchor_metrics.anchor_rate).toBe(1);
    expect(meta.image_url).toBe('/uploads/essay/a.jpg');
    expect(meta.subject).toBe('chinese');
    expect(meta.prompt_version).toBe('3.1.0');
  });

  it('模型未给字段时 meta 不含 scores/summary (保持缺失)', () => {
    const meta = buildReportMeta({ meta: { model: 'qwen-plus' } }, { imageUrl: null, subject: 'english' });
    expect('scores' in meta).toBe(false);
    expect('summary' in meta).toBe(false);
    expect(meta.image_url).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 缺口回归: 落库 meta 经报告端点回读后, 总分/总评都能取到 (形状验证)
// ────────────────────────────────────────────────────────────────────────────
describe('essay report 回读总分/总评 (mock 存储, 形状验证)', () => {
  let server;
  let base;

  beforeEach(async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/essay', essayReviewRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it('报告行 meta 含 scores.total + summary → 接口原样返回 (V0 与批次 3 同形状)', async () => {
    mocks.getEssayReport.mockResolvedValue({
      report_id: 'er_mapped_1',
      user_email: 'smoke@example.com',
      essay_title: '春天',
      meta: {
        image_url: '/uploads/essay/x.jpg',
        subject: 'chinese',
        scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 },
        summary: '总评文字。',
      },
      annotations: [],
      transcript: { paragraphs: [] },
    });

    const r = await fetch(`${base}/api/essay/report/er_mapped_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    // successJson: data = 行对象; 批次 3 resolveScore/resolveComment 与 V0 均从此取
    expect(body.data.meta.scores.total).toBe(62);
    expect(body.data.meta.summary).toBe('总评文字。');
    expect(body.data.image_url).toBe('/uploads/essay/x.jpg');
  });

  it('老数据 meta 无 scores/summary → 接口照常返回, 键保持缺失 (供前端如实标注)', async () => {
    mocks.getEssayReport.mockResolvedValue({
      report_id: 'er_legacy_1',
      user_email: 'smoke@example.com',
      essay_title: '旧作文',
      meta: { image_url: null },
      annotations: [],
      transcript: { paragraphs: [] },
    });

    const r = await fetch(`${base}/api/essay/report/er_legacy_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.meta.scores).toBeUndefined();
    expect(body.data.meta.summary).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 路由层: 状态码 + 固定文案 (端到端, express + 真实 authMiddleware)
// ────────────────────────────────────────────────────────────────────────────

describe('essay-review router (HTTP)', () => {
  let server;
  let base;

  beforeEach(async () => {
    process.env.DEV_AUTH_BYPASS = '1'; // authMiddleware 放行 (测试专用)
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/essay', essayReviewRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  async function post(path, body) {
    const r = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // analyze 会把该 JWT 转发给 /api/proxy 做 Stage B, 因此必须带 Authorization
        // (DEV_AUTH_BYPASS 下 authMiddleware 不再校验其内容, 但 header 需存在)
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }

  it('analyze 参数非法 → 400 + 固定文案 (不泄露内部校验细节)', async () => {
    const { status, body } = await post('/api/essay/analyze', { image: 'x', subject: 'math', grade: 'junior' });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
    expect(JSON.stringify(body)).not.toMatch(/请求参数校验失败|zod_issues/);
  });

  it('analyze 视觉失败 → 503 + 固定文案', async () => {
    mocks.maasVisionChatCompletion.mockRejectedValue(new Error('maas down'));
    const { status, body } = await post('/api/essay/analyze', { image: 'BASE64DATA', subject: 'chinese', grade: 'senior' });
    expect(status).toBe(503);
    expect(body.errorCode).toBe(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
    expect(JSON.stringify(body)).not.toMatch(/maas down/);
  });
});
