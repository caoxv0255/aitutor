import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { logger } from '../core/logger.js';

const DIFFICULTY_MAPPING = {
  easy: { min: 1, max: 2.5 },
  medium: { min: 2.5, max: 4 },
  hard: { min: 4, max: 5 }
};

const QUESTION_TYPE_WEIGHTS = {
  math: { '选择题': 0.45, '填空题': 0.15, '解答题': 0.4 },
  physics: { '选择题': 0.4, '填空题': 0.2, '解答题': 0.4 },
  chemistry: { '选择题': 0.45, '填空题': 0.2, '解答题': 0.35 },
  biology: { '选择题': 0.5, '填空题': 0.25, '解答题': 0.25 },
  english: { '选择题': 0.6, '填空题': 0.2, '解答题': 0.2 },
  chinese: { '选择题': 0.3, '填空题': 0.2, '解答题': 0.5 },
  history: { '选择题': 0.5, '填空题': 0.2, '解答题': 0.3 },
  geography: { '选择题': 0.5, '填空题': 0.2, '解答题': 0.3 },
  politics: { '选择题': 0.5, '填空题': 0.15, '解答题': 0.35 }
};

export class PaperGenerator {
  static async generatePersonalizedPaper(email, options) {
    const { 
      subject = 'math', 
      difficulty = 3.5, 
      timeLimit = 120, 
      questionCount = 22,
      focusWeakPoints = true,
      adaptive = true,
      years = 3,
      includeAnswer = false
    } = options;

    const pool = await getDb();
    
    let targetDifficulty = difficulty;
    if (adaptive && !difficulty) {
      targetDifficulty = await this.calculateAdaptiveDifficulty(pool, email, subject);
    }
    if (!targetDifficulty) targetDifficulty = 3.5;

    let weakKPIds = [];
    if (focusWeakPoints) {
      weakKPIds = await this.getWeakKnowledgePoints(pool, email, subject);
    }

    const kpCoverage = await this.getKnowledgePointCoverage(pool, subject, weakKPIds);

    const distribution = this.calculateQuestionDistribution(targetDifficulty, questionCount, subject);

    const questions = await this.selectQuestions(
      pool, 
      subject, 
      distribution, 
      kpCoverage,
      years,
      weakKPIds
    );

    const paper = this.assemblePaper(
      subject, 
      questions, 
      distribution, 
      targetDifficulty, 
      timeLimit,
      weakKPIds,
      kpCoverage,
      includeAnswer
    );

    await this.savePaper(pool, email, subject, paper);

    return paper;
  }

  static async calculateAdaptiveDifficulty(pool, email, subject) {
    try {
      const result = await pool.query(`
        SELECT AVG(difficulty) as avg_difficulty
        FROM exam_session_answers
        WHERE user_email = $1 AND subject = $2 AND difficulty IS NOT NULL
        ORDER BY timestamp DESC LIMIT 50
      `, [email, subject]);

      if (result.rows.length > 0 && result.rows[0].avg_difficulty) {
        const avg = parseFloat(result.rows[0].avg_difficulty);
        return Math.max(1, Math.min(5, avg));
      }
    } catch (error) {
      logger.warn(`[PaperGenerator] 计算自适应难度失败: ${error.message}`);
    }
    return 3.5;
  }

  static async getWeakKnowledgePoints(pool, email, subject) {
    try {
      const result = await pool.query(`
        SELECT kp_id, COUNT(*) as error_count
        FROM wrong_questions wq
        JOIN knowledge_points kp ON wq.kp_id = kp.id
        WHERE wq.user_email = $1 AND kp.subject = $2
        GROUP BY kp_id
        HAVING COUNT(*) >= 2
        ORDER BY error_count DESC
        LIMIT 10
      `, [email, subject]);

      return result.rows.map(r => r.kp_id);
    } catch (error) {
      logger.warn(`[PaperGenerator] 获取薄弱知识点失败: ${error.message}`);
      return [];
    }
  }

  static async getKnowledgePointCoverage(pool, subject, weakKPIds) {
    const result = await pool.query(`
      SELECT id, name, difficulty, frequency 
      FROM knowledge_points 
      WHERE subject = $1 
      ORDER BY frequency DESC
    `, [subject]);

    const allKP = result.rows;
    const weakKP = allKP.filter(kp => weakKPIds.includes(kp.id));
    const remainingKP = allKP.filter(kp => !weakKPIds.includes(kp.id));

    return {
      all: allKP,
      weak: weakKP,
      remaining: remainingKP,
      target: [...weakKP, ...remainingKP].slice(0, 15)
    };
  }

