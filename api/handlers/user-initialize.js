import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

const VALID_GRADE_CODES = ['grade_10', 'grade_11', 'grade_12', 'grade_7', 'grade_8', 'grade_9'];
const VALID_EXAM_LEVELS = ['gaokao', 'zhongkao'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { email } = req.user;
  const { grade_code, province_code, subjects, target_score, study_hours_per_day } = req.body;

  const validation = validateInitialization({ grade_code, province_code, subjects });
  if (!validation.valid) {
    return res.status(400).json(errorResponse(validation.message));
  }

  try {
    const pool = await getDb();

    const provinceResult = await pool.query('SELECT id FROM provinces WHERE code = $1', [province_code]);
    if (provinceResult.rows.length === 0) {
      return res.status(400).json(errorResponse('无效的地区代码'));
    }

    const gradeResult = await pool.query('SELECT id, level FROM grades WHERE code = $1', [grade_code]);
    if (gradeResult.rows.length === 0) {
      return res.status(400).json(errorResponse('无效的年级代码'));
    }

    const exam_level = gradeResult.rows[0].level;

    await pool.query('BEGIN');

    await pool.query(`
      INSERT INTO user_profiles (
        user_email, grade_code, province_code, exam_level,
        target_score, study_hours_per_day, initialized
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (user_email) DO UPDATE SET
        grade_code = $2, province_code = $3, exam_level = $4,
        target_score = $5, study_hours_per_day = $6,
        initialized = true, updated_at = NOW()
    `, [email, grade_code, province_code, exam_level, target_score, study_hours_per_day || 2]);

    await pool.query('DELETE FROM user_subjects WHERE user_email = $1', [email]);

    for (const subject of subjects) {
      await pool.query(
        'INSERT INTO user_subjects (user_email, subject_code, is_main) VALUES ($1, $2, $3)',
        [email, subject.code, subject.is_main || false]
      );
    }

    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: '初始化完成',
      data: {
        grade_code,
        province_code,
        exam_level,
        subjects,
        initialized: true
      }
    });
  } catch (error) {
    console.error('[User Initialize] Initialize error:', error);
    await pool.query('ROLLBACK');
    return res.status(500).json(errorResponse('初始化失败'));
  }
}

function validateInitialization({ grade_code, province_code, subjects }) {
  if (!grade_code) {
    return { valid: false, message: '请选择年级' };
  }

  if (!VALID_GRADE_CODES.includes(grade_code)) {
    return { valid: false, message: '请选择有效的年级' };
  }

  if (!province_code) {
    return { valid: false, message: '请选择地区' };
  }

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return { valid: false, message: '请至少选择一门学科' };
  }

  if (subjects.length > 10) {
    return { valid: false, message: '最多选择10门学科' };
  }

  const mainCount = subjects.filter(s => s.is_main).length;
  if (mainCount > 6) {
    return { valid: false, message: '主科最多选择6门' };
  }

  return { valid: true, message: '' };
}
