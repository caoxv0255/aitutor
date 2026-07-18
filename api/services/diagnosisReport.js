import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { logger } from '../core/logger.js';

const DIAGNOSIS_PROMPT = (subjectName, learningData) => `你是一位拥有20年教学经验的${subjectName}学科高级教师和学习诊断专家。

请根据以下学生的学习数据，生成一份详细的AI诊断规划报告：

【学习数据概览】
${learningData}

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "report_title": "诊断报告标题",
  "overall_score": 综合评分(0-100),
  "overall_evaluation": "总体评价，包括学习状态、优势和不足",
  "detailed_analysis": {
    "knowledge_points": [
      {
        "name": "知识点名称",
        "mastery_score": 掌握度(0-100),
        "status": "状态描述（如：优秀、良好、薄弱、待提高）",
        "error_count": 错误次数,
        "suggestion": "针对性改进建议"
      }
    ],
    "question_types": [
      {
        "type": "题型名称",
        "accuracy": 正确率(0-100),
        "status": "状态描述",
        "suggestion": "改进建议"
      }
    ],
    "difficulty_distribution": {
      "easy": 简单题正确率(0-100),
      "medium": 中档题正确率(0-100),
      "hard": 难题正确率(0-100),
      "recommendation": "难度策略建议"
    },
    "common_errors": [
      {
        "type": "错误类型",
        "frequency": 频率,
        "description": "错误表现描述",
        "solution": "解决方法"
      }
    ]
  },
  "learning_plan": {
    "phase_1": {
      "duration": "时间周期",
      "focus": "重点内容",
      "tasks": ["任务1", "任务2", "任务3"]
    },
    "phase_2": {
      "duration": "时间周期",
      "focus": "重点内容",
      "tasks": ["任务1", "任务2", "任务3"]
    },
    "phase_3": {
      "duration": "时间周期",
      "focus": "重点内容",
      "tasks": ["任务1", "任务2", "任务3"]
    }
  },
  "key_recommendations": [
    "核心建议1",
    "核心建议2",
    "核心建议3",
    "核心建议4",
    "核心建议5"
  ],
  "expected_outcome": "预期学习成果"
}

要求：
- overall_score必须基于实际数据计算
- detailed_analysis必须详细，覆盖知识点、题型、难度三个维度
- learning_plan必须分阶段，每个阶段有明确的重点和可执行任务
- key_recommendations必须针对薄弱环节给出具体建议
- 所有字段必须填写完整`;

export class DiagnosisReportService {
  static async generateReport(email, subject) {
    const pool = await getDb();
    
    const learningData = await this.collectLearningData(pool, email, subject);
    
    if (!learningData.hasEnoughData) {
      return {
        success: false,
        message: '数据不足，无法生成诊断报告。请至少完成3次练习或20道题目。',
        data: learningData
      };
    }
    
    const subjectMap = {
      math: '数学', physics: '物理', chemistry: '化学',
      biology: '生物', chinese: '语文', english: '英语',
      history: '历史', geography: '地理', politics: '政治'
    };
    const subjectName = subjectMap[subject] || subject;
    
    const prompt = DIAGNOSIS_PROMPT(subjectName, learningData.summary);
    
    try {
      const response = await llm.chat(prompt, {
        model: MODELS.QWEN_PLUS,
        temperature: 0.3,
        maxTokens: 4000,
        feature: 'diagnosis_report'
      });
      
      const report = JSON.parse(response.content);
      
      await this.saveReport(pool, email, subject, report);
      
      return {
        success: true,
        report,
        cost: response.cost,
        tokens: response.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error(`[DiagnosisReport] 生成报告失败: ${error.message}`);
      return {
        success: false,
        message: `生成报告失败: ${error.message}`,
        data: learningData
      };
    }
  }
  
  static async collectLearningData(pool, email, subject) {
    const data = {
      user: null,
      examSessions: [],
      practiceRecords: [],
      wrongQuestions: [],
      mastery: [],
      summary: '',
      hasEnoughData: false
    };
    
    const [userResult, sessionsResult, practiceResult, wrongResult, masteryResult] = await Promise.all([
      pool.query('SELECT * FROM users WHERE email = $1', [email]),
      pool.query(`
        SELECT * FROM exam_sessions 
        WHERE user_email = $1 AND subject = $2 
        ORDER BY started_at DESC LIMIT 10
      `, [email, subject]),
      pool.query(`
        SELECT * FROM practice_records 
        WHERE user_email = $1 AND subject_code = $2 
        ORDER BY created_at DESC LIMIT 100
      `, [email, subject]),
      pool.query(`
        SELECT * FROM wrong_questions 
        WHERE user_email = $1 AND subject_code = $2 
        ORDER BY timestamp DESC LIMIT 50
      `, [email, subject]),
      pool.query(`
        SELECT skm.*, kp.name as kp_name, kp.difficulty as kp_difficulty
        FROM student_knowledge_mastery skm
        LEFT JOIN knowledge_points kp ON skm.knowledge_point_id = kp.id
        WHERE skm.user_email = $1 AND kp.subject = $2
        ORDER BY skm.mastery_score ASC
      `, [email, subject])
    ]);
    
    if (userResult.rows.length > 0) {
      data.user = userResult.rows[0];
    }
    
    data.examSessions = sessionsResult.rows;
    data.practiceRecords = practiceResult.rows;
    data.wrongQuestions = wrongResult.rows;
    data.mastery = masteryResult.rows;
    
    const totalPractices = data.practiceRecords.length;
    const totalSessions = data.examSessions.length;
    const totalWrong = data.wrongQuestions.length;
    const totalMastery = data.mastery.length;
    
    const correctCount = data.practiceRecords.filter(r => r.is_correct === 1).length;
    const overallAccuracy = totalPractices > 0 ? Math.round((correctCount / totalPractices) * 100) : 0;
    
    const avgMastery = totalMastery > 0 
      ? Math.round(data.mastery.reduce((sum, m) => sum + (m.mastery_score || 0), 0) / totalMastery)
      : 0;
    
    const weakPoints = data.mastery.filter(m => (m.mastery_score || 0) < 60).slice(0, 10);
    const strongPoints = data.mastery.filter(m => (m.mastery_score || 0) >= 80).slice(0, 10);
    
    const questionTypeStats = {};
    data.practiceRecords.forEach(rec => {
      if (!questionTypeStats[rec.question_type]) {
        questionTypeStats[rec.question_type] = { total: 0, correct: 0 };
      }
      questionTypeStats[rec.question_type].total++;
      if (rec.is_correct === 1) questionTypeStats[rec.question_type].correct++;
    });
    
    const difficultyStats = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } };
    data.practiceRecords.forEach(rec => {
      let level = 'medium';
      if (rec.difficulty <= 2) level = 'easy';
      else if (rec.difficulty >= 4) level = 'hard';
      difficultyStats[level].total++;
      if (rec.is_correct === 1) difficultyStats[level].correct++;
    });
    
