import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolveSubjectName, resolveSubjectKey } from '../utils/subjectMap.js';

export async function getClassAnalysis(req, res) {
  const pool = await getDb();
  const email = req.user.email;

  try {
    const subjectsResult = await pool.query(`
      SELECT subject_code, COUNT(*) as count,
             AVG(score) as avg_score
      FROM reports
      WHERE user_email = $1
      GROUP BY subject_code
    `, [email]);
    const subjects = subjectsResult.rows;

    const weakPointsResult = await pool.query(`
      SELECT subject_code, COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = $1
      GROUP BY subject_code
      ORDER BY error_count DESC
    `, [email]);
    const weakPoints = weakPointsResult.rows;

    const recentActivityResult = await pool.query(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM (
        SELECT timestamp FROM wrong_questions WHERE user_email = $1
        UNION ALL
        SELECT timestamp FROM reports WHERE user_email = $2
      ) sub
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, [email, email]);
    const recentActivity = recentActivityResult.rows;

    const knowledgeDistributionResult = await pool.query(`
      SELECT
        wq.subject_code,
        wq.knowledge_point_id,
        kp.name as knowledge_point,
        COUNT(*) as frequency
      FROM wrong_questions wq
      LEFT JOIN knowledge_points kp ON wq.knowledge_point_id = kp.id
      WHERE wq.user_email = $1
      GROUP BY wq.subject_code, wq.knowledge_point_id, kp.name
      ORDER BY frequency DESC
      LIMIT 20
    `, [email]);
    const knowledgeDistribution = knowledgeDistributionResult.rows;

    const progressTrendResult = await pool.query(`
      SELECT
        DATE(timestamp) as date,
        subject_code,
        COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = $1 AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(timestamp), subject_code
      ORDER BY date ASC
    `, [email]);
    const progressTrend = progressTrendResult.rows;

    const examHistoryResult = await pool.query(`
      SELECT
        subject,
        correct_count,
        total_questions,
        created_at
      FROM exam_sessions
      WHERE user_email = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [email]);
    const examHistory = examHistoryResult.rows;

    const subjectWarning = subjects.map(s => {
      const weak = weakPoints.find(w => w.subject_code === s.subject_code);
      return {
        subject: resolveSubjectName(s.subject_code),
        avgScore: s.avg_score ? Number(s.avg_score).toFixed(1) : null,
        errorCount: weak ? weak.error_count : 0,
        warning: weak && weak.error_count > 5 ? '偏科预警' : '正常'
      };
    });

    res.json({
      success: true,
      data: {
        subjects: subjectWarning,
        weakPoints: knowledgeDistribution.map(kp => ({
          ...kp,
          subject: resolveSubjectName(kp.subject_code)
        })),
        recentActivity,
        progressTrend: progressTrend.map(pt => ({
          ...pt,
          subject: resolveSubjectName(pt.subject_code)
        })),
        examHistory,
        summary: {
          totalSubjects: subjects.length,
          warningSubjects: subjectWarning.filter(s => s.warning === '偏科预警').length,
          totalErrors: weakPoints.reduce((sum, w) => sum + w.error_count, 0),
          activeDays: recentActivity.length
        }
      }
    });
  } catch (error) {
    console.error('学情分析失败:', error.message);
    res.status(500).json(errorResponse('学情分析失败'));
  }
}

export async function getTeacherDashboard(req, res) {
  const pool = await getDb();

  try {
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const activeTodayResult = await pool.query(`
      SELECT COUNT(DISTINCT user_email) as count
      FROM wrong_questions
      WHERE DATE(timestamp) = CURRENT_DATE
    `);
    const totalQuestionsResult = await pool.query('SELECT COUNT(*) as count FROM exam_questions');
    const totalPapersResult = await pool.query('SELECT COUNT(*) as count FROM exam_papers');

    const subjectStatsResult = await pool.query(`
      SELECT subject_code, COUNT(*) as user_count
      FROM (
        SELECT DISTINCT user_email, subject_code
        FROM wrong_questions
        WHERE subject_code IS NOT NULL
      ) sub
      GROUP BY subject_code
      ORDER BY user_count DESC
    `);

    const difficultyDistributionResult = await pool.query(`
      SELECT difficulty, COUNT(*) as count
      FROM exam_questions
      WHERE difficulty IS NOT NULL
      GROUP BY difficulty
      ORDER BY difficulty
    `);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers: totalUsersResult.rows[0]?.count || 0,
          activeToday: activeTodayResult.rows[0]?.count || 0,
          totalQuestions: totalQuestionsResult.rows[0]?.count || 0,
          totalPapers: totalPapersResult.rows[0]?.count || 0
        },
        subjectStats: subjectStatsResult.rows,
        difficultyDistribution: difficultyDistributionResult.rows
      }
    });
  } catch (error) {
    console.error('教师仪表盘加载失败:', error.message);
    res.status(500).json(errorResponse('教师仪表盘加载失败'));
  }
}

export async function getClassDetail(req, res) {
  const pool = await getDb();
  const { subject, period = '30' } = req.query;
  const periodDays = Math.min(Math.max(parseInt(period) || 30, 7), 365);
  const subjectStr = subject || '';
  const subjectNameStr = resolveSubjectName(subject) || '';

  try {
    const studentPerformanceResult = await pool.query(`
      SELECT
        u.email,
        u.name,
        COUNT(DISTINCT wq.id) as error_count,
        COUNT(DISTINCT es.id) as exam_count,
        AVG(CASE WHEN es.total_questions > 0
          THEN CAST(es.correct_count AS DOUBLE PRECISION) / es.total_questions
          ELSE NULL END) as avg_accuracy
      FROM users u
      LEFT JOIN wrong_questions wq ON u.email = wq.user_email
        AND wq.timestamp >= CURRENT_DATE - CAST($1 AS INTEGER) * INTERVAL '1 day'
      LEFT JOIN exam_sessions es ON u.email = es.user_email
        AND es.created_at >= CURRENT_DATE - CAST($2 AS INTEGER) * INTERVAL '1 day'
        AND ($3 = '' OR es.subject = $4 OR es.subject = $5)
      GROUP BY u.email, u.name
      HAVING COUNT(DISTINCT wq.id) > 0 OR COUNT(DISTINCT es.id) > 0
      ORDER BY avg_accuracy ASC
      LIMIT 50
    `, [periodDays, periodDays, subjectStr, subjectStr, subjectNameStr]);
    const studentPerformance = studentPerformanceResult.rows;

    const classWeakPointsResult = await pool.query(`
      SELECT
        wq.data::jsonb->>'knowledge_point' as knowledge_point,
        wq.data::jsonb->>'subject' as subject,
        COUNT(*) as frequency,
        COUNT(DISTINCT wq.user_email) as affected_students
      FROM wrong_questions wq
      WHERE wq.timestamp >= CURRENT_DATE - CAST($1 AS INTEGER) * INTERVAL '1 day'
        AND ($2 = '' OR wq.data::jsonb->>'subject' = $3 OR wq.data::jsonb->>'subject' = $4)
      GROUP BY wq.data::jsonb->>'knowledge_point', wq.data::jsonb->>'subject'
      HAVING wq.data::jsonb->>'knowledge_point' IS NOT NULL
      ORDER BY frequency DESC
      LIMIT 20
    `, [periodDays, subjectStr, subjectStr, subjectNameStr]);
    const classWeakPoints = classWeakPointsResult.rows;

    const weeklyTrendResult = await pool.query(`
      SELECT
        to_char(timestamp, 'IYYY-IW') as week,
        COUNT(*) as total_errors,
        COUNT(DISTINCT user_email) as active_students
      FROM wrong_questions
      WHERE timestamp >= CURRENT_DATE - CAST($1 AS INTEGER) * INTERVAL '1 day'
        AND ($2 = '' OR data::jsonb->>'subject' = $3 OR data::jsonb->>'subject' = $4)
      GROUP BY to_char(timestamp, 'IYYY-IW')
      ORDER BY week ASC
    `, [periodDays, subjectStr, subjectStr, subjectNameStr]);
    const weeklyTrend = weeklyTrendResult.rows;

    const scoreDistributionResult = await pool.query(`
      SELECT
        CASE
          WHEN CAST(correct_count AS DOUBLE PRECISION) / total_questions >= 0.9 THEN '90-100'
          WHEN CAST(correct_count AS DOUBLE PRECISION) / total_questions >= 0.8 THEN '80-89'
          WHEN CAST(correct_count AS DOUBLE PRECISION) / total_questions >= 0.7 THEN '70-79'
          WHEN CAST(correct_count AS DOUBLE PRECISION) / total_questions >= 0.6 THEN '60-69'
          ELSE '0-59'
        END as score_range,
        COUNT(*) as count
      FROM exam_sessions
      WHERE created_at >= CURRENT_DATE - CAST($1 AS INTEGER) * INTERVAL '1 day'
        AND ($2 = '' OR subject = $3 OR subject = $4)
        AND total_questions > 0
      GROUP BY score_range
      ORDER BY score_range DESC
    `, [periodDays, subjectStr, subjectStr, subjectNameStr]);
    const scoreDistribution = scoreDistributionResult.rows;

    res.json(successResponse({
      studentPerformance,
      classWeakPoints,
      weeklyTrend,
      scoreDistribution,
      period: periodDays,
      subject: subject || 'all'
    }));
  } catch (error) {
    console.error('班级详情分析失败:', error.message);
    res.status(500).json(errorResponse('班级详情分析失败'));
  }
}
