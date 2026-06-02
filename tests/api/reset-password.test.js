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

describe('reset-password.js', () => {
  describe('sendResetCodeHandler', () => {
    it('should reject without email', async () => {
      const { sendResetCodeHandler } = await import('../../api/reset-password.js');
      const req = { method: 'POST', body: {} };
      const res = createMockRes();

      await sendResetCodeHandler(req, res);

      expect(res.statusCode).toBe(400);
    });

    it('should reject GET method', async () => {
      const { sendResetCodeHandler } = await import('../../api/reset-password.js');
      const req = { method: 'GET', body: { email: 'test@test.com' } };
      const res = createMockRes();

      await sendResetCodeHandler(req, res);

      expect(res.statusCode).toBe(405);
    });
  });

  describe('handler (reset password)', () => {
    it('should reject without verification code', async () => {
      const { default: handler } = await import('../../api/reset-password.js');
      const req = { method: 'POST', body: { email: 'test@test.com', newPassword: '123456' } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(JSON.stringify(res.body)).toContain('验证码');
    });

    it('should reject without email or password', async () => {
      const { default: handler } = await import('../../api/reset-password.js');
      const req = { method: 'POST', body: { code: '123456' } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
    });

    it('should reject short passwords', async () => {
      const { default: handler } = await import('../../api/reset-password.js');
      const req = { method: 'POST', body: { email: 'test@test.com', newPassword: '123', code: '123456' } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
    });

    it('should reject if no verification code was sent', async () => {
      const { default: handler } = await import('../../api/reset-password.js');
      const req = { method: 'POST', body: { email: 'new@test.com', newPassword: '123456', code: '123456' } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(JSON.stringify(res.body)).toContain('获取验证码');
    });
  });
});
