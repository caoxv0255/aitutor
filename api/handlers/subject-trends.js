import { getDb } from '../core/db.js';
import { cacheWrapper, CACHE_CONFIG } from '../utils/cache.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getSubjectTrends(req, res) {
  const { subject } = req.params;
  const { province, years = 5, start_year, end_year, exam_level = 'gaokao' } = req.query;

  const cacheKey = `subject_trends_${subject}_${province || 'all'}_${exam_level}_${years}_${start_year || 'default'}_${end_year || 'default'}`;

  try {
    const { data: trends, cached } = await cacheWrapper(cacheKey, async () => {
      const pool = await getDb();
      const currentYear = new Date().getFullYear();
      const startYear = start_year || currentYear - parseInt(years);
      const endYear = end_year || currentYear;

      let paperQuery = `
        SELECT ep.province_code, p.name as province_name, ep.year,
               ep.total_score, ep.question_count, ep.difficulty_avg,
               COUNT(*) as paper_count
        FROM exam_papers ep
        LEFT JOIN provinces p ON ep.province_code = p.code
        WHERE ep.subject = $1 AND ep.year BETWEEN $2 AND $3 AND ep.exam_level = $4
      `;
      let paperParams = [subject, startYear, endYear, exam_level];
      let paramIdx = 5;
      if (province) {
        paperParams.push(province);
        paperQuery += ` AND ep.province_code = $${paramIdx++}`;
      }
      paperQuery += ' GROUP BY ep.province_code, p.name, ep.year, ep.total_score, ep.question_count, ep.difficulty_avg ORDER BY ep.year DESC, p.name';
      const papersResult = await pool.query(paperQuery, paperParams);
      const papersRows = papersResult.rows;

      let typeQuery = `
        SELECT eq.question_type, qt.name as question_type_name,
               COUNT(*) as count, AVG(eq.difficulty) as avg_difficulty, AVG(eq.score) as avg_score
        FROM exam_questions eq
        JOIN exam_papers ep ON eq.paper_id = ep.id
        LEFT JOIN question_types qt ON eq.question_type = qt.code
        WHERE ep.subject = $1 AND ep.year BETWEEN $2 AND $3 AND ep.exam_level = $4
      `;
      let typeParams = [subject, startYear, endYear, exam_level];
      paramIdx = 5;
      if (province) {
        typeParams.push(province);
        typeQuery += ` AND ep.province_code = $${paramIdx++}`;
      }
      typeQuery += ' GROUP BY eq.question_type, qt.name ORDER BY count DESC';
      const typeResult = await pool.query(typeQuery, typeParams);
      const typeRows = typeResult.rows;

      let typeByYearQuery = `
        SELECT ep.year, eq.question_type, qt.name as question_type_name,
               COUNT(*) as count, AVG(eq.difficulty) as avg_difficulty, AVG(eq.score) as avg_score
        FROM exam_questions eq
        JOIN exam_papers ep ON eq.paper_id = ep.id
        LEFT JOIN question_types qt ON eq.question_type = qt.code
        WHERE ep.subject = $1 AND ep.year BETWEEN $2 AND $3 AND ep.exam_level = $4
      `;
      let typeByYearParams = [subject, startYear, endYear, exam_level];
      paramIdx = 5;
      if (province) {
        typeByYearParams.push(province);
        typeByYearQuery += ` AND ep.province_code = $${paramIdx++}`;
      }
      typeByYearQuery += ' GROUP BY ep.year, eq.question_type, qt.name ORDER BY ep.year DESC, count DESC';
      const typeByYearResult = await pool.query(typeByYearQuery, typeByYearParams);
      const typeByYearRows = typeByYearResult.rows;

      let difficultyQuery = `
        SELECT ep.year, eq.difficulty, COUNT(*) as count, AVG(eq.score) as avg_score
        FROM exam_questions eq
        JOIN exam_papers ep ON eq.paper_id = ep.id
        WHERE ep.subject = $1 AND ep.year BETWEEN $2 AND $3 AND ep.exam_level = $4
      `;
      let difficultyParams = [subject, startYear, endYear, exam_level];
      paramIdx = 5;
      if (province) {
        difficultyParams.push(province);
        difficultyQuery += ` AND ep.province_code = $${paramIdx++}`;
      }
      difficultyQuery += ' GROUP BY ep.year, eq.difficulty ORDER BY ep.year DESC, eq.difficulty';
      const difficultyResult = await pool.query(difficultyQuery, difficultyParams);
      const difficultyRows = difficultyResult.rows;

      let knowledgeQuery = `
        SELECT pk.knowledge_point_id, kp.name as knowledge_point_name,
               SUM(pk.frequency) as total_frequency, AVG(pk.avg_difficulty) as avg_difficulty,
               SUM(pk.total_score) as total_score
        FROM province_knowledge_stats pk
        LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
        WHERE pk.subject = $1 AND pk.year BETWEEN $2 AND $3 AND pk.exam_level = $4
      `;
      let knowledgeParams = [subject, startYear, endYear, exam_level];
      paramIdx = 5;
      if (province) {
        knowledgeParams.push(province);
        knowledgeQuery += ` AND pk.province_code = $${paramIdx++}`;
      }
      knowledgeQuery += ' GROUP BY pk.knowledge_point_id, kp.name ORDER BY total_frequency DESC LIMIT 15';
      const knowledgeResult = await pool.query(knowledgeQuery, knowledgeParams);
      const knowledgeRows = knowledgeResult.rows;

      let subjectInfoQuery = 'SELECT * FROM subjects WHERE code = $1';
      const subjectInfoResult = await pool.query(subjectInfoQuery, [subject]);
      const subjectInfo = subjectInfoResult.rows[0] || { name: subject };

      const yearsList = [...new Set(typeByYearRows.map(r => r.year))].sort((a, b) => b - a);
      const typeDistributionByYear = {};
      yearsList.forEach(year => {
        typeDistributionByYear[year] = typeByYearRows
          .filter(r => r.year === year)
          .map(r => ({
            type: r.question_type,
            name: r.question_type_name || r.question_type,
            count: r.count,
            avg_difficulty: parseFloat(r.avg_difficulty) || 0,
            avg_score: parseFloat(r.avg_score) || 0
          }));
      });

      const difficultyTrend = [];
      yearsList.forEach(year => {
        const yearData = difficultyRows.filter(r => r.year === year);
        const total = yearData.reduce((sum, r) => sum + r.count, 0);
        if (total > 0) {
          const weightedAvg = yearData.reduce((sum, r) => sum + (r.difficulty * r.count), 0) / total;
          difficultyTrend.push({
            year,
            avg_difficulty: parseFloat(weightedAvg.toFixed(2)),
            question_count: total
          });
        }
      });

      return {
        subject: subjectInfo,
        exam_level,
        period: { start_year: startYear, end_year: endYear, years: parseInt(years) },
        papers_by_province: papersRows,
        question_types: typeRows,
        type_distribution_by_year: typeDistributionByYear,
        difficulty_trend: difficultyTrend,
        top_knowledge_points: knowledgeRows,
        summary: generateSubjectSummary(subjectInfo, papersRows, typeRows, difficultyTrend, exam_level),
        cached: false
      };
    }, CACHE_CONFIG.LONG_TTL);

    res.json(successResponse({ ...trends, cached }, '获取学科趋势成功'));
  } catch (error) {
    console.error('获取学科趋势失败:', error.message);
    res.status(500).json(errorResponse('获取学科趋势失败'));
  }
}

