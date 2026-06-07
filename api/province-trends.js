import { getDb } from './db.js';
import { cacheWrapper, CACHE_CONFIG } from './utils/cache.js';
import { successResponse, errorResponse } from './utils/response.js';

export async function getProvinceTrends(req, res) {
  const { code } = req.params;
  const { subject, years = 5, start_year, end_year } = req.query;

  const cacheKey = `province_trends_${code}_${subject || 'all'}_${years}_${start_year || 'default'}_${end_year || 'default'}`;
  
  try {
    const { data: trends, cached } = await cacheWrapper(cacheKey, async () => {
      const pool = await getDb();
      
      const provinceResult = await pool.query(
        'SELECT * FROM provinces WHERE code = $1',
        [code]
      );
      const provinceRows = provinceResult.rows;

      if (provinceRows.length === 0) {
        return null;
      }

      const province = provinceRows[0];
      const currentYear = new Date().getFullYear();
      const startYear = start_year || currentYear - parseInt(years);
      const endYear = end_year || currentYear;

      let paperQuery = `
        SELECT year, subject, question_count, total_score, difficulty_avg, COUNT(*) as paper_count
        FROM exam_papers
        WHERE province_code = $1 AND year BETWEEN $2 AND $3
      `;
      let paperParams = [code, startYear, endYear];
      let paramIdx = 4;
      if (subject) {
        paperParams.push(subject);
        paperQuery += ` AND subject = $${paramIdx++}`;
      }
      paperQuery += ' GROUP BY year, subject, question_count, total_score, difficulty_avg ORDER BY year';
      const papersResult = await pool.query(paperQuery, paperParams);
      const papersRows = papersResult.rows;

      let knowledgeQuery = `
        SELECT pk.year, pk.knowledge_point_id, kp.name as knowledge_point_name, kp.subject,
               SUM(pk.frequency) as frequency, AVG(pk.avg_difficulty) as avg_difficulty,
               SUM(pk.total_score) as total_score
        FROM province_knowledge_stats pk
        LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
        WHERE pk.province_code = $1 AND pk.year BETWEEN $2 AND $3
      `;
      let knowledgeParams = [code, startYear, endYear];
      paramIdx = 4;
      if (subject) {
        knowledgeParams.push(subject);
        knowledgeQuery += ` AND pk.subject = $${paramIdx++}`;
      }
      knowledgeQuery += ' GROUP BY pk.year, pk.knowledge_point_id, kp.name, kp.subject ORDER BY pk.year, frequency DESC';
      const knowledgeResult = await pool.query(knowledgeQuery, knowledgeParams);
      const knowledgeRows = knowledgeResult.rows;

      let typeQuery = `
        SELECT eq.question_type, COUNT(*) as count, AVG(eq.difficulty) as avg_difficulty, AVG(eq.score) as avg_score
        FROM exam_questions eq
        JOIN exam_papers ep ON eq.paper_id = ep.id
        WHERE ep.province_code = $1 AND ep.year BETWEEN $2 AND $3
      `;
      let typeParams = [code, startYear, endYear];
      paramIdx = 4;
      if (subject) {
        typeParams.push(subject);
        typeQuery += ` AND ep.subject = $${paramIdx++}`;
      }
      typeQuery += ' GROUP BY eq.question_type ORDER BY count DESC';
      const typeResult = await pool.query(typeQuery, typeParams);
      const typeRows = typeResult.rows;

      let diffQuery = `
        SELECT eq.difficulty, COUNT(*) as count, AVG(eq.score) as avg_score
        FROM exam_questions eq
        JOIN exam_papers ep ON eq.paper_id = ep.id
        WHERE ep.province_code = $1 AND ep.year BETWEEN $2 AND $3
      `;
      let diffParams = [code, startYear, endYear];
      paramIdx = 4;
      if (subject) {
        diffParams.push(subject);
        diffQuery += ` AND ep.subject = $${paramIdx++}`;
      }
      diffQuery += ' GROUP BY eq.difficulty ORDER BY eq.difficulty';
      const diffResult = await pool.query(diffQuery, diffParams);
      const diffRows = diffResult.rows;

      let topKnowledgeQuery = `
        SELECT pk.knowledge_point_id, kp.name as knowledge_point_name,
               SUM(pk.frequency) as total_frequency, AVG(pk.avg_difficulty) as avg_difficulty
        FROM province_knowledge_stats pk
        LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
        WHERE pk.province_code = $1 AND pk.year BETWEEN $2 AND $3
      `;
      let topKnowledgeParams = [code, startYear, endYear];
      paramIdx = 4;
      if (subject) {
        topKnowledgeParams.push(subject);
        topKnowledgeQuery += ` AND pk.subject = $${paramIdx++}`;
      }
      topKnowledgeQuery += ' GROUP BY pk.knowledge_point_id, kp.name ORDER BY total_frequency DESC LIMIT 10';
      const topKnowledgeResult = await pool.query(topKnowledgeQuery, topKnowledgeParams);
      const topKnowledgeRows = topKnowledgeResult.rows;

      return {
        province,
        period: { start_year: startYear, end_year: endYear, years: parseInt(years) },
        papers: papersRows,
        knowledge_points: groupKnowledgeByYear(knowledgeRows),
        question_types: typeRows,
        difficulty_distribution: diffRows,
        top_knowledge_points: topKnowledgeRows,
        summary: generateSummary(province, papersRows, knowledgeRows, typeRows),
        cached: false
      };
    }, CACHE_CONFIG.LONG_TTL);

    if (trends === null) {
      return res.status(404).json(errorResponse('省份不存在'));
    }

    res.json(successResponse({ ...trends, cached }, '获取省份趋势成功'));
  } catch (error) {
    console.error('获取省份趋势失败:', error.message);
    res.status(500).json(errorResponse('获取省份趋势失败'));
  }
}

