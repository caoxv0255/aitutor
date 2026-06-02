import { getDb } from './db.js';
import { successResponse, errorResponse } from './utils/response.js';
import { resolveSubjectName, resolveSubjectKey } from './utils/subjectMap.js';

export async function getClassAnalysis(req, res) {
  const db = await getDb();
  const email = req.user.email;

  try {
    const subjects = await db.all(`
      SELECT subject_code, COUNT(*) as count,
             AVG(score) as avg_score
      FROM reports
      WHERE user_email = ?
      GROUP BY subject_code
    `, [email]);

    const weakPoints = await db.all(`
      SELECT subject_code, COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = ?
      GROUP BY subject_code
      ORDER BY error_count DESC
    `, [email]);

    const recentActivity = await db.all(`
      SELECT date(timestamp) as date, COUNT(*) as count
      FROM (
        SELECT timestamp FROM wrong_questions WHERE user_email = ?
        UNION ALL
        SELECT timestamp FROM reports WHERE user_email = ?
      )
      GROUP BY date(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, [email, email]);

    const knowledgeDistribution = await db.all(`
      SELECT
        wq.subject_code,
        wq.knowledge_point_id,
        kp.name as knowledge_point,
        COUNT(*) as frequency
      FROM wrong_questions wq
      LEFT JOIN knowledge_points kp ON wq.knowledge_point_id = kp.id
      WHERE wq.user_email = ?
      GROUP BY wq.subject_code, wq.knowledge_point_id
      ORDER BY frequency DESC
      LIMIT 20
    `, [email]);

    const progressTrend = await db.all(`
      SELECT
        date(timestamp) as date,
        subject_code,
        COUNT(*) as error_count
      FROM wrong_questions
      WHERE user_email = ? AND timestamp >= date('now', '-30 days')
      GROUP BY date(timestamp), subject_code
      ORDER BY date ASC
    `, [email]);

    const examHistory = await db.all(`
      SELECT
        subject,
        correct_count,
        total_questions,
        created_at
      FROM exam_sessions
      WHERE user_email = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [email]);

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
  const db = await getDb();

  try {
    const totalUsers = await db.all('SELECT COUNT(*) as count FROM users');
    const activeToday = await db.all(`
      SELECT COUNT(DISTINCT user_email) as count
      FROM wrong_questions
      WHERE date(timestamp) = date('now')
    `);
    const totalQuestions = await db.all('SELECT COUNT(*) as count FROM exam_questions');
    const totalPapers = await db.all('SELECT COUNT(*) as count FROM exam_papers');

    const subjectStats = await db.all(`
      SELECT subject_code, COUNT(*) as user_count
      FROM (
        SELECT DISTINCT user_email, subject_code
        FROM wrong_questions
        WHERE subject_code IS NOT NULL
      )
      GROUP BY subject_code
      ORDER BY user_count DESC
    `);

    const difficultyDistribution = await db.all(`
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
          totalUsers: totalUsers[0]?.count || 0,
          activeToday: activeToday[0]?.count || 0,
          totalQuestions: totalQuestions[0]?.count || 0,
          totalPapers: totalPapers[0]?.count || 0
        },
        subjectStats,
        difficultyDistribution
      }
    });
  } catch (error) {
    console.error('教师仪表盘加载失败:', error.message);
    res.status(500).json(errorResponse('教师仪表盘加载失败'));
  }
}

export async function getClassDetail(req, res) {
  const db = await getDb();
  const { subject, period = '30' } = req.query;
  const periodDays = Math.min(Math.max(parseInt(period) || 30, 7), 365);

  try {
    const studentPerformance = await db.all(`
      SELECT
        u.email,
        u.name,
        COUNT(DISTINCT wq.id) as error_count,
        COUNT(DISTINCT es.id) as exam_count,
        AVG(CASE WHEN es.total_questions > 0
          THEN CAST(es.correct_count AS REAL) / es.total_questions
          ELSE NULL END) as avg_accuracy
      FROM users u
      LEFT JOIN wrong_questions wq ON u.email = wq.user_email
        AND wq.timestamp >= date('now', '-' || ? || ' days')
      LEFT JOIN exam_sessions es ON u.email = es.user_email
        AND es.created_at >= date('now', '-' || ? || ' days')
        AND (? = '' OR es.subject = ? OR es.subject = ?)
      GROUP BY u.email, u.name
      HAVING error_count > 0 OR exam_count > 0
      ORDER BY avg_accuracy ASC
      LIMIT 50
    `, [periodDays, periodDays, subject || '', subject || '', resolveSubjectName(subject) || '']);

    const classWeakPoints = await db.all(`
      SELECT
        json_extract(wq.data, '$.knowledge_point') as knowledge_point,
        json_extract(wq.data, '$.subject') as subject,
        COUNT(*) as frequency,
        COUNT(DISTINCT wq.user_email) as affected_students
      FROM wrong_questions wq
      WHERE wq.timestamp >= date('now', '-' || ? || ' days')
        AND (? = '' OR json_extract(wq.data, '$.subject') = ? OR json_extract(wq.data, '$.subject') = ?)
      GROUP BY knowledge_point, subject
      HAVING knowledge_point IS NOT NULL
      ORDER BY frequency DESC
      LIMIT 20
    `, [periodDays, subject || '', subject || '', resolveSubjectName(subject) || '']);

    const weeklyTrend = await db.all(`
      SELECT
        strftime('%Y-%W', timestamp) as week,
        COUNT(*) as total_errors,
        COUNT(DISTINCT user_email) as active_students
      FROM wrong_questions
      WHERE timestamp >= date('now', '-' || ? || ' days')
        AND (? = '' OR json_extract(data, '$.subject') = ? OR json_extract(data, '$.subject') = ?)
      GROUP BY week
      ORDER BY week ASC
    `, [periodDays, subject || '', subject || '', resolveSubjectName(subject) || '']);

    const scoreDistribution = await db.all(`
      SELECT
        CASE
          WHEN CAST(correct_count AS REAL) / total_questions >= 0.9 THEN '90-100'
          WHEN CAST(correct_count AS REAL) / total_questions >= 0.8 THEN '80-89'
          WHEN CAST(correct_count AS REAL) / total_questions >= 0.7 THEN '70-79'
          WHEN CAST(correct_count AS REAL) / total_questions >= 0.6 THEN '60-69'
          ELSE '0-59'
        END as score_range,
        COUNT(*) as count
      FROM exam_sessions
      WHERE created_at >= date('now', '-' || ? || ' days')
        AND (? = '' OR subject = ? OR subject = ?)
        AND total_questions > 0
      GROUP BY score_range
      ORDER BY score_range DESC
    `, [periodDays, subject || '', subject || '', resolveSubjectName(subject) || '']);

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
