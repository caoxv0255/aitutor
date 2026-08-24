import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolveSubjectName } from '../utils/subjectMap.js';

export function calculateUserAbility(examHistory) {
  if (!examHistory || examHistory.length === 0) return 3.0;

  const recentExams = examHistory.slice(0, 10);
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < recentExams.length; i++) {
    const exam = recentExams[i];
    const recencyWeight = 1 / (1 + i * 0.3);
    // Audit-2026-08-24 Fix-2: 兼容 DB 字段 question_count 与测试字段 total_questions
    const totalQ = exam.question_count ?? exam.total_questions ?? 0;
    const accuracy = exam.correct_count / Math.max(totalQ, 1);
    const difficultyFactor = (exam.avg_difficulty || 3) / 5;
    const performance = accuracy * (0.5 + 0.5 * difficultyFactor);
    weightedSum += performance * recencyWeight;
    totalWeight += recencyWeight;
  }

  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  return Math.round(normalizedScore * 4 + 1) * 10 / 10;
}

export function calculateAdaptiveDifficulty(userAbility, weakPointRatio = 0) {
  let difficulty = userAbility;

  if (weakPointRatio > 0.6) {
    difficulty = Math.max(1.5, difficulty - 0.5);
  } else if (weakPointRatio < 0.2) {
    difficulty = Math.min(4.5, difficulty + 0.5);
  }

  if (difficulty < 2) {
    difficulty = 1.5 + (difficulty - 1) * 0.5;
  } else if (difficulty > 4) {
    difficulty = 4 + (difficulty - 4) * 0.5;
  }

  return Math.round(Math.min(Math.max(difficulty, 1.5), 4.5) * 10) / 10;
}

export async function getUserAbilityForSubject(email, subject) {
  const pool = await getDb();
  const subjectName = resolveSubjectName(subject) || subject;

  const historyResult = await pool.query(
    `SELECT es.*
     FROM exam_sessions es
     WHERE es.user_email = $1 AND (es.subject = $2 OR es.subject = $3)
     ORDER BY es.started_at DESC
     LIMIT 10`,
    [email, subject, subjectName]
  );
  const history = historyResult.rows;

  if (!history || history.length === 0) return { ability: 3.0, examCount: 0, adaptiveDifficulty: 3.5 };

  const ability = calculateUserAbility(history);
  const weakPointsResult = await pool.query(
    'SELECT COUNT(*) as count FROM knowledge_points WHERE subject = $1 OR subject = $2',
    [subject, subjectName]
  );
  const weakPoints = weakPointsResult.rows;
  const weakPointRatio = 0.3;
  const adaptiveDifficulty = calculateAdaptiveDifficulty(ability, weakPointRatio);

  return {
    ability,
    examCount: history.length,
    adaptiveDifficulty
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const email = req.user.email;
  const subject = req.query.subject || 'math';

  const result = await getUserAbilityForSubject(email, subject);
  return res.json(successResponse(result));
}
