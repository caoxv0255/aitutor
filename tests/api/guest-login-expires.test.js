// tests/api/guest-login-expires.test.js — 游客登录签发的 token 必须吃 JWT_EXPIRES_IN
//
// 背景 (波次4 债2): api/handlers/guest-login.js 曾把有效期硬编码成 '7d'
//   (jwt.sign(..., { expiresIn: '7d' }))，不吃 JWT_EXPIRES_IN，与全站口径
//   (api/core/auth.js:generateToken) 不一致。本用例直接调用 handler，断言：
//   1) 设了 JWT_EXPIRES_IN 时 token 生命周期跟随该值；
//   2) 未设时回落安全默认 '7d'（604800s），不会是空/undefined。
//
// 全程 mock DB（getDb），不触真库。
// 跑: npx vitest run tests/api/guest-login-expires.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key-with-32-plus-chars!!';
const guestUser = { email: 'guest_existing@aitutor.local', grade: '高中' };
// getDb() 每次返回同一个假 pool；existing-guest 分支只读 SELECT users
const fakePool = { query: vi.fn(async () => ({ rows: [guestUser] })) };

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => fakePool),
}));

import handler from '../../api/handlers/guest-login.js';

const originalSecret = process.env.JWT_SECRET;
const originalExpires = process.env.JWT_EXPIRES_IN;

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  fakePool.query.mockClear();
});

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
  if (originalExpires === undefined) {
    delete process.env.JWT_EXPIRES_IN;
  } else {
    process.env.JWT_EXPIRES_IN = originalExpires;
  }
});

// 命中「已有 guest_id」分支，直接签发 token
async function invokeExistingGuest() {
  const req = { method: 'POST', cookies: { guest_id: 'existing-guest-id' } };
  const res = { json: vi.fn(), setHeader: vi.fn() };
  res.status = vi.fn(() => res);
  await handler(req, res);
  return res;
}

const lifetimeOf = (token) => {
  const decoded = jwt.decode(token);
  return decoded.exp - decoded.iat;
};

describe('guest-login 签发 token 跟随 JWT_EXPIRES_IN', () => {
  it('JWT_EXPIRES_IN=1h 时 exp-iat 为 3600 秒', async () => {
    process.env.JWT_EXPIRES_IN = '1h';
    const res = await invokeExistingGuest();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(lifetimeOf(body.token)).toBe(3600);
  });

  it('JWT_EXPIRES_IN=7d 时 exp-iat 为 604800 秒', async () => {
    process.env.JWT_EXPIRES_IN = '7d';
    const res = await invokeExistingGuest();
    const body = res.json.mock.calls[0][0];
    expect(lifetimeOf(body.token)).toBe(7 * 24 * 3600);
  });

  it('未设置 JWT_EXPIRES_IN 时回落默认 7d（安全默认，非 undefined/空）', async () => {
    delete process.env.JWT_EXPIRES_IN;
    const res = await invokeExistingGuest();
    const decoded = jwt.decode(res.json.mock.calls[0][0].token);
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 3600);
    expect(Number.isFinite(decoded.exp)).toBe(true);
  });
});