export async function getProvinceCompare(req, res) {
  const { codes, subject, years = 5 } = req.query;

  if (!codes) {
    return res.status(400).json(errorResponse('请提供省份代码'));
  }

  const codeList = codes.split(',').map(c => c.trim());
  const cacheKey = `province_compare_${codeList.sort().join('_')}_${subject || 'all'}_${years}`;

  try {
    const { data: rows } = await cacheWrapper(cacheKey, async () => {
      const pool = await getDb();
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - parseInt(years);

      const placeholders = codeList.map((_, i) => `$${i + 1}`).join(',');
      
      let compareQuery = `
        SELECT ep.province_code, p.name as province_name,
               COUNT(DISTINCT ep.id) as paper_count, COUNT(eq.id) as question_count,
               AVG(ep.difficulty_avg) as avg_difficulty, AVG(eq.difficulty) as question_avg_difficulty
        FROM exam_papers ep
        LEFT JOIN provinces p ON ep.province_code = p.code
        LEFT JOIN exam_questions eq ON ep.id = eq.paper_id
        WHERE ep.province_code IN (${placeholders}) AND ep.year BETWEEN $${codeList.length + 1} AND $${codeList.length + 2}
      `;
      
      let compareParams = [...codeList, startYear, currentYear];
      let paramIdx = codeList.length + 3;
      if (subject) {
        compareParams.push(subject);
        compareQuery += ` AND ep.subject = $${paramIdx++}`;
      }
      compareQuery += ' GROUP BY ep.province_code, p.name ORDER BY paper_count DESC';

      const result = await pool.query(compareQuery, compareParams);
      return result.rows;
    }, CACHE_CONFIG.LONG_TTL);

    res.json(successResponse(rows, '获取省份对比成功'));
  } catch (error) {
    console.error('获取省份对比失败:', error.message);
    res.status(500).json(errorResponse('获取省份对比失败'));
  }
}

function groupKnowledgeByYear(rows) {
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.year]) {
      grouped[row.year] = [];
    }
    grouped[row.year].push(row);
  }
  return grouped;
}

function generateSummary(province, papers, knowledge, types) {
  const summary = {
    title: `${province.name}高考命题趋势分析`,
    highlights: [],
    recommendations: []
  };

  if (papers.length > 0) {
    const totalPapers = papers.reduce((sum, p) => sum + parseInt(p.paper_count || 0), 0);
    summary.highlights.push(`近${papers.length}年共收录${totalPapers}套试卷`);
  }

  if (knowledge.length > 0) {
    const topKp = knowledge.slice(0, 3).map(k => k.knowledge_point_name).filter(Boolean);
    if (topKp.length > 0) {
      summary.highlights.push(`高频考点：${topKp.join('、')}`);
      summary.recommendations.push(`建议重点复习：${topKp.join('、')}`);
    }
  }

  if (types.length > 0) {
    const mainType = types[0];
    if (mainType) {
      summary.highlights.push(`主要题型：${mainType.question_type}（共${mainType.count}题）`);
    }
  }

  const avgDiff = papers.reduce((sum, p) => sum + parseFloat(p.difficulty_avg || 0), 0) / papers.length;
  if (avgDiff > 0) {
    const diffLabel = avgDiff < 2.5 ? '偏易' : avgDiff < 3.5 ? '适中' : '偏难';
    summary.highlights.push(`整体难度：${diffLabel}（平均${avgDiff.toFixed(1)}分）`);
    summary.recommendations.push(`难度适中，建议注重基础题和中档题的训练`);
  }

  return summary;
}
