import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getKnowledgeProfile(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();

    const masteryResult = await pool.query(`
      SELECT kp.*, s.name as subject_name, kps.name as knowledge_point_name
      FROM student_knowledge_mastery kp
      LEFT JOIN subjects s ON kp.subject_code = s.code
      LEFT JOIN knowledge_points kps ON kp.knowledge_point_id = kps.id
      WHERE kp.user_email = $1
      ORDER BY kp.mastery_score ASC
    `, [email]);

    const wrongQuestionsResult = await pool.query(`
      SELECT subject_code, knowledge_point_id, knowledge_point_name, 
             error_category, COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = $1
      GROUP BY subject_code, knowledge_point_id, knowledge_point_name, error_category
      ORDER BY error_count DESC
    `, [email]);

    const weakPoints = masteryResult.rows
      .filter(r => r.mastery_score < 60)
      .slice(0, 10)
      .map(r => ({
        id: r.knowledge_point_id,
        name: r.knowledge_point_name || '未知知识点',
        subject: r.subject_name || r.subject_code,
        subject_code: r.subject_code,
        score: r.mastery_score,
        correct_count: r.correct_count,
        total_count: r.total_count,
        last_practiced_at: r.last_practiced_at
      }));

    const strongPoints = masteryResult.rows
      .filter(r => r.mastery_score >= 80)
      .slice(0, 10)
      .map(r => ({
        id: r.knowledge_point_id,
        name: r.knowledge_point_name || '未知知识点',
        subject: r.subject_name || r.subject_code,
        subject_code: r.subject_code,
        score: r.mastery_score,
        correct_count: r.correct_count,
        total_count: r.total_count
      }));

    const subjectSummary = masteryResult.rows.reduce((acc, row) => {
      const subject = row.subject_name || row.subject_code;
      if (!acc[subject]) {
        acc[subject] = { total: 0, sum: 0, count: 0, error_count: 0 };
      }
      acc[subject].total += row.mastery_score;
      acc[subject].count++;
      return acc;
    }, {});

    const wrongByCategory = wrongQuestionsResult.rows.reduce((acc, row) => {
      const category = row.error_category || 'unknown';
      acc[category] = (acc[category] || 0) + row.error_count;
      return acc;
    }, {});

    const wrongBySubject = wrongQuestionsResult.rows.reduce((acc, row) => {
      const subject = row.subject_code;
      acc[subject] = (acc[subject] || 0) + row.error_count;
      return acc;
    }, {});

    Object.keys(subjectSummary).forEach(subject => {
      subjectSummary[subject].avg_score = Math.round(subjectSummary[subject].total / subjectSummary[subject].count);
      subjectSummary[subject].error_count = wrongBySubject[subject] || 0;
    });

    const overallAvgScore = masteryResult.rows.length > 0
      ? Math.round(masteryResult.rows.reduce((sum, r) => sum + r.mastery_score, 0) / masteryResult.rows.length)
      : 0;

    const totalWrongCount = wrongQuestionsResult.rows.reduce((sum, r) => sum + r.error_count, 0);

    const categoryMap = {
      concept: { name: '概念不清', color: '#ef4444' },
      calculation: { name: '计算失误', color: '#f59e0b' },
      comprehension: { name: '审题偏差', color: '#8b5cf6' },
      method: { name: '方法不当', color: '#06b6d4' },
      careless: { name: '粗心大意', color: '#f97316' },
      unknown: { name: '其他', color: '#6b7280' }
    };

    return res.json(successResponse({
      overall: {
        avg_score: overallAvgScore,
        total_knowledge_points: masteryResult.rows.length,
        weak_points_count: weakPoints.length,
        strong_points_count: strongPoints.length,
        total_wrong_count: totalWrongCount
      },
      subject_summary: subjectSummary,
      weak_points: weakPoints,
      strong_points: strongPoints,
      error_category_distribution: Object.keys(wrongByCategory).map(key => ({
        code: key,
        name: categoryMap[key]?.name || key,
        color: categoryMap[key]?.color || '#6b7280',
        count: wrongByCategory[key]
      })),
      knowledge_graph: masteryResult.rows.map(r => ({
        id: r.knowledge_point_id,
        name: r.knowledge_point_name || '未知知识点',
        subject: r.subject_name || r.subject_code,
        subject_code: r.subject_code,
        score: r.mastery_score,
        level: getMasteryLevel(r.mastery_score),
        correct_count: r.correct_count,
        total_count: r.total_count,
        last_practiced_at: r.last_practiced_at
      }))
    }, '获取知识掌握画像成功'));
  } catch (error) {
    console.error('[KnowledgeProfile] 获取知识掌握画像失败:', error.message);
    return res.status(500).json(errorResponse('获取知识掌握画像失败'));
  }
}

