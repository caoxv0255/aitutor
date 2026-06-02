import { getDb } from './db.js';
import { errorResponse, successResponse } from './utils/response.js';

/**
 * 获取用户省份偏好
 * GET /api/user-province
 */
export async function getUserProvince(req, res) {
  const pool = await getDb();
  const user_email = req.user?.email;

  if (!user_email) {
    return res.status(401).json(errorResponse('未登录'));
  }

  try {
    const result = await pool.query(`
      SELECT
        upp.*,
        p.name as province_name,
        p.paper_type,
        p.region
      FROM user_province_prefs upp
      LEFT JOIN provinces p ON upp.province_code = p.code
      WHERE upp.user_email = $1
      ORDER BY upp.exam_level
    `, [user_email]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取用户省份偏好失败:', error.message);
    res.status(500).json(errorResponse('获取省份偏好失败'));
  }
}

/**
 * 设置用户省份偏好
 * POST /api/user-province
 * Body: { exam_level: 'gaokao', province_code: 'beijing', target_score: 650 }
 */
export async function setUserProvince(req, res) {
  const pool = await getDb();
  const user_email = req.user?.email;

  if (!user_email) {
    return res.status(401).json(errorResponse('未登录'));
  }

  const { exam_level, province_code, target_score } = req.body;

  if (!exam_level || !province_code) {
    return res.status(400).json(errorResponse('请提供考试类型和省份'));
  }

  try {
    // 验证省份存在
    const provinceResult = await pool.query(
      'SELECT * FROM provinces WHERE code = $1',
      [province_code]
    );

    if (provinceResult.rows.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    // 插入或更新偏好
    const result = await pool.query(`
      INSERT INTO user_province_prefs (user_email, exam_level, province_code, target_score)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_email, exam_level) DO UPDATE SET
        province_code = EXCLUDED.province_code,
        target_score = COALESCE(EXCLUDED.target_score, user_province_prefs.target_score),
        updated_at = NOW()
      RETURNING *
    `, [user_email, exam_level, province_code, target_score || null]);

    // 同步更新 users 表
    await pool.query(`
      UPDATE users SET province = $1, exam_level = $2 WHERE email = $3
    `, [province_code, exam_level, user_email]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('设置用户省份偏好失败:', error.message);
    res.status(500).json(errorResponse('设置省份偏好失败'));
  }
}

/**
 * 删除用户省份偏好
 * DELETE /api/user-province/:exam_level
 */
export async function deleteUserProvince(req, res) {
  const pool = await getDb();
  const user_email = req.user?.email;
  const { exam_level } = req.params;

  if (!user_email) {
    return res.status(401).json(errorResponse('未登录'));
  }

  try {
    await pool.query(
      'DELETE FROM user_province_prefs WHERE user_email = $1 AND exam_level = $2',
      [user_email, exam_level]
    );

    res.json(successResponse(null, '已删除'));
  } catch (error) {
    console.error('删除用户省份偏好失败:', error.message);
    res.status(500).json(errorResponse('删除省份偏好失败'));
  }
}
