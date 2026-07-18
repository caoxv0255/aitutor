import bcrypt from 'bcryptjs';
import { getDb } from '../core/db.js';
import { validateLogin } from '../utils/validator.js';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../utils/errorCodes.js';
import { generateToken } from '../core/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Method not allowed'));
  }

  const { email, password } = req.body;

  try {
    validateLogin({ email, password });
  } catch (error) {
    return res.status(error.statusCode || 400).json(createErrorResponse(ErrorCode.VALIDATION_ERROR, error.message));
  }

  const pool = await getDb();
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json(createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS));
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json(createErrorResponse(ErrorCode.AUTH_PASSWORD_INCORRECT));
  }

  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    grade: user.grade,
    provinceCode: user.province_code
  };

  res.json(createSuccessResponse({ token, user: userData }, '登录成功'));
}