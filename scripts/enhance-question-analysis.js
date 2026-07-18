import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const { Pool } = pg;

const SUBJECT_MAP = {
  chinese: { name: '语文', dir: '1. 北京高考语文2008-2025' },
  math: { name: '数学', dir: '2. 北京高考数学2008-2025' },
  english: { name: '英语', dir: '3. 北京高考英语2008-2025' },
  physics: { name: '物理', dir: '4. 北京高考物理2008-2025' },
  chemistry: { name: '化学', dir: '5. 北京高考化学2008-2025' },
  biology: { name: '生物', dir: '6. 北京高考生物2008-2025' },
  history: { name: '历史', dir: '7. 北京高考历史2008-2025' },
  politics: { name: '政治', dir: '8. 北京高考政治2008-2025' },
  geography: { name: '地理', dir: '9. 北京高考地理2008-2025' }
};

const BASE_DATA_DIR = path.join(ROOT, 'database', 'question-bank');
const RAW_DIR = path.join(ROOT, 'database', '高考真题', '北京高考');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonStringify(obj, spaces) {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, spaces);
}

function getQuestionCount(subject, year) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(dir)) return 0;
  const questionDirs = fs.readdirSync(dir).filter(d => 
    fs.statSync(path.join(dir, d)).isDirectory() && /^\d{3}$/.test(d)
  );
  return questionDirs.length;
}

function loadQuestions(subject, year) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(dir)) return [];
  
  const questionDirs = fs.readdirSync(dir).filter(d => 
    fs.statSync(path.join(dir, d)).isDirectory() && /^\d{3}$/.test(d)
  ).sort((a, b) => parseInt(a) - parseInt(b));
  
  const questions = [];
  for (const qDir of questionDirs) {
    const metaPath = path.join(dir, qDir, 'metadata.json');
    const contentPath = path.join(dir, qDir, 'content.md');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (fs.existsSync(contentPath)) {
          meta.content = fs.readFileSync(contentPath, 'utf-8');
        }
        questions.push(meta);
      } catch (e) {
        console.log(`   ⚠️ 读取题目${qDir}失败: ${e.message}`);
      }
    }
  }
  return questions;
}

function saveQuestion(subject, year, question) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  const qDir = path.join(dir, String(question.question_number).padStart(3, '0'));
  ensureDir(qDir);
  
  fs.writeFileSync(path.join(qDir, 'metadata.json'), safeJsonStringify(question, 2), 'utf-8');
  
  let mdContent = `# 第${question.question_number}题 (${question.question_type_name})\n\n`;
  mdContent += `**难度**: ${'★'.repeat(question.difficulty)}${'☆'.repeat(5 - question.difficulty)}\n\n`;
  mdContent += `**分值**: ${question.score}分\n\n`;
  if (question.knowledge_points && question.knowledge_points.length > 0) {
    mdContent += `**知识点**: ${question.knowledge_points.join('、')}\n\n`;
  }
  mdContent += `---\n\n`;
  mdContent += `## 题目\n\n${question.stem}\n\n`;
  if (question.options && question.options.length > 0) {
    mdContent += `## 选项\n\n`;
    question.options.forEach((opt, idx) => {
      mdContent += `${String.fromCharCode(65 + idx)}. ${opt}\n\n`;
    });
  }
  mdContent += `## 参考答案\n\n${question.answer || '暂无'}\n\n`;
  mdContent += `## 解析\n\n${question.analysis || '暂无'}\n\n`;
  
  fs.writeFileSync(path.join(qDir, 'content.md'), mdContent, 'utf-8');
}

async function callLLMForAnalysis(questions, subject) {
  const { chatCompletion } = await import('../services/llm.js');
  const subjectInfo = SUBJECT_MAP[subject];
  
  const prompt = `你是一位专业的${subjectInfo.name}学科老师。请为以下题目生成完整的参考答案和详细解析。

要求：
1. 答案必须准确无误
2. 解析要详细，包含解题思路、关键知识点、步骤说明
3. 选择题要解释每个选项的正确性或错误原因
4. 解答题要给出完整的解题步骤和评分标准
5. 输出格式为JSON数组，与输入题目顺序对应

输入题目：
${JSON.stringify(questions.map(q => ({ number: q.question_number, type: q.question_type_name, stem: q.stem, options: q.options })), null, 2)}

请返回：
[
  {"number": 题号, "answer": "答案内容", "analysis": "解析内容"}
]
`;
  
  try {
    const result = await chatCompletion(
      `你是一位专业的${subjectInfo.name}学科老师。请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。`,
      prompt,
      { model: 'deepseek-chat', temperature: 0.3, max_tokens: 20000, jsonMode: true }
    );
    
    try {
      return JSON.parse(result.content);
    } catch {
      const match = result.content.match(/\[.*\]/s);
      if (match) return JSON.parse(match[0]);
    }
  } catch (e) {
    console.log(`   ⚠️ LLM调用失败: ${e.message}`);
  }
  
  return null;
}

function safeParseLLMJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\[.*\]/s);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

async function enhanceQuestions(subject, year, pool) {
  console.log(`\n📚 增强 ${SUBJECT_MAP[subject].name} ${year}年...`);
  
  const questions = loadQuestions(subject, year);
  if (questions.length === 0) {
    console.log(`   ❌ 未找到题目数据`);
    return { success: false, error: '未找到题目数据' };
  }
  
  console.log(`   加载到 ${questions.length} 道题目`);
  
  const needEnhance = questions.filter(q => 
    !q.answer || !q.answer.trim() || !q.analysis || !q.analysis.trim()
  );
  
  if (needEnhance.length === 0) {
    console.log(`   ✅ 所有题目答案和解析已完整`);
    return { success: true, enhanced: 0 };
  }
  
  console.log(`   需要增强 ${needEnhance.length} 道题目...`);
  
  const result = await callLLMForAnalysis(needEnhance, subject);
  
  if (!result || !Array.isArray(result)) {
    console.log(`   ❌ LLM生成失败`);
    return { success: false, error: 'LLM生成失败' };
  }
  
  let enhancedCount = 0;
  for (const ans of result) {
    const q = questions.find(q => q.question_number === ans.number);
    if (q) {
      if (ans.answer && ans.answer.trim()) {
        q.answer = ans.answer.trim();
        enhancedCount++;
      }
      if (ans.analysis && ans.analysis.trim()) {
        q.analysis = ans.analysis.trim();
        if (!q.answer) enhancedCount++;
      }
      saveQuestion(subject, year, q);
      
      if (pool) {
        try {
          await pool.query(
            'UPDATE exam_questions SET answer = $1, analysis = $2 WHERE question_uid = $3',
            [q.answer || null, q.analysis || null, q.uid]
          );
        } catch (e) {
          console.log(`   ⚠️ 更新数据库失败: ${e.message}`);
        }
      }
    }
  }
  
  console.log(`   ✅ 成功增强 ${enhancedCount} 道题目`);
  
  const finalQuality = performQualityCheck(questions);
  console.log(`   📊 增强后: 答案完整率${finalQuality.answer_completeness}%, 解析完整率${finalQuality.analysis_completeness}%`);
  
  return { success: true, enhanced: enhancedCount, total: questions.length, quality: finalQuality };
}

function performQualityCheck(questions) {
  if (!questions || questions.length === 0) {
    return { answer_completeness: 0, analysis_completeness: 0 };
  }
  
  let answerCount = 0, analysisCount = 0;
  for (const q of questions) {
    if (q.answer && q.answer.trim()) answerCount++;
    if (q.analysis && q.analysis.trim()) analysisCount++;
  }
  
  return {
    answer_completeness: ((answerCount / questions.length) * 100).toFixed(1),
    analysis_completeness: ((analysisCount / questions.length) * 100).toFixed(1)
  };
}

async function main() {
  console.log('============================================================');
  console.log('🚀 题目答案和解析增强工具');
  console.log('============================================================');
  
  const dbUrl = env.DATABASE_URL || 'postgresql://postgres:cxclementine102365@localhost:5432/aitutor';
  const url = new URL(dbUrl);
  
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    max: 10
  });
  
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL 数据库连接成功');
  } catch (e) {
    console.log(`❌ 数据库连接失败: ${e.message}`);
    console.log('将仅更新文件，不更新数据库');
    pool.end();
    await mainWithoutDB();
    return;
  }
  
  const years = [2019, 2020, 2021, 2022, 2023];
  const subjects = Object.keys(SUBJECT_MAP);
  
  let totalEnhanced = 0;
  let totalProcessed = 0;
  
  for (const subject of subjects) {
    for (const year of years) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await enhanceQuestions(subject, year, pool);
      if (result.success) {
        totalEnhanced += result.enhanced;
        totalProcessed++;
      }
    }
  }
  
  await pool.end();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 增强结果汇总');
  console.log('='.repeat(60));
  console.log(`处理试卷: ${totalProcessed}份`);
  console.log(`增强题目: ${totalEnhanced}道`);
  console.log(`📁 数据目录: ${BASE_DATA_DIR}`);
}

async function mainWithoutDB() {
  const years = [2019, 2020, 2021, 2022, 2023];
  const subjects = Object.keys(SUBJECT_MAP);
  
  let totalEnhanced = 0;
  let totalProcessed = 0;
  
  for (const subject of subjects) {
    for (const year of years) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await enhanceQuestions(subject, year, null);
      if (result.success) {
        totalEnhanced += result.enhanced;
        totalProcessed++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 增强结果汇总');
  console.log('='.repeat(60));
  console.log(`处理试卷: ${totalProcessed}份`);
  console.log(`增强题目: ${totalEnhanced}道`);
  console.log(`📁 数据目录: ${BASE_DATA_DIR}`);
}

export { enhanceQuestions, main };

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.replace('\\', '/').endsWith(path.basename(__filename))) {
  main().catch(console.error);
}