import { getDb } from './db.js';
import { errorResponse } from './utils/response.js';

export async function getProvinces(req, res) {
  const db = await getDb();
  const { exam_level, region } = req.query;

  try {
    let query = 'SELECT * FROM provinces';
    const conditions = [];
    const params = [];

    if (exam_level) {
      params.push(exam_level);
      conditions.push('exam_type = ?');
    }

    if (region) {
      params.push(region);
      conditions.push('region = ?');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY region, name';

    const rows = await db.all(query, params);

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
  const db = await getDb();
  const { code } = req.params;

  try {
    const rows = await db.all(
      'SELECT * FROM provinces WHERE code = ?',
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    const statsRows = await db.all(`
      SELECT
        COUNT(DISTINCT year) as year_count,
        COUNT(DISTINCT subject) as subject_count,
        COUNT(*) as paper_count,
        MIN(year) as min_year,
        MAX(year) as max_year
      FROM exam_papers
      WHERE province_code = ?
    `, [code]);

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
  const db = await getDb();
  const { code } = req.params;
  const { subject, years = 5 } = req.query;

  try {
    const provinceRows = await db.all(
      'SELECT * FROM provinces WHERE code = ?',
      [code]
    );

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
      WHERE province_code = ?
      AND year >= strftime('%Y', 'now') - ?
    `;
    const paperParams = [code, parseInt(years)];

    if (subject) {
      paperParams.push(subject);
      paperQuery += ' AND subject = ?';
    }

    paperQuery += ' ORDER BY year DESC, subject';

    const papersRows = await db.all(paperQuery, paperParams);

    const knowledgeQuery = `
      SELECT
        pk.knowledge_point_id,
        kp.name as knowledge_point_name,
        SUM(pk.frequency) as total_frequency,
        AVG(pk.avg_difficulty) as avg_difficulty,
        SUM(pk.total_score) as total_score
      FROM province_knowledge_stats pk
      LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
      WHERE pk.province_code = ?
      AND pk.year >= strftime('%Y', 'now') - ?
    `;
    const knowledgeParams = [code, parseInt(years)];

    if (subject) {
      knowledgeParams.push(subject);
      knowledgeQuery += ' AND pk.subject = ?';
    }

    knowledgeQuery += `
      GROUP BY pk.knowledge_point_id, kp.name
      ORDER BY total_frequency DESC
      LIMIT 20
    `;

    const knowledgeRows = await db.all(knowledgeQuery, knowledgeParams);

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
