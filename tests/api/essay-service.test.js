/* ============================================================================
 * tests/api/essay-service.test.js — essayService 单测
 * ============================================================================ */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../api/core/logger.js', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}));

import { parseLLMJsonOutput, extractParagraphs, _internalLLMCall } from '../../api/handlers/essay/essayService.js';

describe('parseLLMJsonOutput()', () => {
  it('标准 JSON 字符串', () => {
    const out = parseLLMJsonOutput('{"clue":[{"original":"好句","comment":"好"}]}');
    expect(out.clue).toHaveLength(1);
    expect(out.clue[0].original).toBe('好句');
  });

  it('markdown 包裹的 JSON', () => {
    const md = '```json\n{"clue":[{"original":"x","comment":"y"}]}\n```';
    const out = parseLLMJsonOutput(md);
    expect(out.clue[0].original).toBe('x');
  });

  it('自由文本 + JSON 混合', () => {
    const noisy = '模型认为：{"clue":[{"original":"好","comment":"棒"}]}，完毕。';
    const out = parseLLMJsonOutput(noisy);
    expect(out.clue).toHaveLength(1);
    expect(out.clue[0].comment).toBe('棒');
  });

  it('中文标点容错（，→,）', () => {
    const cn = '{"clue":[{"original":"a"，"comment":"b"}]}';
    const out = parseLLMJsonOutput(cn);
    expect(out.clue[0].original).toBe('a');
    expect(out.clue[0].comment).toBe('b');
  });

  it('空 / null / 非字符串', () => {
    expect(parseLLMJsonOutput('')).toBeNull();
    expect(parseLLMJsonOutput(null)).toBeNull();
    expect(parseLLMJsonOutput(undefined)).toBeNull();
    expect(parseLLMJsonOutput(123)).toBeNull();
  });

  it('无 JSON 对象', () => {
    expect(parseLLMJsonOutput('hello world')).toBeNull();
    expect(parseLLMJsonOutput('{"unclosed')).toBeNull();
  });
});

describe('extractParagraphs()', () => {
  it('从 LLM content 抽取段落', () => {
    const content = '春天来了。万物复苏。小明在草地上。';
    const ps = extractParagraphs({ metadata: { scores: {} } }, content);
    expect(ps.length).toBeGreaterThanOrEqual(3);
    expect(ps[0].id).toBe('p1');
  });

  it('空 content fallback 1 段', () => {
    const ps = extractParagraphs({}, '');
    expect(ps).toHaveLength(1);
    expect(ps[0].id).toBe('p1');
  });
});

// 2026-09-22 全仓安全扫描 F1–F3: 内部自调用地址曾取自 req 的 Host 头 (SSRF),
// 这里用"恶意 Host"做行为断言 —— 静态闸门只能看形状, 这条保证真实调用地址不受请求头影响。
describe('_internalLLMCall() — 内部自调用地址不受请求头影响 (SSRF)', () => {
  it('伪造 Host + protocol 时, 仍然只请求 127.0.0.1:$PORT/api/proxy', async () => {
    const urls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        urls.push(url);
        return { ok: true, json: async () => ({ data: { model: 'qwen-vl-plus' } }) };
      })
    );
    try {
      await _internalLLMCall({
        images: ['http://127.0.0.1:3002/uploads/a.jpg'],
        essay_title: '春天来了',
        exam_level: 'gaokao',
        grade: '高三',
        req: {
          protocol: 'https',
          get: (k) => (k === 'host' ? 'evil.example.com' : undefined),
          headers: { authorization: 'Bearer test-token' },
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/proxy$/);
    expect(urls[0]).not.toContain('evil.example.com');
  });
});
