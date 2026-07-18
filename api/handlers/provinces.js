import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';
import { CacheService } from '../services/cacheService.js';

export async function getProvinces(req, res) {
  const pool = await getDb();
  const { exam_level, region } = req.query;

  try {
    const { data, cached } = await CacheService.getProvinces(pool, exam_level, region);
    res.json({ ...data, cached });
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
    const { data, cached } = await CacheService.getProvinceStats(pool, code, subject, years);
    
    if (!data) {
      return res.status(404).json(errorResponse('省份不存在'));
    }
    
    res.json({ ...data, cached });
  } catch (error) {
    console.error('获取省份统计失败:', error.message);
    res.status(500).json(errorResponse('获取省份统计失败'));
  }
}
