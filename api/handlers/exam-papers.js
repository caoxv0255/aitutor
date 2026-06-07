import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export async function getExamPapers(req, res) {
  const pool = await getDb();
  const { province, year, subject, exam_level, limit = 50, offset = 0 } = req.query;

  try {
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (province) {
      params.push(province);
      conditions.push(`province_code = $${paramIdx++}`);
    }

    if (year) {
      params.push(parseInt(year));
      conditions.push(`year = $${paramIdx++}`);
    }

    if (subject) {
      params.push(subject);
      conditions.push(`subject = $${paramIdx++}`);
    }

    if (exam_level) {
      params.push(exam_level);
      conditions.push(`exam_level = $${paramIdx++}`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = await pool.query(`
      SELECT id, province_code, year, subject, exam_level, question_count, total_score, difficulty_avg, created_at
      FROM exam_papers
      ${whereClause}
      ORDER BY year DESC, subject
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM exam_papers ${whereClause}
    `, params);

    const provinceCodes = [...new Set(rows.rows.map(r => r.province_code).filter(Boolean))];
    const provinces = {};
    if (provinceCodes.length > 0) {
      const placeholders = provinceCodes.map((_, i) => `$${i + 1}`).join(',');
      const provinceRows = await pool.query(`SELECT code, name FROM provinces WHERE code IN (${placeholders})`, provinceCodes);
      provinceRows.rows.forEach(p => provinces[p.code] = p.name);
    }

    const data = rows.rows.map(r => ({
      ...r,
      province_name: provinces[r.province_code] || '全国'
    }));

    res.json({
      success: true,
      data,
      total: parseInt(countResult.rows[0]?.count || 0),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('查询试卷列表失败:', error.message);
    res.status(500).json(errorResponse('查询试卷列表失败'));
  }
}

export async function getExamPaperById(req, res) {
  const pool = await getDb();
  const { id } = req.params;

  try {
    const rows = await pool.query(`
      SELECT ep.*, p.name as province_name, p.paper_type, p.region
      FROM exam_papers ep
      LEFT JOIN provinces p ON ep.province_code = p.code
      WHERE ep.id = $1
    `, [id]);

    if (rows.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const questionCount = await pool.query(
      'SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = $1',
      [id]
    );

    const paper = rows.rows[0];
    paper.question_count = parseInt(questionCount.rows[0]?.count || 0);

    res.json({
      success: true,
      data: paper
    });
  } catch (error) {
    console.error('获取试卷详情失败:', error.message);
    res.status(500).json(errorResponse('获取试卷详情失败'));
  }
}

export async function createExamPaper(req, res) {
  const pool = await getDb();
  const { province_code, year, subject, exam_level, paper_file_path, total_score } = req.body;

  if (!province_code || !year || !subject || !exam_level) {
    return res.status(400).json(errorResponse('请提供完整信息'));
  }

  try {
    const provinceResult = await pool.query(
      'SELECT * FROM provinces WHERE code = $1',
      [province_code]
    );

    if (provinceResult.rows.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    // Use ON CONFLICT to handle duplicates - since exam_papers has no unique constraint on the combination,
    // we delete and insert instead
    await pool.query(`
      DELETE FROM exam_papers
      WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4
    `, [province_code, year, subject, exam_level]);

    await pool.query(`
      INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path, total_score, question_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [province_code, year, subject, exam_level, paper_file_path || null, total_score || null, 0]);

    const result = await pool.query(`
      SELECT * FROM exam_papers
      WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4
    `, [province_code, year, subject, exam_level]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建试卷失败:', error.message);
    res.status(500).json(errorResponse('创建试卷失败'));
  }
}
