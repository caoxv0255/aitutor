import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getProfile(req, res);
  } else if (req.method === 'POST') {
    return await updateProfile(req, res);
  }
  return res.status(405).json(errorResponse('Method not allowed'));
}

async function getProfile(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();
    const result = await pool.query(`
      SELECT up.*, g.name as grade_name, p.name as province_name, p.exam_type
      FROM user_profiles up
      LEFT JOIN grades g ON up.grade_code = g.code
      LEFT JOIN provinces p ON up.province_code = p.code
      WHERE up.user_email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          initialized: false,
          grade_code: null,
          province_code: null,
          exam_level: null,
          target_score: null,
          study_hours_per_day: 2,
          weak_subjects: [],
          preferences: {}
        }
      });
    }

    const profile = result.rows[0];
    try {
      profile.weak_subjects = JSON.parse(profile.weak_subjects || '[]');
    } catch (e) {
      profile.weak_subjects = [];
    }

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('[User Profile] Get profile error:', error);
    return res.status(500).json(errorResponse('获取用户档案失败'));
  }
}

async function updateProfile(req, res) {
  const { email } = req.user;
  const {
    grade_code,
    province_code,
    exam_level,
    target_score,
    study_hours_per_day,
    weak_subjects,
    preferences,
    initialized
  } = req.body;

  try {
    const pool = await getDb();

    const existing = await pool.query(
      'SELECT id FROM user_profiles WHERE user_email = $1',
      [email]
    );

    const weakSubjectsJson = Array.isArray(weak_subjects) ? JSON.stringify(weak_subjects) : '[]';
    const preferencesJson = typeof preferences === 'object' ? JSON.stringify(preferences) : '{}';

    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE user_profiles
        SET grade_code = COALESCE($1, grade_code),
            province_code = COALESCE($2, province_code),
            exam_level = COALESCE($3, exam_level),
            target_score = COALESCE($4, target_score),
            study_hours_per_day = COALESCE($5, study_hours_per_day),
            weak_subjects = COALESCE($6, weak_subjects),
            preferences = COALESCE($7, preferences)::jsonb,
            initialized = COALESCE($8, initialized),
            updated_at = NOW()
        WHERE user_email = $9
      `, [grade_code, province_code, exam_level, target_score, study_hours_per_day, weakSubjectsJson, preferencesJson, initialized, email]);
    } else {
      await pool.query(`
        INSERT INTO user_profiles (
          user_email, grade_code, province_code, exam_level,
          target_score, study_hours_per_day, weak_subjects,
          preferences, initialized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `, [email, grade_code, province_code, exam_level, target_score, study_hours_per_day, weakSubjectsJson, preferencesJson, initialized]);
    }

    return res.status(200).json({
      success: true,
      message: '用户档案更新成功'
    });
  } catch (error) {
    console.error('[User Profile] Update profile error:', error);
    return res.status(500).json(errorResponse('更新用户档案失败'));
  }
}
