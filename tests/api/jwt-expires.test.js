import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from '../../api/core/auth.js';
import { ErrorCode } from '../../api/utils/errorCodes.js';

// M-1: JWT_EXPIRES_IN 环境变量应实际生效；未配置时回落 '7d'（与改动前行为一致）。
const TEST_SECRET = 'test-secret-key-with-32-plus-chars!!';

describe('generateToken JWT_EXPIRES_IN', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExpires = process.env.JWT_EXPIRES_IN;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    if (originalExpires === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalExpires;
    }
  });

  const lifetimeOf = (token) => {
    const decoded = jwt.decode(token);
    return decoded.exp - decoded.iat;
  };

  it('JWT_EXPIRES_IN=1h 时 exp-iat 为 3600 秒', () => {
    process.env.JWT_EXPIRES_IN = '1h';
    const token = generateToken({ id: 1, role: 'student' });
    expect(lifetimeOf(token)).toBe(3600);
  });

  it('JWT_EXPIRES_IN=7d 时 exp-iat 为 604800 秒', () => {
    process.env.JWT_EXPIRES_IN = '7d';
    const token = generateToken({ id: 1, role: 'student' });
    expect(lifetimeOf(token)).toBe(7 * 24 * 3600);
  });

  it('未设置 JWT_EXPIRES_IN 时回落默认 7d（与改动前一致）', () => {
    delete process.env.JWT_EXPIRES_IN;
    const token = generateToken({ id: 1, role: 'student' });
    expect(lifetimeOf(token)).toBe(7 * 24 * 3600);
  });

  it('显式传 expiresIn 参数时优先于环境变量（签名兼容）', () => {
    process.env.JWT_EXPIRES_IN = '1h';
    const token = generateToken({ id: 1, role: 'student' }, '30m');
    expect(lifetimeOf(token)).toBe(1800);
  });

  it('过期 token 仍走原有拒绝路径 AUTH_TOKEN_EXPIRED', () => {
    process.env.JWT_EXPIRES_IN = '7d';
    const expired = jwt.sign({ id: 1, role: 'student' }, TEST_SECRET, { expiresIn: '-1s' });
    expect(() => verifyToken(expired)).toThrowError(
      expect.objectContaining({ errorCode: ErrorCode.AUTH_TOKEN_EXPIRED })
    );
  });

  it('非法 token 仍走原有拒绝路径 AUTH_INVALID_TOKEN', () => {
    process.env.JWT_EXPIRES_IN = '7d';
    expect(() => verifyToken('not.a.valid-token')).toThrowError(
      expect.objectContaining({ errorCode: ErrorCode.AUTH_INVALID_TOKEN })
    );
  });

  it('用错误密钥签的 token 被拒绝（验签逻辑未变）', () => {
    process.env.JWT_EXPIRES_IN = '7d';
    const forged = jwt.sign({ id: 1, role: 'admin' }, 'wrong-secret-key-with-32-plus-chars', { expiresIn: '7d' });
    expect(() => verifyToken(forged)).toThrowError(
      expect.objectContaining({ errorCode: ErrorCode.AUTH_INVALID_TOKEN })
    );
  });
});
