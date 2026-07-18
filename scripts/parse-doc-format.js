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

const SUBJECT_MAP = {
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '物理': 'physics',
  '化学': 'chemistry',
  '生物': 'biology',
  '历史': 'history',
  '地理': 'geography',
  '政治': 'politics'
};

const SUBJECT_CN = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治'
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
        timeout: 30000
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
      
      try {
        const mammothResult = await mammoth.extractRawText({ path: filePath });
        return mammothResult.value;
      } catch (mammothError) {
        console.log(`   ❌ DOC解析失败: ${mammothError.message}`);
        return '';
      }
    }
  } catch (e) {
    console.log(`   ❌ DOC解析错误: ${e.message}`);
    return '';
  }
}

async function extractTextFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (e) {
    console.log(`   ❌ DOCX解析错误: ${e.message}`);
    return '';
  }
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') return extractTextFromDOCX(filePath);
  if (ext === '.doc') return extractTextFromDOC(filePath);
  return '';
}

const EXTRACTION_PROMPT = `请作为专业的高考试卷题目提取助手，从以下试卷内容中提取所有题目。

要求：
1. 按照文档中标注的题号进行提取，每道大题作为一个独立题目
2. 如果题目包含多个小题（如1（1）、1（2）等），将所有小题内容合并到该大题中
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

注意：
- 选择题type为"choice"，填空题为"fill"，判断题为"judge"，解答题为"solve"
- options数组只用于选择题，其他题型可省略
- 确保JSON格式完整正确，不要添加任何解释文字`;

const SUBJECT_PROMPT_MAP = {
  chinese: '语文学科，包括现代文阅读、文言文阅读、诗歌鉴赏、语言基础、作文等题型',
  math: '数学学科，包括选择题、填空题、解答题等，注意提取公式和几何描述',
  english: '英语学科，包括阅读理解、完形填空、语法填空、写作等题型',
  physics: '物理学科，注意提取公式、单位和物理概念',
  chemistry: '化学学科，注意提取化学方程式、元素符号和实验描述',
  biology: '生物学科，注意提取生物概念、图表描述和实验过程',
  history: '历史学科，包括材料解析、论述题等，注意提取时间、事件和人物',
  geography: '地理学科，包括地图分析、综合题等，注意提取地理概念和数据',
  politics: '政治学科，包括选择题、材料分析题等，注意提取政治概念和理论'
};

const DEEPSEEK_ENDPOINT = env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = env.DEEPSEEK_MODEL || 'deepseek-chat';

async function callLLM(content, subject, kpList, retryCount = 0) {
  const subjectHint = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  const prompt = EXTRACTION_PROMPT
    .replace('{subject_hint}', subjectHint)
    .replace('{kp_list}', kpList || '无');
  
  const maxTokens = retryCount === 0 ? 16000 : 20000;
  
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。' },
        { role: 'user', content: prompt + '\n\n以下是试卷内容：\n' + content }
      ],
      temperature: 0.1,
      max_tokens: maxTokens
    })
  });
  
  const result = await response.json();
  if (result.error) {
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 3000));
      return callLLM(content, subject, kpList, retryCount + 1);
    }
    throw new Error('LLM 调用失败: ' + JSON.stringify(result.error));
  }
  if (result.choices && result.choices[0]) return result.choices[0].message.content;
  throw new Error('LLM 未返回有效内容');
}

function extractJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) cleaned = codeBlockMatch[1];
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  let jsonStr = braceMatch[0];
  
  try { return JSON.parse(jsonStr); } catch {}
  try { return JSON.parse(jsonStr.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'")); } catch {}
  
  try {
    const fixed = fixTruncatedJSON(jsonStr);
    return JSON.parse(fixed);
  } catch {}
  
  return null;
}

function fixTruncatedJSON(jsonStr) {
  let fixed = jsonStr;
  
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  while (closeBraces < openBraces) {
    fixed += '}';
    closeBraces++;
  }
  while (closeBrackets < openBrackets) {
    fixed += ']';
    closeBrackets++;
  }
  
  const lines = fixed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.endsWith(',') && !line.includes(':')) {
      lines[i] = line.replace(/,$/, '');
    }
    if (line.endsWith(',') && i === lines.length - 1) {
      lines[i] = line.replace(/,$/, '');
    }
  }
  return lines.join('\n');
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

