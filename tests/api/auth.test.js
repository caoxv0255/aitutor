import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, validateJWTSecret } from '../../api/core/auth.js';

describe('auth.js', () => {
  describe('validateJWTSecret', () => {
    const originalEnv = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.JWT_SECRET = originalEnv;
    });

    it('should exit if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

      validateJWTSecret();

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
      mockError.mockRestore();
    });

    it('should exit if JWT_SECRET is a default value', () => {
      process.env.JWT_SECRET = 'your-secret-key-here-please-change-in-production';
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

      validateJWTSecret();

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
      mockError.mockRestore();
    });

    it('should warn if JWT_SECRET is shorter than 32 chars but not exit', () => {
      process.env.JWT_SECRET = 'short-key-29-chars-long-xxxxx';
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateJWTSecret();

      expect(mockWarn).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
      mockExit.mockRestore();
      mockWarn.mockRestore();
    });

    it('should pass with a strong JWT_SECRET', () => {
      process.env.JWT_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      validateJWTSecret();

      expect(mockExit).not.toHaveBeenCalled();
      mockExit.mockRestore();
    });
  });

  describe('authMiddleware', () => {
    const originalSecret = process.env.JWT_SECRET;
    beforeEach(() => {
      process.env.JWT_SECRET = 'a-very-long-and-secure-random-secret-key-for-jwt-2026';
    });
    afterEach(() => {
      process.env.JWT_SECRET = originalSecret;
    });

    it('should reject requests without Authorization header', () => {
      const req = { headers: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid token', () => {
      const token = jwt.sign({ email: 'test@test.com' }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.email).toBe('test@test.com');
    });

    it('should reject expired tokens with specific message', () => {
      const token = jwt.sign({ email: 'test@test.com' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('过期') }));
    });
  });
});
