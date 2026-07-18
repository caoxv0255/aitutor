import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getUserSubjects(req, res);
  } else if (req.method === 'POST') {
    return await setUserSubjects(req, res);
  } else if (req.method === 'DELETE') {
    return await removeUserSubject(req, res);
  }
  return res.status(405).json(errorResponse('Method not allowed'));
}

async function getUserSubjects(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();
    const result = await pool.query(`
      SELECT us.*, s.name as subject_name, s.category
      FROM user_subjects us
      JOIN subjects s ON us.subject_code = s.code
      WHERE us.user_email = $1
      ORDER BY s.sort_order
    `, [email]);

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[User Subjects] Get subjects error:', error);
    return res.status(500).json(errorResponse('获取用户选科失败'));
  }
}

async function setUserSubjects(req, res) {
  const { email } = req.user;
  const { subjects } = req.body;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json(errorResponse('请至少选择一门学科'));
  }

  if (subjects.length > 10) {
    return res.status(400).json(errorResponse('最多选择10门学科'));
  }

  try {
    const pool = await getDb();

    const validSubjects = await pool.query(
      'SELECT code FROM subjects WHERE code = ANY($1)',
      [subjects.map(s => s.code)]
    );

    const validCodes = new Set(validSubjects.rows.map(r => r.code));
    const invalidSubjects = subjects.filter(s => !validCodes.has(s.code));

    if (invalidSubjects.length > 0) {
      return res.status(400).json(errorResponse(`无效的学科代码: ${invalidSubjects.map(s => s.code).join(', ')}`));
    }

    await pool.query('DELETE FROM user_subjects WHERE user_email = $1', [email]);

    for (const subject of subjects) {
      await pool.query(
        'INSERT INTO user_subjects (user_email, subject_code, is_main) VALUES ($1, $2, $3)',
        [email, subject.code, subject.is_main || false]
      );
    }

    const result = await pool.query(`
      SELECT us.*, s.name as subject_name, s.category
      FROM user_subjects us
      JOIN subjects s ON us.subject_code = s.code
      WHERE us.user_email = $1
      ORDER BY s.sort_order
    `, [email]);

    return res.status(200).json({
      success: true,
      message: '选科设置成功',
      data: result.rows
    });
  } catch (error) {
    console.error('[User Subjects] Set subjects error:', error);
    return res.status(500).json(errorResponse('设置用户选科失败'));
  }
}

async function removeUserSubject(req, res) {
  const { email } = req.user;
  const { subject_code } = req.body;

  if (!subject_code) {
    return res.status(400).json(errorResponse('请指定要删除的学科'));
  }

  try {
    const pool = await getDb();
    const result = await pool.query(
      'DELETE FROM user_subjects WHERE user_email = $1 AND subject_code = $2',
      [email, subject_code]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(errorResponse('未找到该学科记录'));
    }

    return res.status(200).json({
      success: true,
      message: '学科删除成功'
    });
  } catch (error) {
    console.error('[User Subjects] Remove subject error:', error);
    return res.status(500).json(errorResponse('删除学科失败'));
  }
}
