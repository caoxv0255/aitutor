import { getDb } from './db.js';
import { errorResponse } from './utils/response.js';

export async function getProvinces(req, res) {
  const pool = await getDb();
  const { exam_level, region } = req.query;

  try {
    let query = 'SELECT * FROM provinces';
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (exam_level) {
      params.push(exam_level);
      conditions.push(`exam_type = $${paramIdx++}`);
    }

    if (region) {
      params.push(region);
      conditions.push(`region = $${paramIdx++}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY region, name';

    const result = await pool.query(query, params);
    const rows = result.rows;

    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('获取省份列表失败:', error.message);
    res.status(500).json(errorResponse('获取省份列表失败'));
  }
}

export async function getProvinceByCode(req, res) {
  const pool = await getDb();
  const { code } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM provinces WHERE code = $1',
      [code]
    );
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    const statsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT year) as year_count,
        COUNT(DISTINCT subject) as subject_count,
        COUNT(*) as paper_count,
        MIN(year) as min_year,
        MAX(year) as max_year
      FROM exam_papers
      WHERE province_code = $1
    `, [code]);
    const statsRows = statsResult.rows;

    const province = rows[0];
    province.stats = statsRows[0] || {
      year_count: 0,
      subject_count: 0,
      paper_count: 0,
      min_year: null,
      max_year: null
    };

    res.json({
      success: true,
      data: province
    });
  } catch (error) {
    console.error('获取省份详情失败:', error.message);
    res.status(500).json(errorResponse('获取省份详情失败'));
  }
}

export async function getProvinceStats(req, res) {
  const pool = await getDb();
  const { code } = req.params;
  const { subject, years = 5 } = req.query;

  try {
    const provinceResult = await pool.query(
      'SELECT * FROM provinces WHERE code = $1',
      [code]
    );
    const provinceRows = provinceResult.rows;

    if (provinceRows.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    const province = provinceRows[0];

    let paperQuery = `
      SELECT
        year,
        subject,
        question_count,
        total_score,
        difficulty_avg
      FROM exam_papers
      WHERE province_code = $1
      AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2
    `;
    const paperParams = [code, parseInt(years)];
    let paramIdx = 3;

    if (subject) {
      paperParams.push(subject);
      paperQuery += ` AND subject = $${paramIdx++}`;
    }

    paperQuery += ' ORDER BY year DESC, subject';

    const papersResult = await pool.query(paperQuery, paperParams);
    const papersRows = papersResult.rows;

    const knowledgeQuery = `
      SELECT
        pk.knowledge_point_id,
        kp.name as knowledge_point_name,
        SUM(pk.frequency) as total_frequency,
        AVG(pk.avg_difficulty) as avg_difficulty,
        SUM(pk.total_score) as total_score
      FROM province_knowledge_stats pk
      LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
      WHERE pk.province_code = $1
      AND pk.year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2
    `;
    const knowledgeParams = [code, parseInt(years)];

    if (subject) {
      knowledgeParams.push(subject);
      knowledgeQuery += ' AND pk.subject = $3';
    }

    knowledgeQuery += `
      GROUP BY pk.knowledge_point_id, kp.name
      ORDER BY total_frequency DESC
      LIMIT 20
    `;

    const knowledgeResult = await pool.query(knowledgeQuery, knowledgeParams);
    const knowledgeRows = knowledgeResult.rows;

    res.json({
      success: true,
      data: {
        province,
        papers: papersRows,
        knowledge_points: knowledgeRows,
        period: `近${years}年`
      }
    });
  } catch (error) {
    console.error('获取省份统计失败:', error.message);
    res.status(500).json(errorResponse('获取省份统计失败'));
  }
}
