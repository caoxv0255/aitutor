import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { logger } from '../core/logger.js';
import { enrichQuestionsWithTables, placeholderToText } from './questionTables.js';
import { parseOptionsAsArray } from './parseOptions.js';
import { normalizeQuestionType, toDbQuestionType } from './questionType.js';

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
  // options 容错解析的累计失败计数 (可观测; 见 parseOptionsSafe)
  static optionsParseFailureCount = 0;
  // question_type 无法归一化 (如 'unknown') 被排除出分卷的累计计数 (可观测; 见 assemblePaper)
  static unmappedQuestionTypeCount = 0;

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
    // P4-c 治本: 题面 ⟦TABLE:n⟧ → 结构化 tables (纯文本 content 用短标记兜底, 不泄裸 token)
    await enrichQuestionsWithTables(pool, questions);

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
      // P0-fix (2026-08-24): 原查 exam_session_answers 表不存在 (audit 404)
      //   fallback 到 practice_records (字段: subject_code, difficulty, created_at)
      //   LIMIT 50 + ORDER BY created_at DESC 取最近 50 题的难度均值
      const result = await pool.query(`
        SELECT difficulty
        FROM practice_records
        WHERE user_email = $1 AND subject_code = $2 AND difficulty IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 50
      `, [email, subject]);

      if (result.rows.length > 0) {
        const sum = result.rows.reduce((s, r) => s + Number(r.difficulty || 0), 0);
        const avg = sum / result.rows.length;
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

        // question_type 归一化: distribution.byType 的 key 是中文标签,
        // 而 DB 实际存代码 (choice/fill/solve) → 拼 SQL 前转回代码。
        const dbType = toDbQuestionType(type);

        const kpToUse = kpCoverage.target.filter(kp => !usedKPIds.has(kp.id));
        const shuffledKP = [...kpToUse].sort(() => Math.random() - 0.5);

        for (const kp of shuffledKP.slice(0, Math.min(needed, shuffledKP.length))) {
          const isWeak = weakKPIds.includes(kp.id);
          
          const result = await pool.query(`
            SELECT * FROM exam_questions
            WHERE subject_code = $1
              AND question_type = $2
              AND difficulty::numeric >= $3 AND difficulty::numeric <= $4
              AND year >= $5
              AND answer IS NOT NULL AND TRIM(answer) != ''
              AND (knowledge_points LIKE $6 OR knowledge_points IS NULL)
            ORDER BY RANDOM()
            LIMIT 1
          `, [
            subject,
            dbType,
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

      // 排除已选题。原实现 `id NOT IN (...)` 占位符从 $3 起, 与 `LIMIT $3`
      // 参数冲突 (且 questions 为空时会拼出非法的 `NOT IN ()` → SQL 语法错误,
      // 整卷生成抛出)。改为: LIMIT 固定 $3, NOT IN 从 $4 起, 空列表则不加该条件。
      const excludeIds = questions.map(q => q.id);
      const excludeClause = excludeIds.length > 0
        ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 4}`).join(',')})`
        : '';

      const result = await pool.query(`
        SELECT * FROM exam_questions
        WHERE subject_code = $1
          AND year >= $2
          AND answer IS NOT NULL AND TRIM(answer) != ''
          ${excludeClause}
        ORDER BY RANDOM()
        LIMIT $3
      `, [subject, minYear, remaining, ...excludeIds]);

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

  /**
   * options 字段容错解析 (2026-09-24)。
   *
   * 事故: exam_questions.options 并非总是合法 JSON 数组 (实测同一批数据里
   *   纯文本如 "A. ①\tB. ②..."、合法但非数组如 {"A":...}、合法数组、空 并存)。
   *   旧代码三处裸调 JSON.parse(options) (未做类型/异常防护): 纯文本行直接抛
   *   SyntaxError, 而 assemblePaper 无 try/catch → 整张试卷生成失败。
   *
   * 策略 (与同源消费方 exam-pdf.js:parseOptions 一致): paperGenerator 的 options
   *   最终要交给前端 `q.options.forEach` 渲染, 必须是数组。因此解析失败 / 非数组
   *   一律按「无选项」([]) 处理, 绝不降级为原始字符串 (字符串有 length, 会让前端
   *   的 `q.options.length > 0` 守卫通过, 随后 forEach 抛 TypeError)。
   *   同时 warn + 累计计数, 不静默吞掉。解析与判定已抽到 services/parseOptions.js
   *   (语义 A「要数组」), 本方法只保留本消费者专属的 warn 文案与静态计数。
   */
  static parseOptionsSafe(raw, questionId) {
    return parseOptionsAsArray(raw, (reason) => {
      PaperGenerator.optionsParseFailureCount += 1;
      const label = reason === 'not-array' ? '为合法 JSON 但非数组' : '非合法 JSON';
      logger.warn(
        `[PaperGenerator] options ${label}, 已按「无选项」处理 `
        + `(question_uid=${questionId}, 累计失败=${PaperGenerator.optionsParseFailureCount}): `
        + String(raw).slice(0, 80)
      );
    });
  }

  static assemblePaper(subject, questions, distribution, difficulty, timeLimit, weakKPIds, kpCoverage, includeAnswer) {
    const sections = [];
    let totalScore = 0;

    // question_type 归一化: DB 存代码 (choice/fill/solve), 分卷按中文标签。
    // 归一后可匹配的入对应 section; 不可映射 (如 'unknown') → 记 warn + 计数, 不静默丢。
    const selectionQuestions = questions.filter(q => normalizeQuestionType(q.question_type) === '选择题');
    const fillQuestions = questions.filter(q => normalizeQuestionType(q.question_type) === '填空题');
    const solutionQuestions = questions.filter(
      q => ['解答题', '计算题', '证明题'].includes(normalizeQuestionType(q.question_type))
    );

    const unmapped = questions.filter(q => normalizeQuestionType(q.question_type) === null);
    if (unmapped.length > 0) {
      PaperGenerator.unmappedQuestionTypeCount += unmapped.length;
      const kinds = [...new Set(unmapped.map(q => String(q.question_type)))].join(', ');
      logger.warn(
        `[PaperGenerator] ${unmapped.length} 道题 question_type 无法归一化, 已排除出分卷 `
        + `(实际值=${kinds}; 累计未匹配=${PaperGenerator.unmappedQuestionTypeCount})`
      );
    }

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
          content: placeholderToText(q.stem),
          tables: q.tables || undefined,
          options: PaperGenerator.parseOptionsSafe(q.options, q.question_uid),
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
          content: placeholderToText(q.stem),
          tables: q.tables || undefined,
          options: PaperGenerator.parseOptionsSafe(q.options, q.question_uid),
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
          content: placeholderToText(q.stem),
          tables: q.tables || undefined,
          options: PaperGenerator.parseOptionsSafe(q.options, q.question_uid),
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