  static calculateQuestionDistribution(difficulty, totalCount, subject) {
    const weights = QUESTION_TYPE_WEIGHTS[subject] || QUESTION_TYPE_WEIGHTS.math;
    
    const easyRatio = difficulty <= 2.5 ? 0.5 : difficulty <= 3.5 ? 0.35 : 0.2;
    const mediumRatio = difficulty <= 2.5 ? 0.4 : difficulty <= 3.5 ? 0.5 : 0.4;
    const hardRatio = 1 - easyRatio - mediumRatio;

    const distribution = {
      total: totalCount,
      byDifficulty: {
        easy: Math.round(totalCount * easyRatio),
        medium: Math.round(totalCount * mediumRatio),
        hard: Math.round(totalCount * hardRatio)
      },
      byType: {}
    };

    for (const [type, weight] of Object.entries(weights)) {
      distribution.byType[type] = Math.round(totalCount * weight);
    }

    const totalByType = Object.values(distribution.byType).reduce((a, b) => a + b, 0);
    if (totalByType !== totalCount) {
      const diff = totalCount - totalByType;
      const typeKeys = Object.keys(distribution.byType);
      distribution.byType[typeKeys[typeKeys.length - 1]] += diff;
    }

    const totalByDifficulty = Object.values(distribution.byDifficulty).reduce((a, b) => a + b, 0);
    if (totalByDifficulty !== totalCount) {
      const diff = totalCount - totalByDifficulty;
      distribution.byDifficulty.medium += diff;
    }

    return distribution;
  }

  static async selectQuestions(pool, subject, distribution, kpCoverage, years = 3, weakKPIds = []) {
    const questions = [];
    const usedKPIds = new Set();
    
    const minYear = new Date().getFullYear() - years;

    for (const [difficulty, count] of Object.entries(distribution.byDifficulty)) {
      for (const [type, typeCount] of Object.entries(distribution.byType)) {
        const needed = Math.round(typeCount * (count / distribution.total));
        
        if (needed <= 0) continue;

        const kpToUse = kpCoverage.target.filter(kp => !usedKPIds.has(kp.id));
        const shuffledKP = [...kpToUse].sort(() => Math.random() - 0.5);

        for (const kp of shuffledKP.slice(0, Math.min(needed, shuffledKP.length))) {
          const isWeak = weakKPIds.includes(kp.id);
          
          const result = await pool.query(`
            SELECT * FROM exam_questions
            WHERE subject_code = $1
              AND question_type = $2
              AND difficulty >= $3 AND difficulty <= $4
              AND year >= $5
              AND answer IS NOT NULL AND TRIM(answer) != ''
              AND (knowledge_points LIKE $6 OR knowledge_points IS NULL)
            ORDER BY RANDOM()
            LIMIT 1
          `, [
            subject,
            type,
            DIFFICULTY_MAPPING[difficulty].min,
            DIFFICULTY_MAPPING[difficulty].max,
            minYear,
            `%${kp.id}%`
          ]);

          if (result.rows.length > 0) {
            questions.push({
              ...result.rows[0],
              knowledge_point_name: kp.name,
              is_weak_point: isWeak,
              difficulty_level: difficulty
            });
            usedKPIds.add(kp.id);
          }
        }
      }
    }

    if (questions.length < distribution.total) {
      const remaining = distribution.total - questions.length;
      
      const result = await pool.query(`
        SELECT * FROM exam_questions
        WHERE subject_code = $1
          AND year >= $2
          AND answer IS NOT NULL AND TRIM(answer) != ''
          AND id NOT IN (${questions.map((_, i) => `$${i + 3}`).join(',')})
        ORDER BY RANDOM()
        LIMIT $3
      `, [subject, minYear, remaining, ...questions.map(q => q.id)]);

      result.rows.forEach(q => {
        questions.push({
          ...q,
          knowledge_point_name: '综合',
          is_weak_point: false,
          difficulty_level: 'medium'
        });
      });
    }

    return questions;
  }

