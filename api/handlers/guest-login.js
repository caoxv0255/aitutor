import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../core/db.js';
import { generateToken } from '../core/auth.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const pool = await getDb();

  const guestId = req.cookies?.guest_id;

  if (guestId) {
    const guestEmail = `guest_${guestId}@aitutor.local`;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [guestEmail]);
    const user = result.rows[0];

    if (user) {
      // 统一走 generateToken：有效期取 JWT_EXPIRES_IN，未配置回落 '7d'（与全站登录路径同口径）
      const token = generateToken({ email: user.email });
      // 双格式响应: 信封 data 字段 (D062, PWA/F3 消费) + 顶层兼容字段 (legacy 页面/契约测试消费)
      const payload = { token, user: { email: user.email, grade: user.grade } };
      return res.json({ success: true, message: '游客登录成功', ...payload, data: payload });
    }
  }

  const newGuestId = crypto.randomUUID();
  const guestEmail = `guest_${newGuestId}@aitutor.local`;
  const guestPassword = crypto.randomBytes(16).toString('hex');
  const hashedPassword = await bcrypt.hash(guestPassword, 10);
  const defaultGrade = '高中';

  await pool.query(
    'INSERT INTO users (email, password, grade) VALUES ($1, $2, $3)',
    [guestEmail, hashedPassword, defaultGrade]
  );

  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `guest_id=${newGuestId}; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax; HttpOnly${secureFlag}`
  );

  // 统一走 generateToken：有效期取 JWT_EXPIRES_IN，未配置回落 '7d'（与全站登录路径同口径）
  const token = generateToken({ email: guestEmail });

  // 双格式响应: 信封 data 字段 (D062, PWA/F3 消费) + 顶层兼容字段 (legacy 页面/契约测试消费)
  const payload = { token, user: { email: guestEmail, grade: defaultGrade } };
  res.json({ success: true, message: '游客登录成功', ...payload, data: payload });
}
