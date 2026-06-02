import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { validateLogin } from './utils/validator.js';
import { errorResponse } from './utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { email, password } = req.body;

  try {
    validateLogin({ email, password });
  } catch (error) {
    return res.status(error.statusCode || 400).json(errorResponse(error.message));
  }

  const db = await getDb();
  const rows = await db.all('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    return res.status(401).json(errorResponse('邮箱或密码错误'));
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json(errorResponse('邮箱或密码错误'));
  }

  const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    success: true,
    token,
    user: { email: user.email, grade: user.grade }
  });
}
