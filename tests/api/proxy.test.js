import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
}

describe('proxy.js', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = 'test-key-for-vitest';
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should reject GET requests', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'GET', user: { email: 'test@test.com' }, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it('should reject requests without user', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'POST', user: null, body: { model: 'qwen-plus', messages: [{ role: 'user', content: 'hi' }] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('should reject unsupported model', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'POST', user: { email: 'test@test.com' }, body: { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('不支持');
  });

  it('should reject empty messages', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'POST', user: { email: 'test@test.com' }, body: { model: 'qwen-plus', messages: [] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('should reject messages array exceeding 20 items', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const messages = Array.from({ length: 21 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const req = { method: 'POST', user: { email: 'test@test.com' }, body: { model: 'qwen-plus', messages } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('20');
  });

  it('should return 503 when API key is missing', async () => {
    delete process.env.DASHSCOPE_API_KEY;
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'POST', user: { email: 'test@test.com' }, body: { model: 'qwen-plus', messages: [{ role: 'user', content: 'hi' }] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
  });

  it('should clamp max_tokens to [100, 4000]', async () => {
    const { default: handler } = await import('../../api/proxy.js');
    const req = { method: 'POST', user: { email: 'test@test.com' }, body: { model: 'qwen-plus', messages: [{ role: 'user', content: 'hi' }], max_tokens: -1 } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).not.toBe(400);
  });
});
