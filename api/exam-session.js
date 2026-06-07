import { getDb } from './db.js';
import crypto from 'crypto';
import { errorResponse } from './utils/response.js';

const SUBJECT_MAP = {
  数学: 'math',
  语文: 'chinese',
  英语: 'english',
  物理: 'physics',
  化学: 'chemistry',
  政治: 'politics',
  生物: 'biology',
  历史: 'history',
  地理: 'geography',
};

export async function startExamSession(req, res) {
  const pool = await getDb();
  const email = req.user.email;
  const { subject, province_code, year, time_limit = 120, question_count = 20 } = req.body;

  if (!subject) {
    return res.status(400).json(errorResponse('请选择学科'));
  }

  const safeQuestionCount = Math.min(Math.max(parseInt(question_count) || 20, 1), 100);
  const safeTimeLimit = Math.min(Math.max(parseInt(time_limit) || 120, 10), 300);

  try {
    let query = `
      SELECT eq.*, p.name as province_name
      FROM exam_questions eq
      LEFT JOIN provinces p ON eq.province_code = p.code
      WHERE eq.subject_code = $1
    `;
    const params = [subject];
    let paramIdx = 2;

    if (province_code) {
      params.push(province_code);
      query += ` AND eq.province_code = $${paramIdx++}`;
    }

    if (year) {
      params.push(parseInt(year));
      query += ` AND eq.year = $${paramIdx++}`;
    }

    query += ` ORDER BY random() LIMIT $${paramIdx}`;
    params.push(safeQuestionCount);

    const questions = await pool.query(query, params);

    if (questions.rows.length === 0) {
      return res.status(404).json(errorResponse('没有找到符合条件的题目'));
    }

    const sessionId = crypto.randomUUID();

    await pool.query(
      `
      INSERT INTO exam_sessions (id, user_email, subject, province_code, time_limit, question_count, status, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
    `,
      [sessionId, email, subject, province_code || null, safeTimeLimit, questions.rows.length]
    );

    const cleanQuestions = questions.rows.map((q) => ({
      id: q.id,
      question_number: q.question_number,
      question_type: q.question_type,
      stem: q.stem,
      options: q.options,
      score: q.score,
      difficulty: q.difficulty,
      year: q.year,
      province_name: q.province_name,
    }));

    res.json({
      success: true,
      data: {
        sessionId,
        questions: cleanQuestions,
        timeLimit: safeTimeLimit,
        totalQuestions: cleanQuestions.length,
        subject,
        province_code,
      },
    });
  } catch (error) {
    console.error('创建考试会话失败:', error.message);
    res.status(500).json(errorResponse('创建考试会话失败'));
  }
}

