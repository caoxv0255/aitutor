/* ============================================================================
 * tests/api/essay-analyze.test.js — 作文 analyze 编排 + 路由
 *
 * 覆盖:
 *   1. startAnalyze 参数校验 / 未登录 (同步拒, 不触达 LLM)
 *   2. startAnalyze 立即返回 pending, 且落一条 status='pending' 的行
 *   3. runAnalyzeJob 成功路径 → 写回 completed + 顶层 score = meta.scores.total
 *   4. 批改 Schema 校验失败 → 重试一次 → 成功
 *   5. 两次校验失败 → 该行标 failed (error_message = 错误码, 不含 err.message)
 *   6. MaaS 视觉失败 → 该行标 failed(ESSAY_LLM_UPSTREAM_ERROR)
 *   7. 路由层: 400/503 状态码 + 固定文案 (不把内部 message 回显给客户端)
 *
 * 全 mock 外部依赖 (LLM / 存储 / sharp), 不真调外部服务, 不写 DB。
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';

const mocks = vi.hoisted(() => ({
  insertEssayReport: vi.fn(),
  getEssayReport: vi.fn(),
  updateEssayReportResult: vi.fn(),
  markEssayFailed: vi.fn(),
  reclaimStalePending: vi.fn(),
  gradeEssay: vi.fn(),
  maasVisionChatCompletion: vi.fn(),
  saveImageFromBase64: vi.fn(),
}));

vi.mock('../../api/handlers/essay/essayStorage.js', () => ({
  insertEssayReport: mocks.insertEssayReport,
  getEssayReport: mocks.getEssayReport,
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
  mapGradedToMeta,
  buildReportMeta,
} from '../../api/handlers/essay/analyzeService.js';
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
  mocks.updateEssayReportResult.mockResolvedValue(undefined);
  mocks.markEssayFailed.mockResolvedValue(undefined);
  mocks.reclaimStalePending.mockResolvedValue([]);
});

/** startAnalyze 返回的 pending 行 → 交给 runAnalyzeJob 的 job 描述 */
function jobOf(reportId = 'er_test_1', overrides = {}) {
  return {
    reportId,
    email: 'student@example.com',
    authHeader: 'Bearer test-token',
    image: 'BASE64DATA',
    subject: 'chinese',
    essayTitle: '未命名',
    examLevel: 'zhongkao',
    grade: '初三',
    requestId: 'tid-test',
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.DEV_AUTH_BYPASS;
});

describe('startAnalyze() — 异步入口 (立即返回)', () => {
  it('未登录 → AUTH_NOT_LOGIN (不触达 LLM, 不落库)', async () => {
    const req = mockReq({});
    delete req.user;
    await expect(startAnalyze({ req })).rejects.toMatchObject({ code: ErrorCode.AUTH_NOT_LOGIN });
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
    expect(mocks.insertEssayReport).not.toHaveBeenCalled();
  });

  it('缺 Authorization 头 → AUTH_NOT_LOGIN (后台无头可转发)', async () => {
    const req = mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'junior' });
    delete req.headers.authorization;
    await expect(startAnalyze({ req })).rejects.toMatchObject({ code: ErrorCode.AUTH_NOT_LOGIN });
    expect(mocks.insertEssayReport).not.toHaveBeenCalled();
  });

  it('subject 非法 → VALIDATION_REQUIRED_FIELD (不触达 LLM)', async () => {
    await expect(
      startAnalyze({ req: mockReq({ image: 'BASE64DATA', subject: 'math', grade: 'junior' }) })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
  });

  it('grade 非法 → VALIDATION_REQUIRED_FIELD', async () => {
    await expect(
      startAnalyze({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: '大一' }) })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_REQUIRED_FIELD });
  });

  it('立即返回 200 + status=pending + report_id, 且只落一条 pending 行', async () => {
    const dispatch = vi.fn(); // 掐断后台派发, 单测「同步路径」
    const res = await startAnalyze({
      req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'junior' }),
      dispatch,
    });

    expect(res.status).toBe('pending');
    expect(typeof res.report_id).toBe('string');
    expect(res.report_id.length).toBeGreaterThan(0);
    // junior → zhongkao/初三 的映射仍然在建行时确定
    expect(mocks.insertEssayReport).toHaveBeenCalledTimes(1);
    expect(mocks.insertEssayReport).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending', exam_level: 'zhongkao', grade: '初三', user_email: 'student@example.com',
    }));
    // 同步路径**不**碰重活: 不落盘、不调视觉、不调批改
    expect(mocks.saveImageFromBase64).not.toHaveBeenCalled();
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
    // 后台任务被派发, 且带齐了跑完全程所需的信息 (不含 req 引用)
    expect(dispatch).toHaveBeenCalledTimes(1);
    const job = dispatch.mock.calls[0][0];
    expect(job.reportId).toBe(res.report_id);
    expect(job.authHeader).toBe('Bearer test-token');
    expect(job.examLevel).toBe('zhongkao');
    expect(job.grade).toBe('初三');
    expect(job).not.toHaveProperty('req');
  });

  it('默认派发器会把后台任务真的跑起来 → 行最终变 completed', async () => {
    const res = await startAnalyze({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'junior' }) });
    // 后台是 fire-and-forget; 用轮询等它落地 (mock 全同步 resolve, 通常一两轮微任务)
    for (let i = 0; i < 50 && mocks.updateEssayReportResult.mock.calls.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(mocks.updateEssayReportResult).toHaveBeenCalledWith(res.report_id, expect.objectContaining({
      status: 'completed', score: 62,
    }));
  });

  it('pending 行落库失败 → INTERNAL_ERROR (不返回假的 pending)', async () => {
    mocks.insertEssayReport.mockRejectedValueOnce(new Error('db down'));
    await expect(
      startAnalyze({ req: mockReq({ image: 'BASE64DATA', subject: 'chinese', grade: 'senior' }) })
    ).rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR });
  });
});