  static assemblePaper(subject, questions, distribution, difficulty, timeLimit, weakKPIds, kpCoverage, includeAnswer) {
    const sections = [];
    let totalScore = 0;

    const selectionQuestions = questions.filter(q => q.question_type === '选择题');
    const fillQuestions = questions.filter(q => q.question_type === '填空题');
    const solutionQuestions = questions.filter(q => ['解答题', '计算题', '证明题'].includes(q.question_type));

    if (selectionQuestions.length > 0) {
      const scorePerQuestion = Math.round(60 / selectionQuestions.length);
      const totalSelectionScore = selectionQuestions.length * scorePerQuestion;
      totalScore += totalSelectionScore;

      sections.push({
        section_name: '一、选择题',
        description: `本题共${selectionQuestions.length}小题，每小题${scorePerQuestion}分，共${totalSelectionScore}分。`,
        questions: selectionQuestions.map((q, i) => ({
          id: `S${i + 1}`,
          question_uid: q.question_uid,
          content: q.stem,
          options: q.options ? JSON.parse(q.options) : [],
          answer: includeAnswer ? q.answer : null,
          explanation: includeAnswer ? q.analysis : null,
          knowledge_point: q.knowledge_point_name,
          kp_id: q.kp_id || null,
          is_weak_point: q.is_weak_point,
          difficulty: q.difficulty_level,
          score: scorePerQuestion,
          original_difficulty: q.difficulty
        }))
      });
    }

    if (fillQuestions.length > 0) {
      const scorePerQuestion = Math.round(20 / fillQuestions.length);
      const totalFillScore = fillQuestions.length * scorePerQuestion;
      totalScore += totalFillScore;

      sections.push({
        section_name: '二、填空题',
        description: `本题共${fillQuestions.length}小题，每小题${scorePerQuestion}分，共${totalFillScore}分。`,
        questions: fillQuestions.map((q, i) => ({
          id: `F${i + 1}`,
          question_uid: q.question_uid,
          content: q.stem,
          options: q.options ? JSON.parse(q.options) : [],
          answer: includeAnswer ? q.answer : null,
          explanation: includeAnswer ? q.analysis : null,
          knowledge_point: q.knowledge_point_name,
          kp_id: q.kp_id || null,
          is_weak_point: q.is_weak_point,
          difficulty: q.difficulty_level,
          score: scorePerQuestion,
          original_difficulty: q.difficulty
        }))
      });
    }

    if (solutionQuestions.length > 0) {
      const remainingScore = Math.max(20, 150 - totalScore);
      const baseScore = Math.floor(remainingScore / solutionQuestions.length);
      const extraScore = remainingScore % solutionQuestions.length;
      totalScore += remainingScore;

      sections.push({
        section_name: '三、解答题',
        description: `本题共${solutionQuestions.length}小题，共${remainingScore}分。`,
        questions: solutionQuestions.map((q, i) => ({
          id: `J${i + 1}`,
          question_uid: q.question_uid,
          content: q.stem,
          options: q.options ? JSON.parse(q.options) : [],
          answer: includeAnswer ? q.answer : null,
          explanation: includeAnswer ? q.analysis : null,
          knowledge_point: q.knowledge_point_name,
          kp_id: q.kp_id || null,
          is_weak_point: q.is_weak_point,
          difficulty: q.difficulty_level,
          score: baseScore + (i < extraScore ? 1 : 0),
          original_difficulty: q.difficulty
        }))
      });
    }

    const weakPointNames = kpCoverage.weak.map(kp => kp.name);

    return {
      title: `${subject}个性化预测卷`,
      subject,
      generated_at: new Date().toISOString(),
      is_personalized: weakKPIds.length > 0,
      weak_points_targeted: weakPointNames,
      metadata: {
        difficulty: parseFloat(difficulty),
        timeEstimate: `${Math.round(timeLimit * 0.83)}分钟`,
        timeLimit: parseInt(timeLimit) || 120,
        questionCount: questions.length,
        totalScore: totalScore,
        weakPointsCovered: weakPointNames,
        distribution: {
          byDifficulty: distribution.byDifficulty,
          byType: distribution.byType
        },
        knowledgePointsCovered: kpCoverage.target.length
      },
      sections
    };
  }

  static async savePaper(pool, email, subject, paper) {
    try {
      await pool.query(
        'INSERT INTO personalized_papers (user_email, subject, data) VALUES ($1, $2, $3)',
        [email, subject, JSON.stringify(paper)]
      );
    } catch (error) {
      logger.warn(`[PaperGenerator] 保存试卷失败: ${error.message}`);
    }
  }

  static async generateFromTemplate(email, options) {
    const { subject = 'math', difficulty = 3.5, timeLimit = 120 } = options;
    
    const pool = await getDb();
    const weakKPIds = await this.getWeakKnowledgePoints(pool, email, subject);
    const kpCoverage = await this.getKnowledgePointCoverage(pool, subject, weakKPIds);
    
    const distribution = this.calculateQuestionDistribution(difficulty, 22, subject);
    
    const paper = {
      title: `${subject}智能组卷`,
      subject,
      generated_at: new Date().toISOString(),
      is_personalized: weakKPIds.length > 0,
      metadata: {
        difficulty: parseFloat(difficulty),
        timeLimit: parseInt(timeLimit) || 120,
        questionCount: 22,
        distribution: distribution.byDifficulty
      },
      sections: []
    };

    return paper;
  }
}

export { DIFFICULTY_MAPPING, QUESTION_TYPE_WEIGHTS };