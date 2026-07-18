import { getDb } from '../api/core/db.js';
import { llm, MODELS } from '../services/llm.js';
import { logger } from '../api/core/logger.js';
import { parseExplainResponse } from '../api/utils/llmParser.js';
import { SubjectMap } from '../api/utils/subjectMap.js';

const BATCH_SIZE = 10;
const MAX_WORKERS = 3;
const FAILURE_THRESHOLD = 5;

const BACKFILL_PROMPT = (subjectName, question, options, questionType) => `你是一位拥有20年教学经验的${subjectName}学科高级教师。

请为以下题目生成准确的答案和详细解析：

【题目类型】${questionType || '未知'}

【题目】
${question}

${options ? `【选项】
${options}` : ''}

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "answer": "题目答案，选择题返回选项字母（如A、B、C、D），主观题返回完整答案",
  "analysis": "详细解析，包含：1)答案分析 2)解题思路 3)知识点讲解 4)易错点提示。使用\\n\\n分隔大段落，数学公式用LaTeX格式如 $x^2$。",
  "knowledge_points": ["知识点1", "知识点2"],
  "difficulty": 难度等级(1-5)
}

要求：
- answer字段必须准确无误
- analysis字段必须详细，不少于100字
- 选择题必须返回单个字母（如A、B、C、D）或多个字母（如AB、ACD）
- 主观题答案要完整准确
- 难度等级1最简单，5最难`;