describe('runAnalyzeJob() — 后台任务', () => {
  it('成功 → 写回 completed + 顶层 score 与 meta.scores.total 同源', async () => {
    const out = await runAnalyzeJob(jobOf('er_job_1'));

    expect(out.status).toBe('completed');
    expect(mocks.updateEssayReportResult).toHaveBeenCalledTimes(1);
    const [reportId, written] = mocks.updateEssayReportResult.mock.calls[0];
    expect(reportId).toBe('er_job_1');
    expect(written.status).toBe('completed');
    // 遗留 2: 总分同步进顶层 score 列
    expect(written.score).toBe(62);
    expect(written.meta.scores.total).toBe(62);
    expect(written.meta.summary).toBe(GRADED.comment);
    expect(written.transcript.paragraphs[0].lines[0].text).toBe('春天来了。');
    expect(mocks.markEssayFailed).not.toHaveBeenCalled();
  });

  it('base64 会落盘取 URL (复用存储), 并把 base64 交给视觉通路', async () => {
    await runAnalyzeJob(jobOf('er_job_2', { subject: 'chinese', grade: '高三', examLevel: 'gaokao' }));
    expect(mocks.saveImageFromBase64).toHaveBeenCalledWith('BASE64DATA', expect.objectContaining({ purpose: 'essay' }));
    expect(mocks.maasVisionChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ images: [{ base64: 'BASE64DATA' }] })
    );
    // 后台转发给 /api/proxy 的 Authorization 头来自 job.authHeader
    expect(mocks.gradeEssay).toHaveBeenCalledWith(expect.objectContaining({
      req: { headers: { authorization: 'Bearer test-token' } },
    }));
  });

  it('批改校验失败 → 重试一次 → 成功', async () => {
    mocks.gradeEssay
      .mockRejectedValueOnce(new EssayError(ErrorCode.ESSAY_GRADE_PARSE_FAILED, 'AI 输出不符合批改 Schema', { raw_excerpt: 'RAW' }))
      .mockResolvedValueOnce(GRADED);

    const out = await runAnalyzeJob(jobOf('er_job_3'));

    expect(mocks.gradeEssay).toHaveBeenCalledTimes(2);
    expect(out.status).toBe('completed');
    expect(mocks.updateEssayReportResult).toHaveBeenCalledWith('er_job_3', expect.objectContaining({ status: 'completed' }));
  });

  it('两次都失败 → 该行标 failed, error_message 是错误码且不含内部细节', async () => {
    mocks.gradeEssay.mockRejectedValue(
      new EssayError(ErrorCode.ESSAY_GRADE_PARSE_FAILED, 'AI 输出不符合批改 Schema: scores.total 不匹配', { raw_excerpt: 'RAW_INTERNAL' })
    );

    const out = await runAnalyzeJob(jobOf('er_job_4'));

    expect(mocks.gradeEssay).toHaveBeenCalledTimes(2); // 重试一次
    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledTimes(1);
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_job_4', ErrorCode.ESSAY_GRADE_PARSE_FAILED);
    // 绝不把 err.message 写进库 (第 11 段)
    const code = mocks.markEssayFailed.mock.calls[0][1];
    expect(String(code)).not.toMatch(/Schema|scores|total|RAW_INTERNAL/);
    expect(mocks.updateEssayReportResult).not.toHaveBeenCalled();
  });

  it('MaaS 视觉失败 → 标 failed(ESSAY_LLM_UPSTREAM_ERROR), 不触达批改', async () => {
    mocks.maasVisionChatCompletion.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const out = await runAnalyzeJob(jobOf('er_job_5'));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_job_5', ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it('图片非白名单 URL → 标 failed, 不触达视觉', async () => {
    const out = await runAnalyzeJob(jobOf('er_job_6', { image: 'https://evil.example.com/a.jpg' }));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_job_6', ErrorCode.VALIDATION_REQUIRED_FIELD);
    expect(mocks.maasVisionChatCompletion).not.toHaveBeenCalled();
  });

  it('转录解析失败 → 标 failed(ESSAY_TRANSCRIBE_PARSE_FAILED)', async () => {
    mocks.maasVisionChatCompletion.mockResolvedValue({ content: 'not json at all', provider: 'maas' });

    const out = await runAnalyzeJob(jobOf('er_job_7'));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_job_7', ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED);
  });

  it('结果写回失败 → 标 failed(INTERNAL_ERROR) (不留悬空 pending)', async () => {
    mocks.updateEssayReportResult.mockRejectedValueOnce(new Error('db down'));

    const out = await runAnalyzeJob(jobOf('er_job_8'));

    expect(out.status).toBe('failed');
    expect(mocks.markEssayFailed).toHaveBeenCalledWith('er_job_8', ErrorCode.INTERNAL_ERROR);
  });

  it('模型未给 scores → score 写 null (不编造分数)', async () => {
    mocks.gradeEssay.mockResolvedValue({ ...GRADED, scores: undefined });

    await runAnalyzeJob(jobOf('er_job_9'));

    const written = mocks.updateEssayReportResult.mock.calls[0][1];
    expect(written.score).toBeNull();
    expect('scores' in written.meta).toBe(false);
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

  it('analyze 异步化: 后端视觉失败也**不**体现在提交响应 (200 + pending), 由轮询暴露', async () => {
    mocks.maasVisionChatCompletion.mockRejectedValue(new Error('maas down'));
    const { status, body } = await post('/api/essay/analyze', { image: 'BASE64DATA', subject: 'chinese', grade: 'senior' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(typeof body.data.report_id).toBe('string');
    // 内部错误绝不回显 (第 11 段)
    expect(JSON.stringify(body)).not.toMatch(/maas down/);
  });

  it('report 端点: pending 行原样回 pending (不阻塞等完成)', async () => {
    mocks.getEssayReport.mockResolvedValue({
      report_id: 'er_pending_1',
      user_email: 'smoke@example.com',
      status: 'pending',
      meta: { subject: 'chinese', prompt_version: '3.1.0', stage: 'pending' },
      annotations: [],
      transcript: { paragraphs: [] },
      score: null,
    });

    const r = await fetch(`${base}/api/essay/report/er_pending_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.status).toBe('pending');
    expect(body.data.score).toBeNull();
    expect(body.data.report_id).toBe('er_pending_1');
  });

  it('report 端点: completed 行回传顶层 score (与 meta.scores.total 同值)', async () => {
    mocks.getEssayReport.mockResolvedValue({
      report_id: 'er_done_1',
      user_email: 'smoke@example.com',
      status: 'completed',
      score: 62,
      meta: { scores: { content: 17, language: 16, structure: 15, development: 14, total: 62 }, summary: '总评。' },
      annotations: [],
      transcript: { paragraphs: [] },
    });

    const r = await fetch(`${base}/api/essay/report/er_done_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    });
    const body = await r.json();
    expect(body.data.status).toBe('completed');
    expect(body.data.score).toBe(62);
    expect(body.data.meta.scores.total).toBe(62);
  });
});