export async function updateKnowledgeMastery(req, res) {
  const { email } = req.user;
  const { knowledge_point_id, subject_code, correct } = req.body;

  if (!knowledge_point_id || !subject_code) {
    return res.status(400).json(errorResponse('缺少必填字段: knowledge_point_id, subject_code'));
  }

  try {
    const pool = await getDb();

    const existingResult = await pool.query(`
      SELECT * FROM student_knowledge_mastery
      WHERE user_email = $1 AND knowledge_point_id = $2
    `, [email, knowledge_point_id]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const newCorrectCount = existing.correct_count + (correct ? 1 : 0);
      const newTotalCount = existing.total_count + 1;
      const newMasteryScore = Math.round((newCorrectCount / newTotalCount) * 100);

      await pool.query(`
        UPDATE student_knowledge_mastery
        SET correct_count = $1, total_count = $2, mastery_score = $3, 
            last_practiced_at = NOW(), updated_at = NOW()
        WHERE user_email = $4 AND knowledge_point_id = $5
      `, [newCorrectCount, newTotalCount, newMasteryScore, email, knowledge_point_id]);
    } else {
      const masteryScore = correct ? 100 : 0;
      await pool.query(`
        INSERT INTO student_knowledge_mastery 
          (user_email, knowledge_point_id, subject_code, correct_count, total_count, mastery_score)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [email, knowledge_point_id, subject_code, correct ? 1 : 0, 1, masteryScore]);
    }

    return res.json(successResponse({}, '更新知识掌握成功'));
  } catch (error) {
    console.error('[KnowledgeProfile] 更新知识掌握失败:', error.message);
    return res.status(500).json(errorResponse('更新知识掌握失败'));
  }
}

export async function getLearningSuggestions(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();

    const weakPointsResult = await pool.query(`
      SELECT kp.knowledge_point_id, kps.name as knowledge_point_name, 
             s.name as subject_name, kp.subject_code, kp.mastery_score
      FROM student_knowledge_mastery kp
      LEFT JOIN knowledge_points kps ON kp.knowledge_point_id = kps.id
      LEFT JOIN subjects s ON kp.subject_code = s.code
      WHERE kp.user_email = $1 AND kp.mastery_score < 60
      ORDER BY kp.mastery_score ASC
      LIMIT 5
    `, [email]);

    const wrongResult = await pool.query(`
      SELECT knowledge_point_id, knowledge_point_name, subject_code, error_category,
             COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = $1
      GROUP BY knowledge_point_id, knowledge_point_name, subject_code, error_category
      ORDER BY error_count DESC
      LIMIT 5
    `, [email]);

    const suggestions = [];

    weakPointsResult.rows.forEach(row => {
      suggestions.push({
        type: 'weak_point',
        knowledge_point_id: row.knowledge_point_id,
        knowledge_point_name: row.knowledge_point_name || '未知知识点',
        subject: row.subject_name || row.subject_code,
        subject_code: row.subject_code,
        mastery_score: row.mastery_score,
        suggestion: `知识点「${row.knowledge_point_name || '未知知识点'}」掌握程度较低，建议重点复习该知识点的基础概念和典型例题。`
      });
    });

    wrongResult.rows.forEach(row => {
      const categoryMap = {
        concept: '概念理解',
        calculation: '计算能力',
        comprehension: '审题能力',
        method: '解题方法',
        careless: '细心程度'
      };
      suggestions.push({
        type: 'frequent_error',
        knowledge_point_id: row.knowledge_point_id,
        knowledge_point_name: row.knowledge_point_name || '未知知识点',
        subject_code: row.subject_code,
        error_category: row.error_category,
        error_category_name: categoryMap[row.error_category] || '其他',
        error_count: row.error_count,
        suggestion: `在「${row.knowledge_point_name || '未知知识点'}」上多次出错，主要问题在于${categoryMap[row.error_category] || '其他'}，建议针对性练习。`
      });
    });

    return res.json(successResponse({ suggestions }, '获取学习建议成功'));
  } catch (error) {
    console.error('[KnowledgeProfile] 获取学习建议失败:', error.message);
    return res.status(500).json(errorResponse('获取学习建议失败'));
  }
}

function getMasteryLevel(score) {
  if (score >= 90) return 'mastered';
  if (score >= 70) return 'proficient';
  if (score >= 50) return 'learning';
  return 'weak';
}
