import { getDb } from './db.js';
import { cacheWrapper, CACHE_CONFIG } from './utils/cache.js';
import { successResponse, errorResponse } from './utils/response.js';

export async function getLearningDashboard(req, res) {
  const email = req.user.email;
  const cacheKey = `learning_dashboard_${email}`;

  try {
    const { data: dashboard } = await cacheWrapper(cacheKey, async () => {
      const pool = await getDb();

      const [
        wrongQuestionsResult,
        userInfoResult,
        practiceStatsResult,
        weakPointsResult,
        learningHistoryResult
      ] = await Promise.all([
        pool.query(
          'SELECT subject_code, COUNT(*) as count FROM wrong_questions WHERE user_email = $1 GROUP BY subject_code',
          [email]
        ).then(r => r.rows),
        pool.query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows),
        pool.query(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as practice_count,
            AVG(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as accuracy
          FROM practice_records
          WHERE user_email = $1
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 7
        `, [email]).then(r => r.rows),
        pool.query(`
          SELECT 
            kp.id,
            kp.name,
            kp.subject,
            COALESCE(wq.count, 0) as wrong_count,
            COALESCE(pc.practice_count, 0) as practice_count,
            COALESCE(pc.accuracy, 0) as accuracy
          FROM knowledge_points kp
          LEFT JOIN (
            SELECT knowledge_point_id, COUNT(*) as count 
            FROM wrong_questions 
            WHERE user_email = $1
            GROUP BY knowledge_point_id
          ) wq ON kp.id = wq.knowledge_point_id
          LEFT JOIN (
            SELECT knowledge_point_id, COUNT(*) as practice_count,
                   AVG(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as accuracy
            FROM practice_records
            WHERE user_email = $2
            GROUP BY knowledge_point_id
          ) pc ON kp.id = pc.knowledge_point_id
          ORDER BY wq.count DESC, pc.accuracy ASC
          LIMIT 10
        `, [email, email]).then(r => r.rows),
        pool.query(`
          SELECT 
            to_char(created_at, 'YYYY-MM') as month,
            COUNT(*) as total_practice,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count
          FROM practice_records
          WHERE user_email = $1
          GROUP BY to_char(created_at, 'YYYY-MM')
          ORDER BY month DESC
          LIMIT 6
        `, [email]).then(r => r.rows)
      ]);

      const user = userInfoResult[0];
      
      const totalWrongQuestions = wrongQuestionsResult.reduce((sum, r) => sum + r.count, 0);
      const totalPractice = practiceStatsResult.reduce((sum, r) => sum + r.practice_count, 0);
      const avgAccuracy = practiceStatsResult.length > 0 
        ? practiceStatsResult.reduce((sum, r) => sum + (r.accuracy || 0), 0) / practiceStatsResult.length 
        : 0;

      const subjectDistribution = wrongQuestionsResult.map(r => ({
        subject: r.subject_code,
        count: r.count,
        percentage: totalWrongQuestions > 0 ? ((r.count / totalWrongQuestions) * 100).toFixed(1) : 0
      }));

      const dailyPractice = practiceStatsResult.map(r => ({
        date: r.date,
        practice_count: r.practice_count,
        accuracy: r.accuracy ? (r.accuracy * 100).toFixed(1) : 0
      })).reverse();

      const monthlyTrend = learningHistoryResult.map(r => ({
        month: r.month,
        total_practice: r.total_practice,
        correct_count: r.correct_count,
        accuracy: r.total_practice > 0 ? ((r.correct_count / r.total_practice) * 100).toFixed(1) : 0
      })).reverse();

      const weakPoints = weakPointsResult.map(r => ({
        id: r.id,
        name: r.name,
        subject: r.subject,
        wrong_count: r.wrong_count,
        practice_count: r.practice_count,
        accuracy: r.accuracy ? (r.accuracy * 100).toFixed(1) : 'N/A',
        level: getWeaknessLevel(r.wrong_count, r.accuracy)
      }));

      return {
        user: {
          email: user?.email,
          grade: user?.grade,
          join_date: user?.created_at
        },
        overview: {
          total_wrong_questions: totalWrongQuestions,
          total_practice: totalPractice,
          avg_accuracy: (avgAccuracy * 100).toFixed(1),
          study_days: practiceStatsResult.length
        },
        subject_distribution: subjectDistribution,
        daily_practice: dailyPractice,
        monthly_trend: monthlyTrend,
        weak_points: weakPoints,
        suggestions: generateSuggestions(weakPoints, subjectDistribution)
      };
    }, CACHE_CONFIG.SHORT_TTL);

    res.json(successResponse(dashboard, '获取学习仪表盘数据成功'));
  } catch (error) {
    console.error('获取学习仪表盘失败:', error.message);
    res.status(500).json(errorResponse('获取学习仪表盘失败'));
  }
}

function getWeaknessLevel(wrongCount, accuracy) {
  if (wrongCount >= 5) return 'critical';
  if (wrongCount >= 3) return 'high';
  if (wrongCount >= 1) return 'medium';
  if (accuracy && accuracy < 0.6) return 'warning';
  return 'normal';
}

function generateSuggestions(weakPoints, subjectDistribution) {
  const suggestions = [];
  
  const criticalPoints = weakPoints.filter(p => p.level === 'critical');
  if (criticalPoints.length > 0) {
    suggestions.push({
      type: 'critical',
      message: `发现 ${criticalPoints.length} 个薄弱知识点需要重点关注：${criticalPoints.slice(0, 3).map(p => p.name).join('、')}`,
      action: '建议集中复习这些知识点的相关题目'
    });
  }

  const highSubjects = subjectDistribution.filter(s => parseFloat(s.percentage) > 30);
  if (highSubjects.length > 0) {
    suggestions.push({
      type: 'warning',
      message: `${highSubjects[0].subject} 错题占比较高（${highSubjects[0].percentage}%）`,
      action: '建议加强该学科的练习'
    });
  }

  const lowAccuracyPoints = weakPoints.filter(p => p.practice_count >= 3 && p.accuracy !== 'N/A' && parseFloat(p.accuracy) < 70);
  if (lowAccuracyPoints.length > 0) {
    suggestions.push({
      type: 'info',
      message: `有 ${lowAccuracyPoints.length} 个知识点练习正确率较低`,
      action: '建议回顾相关知识点并增加练习'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'success',
      message: '学习状态良好',
      action: '继续保持，建议定期复习已掌握的知识点'
    });
  }

  return suggestions;
}
