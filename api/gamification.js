import { getDb } from './db.js';
import { errorResponse } from './utils/response.js';

const BADGES = [
  { id: 'first_login', name: '初来乍到', description: '首次登录', icon: '🌟', condition: (stats) => stats.loginDays >= 1 },
  { id: 'week_streak', name: '坚持一周', description: '连续打卡7天', icon: '🔥', condition: (stats) => stats.streakDays >= 7 },
  { id: 'month_streak', name: '月度之星', description: '连续打卡30天', icon: '👑', condition: (stats) => stats.streakDays >= 30 },
  { id: 'first_error', name: '不怕犯错', description: '记录第一道错题', icon: '📝', condition: (stats) => stats.totalErrors >= 1 },
  { id: 'error_50', name: '错题达人', description: '累计记录50道错题', icon: '📚', condition: (stats) => stats.totalErrors >= 50 },
  { id: 'error_200', name: '百炼成钢', description: '累计记录200道错题', icon: '⚔️', condition: (stats) => stats.totalErrors >= 200 },
  { id: 'exam_1', name: '初试锋芒', description: '完成第一次练习', icon: '✏️', condition: (stats) => stats.totalExams >= 1 },
  { id: 'exam_10', name: '勤学苦练', description: '完成10次练习', icon: '📖', condition: (stats) => stats.totalExams >= 10 },
  { id: 'exam_50', name: '题海战术', description: '完成50次练习', icon: '🎓', condition: (stats) => stats.totalExams >= 50 },
  { id: 'accuracy_80', name: '精准射手', description: '单次练习正确率≥80%', icon: '🎯', condition: (stats) => stats.bestAccuracy >= 80 },
  { id: 'accuracy_95', name: '满分选手', description: '单次练习正确率≥95%', icon: '💯', condition: (stats) => stats.bestAccuracy >= 95 },
  { id: 'points_100', name: '积分新手', description: '累计获得100积分', icon: '🪙', condition: (stats) => stats.totalPoints >= 100 },
  { id: 'points_1000', name: '积分达人', description: '累计获得1000积分', icon: '🏆', condition: (stats) => stats.totalPoints >= 1000 },
  { id: 'all_subjects', name: '全科选手', description: '练习覆盖所有学科', icon: '🌈', condition: (stats) => stats.subjectCount >= 6 }
];

export async function checkIn(req, res) {
  const db = await getDb();
  const email = req.user.email;

  try {
    const today = new Date().toISOString().split('T')[0];

    const existing = await db.all(
      'SELECT * FROM user_checkins WHERE user_email = ? AND date(checkin_date) = date(?)',
      [email, today]
    );

    if (existing.length > 0) {
      return res.status(400).json(errorResponse('今日已打卡'));
    }

    const lastCheckin = await db.all(
      'SELECT checkin_date FROM user_checkins WHERE user_email = ? ORDER BY checkin_date DESC LIMIT 1',
      [email]
    );

    let streakDays = 1;
    if (lastCheckin.length > 0) {
      const lastDate = new Date(lastCheckin[0].checkin_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        const streakResult = await db.all(
          'SELECT MAX(streak_days) as max_streak FROM user_checkins WHERE user_email = ?',
          [email]
        );
        streakDays = (streakResult[0]?.max_streak || 0) + 1;
      }
    }

    await db.run(
      'INSERT INTO user_checkins (user_email, checkin_date, streak_days) VALUES (?, ?, ?)',
      [email, today, streakDays]
    );

    await db.run(
      'INSERT INTO user_points (user_email, points, reason) VALUES (?, ?, ?)',
      [email, 5 + Math.min(streakDays, 20), '每日打卡（连续' + streakDays + '天）']
    );

    const newBadges = await checkAndAwardBadges(db, email);

    res.json({
      success: true,
      data: {
        checkinDate: today,
        streakDays,
        pointsEarned: 5 + Math.min(streakDays, 20),
        newBadges
      }
    });
  } catch (error) {
    console.error('打卡失败:', error.message);
    res.status(500).json(errorResponse('打卡失败'));
  }
}

export async function getCheckinStatus(req, res) {
  const db = await getDb();
  const email = req.user.email;

  try {
    const today = new Date().toISOString().split('T')[0];
    const todayCheckin = await db.all(
      'SELECT * FROM user_checkins WHERE user_email = ? AND date(checkin_date) = date(?)',
      [email, today]
    );

    const streakInfo = await db.all(
      'SELECT MAX(streak_days) as current_streak FROM user_checkins WHERE user_email = ?',
      [email]
    );

    const recentCheckins = await db.all(
      'SELECT checkin_date, streak_days FROM user_checkins WHERE user_email = ? ORDER BY checkin_date DESC LIMIT 30',
      [email]
    );

    const totalCheckins = await db.all(
      'SELECT COUNT(*) as count FROM user_checkins WHERE user_email = ?',
      [email]
    );

    res.json({
      success: true,
      data: {
        todayCheckedIn: todayCheckin.length > 0,
        currentStreak: streakInfo[0]?.current_streak || 0,
        totalCheckins: totalCheckins[0]?.count || 0,
        recentCheckins
      }
    });
  } catch (error) {
    console.error('获取打卡状态失败:', error.message);
    res.status(500).json(errorResponse('获取打卡状态失败'));
  }
}