async function getQuestionsToBackfill(db, limit = 100) {
  const result = await db.query(`
    SELECT q.id, q.question_uid, q.stem, q.options, q.question_type, q.subject_code,
           CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END as missing_answer,
           CASE WHEN q.analysis IS NULL OR TRIM(q.analysis) = '' THEN 1 ELSE 0 END as missing_analysis
    FROM exam_questions q
    WHERE (q.answer IS NULL OR TRIM(q.answer) = '' OR q.analysis IS NULL OR TRIM(q.analysis) = '')
      AND q.stem IS NOT NULL AND TRIM(q.stem) != ''
      AND q.stem NOT LIKE '[图片%]'
    ORDER BY q.created_at ASC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

async function processQuestion(db, question) {
  const subjectName = SubjectMap[question.subject_code] || question.subject_code;
  
  const prompt = BACKFILL_PROMPT(
    subjectName,
    question.stem,
    question.options,
    question.question_type
  );
  
  try {
    const startTime = Date.now();
    const response = await llm.chat(prompt, {
      model: MODELS.QWEN_TURBO,
      temperature: 0.3,
      maxTokens: 2000
    });
    
    const processingTime = Date.now() - startTime;
    const parsed = parseExplainResponse(response.content);
    
    if (!parsed.parsed || !parsed.parsed.answer) {
      logger.warn(`[Backfill] 解析失败 question_id=${question.id} quality=${parsed.quality}`);
      return { success: false, questionId: question.id, error: '解析失败' };
    }
    
    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;
    
    if (question.missing_answer && parsed.parsed.answer) {
      updateFields.push(`answer = $${valueIndex++}`);
      updateValues.push(parsed.parsed.answer);
    }
    
    if (question.missing_analysis && parsed.parsed.analysis) {
      updateFields.push(`analysis = $${valueIndex++}`);
      updateValues.push(parsed.parsed.analysis);
    }
    
    if (parsed.parsed.knowledge_points && Array.isArray(parsed.parsed.knowledge_points)) {
      updateFields.push(`knowledge_points = $${valueIndex++}`);
      updateValues.push(parsed.parsed.knowledge_points.join(','));
    }
    
    if (parsed.parsed.difficulty && parsed.parsed.difficulty >= 1 && parsed.parsed.difficulty <= 5) {
      updateFields.push(`difficulty = $${valueIndex++}`);
      updateValues.push(parsed.parsed.difficulty);
    }
    
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(question.id);
    
    await db.query(`
      UPDATE exam_questions
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
    `, updateValues);
    
    logger.info(`[Backfill] 成功 question_id=${question.id} quality=${parsed.quality} time=${processingTime}ms tokens=${response.usage?.total_tokens || 0}`);
    
    return {
      success: true,
      questionId: question.id,
      quality: parsed.quality,
      tokens: response.usage?.total_tokens || 0,
      timeMs: processingTime
    };
  } catch (error) {
    logger.error(`[Backfill] 错误 question_id=${question.id}: ${error.message}`);
    return { success: false, questionId: question.id, error: error.message };
  }
}

async function runBatch(db, questions) {
  const results = [];
  let inProgress = [];
  
  for (let i = 0; i < questions.length; i++) {
    if (inProgress.length >= MAX_WORKERS) {
      const [result] = await Promise.race(inProgress.map(p => p.then(r => ({ result: r, idx: inProgress.indexOf(p) }))));
      results.push(result.result);
      inProgress = inProgress.filter((_, idx) => idx !== result.idx);
    }
    
    inProgress.push(processQuestion(db, questions[i]));
    
    if ((i + 1) % BATCH_SIZE === 0) {
      logger.info(`[Backfill] 已处理 ${i + 1}/${questions.length} 题`);
    }
  }
  
  const remainingResults = await Promise.all(inProgress);
  results.push(...remainingResults);
  
  return results;
}

async function generateQualityReport(db, results) {
  const stats = {
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    avgQuality: 0,
    avgTimeMs: 0,
    totalTokens: 0
  };
  
  const successResults = results.filter(r => r.success);
  if (successResults.length > 0) {
    stats.avgQuality = (successResults.reduce((sum, r) => sum + (r.quality || 0), 0) / successResults.length).toFixed(1);
    stats.avgTimeMs = (successResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / successResults.length).toFixed(0);
    stats.totalTokens = successResults.reduce((sum, r) => sum + (r.tokens || 0), 0);
  }
  
  const qualityDistribution = {
    excellent: successResults.filter(r => (r.quality || 0) >= 80).length,
    good: successResults.filter(r => (r.quality || 0) >= 60 && (r.quality || 0) < 80).length,
    fair: successResults.filter(r => (r.quality || 0) >= 40 && (r.quality || 0) < 60).length,
    poor: successResults.filter(r => (r.quality || 0) < 40).length
  };
  
  console.log('\n=== 批量补全质量报告 ===');
  console.log(`总题数: ${stats.total}`);
  console.log(`成功: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`);
  console.log(`失败: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
  console.log(`平均质量分: ${stats.avgQuality}`);
  console.log(`平均耗时: ${stats.avgTimeMs}ms`);
  console.log(`总Token消耗: ${stats.totalTokens}`);
  
  console.log('\n质量分布:');
  console.log(`  优秀(>=80): ${qualityDistribution.excellent}`);
  console.log(`  良好(60-79): ${qualityDistribution.good}`);
  console.log(`  一般(40-59): ${qualityDistribution.fair}`);
  console.log(`  较差(<40): ${qualityDistribution.poor}`);
  
  const dbStats = await db.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN answer IS NULL OR TRIM(answer) = '' THEN 1 ELSE 0 END) as missing_answer,
      SUM(CASE WHEN analysis IS NULL OR TRIM(analysis) = '' THEN 1 ELSE 0 END) as missing_analysis
    FROM exam_questions
    WHERE stem IS NOT NULL AND TRIM(stem) != ''
      AND stem NOT LIKE '[图片%]'
  `);
  
  const row = dbStats.rows[0];
  console.log('\n=== 数据库当前状态 ===');
  console.log(`总题数: ${row.total}`);
  console.log(`缺答案: ${row.missing_answer} (${((row.missing_answer / row.total) * 100).toFixed(1)}%)`);
  console.log(`缺解析: ${row.missing_analysis} (${((row.missing_analysis / row.total) * 100).toFixed(1)}%)`);
  
  return { stats, qualityDistribution };
}

async function run() {
  logger.info('[Backfill] 启动批量LLM补全脚本');
  
  const db = await getDb();
  
  try {
    const questions = await getQuestionsToBackfill(db, 100);
    logger.info(`[Backfill] 找到 ${questions.length} 道需要补全的题目`);
    
    if (questions.length === 0) {
      console.log('没有需要补全的题目');
      return;
    }
    
    const results = await runBatch(db, questions);
    
    await generateQualityReport(db, results);
    
    logger.info('[Backfill] 批量补全完成');
  } finally {
    await db.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => {
    logger.error('[Backfill] 脚本执行失败:', error);
    process.exit(1);
  });
}

export { getQuestionsToBackfill, processQuestion, runBatch, BACKFILL_PROMPT };