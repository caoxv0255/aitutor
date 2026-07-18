import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import { chatCompletion, safeParseLLMJson } from '../services/llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

import dotenv from 'dotenv';
dotenv.config({ path: path.join(ROOT, '.env') });

const { Pool } = pg;

const SUBJECT_MAP = {
  '数学': 'math',
  '英语': 'english',
  '物理': 'physics'
};

const PROVINCE_CODE = 'beijing';
const YEAR = 2021;
const DATABASE_DIR = path.join(ROOT, 'database', '高考真题', '北京高考');

async function extractTextFromDOC(filePath) {
  try {
    const child_process = await import('child_process');
    
    const tempFile = filePath.replace(/\.doc$/, '_temp.txt');
    
    try {
      const convertScript = path.join(__dirname, 'convert-doc.py');
      child_process.execFileSync('python', [convertScript, filePath, tempFile], { 
        encoding: 'utf-8',
        timeout: 60000
      });
      
      if (fs.existsSync(tempFile)) {
        const result = fs.readFileSync(tempFile, 'utf-8');
        fs.unlinkSync(tempFile);
        return result;
      } else {
        throw new Error('转换后的文件不存在');
      }
    } catch (error) {
      console.log(`   ⚠️  Python转换失败: ${error.message}`);
      throw error;
    }
  } catch (e) {
    console.log(`   ❌ DOC解析错误: ${e.message}`);
    return '';
  }
}

const EXTRACTION_PROMPT = `请作为专业的高考试卷题目提取助手，从以下试卷内容中提取所有题目。

要求：
1. 按照文档中标注的题号进行提取，每道大题作为一个独立题目
2. 如果题目包含多个小题，将所有小题内容合并到该大题中
3. 包含完整的阅读材料、题目文本及所有相关小题内容
4. 严格按照JSON格式输出，格式如下：
{
  "questions": [
    {
      "number": 题号,
      "type": "题型（choice/solve/fill/judge）",
      "stem": "题干内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "答案",
      "analysis": "解析",
      "knowledge_points": ["知识点1", "知识点2"],
      "difficulty": 难度(1-5),
      "score": 分值
    }
  ]
}

注意：确保JSON格式完整正确，不要添加任何解释文字。`;

const SUBJECT_PROMPT_MAP = {
  math: '数学学科，包括选择题、填空题、解答题等',
  english: '英语学科，包括阅读理解、完形填空、语法填空、写作等题型',
  physics: '物理学科，注意提取公式、单位和物理概念'
};

async function callLLM(content, subject) {
  const subjectHint = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  const prompt = EXTRACTION_PROMPT
    .replace('{subject_hint}', subjectHint)
    .replace('{kp_list}', '无');
  
  try {
    const result = await chatCompletion(
      '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。',
      prompt + '\n\n以下是试卷内容：\n' + content,
      { model: 'qwen-plus', temperature: 0.1, max_tokens: 16000, jsonMode: true }
    );
    
    return result.content;
  } catch (e) {
    console.log(`   🔄 JSON模式失败，尝试非JSON模式...`);
    
    const result = await chatCompletion(
      '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。',
      prompt + '\n\n以下是试卷内容：\n' + content,
      { model: 'qwen-plus', temperature: 0.1, max_tokens: 16000, jsonMode: false }
    );
    
    return result.content;
  }
}

function sanitizeQuestion(q) {
  return {
    number: q.number || 0,
    type: q.type || 'solve',
    stem: q.stem || '',
    options: q.options || null,
    answer: q.answer || '',
    analysis: q.analysis || '',
    knowledge_points: q.knowledge_points || [],
    difficulty: q.difficulty || 3,
    score: q.score || 0
  };
}

function generateQuestionUID(subject, year, province, number) {
  return `${subject}_${year}_${province}_${String(number).padStart(3, '0')}`;
}

function findPaperFile(subjectCn, year) {
  const dirMap = {
    '数学': '2. 北京高考数学2008-2025',
    '英语': '3. 北京高考英语2008-2025',
    '物理': '4. 北京高考物理2008-2025'
  };
  
  const dirName = dirMap[subjectCn];
  if (!dirName) return null;
  
  const dirPath = path.join(DATABASE_DIR, dirName);
  if (!fs.existsSync(dirPath)) return null;
  
  const files = fs.readdirSync(dirPath);
  
  const yearStr = year.toString();
  
  const patterns = [
    `${yearStr}年北京高考${subjectCn}试卷（原卷版）`,
    `${yearStr}年北京高考${subjectCn}试卷`,
    `${yearStr}年北京高考${subjectCn}`
  ];
  
  for (const pattern of patterns) {
    const found = files.find(f => f.includes(pattern) && f.endsWith('.doc'));
    if (found) {
      return path.join(dirPath, found);
    }
  }
  
  return null;
}

