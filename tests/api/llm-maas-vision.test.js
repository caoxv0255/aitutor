/* ============================================================================
 * tests/api/llm-maas-vision.test.js — 私有 MaaS 视觉分支 (2026-09-25)
 *
 * 覆盖:
 *   1. resolveMaasConfig: env 优先于 ~/.secrets
 *   2. 成功路径: base64 → image_url content 数组 + response_format json_object
 *   3. qwen3-vl 最小边约束: 8×8 被前置拒绝, 且**不发出**网络请求
 *   4. 上游非 2xx → 抛错
 *
 * 不真调外部服务: 全部 mock global.fetch; 且显式设 env 覆盖本机 ~/.secrets。
 * ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('../../services/aiTrace.js', () => ({
  recordAiTraceAsync: () => {},
  generateTraceId: () => 'trace-test',
}));

import { maasVisionChatCompletion, resolveMaasConfig } from '../../services/llm.js';

/** 生成指定边长的 PNG base64 */
async function pngBase64(size) {
  const buf = await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  return buf.toString('base64');
}

beforeEach(() => {
  process.env.ALIYUN_MAAS_BASE_URL = 'https://maas.test.local/compatible-mode/v1';
  process.env.ALIYUN_MAAS_API_KEY = 'test-maas-key';
});

afterEach(() => {
  delete process.env.ALIYUN_MAAS_BASE_URL;
  delete process.env.ALIYUN_MAAS_API_KEY;
  vi.restoreAllMocks();
});

describe('resolveMaasConfig()', () => {
  it('env 覆盖 ~/.secrets (可轮换)', () => {
    const cfg = resolveMaasConfig();
    expect(cfg.baseUrl).toBe('https://maas.test.local/compatible-mode/v1');
    expect(cfg.apiKey).toBe('test-maas-key');
    expect(cfg.configured).toBe(true);
  });
});

describe('maasVisionChatCompletion()', () => {
  it('成功: 发 base64 image_url + JSON mode, 返回 content', async () => {
    let captured = null;
    global.fetch = vi.fn(async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
          usage: { prompt_tokens: 66, completion_tokens: 5, total_tokens: 71 },
          model: 'qwen3-vl-flash',
        }),
      };
    });

    const res = await maasVisionChatCompletion({
      userText: 'transcribe',
      images: [{ base64: await pngBase64(20) }],
      options: { jsonMode: true, task_type: 'essay_transcribe' },
    });

    expect(res.content).toBe('{"ok":true}');
    expect(res.provider).toBe('maas');
    // 出站 URL / 鉴权
    expect(captured.url).toBe('https://maas.test.local/compatible-mode/v1/chat/completions');
    expect(captured.init.headers.Authorization).toBe('Bearer test-maas-key');
    // content 数组: 文本 + image_url(data URL)
    const content = captured.body.messages.at(-1).content;
    expect(content[0]).toMatchObject({ type: 'text', text: 'transcribe' });
    expect(content[1].type).toBe('image_url');
    expect(content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    // JSON mode
    expect(captured.body.response_format).toEqual({ type: 'json_object' });
    expect(captured.body.model).toBe('qwen3-vl-flash');
  });

  it('最小边约束: 8×8 被前置拒绝, 且不发网络请求', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await expect(
      maasVisionChatCompletion({ userText: 'x', images: [{ base64: await pngBase64(8) }] })
    ).rejects.toThrow(/最小边/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('上游非 2xx → 抛错 (含上游 message, 供日志; 不含凭据)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'unknown model' } }),
    }));

    await expect(
      maasVisionChatCompletion({ userText: 'x', images: [{ base64: await pngBase64(20) }] })
    ).rejects.toThrow(/unknown model/);
  });

  it('无图片 → 抛错', async () => {
    global.fetch = vi.fn();
    await expect(
      maasVisionChatCompletion({ userText: 'x', images: [] })
    ).rejects.toThrow(/至少需要 1 张图片/);
  });
});
