import jwt from 'jsonwebtoken';
import { createErrorResponse, ErrorCode } from '../utils/errorCodes.js';
import { AuthError } from '../middleware/errorHandler.js';

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
  // Dev bypass: NODE_ENV !== 'production' 且带 x-dev-bypass: 1 header → 跳过 verify
  // (production 模式强制走 JWT verify, header 无效)
  if (process.env.NODE_ENV !== 'production' && req.headers['x-dev-bypass'] === '1') {
    req.user = { id: 1, userId: 1, role: 'admin', phone: '13800138000', is_dev: true };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(createErrorResponse(ErrorCode.AUTH_NOT_LOGIN));
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.errorCode === ErrorCode.AUTH_TOKEN_EXPIRED) {
      return res.status(401).json(createErrorResponse(ErrorCode.AUTH_TOKEN_EXPIRED));
    }
    return res.status(401).json(createErrorResponse(ErrorCode.AUTH_INVALID_TOKEN));
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json(createErrorResponse(ErrorCode.AUTH_PERMISSION_DENIED));
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