    data.hasEnoughData = totalPractices >= 20 || totalSessions >= 3;
    
    data.summary = `【学生信息】
邮箱: ${email}
省份: ${data.user?.province || '未知'}
年级: ${data.user?.grade || '未知'}

【学习统计】
总练习次数: ${totalPractices}
总考试次数: ${totalSessions}
总错题数: ${totalWrong}
总掌握知识点数: ${totalMastery}
综合正确率: ${overallAccuracy}%
平均掌握度: ${avgMastery}%

【薄弱知识点】(${weakPoints.length}个)
${weakPoints.map(m => `- ${m.kp_name}: 掌握度${Math.round(m.mastery_score || 0)}%`).join('\n')}

【优势知识点】(${strongPoints.length}个)
${strongPoints.map(m => `- ${m.kp_name}: 掌握度${Math.round(m.mastery_score || 0)}%`).join('\n')}

【题型正确率】
${Object.entries(questionTypeStats).map(([type, stats]) => {
  const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  return `- ${type}: ${stats.correct}/${stats.total} (${acc}%)`;
}).join('\n')}

【难度分布】
- 简单题(难度1-2): ${difficultyStats.easy.correct}/${difficultyStats.easy.total} 
- 中档题(难度3): ${difficultyStats.medium.correct}/${difficultyStats.medium.total}
- 难题(难度4-5): ${difficultyStats.hard.correct}/${difficultyStats.hard.total}

【最近考试记录】
${data.examSessions.map(s => `- ${s.started_at?.split('T')[0] || ''}: ${s.score || 0}/${s.total_score || 0}分, 正确率${Math.round((s.correct_count || 0) / (s.question_count || 1) * 100)}%`).join('\n')}`;
    
    return data;
  }
  
  static async saveReport(pool, email, subject, report) {
    try {
      await pool.query(
        'INSERT INTO reports (user_email, subject_code, data, timestamp) VALUES ($1, $2, $3, NOW())',
        [email, subject, JSON.stringify(report)]
      );
    } catch (error) {
      logger.warn(`[DiagnosisReport] 保存报告失败: ${error.message}`);
    }
  }
  
  static async getHistoryReports(pool, email, subject, limit = 5) {
    const result = await pool.query(`
      SELECT * FROM reports 
      WHERE user_email = $1 AND subject_code = $2 
      ORDER BY timestamp DESC LIMIT $3
    `, [email, subject, limit]);
    
    return result.rows.map(r => ({
      ...r,
      data: JSON.parse(r.data)
    }));
  }
}

export { DIAGNOSIS_PROMPT };