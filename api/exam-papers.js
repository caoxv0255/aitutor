import { getDb } from './db.js';
import { errorResponse } from './utils/response.js';

export async function getExamPapers(req, res) {
  const db = await getDb();
  const { province, year, subject, exam_level, limit = 50, offset = 0 } = req.query;

  try {
    const conditions = [];
    const params = [];

    if (province) {
      params.push(province);
      conditions.push(`province_code = ?`);
    }

    if (year) {
      params.push(parseInt(year));
      conditions.push(`year = ?`);
    }

    if (subject) {
      params.push(subject);
      conditions.push(`subject = ?`);
    }

    if (exam_level) {
      params.push(exam_level);
      conditions.push(`exam_level = ?`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = await db.all(`
      SELECT id, province_code, year, subject, exam_level, question_count, total_score, difficulty_avg, created_at
      FROM exam_papers
      ${whereClause}
      ORDER BY year DESC, subject
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await db.all(`
      SELECT COUNT(*) as count FROM exam_papers ${whereClause}
    `, params);

    const provinceCodes = [...new Set(rows.map(r => r.province_code).filter(Boolean))];
    const provinces = {};
    if (provinceCodes.length > 0) {
      const placeholders = provinceCodes.map(() => '?').join(',');
      const provinceRows = await db.all(`SELECT code, name FROM provinces WHERE code IN (${placeholders})`, provinceCodes);
      provinceRows.forEach(p => provinces[p.code] = p.name);
    }

    const data = rows.map(r => ({
      ...r,
      province_name: provinces[r.province_code] || '全国'
    }));

    res.json({
      success: true,
      data,
      total: parseInt(countResult[0]?.count || 0),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('查询试卷列表失败:', error.message);
    res.status(500).json(errorResponse('查询试卷列表失败'));
  }
}

export async function getExamPaperById(req, res) {
  const db = await getDb();
  const { id } = req.params;

  try {
    const rows = await db.all(`
      SELECT ep.*, p.name as province_name, p.paper_type, p.region
      FROM exam_papers ep
      LEFT JOIN provinces p ON ep.province_code = p.code
      WHERE ep.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const questionCount = await db.all(
      'SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = ?',
      [id]
    );

    const paper = rows[0];
    paper.question_count = parseInt(questionCount[0]?.count || 0);

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
  const db = await getDb();
  const { province_code, year, subject, exam_level, paper_file_path, total_score } = req.body;

  if (!province_code || !year || !subject || !exam_level) {
    return res.status(400).json(errorResponse('请提供完整信息'));
  }

  try {
    const provinceResult = await db.all(
      'SELECT * FROM provinces WHERE code = ?',
      [province_code]
    );

    if (provinceResult.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    await db.run(`
      INSERT OR REPLACE INTO exam_papers (province_code, year, subject, exam_level, paper_file_path, total_score, question_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [province_code, year, subject, exam_level, paper_file_path || null, total_score || null, 0]);

    const result = await db.all(`
      SELECT * FROM exam_papers
      WHERE province_code = ? AND year = ? AND subject = ? AND exam_level = ?
    `, [province_code, year, subject, exam_level]);

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('创建试卷失败:', error.message);
    res.status(500).json(errorResponse('创建试卷失败'));
  }
}
