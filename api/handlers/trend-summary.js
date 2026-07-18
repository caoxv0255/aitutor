import { getDb } from '../core/db.js';
import { cacheWrapper, CACHE_CONFIG } from '../utils/cache.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getExpertSummary(req, res) {
  const { province, subject, exam_level = 'gaokao', year } = req.query;

  if (!province && !subject) {
    return res.status(400).json(errorResponse('请提供省份或学科参数'));
  }

  const cacheKey = `expert_summary_${province || 'all'}_${subject || 'all'}_${exam_level}_${year || 'latest'}`;

  try {
    const { data: summary, cached } = await cacheWrapper(cacheKey, async () => {
      const pool = await getDb();
      const currentYear = year || new Date().getFullYear();

      let queries = [];

      if (province) {
        queries.push(getProvinceAnalysis(pool, province, exam_level, currentYear));
      }

      if (subject) {
        queries.push(getSubjectAnalysis(pool, subject, province, exam_level, currentYear));
      }

      queries.push(getNationalTrend(pool, exam_level, currentYear));

      const results = await Promise.all(queries);

      let combinedSummary = {
        title: '',
        overview: '',
        key_findings: [],
        difficulty_analysis: {},
        type_analysis: {},
        knowledge_analysis: {},
        recommendations: [],
        expert_comments: [],
        tags: []
      };

      results.forEach(result => {
        if (result) {
          if (result.title) combinedSummary.title = combinedSummary.title || result.title;
          if (result.overview) combinedSummary.overview += (combinedSummary.overview ? '\n' : '') + result.overview;
          if (result.key_findings) combinedSummary.key_findings = combinedSummary.key_findings.concat(result.key_findings);
          if (result.difficulty_analysis) Object.assign(combinedSummary.difficulty_analysis, result.difficulty_analysis);
          if (result.type_analysis) Object.assign(combinedSummary.type_analysis, result.type_analysis);
          if (result.knowledge_analysis) Object.assign(combinedSummary.knowledge_analysis, result.knowledge_analysis);
          if (result.recommendations) combinedSummary.recommendations = combinedSummary.recommendations.concat(result.recommendations);
          if (result.expert_comments) combinedSummary.expert_comments = combinedSummary.expert_comments.concat(result.expert_comments);
          if (result.tags) combinedSummary.tags = combinedSummary.tags.concat(result.tags);
        }
      });

      combinedSummary.expert_comments = generateExpertComments(combinedSummary, exam_level);

      return { ...combinedSummary, cached: false };
    }, CACHE_CONFIG.LONG_TTL);

    res.json(successResponse({ ...summary, cached }, '获取专家总结成功'));
  } catch (error) {
    console.error('获取专家总结失败:', error.message);
    res.status(500).json(errorResponse('获取专家总结失败'));
  }
}