export async function getPointsHistory(req, res) {
  const db = await getDb();
  const email = req.user.email;
  const { limit = 30, offset = 0 } = req.query;

  try {
    const history = await db.all(
      'SELECT * FROM user_points WHERE user_email = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [email, parseInt(limit), parseInt(offset)]
    );

    const total = await db.all(
      'SELECT SUM(points) as total FROM user_points WHERE user_email = ?',
      [email]
    );

    res.json({
      success: true,
      data: {
        totalPoints: total[0]?.total || 0,
        history
      }
    });
  } catch (error) {
    console.error('获取积分历史失败:', error.message);
    res.status(500).json(errorResponse('获取积分历史失败'));
  }
}

export async function getBadges(req, res) {
  const db = await getDb();
  const email = req.user.email;

  try {
    const earned = await db.all(
      'SELECT badge_id, earned_at FROM user_badges WHERE user_email = ?',
      [email]
    );

    const earnedIds = earned.map(e => e.badge_id);

    const stats = await getUserStats(db, email);

    const allBadges = BADGES.map(badge => ({
      ...badge,
      earned: earnedIds.includes(badge.id),
      earnedAt: earned.find(e => e.badge_id === badge.id)?.earned_at || null,
      progress: getBadgeProgress(badge, stats)
    }));

    res.json({
      success: true,
      data: {
        totalBadges: allBadges.length,
        earnedCount: earnedIds.length,
        badges: allBadges
      }
    });
  } catch (error) {
    console.error('获取徽章失败:', error.message);
    res.status(500).json(errorResponse('获取徽章失败'));
  }
}

async function checkAndAwardBadges(db, email) {
  const stats = await getUserStats(db, email);
  const earned = await db.all(
    'SELECT badge_id FROM user_badges WHERE user_email = ?',
    [email]
  );
  const earnedIds = earned.map(e => e.badge_id);

  const newBadges = [];

  for (const badge of BADGES) {
    if (!earnedIds.includes(badge.id) && badge.condition(stats)) {
      await db.run(
        'INSERT INTO user_badges (user_email, badge_id) VALUES (?, ?)',
        [email, badge.id]
      );
      newBadges.push(badge);
    }
  }

  return newBadges;
}

async function getUserStats(db, email) {
  const loginDays = await db.all(
    'SELECT COUNT(DISTINCT date(checkin_date)) as count FROM user_checkins WHERE user_email = ?',
    [email]
  );

  const streakDays = await db.all(
    'SELECT MAX(streak_days) as max FROM user_checkins WHERE user_email = ?',
    [email]
  );

  const totalErrors = await db.all(
    'SELECT COUNT(*) as count FROM wrong_questions WHERE user_email = ?',
    [email]
  );

  const totalExams = await db.all(
    'SELECT COUNT(*) as count FROM exam_sessions WHERE user_email = ? AND status = ?',
    [email, 'completed']
  );

  const bestAccuracy = await db.all(
    'SELECT MAX(accuracy) as best FROM exam_sessions WHERE user_email = ? AND status = ?',
    [email, 'completed']
  );

  const totalPoints = await db.all(
    'SELECT SUM(points) as total FROM user_points WHERE user_email = ?',
    [email]
  );

  const subjectCount = await db.all(
    'SELECT COUNT(DISTINCT subject) as count FROM exam_sessions WHERE user_email = ? AND status = ?',
    [email, 'completed']
  );

  return {
    loginDays: loginDays[0]?.count || 0,
    streakDays: streakDays[0]?.max || 0,
    totalErrors: totalErrors[0]?.count || 0,
    totalExams: totalExams[0]?.count || 0,
    bestAccuracy: bestAccuracy[0]?.best ? parseFloat(bestAccuracy[0].best) : 0,
    totalPoints: totalPoints[0]?.total || 0,
    subjectCount: subjectCount[0]?.count || 0
  };
}

function getBadgeProgress(badge, stats) {
  const keys = {
    'first_login': 'loginDays',
    'week_streak': 'streakDays',
    'month_streak': 'streakDays',
    'first_error': 'totalErrors',
    'error_50': 'totalErrors',
    'error_200': 'totalErrors',
    'exam_1': 'totalExams',
    'exam_10': 'totalExams',
    'exam_50': 'totalExams',
    'accuracy_80': 'bestAccuracy',
    'accuracy_95': 'bestAccuracy',
    'points_100': 'totalPoints',
    'points_1000': 'totalPoints',
    'all_subjects': 'subjectCount'
  };

  const thresholds = {
    'first_login': 1, 'week_streak': 7, 'month_streak': 30,
    'first_error': 1, 'error_50': 50, 'error_200': 200,
    'exam_1': 1, 'exam_10': 10, 'exam_50': 50,
    'accuracy_80': 80, 'accuracy_95': 95,
    'points_100': 100, 'points_1000': 1000,
    'all_subjects': 6
  };

  const key = keys[badge.id];
  const threshold = thresholds[badge.id];
  if (!key || !threshold) return null;

  const current = stats[key] || 0;
  return {
    current,
    target: threshold,
    percentage: Math.min(100, Math.floor(current / threshold * 100))
  };
}
