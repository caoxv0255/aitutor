import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';
import { createErrorResponse, ErrorCode } from '../utils/errorCodes.js';
import { AuthError } from '../middleware/errorHandler.js';
import { isPublicRoute } from '../middleware/publicRoutes.js';

const DEFAULT_SECRETS = [
  'your-secret-key-here-please-change-in-production',
  'secret',
  'jwt_secret',
  'change-me',
  'test'
];

export function validateJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ FATAL: JWT_SECRET 环境变量未设置，服务拒绝启动');
    process.exit(1);
    return;
  }
  if (DEFAULT_SECRETS.includes(secret)) {
    console.error('❌ FATAL: JWT_SECRET 使用了默认值，请在生产环境更换为强随机密钥（≥32字符）');
    process.exit(1);
    return;
  }
  if (secret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET 长度不足32字符，建议使用更强的密钥');
  }
}

export function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthError('登录已过期，请重新登录', ErrorCode.AUTH_TOKEN_EXPIRED);
    }
    throw new AuthError('认证失败，请重新登录', ErrorCode.AUTH_INVALID_TOKEN);
  }
}

export function authMiddleware(req, res, next) {
  // P0.6 (2026-08-15): 公开路由白名单放行 (登录/注册/游客/重置密码等预认证端点).
  // 避免全局 authMiddleware 造成"登录本身也需要 JWT"的死锁.
  if (isPublicRoute(req.path)) {
    return next();
  }

  // Dev bypass: ONLY when DEV_AUTH_BYPASS=1 is set explicitly.  This
  // makes test runs and CI use real token verification while still
  // letting developers opt into bypass locally (e.g. for smoke tests
  // without setting up JWT issuance).
  //
  // D067 (2026-08-17): 每次触发时输出警告日志，防止环境变量残留导致
  // 生产环境认证被绕过 (2026-08-17 incident: 旧进程 DEV_AUTH_BYPASS=1
  // 残留 → 所有端点无 token 返回 200).
  if (process.env.DEV_AUTH_BYPASS === '1') {
    console.warn('⚠️  DEV_AUTH_BYPASS=1 — AUTH BYPASS ACTIVE — NOT FOR PRODUCTION');
    req.user = { id: 1, userId: 1, role: 'admin', email: process.env.DEV_USER_EMAIL || 'smoke@example.com', phone: '13800138000', is_dev: true };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('请先登录', ErrorCode.AUTH_NOT_LOGIN));
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.errorCode === ErrorCode.AUTH_TOKEN_EXPIRED) {
      return res.status(401).json(errorResponse('登录已过期，请重新登录', ErrorCode.AUTH_TOKEN_EXPIRED));
    }
    return res.status(401).json(errorResponse('认证失败，请重新登录', ErrorCode.AUTH_INVALID_TOKEN));
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json(errorResponse('权限不足', ErrorCode.AUTH_PERMISSION_DENIED));
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  return requireRole(['admin'])(req, res, next);
}

export function requireTeacher(req, res, next) {
  return requireRole(['teacher', 'admin'])(req, res, next);
}

export function requireStudent(req, res, next) {
  return requireRole(['student', 'teacher', 'admin'])(req, res, next);
}