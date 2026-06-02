import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import { errorResponse, successResponse } from './utils/response.js';

const verificationCodes = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const CODE_RATE_LIMIT_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendResetCodeHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json(errorResponse('请填写邮箱'));
  }

  const db = await getDb();
  const rows = await db.all('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    return res.status(404).json(errorResponse('该邮箱未注册'));
  }

  const existing = verificationCodes.get(email);
  if (existing && Date.now() - existing.sentAt < CODE_RATE_LIMIT_MS) {
    const waitSec = Math.ceil((CODE_RATE_LIMIT_MS - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json(errorResponse(`请求过于频繁，请${waitSec}秒后重试`));
  }

  const code = generateCode();
  verificationCodes.set(email, {
    code,
    sentAt: Date.now(),
    attempts: 0
  });

  console.log(`[ResetPassword] 验证码已生成: email=${email} code=${code}`);
  console.log(`[ResetPassword] 生产环境应通过邮件发送验证码，当前为开发模式直接输出到日志`);

  return res.json(successResponse(null, '验证码已发送到您的邮箱（开发模式请查看服务端日志）'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { email, newPassword, code } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json(errorResponse('请填写邮箱和新密码'));
  }

  if (newPassword.length < 6) {
    return res.status(400).json(errorResponse('密码至少需要6位'));
  }

  if (!code) {
    return res.status(400).json(errorResponse('请填写验证码'));
  }

  const stored = verificationCodes.get(email);
  if (!stored) {
    return res.status(403).json(errorResponse('请先获取验证码'));
  }

  if (Date.now() - stored.sentAt > CODE_EXPIRE_MS) {
    verificationCodes.delete(email);
    return res.status(403).json(errorResponse('验证码已过期，请重新获取'));
  }

  stored.attempts++;
  if (stored.attempts > MAX_VERIFY_ATTEMPTS) {
    verificationCodes.delete(email);
    return res.status(403).json(errorResponse('验证码错误次数过多，请重新获取'));
  }

  if (stored.code !== String(code)) {
    return res.status(403).json(errorResponse(`验证码错误，还剩${MAX_VERIFY_ATTEMPTS - stored.attempts}次机会`));
  }

  verificationCodes.delete(email);

  const db = await getDb();
  const rows = await db.all('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    return res.status(404).json(errorResponse('该邮箱未注册'));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

  res.json(successResponse(null, '密码重置成功'));
}
