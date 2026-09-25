/* ============================================================================
 * tests/api/essay-annotations-ext.test.js — 批次 2 · annotations 契约扩展
 *
 * 锁死 4 个**向后兼容**新键: revised_text / severity / knowledge_points / bbox
 *   1. Zod Schema: 合法 / 缺失 / 枚举越界 / bbox 越界
 *   2. reconcile 透传: 有键带出、无键不新增 (老数据输出逐字节不变)
 *   3. gradeEssay 端到端 (mock LLM): 键透传、旧结构仍成功、越界 bbox 被丢弃
 *   4. prompt: 新字段说明 + 版本号已进 system 消息
 *
 * 全 mock 外部依赖 (fetch / logger), 不真调 LLM, 不读 DB。
 * ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('../../api/core/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import {
  gradeEssay,
  BboxSchema,
  SeveritySchema,
  AnnotationSchema,
  sanitizeExtensionFields,
} from '../../api/handlers/essay/gradeService.js';
import { reconcile, pickExtensionKeys } from '../../api/handlers/essay/essayReconcile.js';

// ────────────────────────────────────────────────────────────────────────────
// fixtures
// ────────────────────────────────────────────────────────────────────────────

const TRANSCRIPT = {
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
      lines: [{ line_no: 0, text: '小明在田野上奔跑。', uncertain_chars: [] }],
    },
  ],
  confidence: 0.92,
  uncertain_total: 0,
};

function mockReq() {
  return { headers: { authorization: 'Bearer test-token' } };
}

function proxyOk(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { choices: [{ message: { role: 'assistant', content } }] },
    }),
  };
}

function captureProxy(content) {
  const calls = [];
  const fn = vi.fn(async (url, opts = {}) => {
    calls.push({ url, body: JSON.parse(opts.body || '{}') });
    return proxyOk(content);
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

const BASE_SCORES = { content: 17, language: 16, structure: 15, development: 14, total: 62 };

function gradeOutput(annotations) {
  return JSON.stringify({
    annotations,
    scores: BASE_SCORES,
    comment: '本文以春天为背景，画面感强，但中段略空，建议增加细节描写。',
    rubric_id: 'chinese_gaokao_v1',
    meta: {
      model: 'qwen-plus',
      anchor_metrics: { raw_count: annotations.length, anchor_success_count: 3, anchor_rate: 1, final_valid_count: 3 },
      prompt_version: '3.1.0',
    },
  });
}

async function runGrade(content) {
  captureProxy(content);
  return gradeEssay({
    user_email: 'a@test.com',
    transcript: TRANSCRIPT,
    essay_title: '春天来了',
    exam_level: 'gaokao',
    grade: '高三',
    subject: 'chinese',
    request_token: 'tx_test_token_0001',
    req: mockReq(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Zod Schema
// ────────────────────────────────────────────────────────────────────────────

describe('批次2 · 新键 Zod 校验', () => {
  it('BboxSchema: 合法 0-1000 通过', () => {
    expect(BboxSchema.safeParse({ x: 0, y: 0, w: 1000, h: 1000 }).success).toBe(true);
    expect(BboxSchema.safeParse({ x: 56, y: 114, w: 520, h: 202 }).success).toBe(true);
  });

  it('BboxSchema: 分量越界 (>1000 / 负数 / 非整数) 拒绝', () => {
    expect(BboxSchema.safeParse({ x: 1001, y: 0, w: 10, h: 10 }).success).toBe(false);
    expect(BboxSchema.safeParse({ x: -1, y: 0, w: 10, h: 10 }).success).toBe(false);
    expect(BboxSchema.safeParse({ x: 0, y: 0, w: 10.5, h: 10 }).success).toBe(false);
  });

  it('BboxSchema: x+w / y+h 越界拒绝', () => {
    expect(BboxSchema.safeParse({ x: 900, y: 0, w: 200, h: 10 }).success).toBe(false);
    expect(BboxSchema.safeParse({ x: 0, y: 900, w: 10, h: 200 }).success).toBe(false);
  });

  it('BboxSchema: 缺字段 / 多字段拒绝', () => {
    expect(BboxSchema.safeParse({ x: 0, y: 0, w: 10 }).success).toBe(false);
  });

  it('SeveritySchema: minor/moderate/major 通过, 越界拒绝', () => {
    expect(SeveritySchema.safeParse('minor').success).toBe(true);
    expect(SeveritySchema.safeParse('moderate').success).toBe(true);
    expect(SeveritySchema.safeParse('major').success).toBe(true);
    expect(SeveritySchema.safeParse('high').success).toBe(false);
    expect(SeveritySchema.safeParse('MAJOR').success).toBe(false);
  });

  it('AnnotationSchema: 含 4 个新键的合法批注通过', () => {
    const r = AnnotationSchema.safeParse({
      type: 'highlight',
      anchor: { paragraph_index: 0, quote: '春天来了' },
      comment: '好句',
      revised_text: '春天悄然来临',
      severity: 'minor',
      knowledge_points: ['修辞'],
      bbox: { x: 10, y: 20, w: 100, h: 40 },
    });
    expect(r.success).toBe(true);
    expect(r.data.bbox).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });

  it('AnnotationSchema: 缺 4 个新键仍通过 (向后兼容)', () => {
    const r = AnnotationSchema.safeParse({
      type: 'highlight',
      anchor: { paragraph_index: 0, quote: '春天来了' },
      comment: '好句',
    });
    expect(r.success).toBe(true);
    // 缺省时不得凭空生出新键 (增量语义)
    expect(r.data.revised_text).toBeUndefined();
    expect(r.data.severity).toBeUndefined();
    expect(r.data.knowledge_points).toBeUndefined();
    expect(r.data.bbox).toBeUndefined();
  });

  it('AnnotationSchema: severity 枚举越界拒绝', () => {
    const r = AnnotationSchema.safeParse({
      type: 'highlight',
      anchor: { paragraph_index: 0, quote: '春天来了' },
      comment: '好句',
      severity: 'critical',
    });
    expect(r.success).toBe(false);
  });

  it('sanitizeExtensionFields: 剔除非法项, 保留合法项', () => {
    const parsed = {
      annotations: [
        {
          type: 'grammar_error',
          anchor: { paragraph_index: 0, quote: '春天来了' },
          comment: '搭配不当',
          severity: 'critical', // 越界 → 剔除
          bbox: { x: 900, y: 0, w: 500, h: 10 }, // 越界 → 剔除
          revised_text: '春天到了',
          knowledge_points: ['搭配'],
        },
      ],
    };
    const out = sanitizeExtensionFields(parsed);
    const a = out.annotations[0];
    expect(a.severity).toBeUndefined();
    expect(a.bbox).toBeUndefined();
    expect(a.revised_text).toBe('春天到了');
    expect(a.knowledge_points).toEqual(['搭配']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. reconcile 透传
// ────────────────────────────────────────────────────────────────────────────

describe('批次2 · reconcile 透传扩展键', () => {
  it('有扩展键 → 原样带到 resolved[]', () => {
    const { resolved } = reconcile(TRANSCRIPT.paragraphs, [
      {
        id: 'a1',
        type: 'highlight',
        anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。' },
        comment: '好句',
        revised_text: '',
        severity: 'minor',
        knowledge_points: ['比喻'],
        bbox: { x: 10, y: 20, w: 100, h: 40 },
      },
    ]);
    expect(resolved[0].anchor_failed).toBe(false);
    expect(resolved[0].revised_text).toBe('');
    expect(resolved[0].severity).toBe('minor');
    expect(resolved[0].knowledge_points).toEqual(['比喻']);
    expect(resolved[0].bbox).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });

  it('锚定失败时扩展键也保留 (降级不丢信息)', () => {
    const { resolved } = reconcile(TRANSCRIPT.paragraphs, [
      {
        id: 'a1',
        type: 'grammar_error',
        anchor: { paragraph_index: 9, quote: '不存在的句子' },
        comment: '越界',
        severity: 'major',
        bbox: { x: 1, y: 2, w: 3, h: 4 },
      },
    ]);
    expect(resolved[0].anchor_failed).toBe(true);
    expect(resolved[0].severity).toBe('major');
    expect(resolved[0].bbox).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('无扩展键 → resolved 不新增这些键 (旧输出逐字节兼容)', () => {
    const { resolved } = reconcile(TRANSCRIPT.paragraphs, [
      { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了' }, comment: '好句' },
    ]);
    for (const k of ['revised_text', 'severity', 'knowledge_points', 'bbox']) {
      expect(Object.prototype.hasOwnProperty.call(resolved[0], k)).toBe(false);
    }
    // 既有字段完好
    expect(resolved[0].quote).toBe('春天来了');
    expect(resolved[0].type).toBe('highlight');
    expect(resolved[0].comment).toBe('好句');
  });

  it('pickExtensionKeys: 只复制存在的键', () => {
    expect(pickExtensionKeys({ severity: 'minor' })).toEqual({ severity: 'minor' });
    expect(pickExtensionKeys({ bbox: undefined, severity: 'minor' })).toEqual({ severity: 'minor' });
    expect(pickExtensionKeys(null)).toEqual({});
    expect(pickExtensionKeys({ foo: 1 })).toEqual({});
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. gradeEssay 端到端 (mock LLM)
// ────────────────────────────────────────────────────────────────────────────

describe('批次2 · gradeEssay 端到端', () => {
  it('模型返回 4 键 → 透传到 resolved annotations', async () => {
    const out = await runGrade(
      gradeOutput([
        {
          id: 'a1',
          type: 'highlight',
          anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。', line_no: 0 },
          comment: '好句',
          revised_text: '',
          severity: 'minor',
          knowledge_points: ['比喻'],
          bbox: { x: 10, y: 20, w: 100, h: 40 },
        },
        {
          id: 'a2',
          type: 'masterstroke',
          anchor: { paragraph_index: 0, quote: '大地披上了绿装', line_no: 1 },
          comment: '点睛',
          revised_text: '大地换上了绿装',
          severity: 'moderate',
          knowledge_points: ['拟人'],
          bbox: { x: 10, y: 100, w: 120, h: 40 },
        },
        {
          id: 'a3',
          type: 'grammar_error',
          anchor: { paragraph_index: 1, quote: '小明在田野上奔跑。', line_no: 0 },
          comment: '语病',
          revised_text: '小明在田野上奔跑',
          severity: 'major',
          knowledge_points: [],
          bbox: { x: 10, y: 200, w: 150, h: 40 },
        },
      ])
    );

    expect(out.annotations).toHaveLength(3);
    const a1 = out.annotations.find((a) => a.type === 'highlight');
    expect(a1.bbox).toEqual({ x: 10, y: 20, w: 100, h: 40 });
    expect(a1.severity).toBe('minor');
    expect(a1.knowledge_points).toEqual(['比喻']);
    expect(a1.revised_text).toBe('');
    const a3 = out.annotations.find((a) => a.type === 'grammar_error');
    expect(a3.severity).toBe('major');
    expect(a3.knowledge_points).toEqual([]);
  });

  it('模型返回旧结构 (无新键) → 仍成功且输出不含新键', async () => {
    const out = await runGrade(
      gradeOutput([
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。' }, comment: '好句' },
        { id: 'a2', type: 'masterstroke', anchor: { paragraph_index: 0, quote: '大地披上了绿装' }, comment: '点睛' },
        {
          id: 'a3',
          type: 'grammar_error',
          anchor: { paragraph_index: 1, quote: '小明在田野上奔跑。' },
          comment: '语病',
        },
      ])
    );
    expect(out.annotations).toHaveLength(3);
    for (const a of out.annotations) {
      expect(Object.prototype.hasOwnProperty.call(a, 'bbox')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(a, 'severity')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(a, 'knowledge_points')).toBe(false);
      expect(a.quote).toBeTruthy();
      expect(a.type).toBeTruthy();
    }
  });

  it('bbox 越界 → 只丢弃 bbox, severity 保留, 批改仍成功', async () => {
    const out = await runGrade(
      gradeOutput([
        {
          id: 'a1',
          type: 'highlight',
          anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。' },
          comment: '好句',
          severity: 'minor',
          bbox: { x: 900, y: 0, w: 500, h: 10 }, // x+w=1400 越界
        },
        {
          id: 'a2',
          type: 'masterstroke',
          anchor: { paragraph_index: 0, quote: '大地披上了绿装' },
          comment: '点睛',
          bbox: { x: 0, y: 0, w: 10, h: 10 },
        },
        {
          id: 'a3',
          type: 'grammar_error',
          anchor: { paragraph_index: 1, quote: '小明在田野上奔跑。' },
          comment: '语病',
        },
      ])
    );
    const a1 = out.annotations.find((a) => a.type === 'highlight');
    expect(a1.bbox).toBeUndefined();
    expect(a1.severity).toBe('minor'); // 合法键不受牵连
    expect(out.scores.total).toBe(62);
  });

  it('system prompt 携带新字段说明与 3.1.0 版本号', async () => {
    const { calls } = captureProxy(
      gradeOutput([
        { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。' }, comment: '好句' },
        { id: 'a2', type: 'masterstroke', anchor: { paragraph_index: 0, quote: '大地披上了绿装' }, comment: '点睛' },
        {
          id: 'a3',
          type: 'grammar_error',
          anchor: { paragraph_index: 1, quote: '小明在田野上奔跑。' },
          comment: '语病',
        },
      ])
    );
    await gradeEssay({
      user_email: 'a@test.com',
      transcript: TRANSCRIPT,
      essay_title: '春天来了',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: 'tx_test_token_0001',
      req: mockReq(),
    });
    const systemText = calls[0].body.messages[0].content[0].text;
    expect(systemText).toMatch(/bbox/);
    expect(systemText).toMatch(/severity/);
    expect(systemText).toMatch(/knowledge_points/);
    expect(systemText).toMatch(/3\.1\.0/);
    expect(systemText).toMatch(/change_type/);
  });
});
