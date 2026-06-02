import jwt from 'jsonwebtoken';
import { errorResponse } from './utils/response.js';

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

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(errorResponse('请先登录'));
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json(errorResponse('登录已过期，请重新登录'));
        }
        return res.status(401).json(errorResponse('认证失败，请重新登录'));
    }
}