export async function submitExamSession(req, res) {
  const pool = await getDb();
  const email = req.user.email;
  const { sessionId, answers } = req.body;

  if (!sessionId) {
    return res.status(400).json(errorResponse('请提供会话ID'));
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json(errorResponse('请提供答案列表'));
  }

  try {
    const sessions = await pool.query('SELECT * FROM exam_sessions WHERE id = $1 AND user_email = $2 AND status = $3', [
      sessionId,
      email,
      'active',
    ]);

    if (sessions.rows.length === 0) {
      return res.status(404).json(errorResponse('考试会话不存在或已结束'));
    }

    const session = sessions.rows[0];
    const subjectCode = SUBJECT_MAP[session.subject] || session.subject;

    const questionIds = answers.map((a) => a.questionId).filter(Boolean);
    if (questionIds.length === 0) {
      return res.status(400).json(errorResponse('答案中缺少有效的题目ID'));
    }

    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(',');
    const questions = await pool.query(
      `SELECT id, answer, difficulty, score, knowledge_points FROM exam_questions WHERE id IN (${placeholders})`,
      questionIds
    );

    const kpRows = await pool.query(
      `SELECT question_id, knowledge_point_id FROM question_knowledge_points WHERE question_id IN (${placeholders})`,
      questionIds
    );
    const kpMap = {};
    for (const row of kpRows.rows) {
      if (!kpMap[row.question_id]) {
        kpMap[row.question_id] = row.knowledge_point_id;
      }
    }

    const sessionQuestionIds = new Set(
      (await pool.query('SELECT id FROM exam_questions WHERE subject_code = $1', [session.subject])).rows.map((q) => q.id)
    );

    const userRow = await pool.query('SELECT exam_level FROM users WHERE email = $1', [email]);
    const examLevel = userRow.rows[0]?.exam_level || null;

    let correctCount = 0;
    let totalScore = 0;
    let earnedScore = 0;
    const results = [];

    for (const answer of answers) {
      const question = questions.rows.find((q) => q.id === answer.questionId);
      if (!question) continue;

      if (!sessionQuestionIds.has(answer.questionId)) {
        console.warn(`[ExamSession] Question ${answer.questionId} does not belong to session ${sessionId}`);
        continue;
      }

      const isCorrect =
        question.answer && answer.answer && question.answer.trim().toLowerCase() === answer.answer.trim().toLowerCase();
      const qScore = question.score || 5;
      totalScore += qScore;

      if (isCorrect) {
        correctCount++;
        earnedScore += qScore;
      }

      const kpId = kpMap[answer.questionId] || null;

      results.push({
        questionId: answer.questionId,
        userAnswer: answer.answer,
        correctAnswer: question.answer,
        isCorrect,
        score: qScore,
        earnedScore: isCorrect ? qScore : 0,
        difficulty: question.difficulty,
        knowledgePoints: question.knowledge_points,
      });

      await pool.query(
        `INSERT INTO practice_records (user_email, question_id, subject_code, knowledge_point_id, difficulty, is_correct, user_answer, correct_answer, session_id, exam_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          email,
          answer.questionId,
          subjectCode,
          kpId,
          question.difficulty,
          isCorrect ? 1 : 0,
          answer.answer,
          question.answer,
          sessionId,
          examLevel,
        ]
      );

      if (!isCorrect) {
        const existingWrong = await pool.query('SELECT id FROM wrong_questions WHERE user_email = $1 AND question_id = $2', [
          email,
          answer.questionId,
        ]);

        if (existingWrong.rows.length === 0) {
          await pool.query(
            `INSERT INTO wrong_questions (user_email, data, subject_code, knowledge_point_id, difficulty, question_id, is_correct, exam_level, user_answer, correct_answer, session_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              email,
              JSON.stringify({
                question_id: answer.questionId,
                subject: session.subject,
                user_answer: answer.answer,
                correct_answer: question.answer,
                difficulty: question.difficulty,
                knowledge_points: question.knowledge_points,
                session_id: sessionId,
              }),
              subjectCode,
              kpId,
              question.difficulty,
              answer.questionId,
              0,
              examLevel,
              answer.answer,
              question.answer,
              sessionId,
            ]
          );
        }
      }
    }

    const accuracy = totalScore > 0 ? ((earnedScore / totalScore) * 100).toFixed(1) : 0;

    await pool.query(
      `
      UPDATE exam_sessions
      SET status = 'completed', accuracy = $1, score = $2, total_score = $3,
          correct_count = $4, completed_at = NOW()
      WHERE id = $5
    `,
      [accuracy, earnedScore, totalScore, correctCount, sessionId]
    );

    await pool.query(
      `
      INSERT INTO user_points (user_email, points, reason, created_at)
      VALUES ($1, $2, $3, NOW())
    `,
      [email, Math.floor(earnedScore / 5) + 10, '完成练习']
    );

    res.json({
      success: true,
      data: {
        sessionId,
        totalQuestions: answers.length,
        correctCount,
        accuracy,
        earnedScore,
        totalScore,
        results,
      },
    });
  } catch (error) {
    console.error('提交考试失败:', error.message);
    res.status(500).json(errorResponse('提交考试失败'));
  }
}

export async function getExamHistory(req, res) {
  const pool = await getDb();
  const email = req.user.email;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  if (isNaN(limit) || isNaN(offset)) {
    return res.status(400).json(errorResponse('分页参数无效'));
  }

  try {
    const sessions = await pool.query(
      `
      SELECT * FROM exam_sessions
      WHERE user_email = $1
      ORDER BY started_at DESC
      LIMIT $2 OFFSET $3
    `,
      [email, limit, offset]
    );

    const total = await pool.query('SELECT COUNT(*) as count FROM exam_sessions WHERE user_email = $1', [email]);

    res.json({
      success: true,
      data: sessions.rows,
      total: total.rows[0]?.count || 0,
    });
  } catch (error) {
    console.error('获取考试历史失败:', error.message);
    res.status(500).json(errorResponse('获取考试历史失败'));
  }
}
