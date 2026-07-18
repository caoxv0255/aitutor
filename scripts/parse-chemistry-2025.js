import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

import dotenv from 'dotenv';
dotenv.config({ path: path.join(ROOT, '.env') });

const { Pool } = pg;

const SUBJECT = 'chemistry';
const YEAR = 2025;
const PROVINCE_CODE = 'beijing';
const DATABASE_DIR = path.join(ROOT, 'database', '高考真题', '北京高考');

async function extractTextFromDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

const EXTRACTION_PROMPT = `请作为专业的高考化学试卷题目提取助手，从以下试卷内容中提取所有题目。

要求：
1. 按照文档中标注的题号进行提取，每道大题作为一个独立题目
2. 如果题目包含多个小题（如1（1）、1（2）等），将所有小题内容合并到该大题中
3. 包含完整的题目文本及所有相关小题内容
4. 严格按照JSON格式输出，格式如下：
{
  "questions": [
    {
      "number": 题号,
      "type": "choice或solve",
      "stem": "题干内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "答案",
      "analysis": "解析",
      "knowledge_points": ["知识点1"],
      "difficulty": 难度(1-5),
      "score": 分值
    }
  ]
}

注意：选择题type为"choice"，其他题型为"solve"。确保JSON格式完整正确。`;

const DEEPSEEK_ENDPOINT = env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = env.DEEPSEEK_MODEL || 'deepseek-chat';

async function callLLM(content, retryCount = 0) {
  const maxTokens = retryCount === 0 ? 8000 : 16000;
  
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，不要添加任何解释。' },
        { role: 'user', content: EXTRACTION_PROMPT + '\n\n以下是试卷内容：\n' + content }
      ],
      temperature: 0.1,
      max_tokens: maxTokens
    })
  });
  
  const result = await response.json();
  if (result.error) {
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 3000));
      return callLLM(content, retryCount + 1);
    }
    throw new Error('LLM 调用失败: ' + JSON.stringify(result.error));
  }
  if (result.choices && result.choices[0]) return result.choices[0].message.content;
  throw new Error('LLM 未返回有效内容');
}

function extractJSON(text) {
  console.log('LLM输出前1000字符:', text.substring(0, 1000));
  
  if (!text) return null;
  let cleaned = text.trim();
  
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    console.log('找到代码块');
    cleaned = codeBlockMatch[1];
  }
  
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) {
    console.log('未找到JSON对象');
    return null;
  }
  
  let jsonStr = braceMatch[0];
  console.log('提取的JSON长度:', jsonStr.length);
  
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('JSON解析成功');
    return parsed;
  } catch (e) {
    console.log('JSON解析失败:', e.message);
  }
  
  try {
    const fixed = jsonStr.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    const parsed = JSON.parse(fixed);
    console.log('替换引号后解析成功');
    return parsed;
  } catch (e) {
    console.log('替换引号后解析失败:', e.message);
  }
  
  return null;
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

async function main() {
  console.log('============================================================');
  console.log('📦 单独解析化学 2025年');
  console.log('============================================================');
  
  const filePath = path.join(DATABASE_DIR, '5. 北京高考化学2008-2025', '2025年北京高考化学试卷（原卷版）.docx');
  
  console.log('文件路径:', filePath);
  
  const content = await extractTextFromDOCX(filePath);
  console.log('文本长度:', content.length);
  console.log('文本预览:', content.substring(0, 500));
  
  const llmResult = await callLLM(content);
  
  const outputFile = path.join(ROOT, 'database', 'parsed-examples', 'chemistry_2025_debug.txt');
  fs.writeFileSync(outputFile, llmResult, 'utf-8');
  console.log('LLM输出已保存:', outputFile);
  
  const data = extractJSON(llmResult);
  
  if (!data || !data.questions) {
    console.log('❌ 解析失败');
    return;
  }
  
  console.log('提取到', data.questions.length, '道题目');
  
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
  console.log('✅ 数据库连接成功');
  
  const paperRes = await pool.query(
    'SELECT id FROM exam_papers WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4',
    [PROVINCE_CODE, YEAR, SUBJECT, 'gaokao']
  );
  
  if (paperRes.rows.length === 0) {
    console.log('❌ 未找到试卷记录');
    return;
  }
  
  const paper = paperRes.rows[0];
  await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paper.id]);
  
  let insertedCount = 0;
  for (const q of data.questions) {
    const sanitized = sanitizeQuestion(q);
    const questionUid = generateQuestionUID(SUBJECT, YEAR, PROVINCE_CODE, sanitized.number);
    
    try {
      await pool.query(`
        INSERT INTO exam_questions (
          question_uid, paper_id, question_number, question_type, stem, options,
          answer, analysis, knowledge_points, difficulty, score,
          subject_code, province_code, year, has_image, has_formula,
          image_descriptions, latex_formulas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        questionUid, paper.id, sanitized.number, sanitized.type, sanitized.stem,
        sanitized.options ? JSON.stringify(sanitized.options) : null,
        sanitized.answer, sanitized.analysis,
        sanitized.knowledge_points ? JSON.stringify(sanitized.knowledge_points) : null,
        sanitized.difficulty, sanitized.score, SUBJECT, PROVINCE_CODE, YEAR,
        false, false, null, null
      ]);
      insertedCount++;
    } catch (e) {
      console.log(`❌ 第${sanitized.number}题入库失败: ${e.message}`);
    }
  }
  
  await pool.query('UPDATE exam_papers SET question_count = $1 WHERE id = $2', [insertedCount, paper.id]);
  await pool.end();
  
  console.log(`✅ 成功入库 ${insertedCount} 道题目`);
}

main().catch(console.error);