function generateSubjectSummary(subject, papers, types, difficultyTrend, examLevel) {
  const examLabel = examLevel === 'zhongkao' ? '中考' : '高考';
  const summary = {
    title: `${subject.name}${examLabel}命题趋势分析`,
    highlights: [],
    recommendations: [],
    tags: []
  };

  if (papers.length > 0) {
    const provinces = [...new Set(papers.map(p => p.province_name))];
    summary.highlights.push(`覆盖${provinces.length}个省份，共${papers.length}套试卷`);
    summary.tags.push(`覆盖${provinces.length}省`);
  }

  if (types.length > 0) {
    const mainTypes = types.slice(0, 3).map(t => t.question_type_name || t.question_type);
    summary.highlights.push(`主要题型：${mainTypes.join('、')}`);
    types.slice(0, 3).forEach(t => {
      summary.tags.push(`${t.question_type_name || t.question_type}: ${t.count}题`);
    });
  }

  if (difficultyTrend.length > 0) {
    const avgDiff = difficultyTrend.reduce((sum, d) => sum + d.avg_difficulty, 0) / difficultyTrend.length;
    const diffLabel = avgDiff < 2.5 ? '偏易' : avgDiff < 3.5 ? '适中' : '偏难';
    summary.highlights.push(`整体难度：${diffLabel}（平均${avgDiff.toFixed(1)}）`);

    if (difficultyTrend.length >= 2) {
      const first = difficultyTrend[0];
      const last = difficultyTrend[difficultyTrend.length - 1];
      const change = first.avg_difficulty - last.avg_difficulty;
      if (Math.abs(change) > 0.2) {
        const trendLabel = change > 0 ? '上升' : '下降';
        summary.highlights.push(`难度趋势：${trendLabel}（${Math.abs(change).toFixed(2)}）`);
        summary.tags.push(`难度${trendLabel}`);
      }
    }
  }

  summary.recommendations.push('建议重点关注高频考点和近年新增题型');
  summary.recommendations.push('根据难度变化调整复习策略');

  return summary;
}
