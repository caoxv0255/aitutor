import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { validateEmailFormat, validatePassword } from './utils/validator.js';
import { errorResponse } from './utils/response.js';

const VALID_GRADES = ['小学', '初中', '高中'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { email, password, grade } = req.body;

  if (!email || !password || !grade) {
    return res.status(400).json(errorResponse('请填写完整信息'));
  }

  const emailValidation = validateEmailFormat(email);
  if (!emailValidation.valid) {
    return res.status(400).json(errorResponse(emailValidation.message));
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json(errorResponse(passwordValidation.message));
  }

  if (!VALID_GRADES.includes(grade)) {
    return res.status(400).json(errorResponse('请选择有效的年级'));
  }

  const pool = await getDb();
  const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (result.rows.length > 0) {
    return res.status(400).json(errorResponse('该邮箱已注册'));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (email, password, grade) VALUES ($1, $2, $3)',
    [email, hashedPassword, grade]
  );

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ success: true, token, user: { email, grade } });
}