async function getKPList(pool, subject) {
  try {
    const res = await pool.query(
      'SELECT name FROM knowledge_points WHERE subject = $1 LIMIT 100',
      [subject]
    );
    return res.rows.map(r => r.name).join('、');
  } catch {
    return '无';
  }
}

function findPaperFile(subjectCn, year) {
  const dirMap = {
    '语文': '1. 北京高考语文2008-2025',
    '数学': '2. 北京高考数学2008-2025',
    '英语': '3. 北京高考英语2008-2025',
    '物理': '4. 北京高考物理2008-2025',
    '化学': '5. 北京高考化学2008-2025',
    '生物': '6. 北京高考生物2008-2025',
    '历史': '7. 北京高考历史2008-2025',
    '政治': '8. 北京高考政治2008-2025',
    '地理': '9. 北京高考地理2008-2025'
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
  console.log(`   文件格式: ${path.extname(filePath)}`);
  
  const content = await extractText(filePath);
  if (!content || content.length < 100) {
    console.log(`   ❌ 文本提取失败或内容过短 (长度: ${content.length})`);
    
    const outputFile = path.join(ROOT, 'database', 'parsed-examples', `${subject}_${year}_debug.txt`);
    fs.writeFileSync(outputFile, content || '', 'utf-8');
    console.log(`   已保存调试文件: ${outputFile}`);
    
    return { success: false, error: '文本提取失败' };
  }
  
  console.log(`   文本长度: ${content.length} 字符`);
  
  const kpList = await getKPList(pool, subject);
  
  let allQuestions = [];
  try {
    const llmResult = await callLLM(content, subject, kpList);
    const data = extractJSON(llmResult);
    
    if (data && data.questions && Array.isArray(data.questions)) {
      for (const q of data.questions) {
        const sanitized = sanitizeQuestion(q);
        allQuestions.push(sanitized);
      }
    } else {
      console.log(`   ❌ LLM输出解析失败`);
      const llmOutputFile = path.join(ROOT, 'database', 'parsed-examples', `${subject}_${year}_llm-output.txt`);
      fs.writeFileSync(llmOutputFile, llmResult || '', 'utf-8');
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
  
  const qNumbers = allQuestions.map(q => q.number).sort((a, b) => a - b);
  const minNum = qNumbers[0];
  const maxNum = qNumbers[qNumbers.length - 1];
  
  const missingNumbers = [];
  for (let i = minNum; i <= maxNum; i++) {
    if (!qNumbers.includes(i)) {
      missingNumbers.push(i);
    }
  }
  
  if (missingNumbers.length > 0) {
    console.log(`   ⚠️  缺失题号: ${missingNumbers.join(', ')}`);
  }
  
  const emptyStem = allQuestions.filter(q => !q.stem || q.stem.trim().length < 10);
  if (emptyStem.length > 0) {
    console.log(`   ⚠️  题干内容过短: 题号 ${emptyStem.map(q => q.number).join(', ')}`);
  }
  
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
    
    await pool.query(
      'UPDATE exam_papers SET question_count = $1 WHERE id = $2',
      [insertedCount, paper.id]
    );
    
    console.log(`   ✅ 成功入库 ${insertedCount} 道题目`);
    return { success: true, count: insertedCount, subject, year };
    
  } catch (e) {
    console.log(`   ❌ 入库失败: ${e.message}`);
    return { success: false, error: '入库失败' };
  }
}

async function main() {
  console.log('============================================================');
  console.log(`📦 解析2021年北京高考试卷 (DOC格式)`);
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
    console.log('✅ PostgreSQL 数据库连接池初始化成功');
  } catch (e) {
    console.log(`❌ 数据库连接失败: ${e.message}`);
    return;
  }
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const [cnName, code] of Object.entries(SUBJECT_MAP)) {
    const result = await parseSinglePaper(pool, code, YEAR);
    results.push({ subject: cnName, year: YEAR, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await pool.end();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理结果汇总');
  console.log('='.repeat(60));
  
  results.forEach(r => {
    if (r.success) {
      console.log(`✓ ${r.subject} ${r.year}年: ${r.count}道题目`);
    } else {
      console.log(`✗ ${r.subject} ${r.year}年: ${r.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`总计: ${successCount}/${successCount + failCount} 成功`);
  console.log('============================================================');
}

main().catch(console.error);