async function getProvinceAnalysis(pool, province, examLevel, year) {
  const examLabel = examLevel === 'zhongkao' ? '中考' : '高考';

  const provinceResult = await pool.query('SELECT name FROM provinces WHERE code = $1', [province]);
  const provinceName = provinceResult.rows[0]?.name || province;

  const paperResult = await pool.query(`
    SELECT COUNT(*) as paper_count, AVG(difficulty_avg) as avg_difficulty, AVG(total_score) as avg_score
    FROM exam_papers
    WHERE province_code = $1 AND year = $2 AND exam_level = $3
  `, [province, year, examLevel]);

  const paperData = paperResult.rows[0];

  if (!paperData || paperData.paper_count === 0) {
    return null;
  }

  const typeResult = await pool.query(`
    SELECT eq.question_type, qt.name as type_name, COUNT(*) as count, AVG(eq.score) as avg_score
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    LEFT JOIN question_types qt ON eq.question_type = qt.code
    WHERE ep.province_code = $1 AND ep.year = $2 AND ep.exam_level = $3
    GROUP BY eq.question_type, qt.name ORDER BY count DESC LIMIT 5
  `, [province, year, examLevel]);

  const knowledgeResult = await pool.query(`
    SELECT kp.name as knowledge_point_name, pk.frequency, pk.avg_difficulty, pk.total_score
    FROM province_knowledge_stats pk
    JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
    WHERE pk.province_code = $1 AND pk.year = $2 AND pk.exam_level = $3
    ORDER BY pk.frequency DESC LIMIT 5
  `, [province, year, examLevel]);

  const difficultyLevel = parseFloat(paperData.avg_difficulty) || 0;
  const diffLabel = difficultyLevel < 2.5 ? '较低' : difficultyLevel < 3.5 ? '适中' : '较高';

  return {
    title: `${provinceName}${examLabel}${year}年命题分析`,
    overview: `${provinceName}${year}年${examLabel}共收录${paperData.paper_count}套试卷，平均难度${difficultyLevel.toFixed(1)}，属于${diffLabel}水平。`,
    key_findings: [
      `试卷数量：${paperData.paper_count}套`,
      `平均难度：${difficultyLevel.toFixed(1)}（${diffLabel}）`,
      `平均总分：${Math.round(paperData.avg_score || 0)}分`
    ],
    difficulty_analysis: {
      level: difficultyLevel,
      label: diffLabel,
      description: `整体难度${diffLabel}，适合${examLabel}备考学生进行针对性练习`
    },
    type_analysis: {
      top_types: typeResult.rows.slice(0, 3).map(t => ({
        type: t.type_name || t.question_type,
        count: t.count,
        avg_score: parseFloat(t.avg_score) || 0
      }))
    },
    knowledge_analysis: {
      top_points: knowledgeResult.rows.slice(0, 3).map(k => ({
        name: k.knowledge_point_name,
        frequency: k.frequency,
        difficulty: parseFloat(k.avg_difficulty) || 0
      }))
    },
    recommendations: [
      `重点关注${typeResult.rows[0]?.type_name || typeResult.rows[0]?.question_type}题型`,
      `加强${knowledgeResult.rows[0]?.knowledge_point_name}知识点的复习`
    ],
    tags: [`${provinceName}`, `${year}年`, `难度${diffLabel}`]
  };
}

async function getSubjectAnalysis(pool, subject, province, examLevel, year) {
  const examLabel = examLevel === 'zhongkao' ? '中考' : '高考';

  const subjectResult = await pool.query('SELECT name FROM subjects WHERE code = $1', [subject]);
  const subjectName = subjectResult.rows[0]?.name || subject;

  let query = `
    SELECT COUNT(DISTINCT ep.id) as paper_count, AVG(ep.difficulty_avg) as avg_difficulty,
           COUNT(eq.id) as question_count, AVG(eq.difficulty) as avg_q_difficulty
    FROM exam_papers ep
    LEFT JOIN exam_questions eq ON ep.id = eq.paper_id
    WHERE ep.subject = $1 AND ep.year = $2 AND ep.exam_level = $3
  `;
  let params = [subject, year, examLevel];
  if (province) {
    query += ' AND ep.province_code = $4';
    params.push(province);
  }

  const paperResult = await pool.query(query, params);
  const paperData = paperResult.rows[0];

  if (!paperData || paperData.paper_count === 0) {
    return null;
  }

  const typeResult = await pool.query(`
    SELECT eq.question_type, qt.name as type_name, COUNT(*) as count,
           AVG(eq.difficulty) as avg_difficulty, AVG(eq.score) as avg_score
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    LEFT JOIN question_types qt ON eq.question_type = qt.code
    WHERE ep.subject = $1 AND ep.year = $2 AND ep.exam_level = $3
    ${province ? 'AND ep.province_code = $4' : ''}
    GROUP BY eq.question_type, qt.name ORDER BY count DESC LIMIT 5
  `, province ? [subject, year, examLevel, province] : [subject, year, examLevel]);

  const difficultyLevel = parseFloat(paperData.avg_q_difficulty) || parseFloat(paperData.avg_difficulty) || 0;
  const diffLabel = difficultyLevel < 2.5 ? '基础' : difficultyLevel < 3.5 ? '中档' : '较难';

  return {
    title: `${subjectName}${examLabel}${year}年命题分析`,
    overview: `${subjectName}${year}年${examLabel}共收录${paperData.paper_count}套试卷，${paperData.question_count}道题目，平均难度${difficultyLevel.toFixed(1)}。`,
    key_findings: [
      `题目数量：${paperData.question_count}道`,
      `平均难度：${difficultyLevel.toFixed(1)}（${diffLabel}）`,
      `试卷数量：${paperData.paper_count}套`
    ],
    type_analysis: {
      top_types: typeResult.rows.map(t => ({
        type: t.type_name || t.question_type,
        count: t.count,
        difficulty: parseFloat(t.avg_difficulty) || 0,
        avg_score: parseFloat(t.avg_score) || 0
      }))
    },
    recommendations: [
      `重点练习${typeResult.rows[0]?.type_name || typeResult.rows[0]?.question_type}题型`,
      `针对难度${diffLabel}的题目进行专项训练`
    ],
    tags: [`${subjectName}`, `${year}年`, `${diffLabel}`]
  };
}