async function parseSinglePaper(pool, subject, year) {
  const provinceCode = PROVINCE_CODE;
  const cnName = Object.keys(SUBJECT_MAP).find(k => SUBJECT_MAP[k] === subject);
  
  console.log(`\n📋 解析：${cnName} ${year}年`);
  
  const filePath = findPaperFile(cnName, year);
  
  if (!filePath) {
    console.log(`   ❌ 文件未找到`);
    return { success: false, error: '文件未找到' };
  }
  
  console.log(`   文件路径: ${filePath}`);
  
  const content = await extractTextFromDOC(filePath);
  if (!content || content.length < 100) {
    console.log(`   ❌ 文本提取失败或内容过短`);
    return { success: false, error: '文本提取失败' };
  }
  
  console.log(`   文本长度: ${content.length} 字符`);
  
  let allQuestions = [];
  try {
    const llmResult = await callLLM(content, subject);
    const data = safeParseLLMJson(llmResult);
    
    if (data && data.questions && Array.isArray(data.questions)) {
      for (const q of data.questions) {
        const sanitized = sanitizeQuestion(q);
        allQuestions.push(sanitized);
      }
    } else {
      console.log(`   ❌ LLM输出解析失败`);
      return { success: false, error: 'LLM输出解析失败' };
    }
  } catch (e) {
    console.log(`   ❌ LLM调用失败: ${e.message}`);
    return { success: false, error: 'LLM调用失败' };
  }
  
  if (allQuestions.length === 0) {
    console.log(`   ❌ 未提取到题目`);
    return { success: false, error: '未提取到题目' };
  }
  
  console.log(`   提取到 ${allQuestions.length} 道题目`);
  
  try {
    const paperRes = await pool.query(
      'SELECT id FROM exam_papers WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4',
      [provinceCode, year, subject, 'gaokao']
    );
    
    if (paperRes.rows.length === 0) {
      console.log(`   ❌ 未找到试卷记录`);
      return { success: false, error: '未找到试卷记录' };
    }
    
    const paper = paperRes.rows[0];
    await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paper.id]);
    
    let insertedCount = 0;
    for (const q of allQuestions) {
      const questionUid = generateQuestionUID(subject, year, provinceCode, q.number);
      
      try {
        await pool.query(`
          INSERT INTO exam_questions (
            question_uid, paper_id, question_number, question_type, stem, options,
            answer, analysis, knowledge_points, difficulty, score,
            subject_code, province_code, year, has_image, has_formula,
            image_descriptions, latex_formulas
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          questionUid, paper.id, q.number, q.type, q.stem,
          q.options ? JSON.stringify(q.options) : null,
          q.answer, q.analysis,
          q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
          q.difficulty, q.score, subject, provinceCode, year,
          false, false, null, null
        ]);
        insertedCount++;
      } catch (e) {
        console.log(`   ❌ 第${q.number}题入库失败: ${e.message}`);
      }
    }
    
    await pool.query('UPDATE exam_papers SET question_count = $1 WHERE id = $2', [insertedCount, paper.id]);
    
    console.log(`   ✅ 成功入库 ${insertedCount} 道题目`);
    return { success: true, count: insertedCount };
    
  } catch (e) {
    console.log(`   ❌ 入库失败: ${e.message}`);
    return { success: false, error: '入库失败' };
  }
}

async function main() {
  console.log('============================================================');
  console.log(`📦 重试解析2021年北京高考试卷 (DOC格式)`);
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
  
  await pool.query('SELECT 1');
  console.log('✅ PostgreSQL 数据库连接池初始化成功');
  
  const results = [];
  
  for (const [cnName, code] of Object.entries(SUBJECT_MAP)) {
    await new Promise(r => setTimeout(r, 3000));
    const result = await parseSinglePaper(pool, code, YEAR);
    results.push({ subject: cnName, ...result });
  }
  
  await pool.end();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理结果汇总');
  console.log('='.repeat(60));
  
  results.forEach(r => {
    if (r.success) {
      console.log(`✓ ${r.subject} ${YEAR}年: ${r.count}道题目`);
    } else {
      console.log(`✗ ${r.subject} ${YEAR}年: ${r.error}`);
    }
  });
}

main().catch(console.error);