async function getNationalTrend(pool, examLevel, year) {
  const examLabel = examLevel === 'zhongkao' ? '中考' : '高考';

  const yearResult = await pool.query(`
    SELECT year, COUNT(DISTINCT id) as paper_count, AVG(difficulty_avg) as avg_difficulty
    FROM exam_papers
    WHERE exam_level = $1 AND year >= $2 - 4 AND year <= $2
    GROUP BY year ORDER BY year DESC
  `, [examLevel, year]);

  const rows = yearResult.rows;

  if (rows.length < 2) {
    return null;
  }

  const latest = rows[0];
  const prev = rows[1];

  const difficultyChange = parseFloat(latest.avg_difficulty) - parseFloat(prev.avg_difficulty);
  const difficultyTrend = difficultyChange > 0.1 ? '上升' : difficultyChange < -0.1 ? '下降' : '稳定';

  return {
    overview: `${examLabel}近5年共收录${rows.reduce((sum, r) => sum + r.paper_count, 0)}套试卷，${year}年难度${difficultyTrend}。`,
    key_findings: [
      `近5年试卷总量：${rows.reduce((sum, r) => sum + r.paper_count, 0)}套`,
      `${year}年试卷数量：${latest.paper_count}套`,
      `难度趋势：${difficultyTrend}（变化${difficultyChange.toFixed(2)}）`
    ],
    tags: [`${examLabel}`, '全国趋势', `${difficultyTrend}`]
  };
}

function generateExpertComments(summary, examLevel) {
  const examLabel = examLevel === 'zhongkao' ? '中考' : '高考';
  const comments = [];

  if (summary.difficulty_analysis) {
    const { level, label } = summary.difficulty_analysis;
    if (label === '较高') {
      comments.push({
        expert: '资深命题专家',
        content: `${examLabel}难度${label}，建议学生加强综合能力训练，注重知识点之间的联系和应用。`,
        rating: 5
      });
    } else if (label === '适中') {
      comments.push({
        expert: '教育教研主任',
        content: `${examLabel}难度${label}，符合选拔性考试的定位，建议学生夯实基础，稳步提升。`,
        rating: 4
      });
    } else {
      comments.push({
        expert: '一线教师',
        content: `${examLabel}难度${label}，更注重基础知识的考查，建议学生扎实掌握核心知识点。`,
        rating: 4
      });
    }
  }

  if (summary.type_analysis?.top_types?.length > 0) {
    const mainType = summary.type_analysis.top_types[0];
    comments.push({
      expert: '学科教研员',
      content: `${mainType.type}题型占比最高，建议学生针对性练习，掌握该题型的解题技巧和方法。`,
      rating: 5
    });
  }

  if (summary.knowledge_analysis?.top_points?.length > 0) {
    const topPoint = summary.knowledge_analysis.top_points[0];
    comments.push({
      expert: '特级教师',
      content: `${topPoint.name}是高频考点，且难度较高，建议学生深入理解该知识点的本质和应用场景。`,
      rating: 5
    });
  }

  comments.push({
    expert: '备考指导专家',
    content: `建议制定科学的复习计划，重点突破薄弱环节，合理分配各学科的复习时间。`,
    rating: 4
  });

  return comments;
}
