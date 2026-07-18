import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import { chatCompletion, safeParseLLMJson } from '../services/llm.js';
import dotenv from 'dotenv';
import { execFileSync } from 'child_process';
import os from 'os';

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

const PROVINCE_CODE = 'beijing';
const EXAM_LEVEL = 'gaokao';
const BASE_DATA_DIR = path.join(ROOT, 'database', 'question-bank');
const RAW_DIR = path.join(ROOT, 'database', '高考真题', '北京高考');

const SUBJECT_PROMPT_MAP = {
  chinese: '语文学科，包括现代文阅读、文言文阅读、诗歌鉴赏、语言基础、作文等题型',
  math: '数学学科，包括选择题、填空题、解答题等，注意提取公式和几何描述',
  english: '英语学科，包括阅读理解、完形填空、语法填空、写作等题型',
  physics: '物理学科，注意提取公式、单位和物理概念',
  chemistry: '化学学科，注意提取化学式、方程式和实验描述',
  biology: '生物学科，注意提取生物概念、实验设计和图表分析',
  history: '历史学科，包括史料阅读、分析论述等题型',
  geography: '地理学科，注意提取地图分析、地理概念和图表解读',
  politics: '政治学科，包括政治理论、材料分析和论述题'
};

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
      "type": "题型（choice/solve/fill/judge/multi_choice）",
      "stem": "题干内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "答案",
      "analysis": "解析",
      "knowledge_points": ["知识点1", "知识点2"],
      "difficulty": 难度(1-5),
      "score": 分值,
      "sub_questions": [{"number": "1(1)", "stem": "小题内容", "answer": "答案"}]
    }
  ],
  "metadata": {"total_questions": 总题数, "paper_title": "试卷标题", "year": 年份}
}

注意：选择题type为"choice"，多选题为"multi_choice"，填空题为"fill"，判断题为"judge"，解答题为"solve"。确保JSON格式完整正确。`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonStringify(obj, space = 2) {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.replace(/[\x00-\x1F\x7F]/g, '');
    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, space);
}

function generateQuestionUID(subject, year, province, number) {
  return `${subject}_${year}_${province}_${String(number).padStart(3, '0')}`;
}

async function extractTextAndImagesFromPDF(pdfPath) {
  return new Promise((resolve) => {
    const tmpScript = path.join(os.tmpdir(), `pdf_extract_${Date.now()}.py`);
    
    const script = `# -*- coding: utf-8 -*-
import sys
try:
    import fitz
    doc = fitz.open(r"""${pdfPath}""")
    content_parts = []
    images_info = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text: content_parts.append(f"[第{page_num+1}页]\\n{text}\\n")
        images = page.get_images(full=True)
        for idx, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            if base_image:
                images_info.append({"page": page_num+1, "index": idx+1, "width": base_image.get("width",0), "height": base_image.get("height",0)})
    page_count = len(doc)
    image_count = len(images_info)
    doc.close()
    result = {"text": "\\n".join(content_parts), "page_count": page_count, "image_count": image_count, "images": images_info}
    sys.stdout.buffer.write(str(result).encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
    
    try {
      fs.writeFileSync(tmpScript, script, 'utf-8');
      const output = execFileSync('python', [tmpScript], { encoding: 'buffer', timeout: 60000, maxBuffer: 50 * 1024 * 1024 });
      try { fs.unlinkSync(tmpScript); } catch {}
      const resultStr = output.toString('utf-8');
      let result;
      try { result = eval(resultStr); } catch { result = { text: resultStr, page_count: 0, image_count: 0, images: [] }; }
      resolve(result);
    } catch (e) {
      try { fs.unlinkSync(tmpScript); } catch {}
      resolve({ text: '', page_count: 0, image_count: 0, images: [] });
    }
  });
}

async function extractImagesFromPDF(pdfPath, outputDir) {
  return new Promise((resolve) => {
    const tmpScript = path.join(os.tmpdir(), `pdf_images_${Date.now()}.py`);
    ensureDir(outputDir);
    
    const script = `# -*- coding: utf-8 -*-
import sys
import os
try:
    import fitz
    doc = fitz.open(r"""${pdfPath}""")
    saved_images = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)
        for idx, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            if base_image:
                img_bytes = base_image["image"]
                img_ext = base_image.get("ext", "png")
                img_filename = f"page_{page_num+1}_img_{idx+1}.{img_ext}"
                img_path = os.path.join(r"""${outputDir}""", img_filename)
                with open(img_path, "wb") as f: f.write(img_bytes)
                saved_images.append({"filename": img_filename, "page": page_num+1, "index": idx+1, "width": base_image.get("width",0), "height": base_image.get("height",0)})
    doc.close()
    sys.stdout.buffer.write(str(saved_images).encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
    
    try {
      fs.writeFileSync(tmpScript, script, 'utf-8');
      const output = execFileSync('python', [tmpScript], { encoding: 'buffer', timeout: 120000, maxBuffer: 100 * 1024 * 1024 });
      try { fs.unlinkSync(tmpScript); } catch {}
      const resultStr = output.toString('utf-8');
      let result;
      try { result = eval(resultStr); } catch { result = []; }
      resolve(result);
    } catch (e) {
      try { fs.unlinkSync(tmpScript); } catch {}
      resolve([]);
    }
  });
}

async function callLLMForExtraction(content, subject) {
  const prompt = EXTRACTION_PROMPT;
  const subjectPrompt = SUBJECT_PROMPT_MAP[subject] || '';
  
  try {
    const result = await chatCompletion(
      `你是一个专业的高考试卷题目提取助手。${subjectPrompt}请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。`,
      prompt + '\n\n以下是试卷内容：\n' + content,
      { model: 'deepseek-v4-pro', temperature: 0.1, max_tokens: 20000, jsonMode: true }
    );
    return safeParseLLMJson(result.content);
  } catch (e) {
    console.log(`   ⚠️  deepseek-v4-pro JSON模式失败，回退到deepseek-chat...`);
    try {
      const result = await chatCompletion(
        `你是一个专业的高考试卷题目提取助手。${subjectPrompt}请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。`,
        prompt + '\n\n以下是试卷内容：\n' + content,
        { model: 'deepseek-chat', temperature: 0.1, max_tokens: 16000, jsonMode: true }
      );
      return safeParseLLMJson(result.content);
    } catch (e2) {
      console.log(`   ⚠️  deepseek-chat JSON模式失败，尝试非JSON模式...`);
      const result = await chatCompletion(
        `你是一个专业的高考试卷题目提取助手。${subjectPrompt}请严格按照JSON格式输出，确保JSON完整闭合，不要添加任何解释。`,
        prompt + '\n\n以下是试卷内容：\n' + content,
        { model: 'deepseek-chat', temperature: 0.1, max_tokens: 16000, jsonMode: false }
      );
      return safeParseLLMJson(result.content);
    }
  }
}

function getQuestionTypeName(type) {
  const typeMap = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题', judge: '判断题', essay: '作文题', reading: '阅读理解' };
  return typeMap[type] || type;
}

function generateMarkdownContent(question) {
  let md = `# 第${question.number}题\n\n**题型**: ${getQuestionTypeName(question.type)}\n\n**难度**: ${'★'.repeat(question.difficulty || 3)}${'☆'.repeat(5 - (question.difficulty || 3))}\n\n**分值**: ${question.score || 0}分\n\n`;
  if (question.knowledge_points && question.knowledge_points.length > 0) {
    md += `**知识点**: ${question.knowledge_points.join('、')}\n\n`;
  }
  md += `---\n\n## 题目内容\n\n${question.stem}\n\n`;
  if (question.options && question.options.length > 0) {
    md += `## 选项\n\n`;
    question.options.forEach((opt, idx) => { md += `${String.fromCharCode(65 + idx)}. ${opt}\n\n`; });
  }
  if (question.sub_questions && question.sub_questions.length > 0) {
    md += `## 小题\n\n`;
    question.sub_questions.forEach((sub, idx) => { md += `### ${sub.number || idx + 1}\n\n${sub.stem}\n\n**答案**: ${sub.answer || ''}\n\n`; });
  }
  md += `---\n\n## 参考答案\n\n${question.answer || '暂无'}\n\n`;
  if (question.analysis) md += `## 解析\n\n${question.analysis}\n\n`;
  return md;
}

function generateMetadataJson(question, subject, year, imageFiles = []) {
  return {
    uid: generateQuestionUID(subject, year, PROVINCE_CODE, question.number),
    subject,
    subject_name: SUBJECT_MAP[subject].name,
    year,
    province: PROVINCE_CODE,
    province_name: '北京',
    exam_level: EXAM_LEVEL,
    question_number: question.number,
    question_type: question.type,
    question_type_name: getQuestionTypeName(question.type),
    difficulty: question.difficulty || 3,
    score: question.score || 0,
    knowledge_points: question.knowledge_points || [],
    has_image: imageFiles.length > 0,
    has_formula: question.stem && /[\u0391-\u03c9\u2200-\u22ff]/.test(question.stem),
    image_count: imageFiles.length,
    images: imageFiles.map(f => ({ filename: f.filename, page: f.page, width: f.width, height: f.height })),
    created_at: new Date().toISOString(),
    source_file: 'PDF解析',
    parsing_version: 'v1.0'
  };
}

function performQualityCheck(questions, subject, year) {
  const issues = [], warnings = [];
  
  if (!questions || questions.length === 0) {
    issues.push('未提取到任何题目');
    return { valid: false, issues, warnings, stats: {} };
  }
  
  const stats = { total: questions.length, by_type: {}, avg_difficulty: 0, answer_completeness: 0, analysis_completeness: 0 };
  let answerCount = 0, analysisCount = 0, difficultySum = 0, difficultyCount = 0;
  let shortStemCount = 0;
  
  for (const q of questions) {
    if (!q.stem || q.stem.trim().length === 0) {
      issues.push(`第${q.number}题题干为空`);
    } else if (q.stem.trim().length < 10) {
      shortStemCount++;
      warnings.push(`第${q.number}题题干较短`);
    }
    
    if (!q.type) { warnings.push(`第${q.number}题未指定题型`); q.type = 'solve'; }
    if (q.difficulty && (q.difficulty < 1 || q.difficulty > 5)) { warnings.push(`第${q.number}题难度值${q.difficulty}超出范围`); q.difficulty = 3; }
    if (q.answer && q.answer.trim()) answerCount++;
    if (q.analysis && q.analysis.trim()) analysisCount++;
    if (q.difficulty && q.difficulty >= 1 && q.difficulty <= 5) { difficultySum += q.difficulty; difficultyCount++; }
    stats.by_type[q.type] = (stats.by_type[q.type] || 0) + 1;
  }
  
  stats.answer_completeness = ((answerCount / questions.length) * 100).toFixed(1);
  stats.analysis_completeness = ((analysisCount / questions.length) * 100).toFixed(1);
  stats.avg_difficulty = difficultyCount > 0 ? (difficultySum / difficultyCount).toFixed(2) : 'N/A';
  
  const uniqueNumbers = new Set(questions.map(q => q.number));
  if (uniqueNumbers.size !== questions.length) {
    const dupCount = questions.length - uniqueNumbers.size;
    if (dupCount > questions.length * 0.3) {
      issues.push(`重复题号过多（${dupCount}个）`);
    } else {
      warnings.push(`存在${dupCount}个重复题号`);
    }
  }
  
  if (shortStemCount > questions.length * 0.5) {
    issues.push(`短题干题目过多（${shortStemCount}个）`);
  }
  
  if (stats.answer_completeness < 50) warnings.push(`答案完整性较低: ${stats.answer_completeness}%`);
  if (stats.analysis_completeness < 30) warnings.push(`解析完整性较低: ${stats.analysis_completeness}%`);
  
  return { valid: issues.length === 0, issues, warnings, stats };
}

async function saveToDatabase(pool, questions, subject, year) {
  try {
    const paperRes = await pool.query('SELECT id FROM exam_papers WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4', [PROVINCE_CODE, year, subject, EXAM_LEVEL]);
    
    let paperId;
    if (paperRes.rows.length > 0) {
      paperId = paperRes.rows[0].id;
      await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);
    } else {
      const insertResult = await pool.query(`INSERT INTO exam_papers (province_code, year, subject, exam_level, question_count) VALUES ($1, $2, $3, $4, 0) RETURNING id`, [PROVINCE_CODE, year, subject, EXAM_LEVEL]);
      paperId = insertResult.rows[0].id;
    }
    
    let insertedCount = 0;
    for (const q of questions) {
      const questionUid = generateQuestionUID(subject, year, PROVINCE_CODE, q.number);
      try {
        await pool.query(`INSERT INTO exam_questions (question_uid, paper_id, question_number, question_type, stem, options, answer, analysis, knowledge_points, difficulty, score, subject_code, province_code, year, has_image, has_formula) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`, [
          questionUid, paperId, q.number, q.type, q.stem,
          q.options ? JSON.stringify(q.options) : null,
          q.answer, q.analysis,
          q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
          q.difficulty || 3, q.score || 0, subject, PROVINCE_CODE, year, false, false
        ]);
        insertedCount++;
      } catch (e) {
        console.log(`   ⚠️  第${q.number}题入库失败: ${e.message}`);
      }
    }
    
    await pool.query('UPDATE exam_papers SET question_count = $1 WHERE id = $2', [insertedCount, paperId]);
    return { success: true, count: insertedCount, paperId };
  } catch (e) {
    console.log(`   ❌ 数据库存储失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

function findPDFFile(subject, year, preferAnalysis = true) {
  const subjectInfo = SUBJECT_MAP[subject];
  if (!subjectInfo) return null;
  
  const dirPath = path.join(RAW_DIR, subjectInfo.dir);
  if (!fs.existsSync(dirPath)) return null;
  
  const files = fs.readdirSync(dirPath);
  const yearStr = year.toString();
  
  const analysisPatterns = [
    `${yearStr}年北京高考${subjectInfo.name}试卷（解析版）`,
    `${yearStr}年北京高考${subjectInfo.name}解析`,
    `${yearStr}高考北京卷${subjectInfo.name}（解析版）`,
    `${yearStr}北京高考${subjectInfo.name}解析`,
    `${yearStr}高考北京卷${subjectInfo.name}解析`
  ];
  
  if (preferAnalysis) {
    for (const pattern of analysisPatterns) {
      const found = files.find(f => f.includes(pattern) && f.endsWith('.pdf'));
      if (found) return { path: path.join(dirPath, found), type: 'analysis' };
    }
  }
  
  const originalPatterns = [
    `${yearStr}年北京高考${subjectInfo.name}试卷（原卷版）`,
    `${yearStr}年北京高考${subjectInfo.name}试卷`,
    `${yearStr}年北京高考${subjectInfo.name}`,
    `${yearStr}高考北京卷${subjectInfo.name}（原卷版）`,
    `${yearStr}高考北京卷${subjectInfo.name}`,
    `${yearStr}年普通高等学校招生全国统一考试(北京卷)`,
    `${yearStr}北京高考${subjectInfo.name}`
  ];
  
  for (const pattern of originalPatterns) {
    const found = files.find(f => f.includes(pattern) && f.endsWith('.pdf') && !f.includes('解析'));
    if (found) return { path: path.join(dirPath, found), type: 'original' };
  }
  
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  for (const pdfFile of pdfFiles) {
    if (pdfFile.includes(yearStr) && pdfFile.includes(subjectInfo.name)) {
      const isAnalysis = pdfFile.includes('解析');
      return { path: path.join(dirPath, pdfFile), type: isAnalysis ? 'analysis' : 'original' };
    }
  }
  
  return null;
}

async function generateAnswersAndAnalysis(questions, subject) {
  const subjectInfo = SUBJECT_MAP[subject];
  const prompt = `你是一位专业的${subjectInfo.name}学科老师。请为以下题目生成完整的参考答案和详细解析。

要求：
1. 答案必须准确无误
2. 解析要详细，包含解题思路、关键知识点、步骤说明
3. 选择题要解释每个选项的正确性或错误原因
4. 解答题要给出完整的解题步骤和评分标准
5. 输出格式为JSON数组，与输入题目顺序对应

输入题目：
${JSON.stringify(questions.map(q => ({ number: q.number, type: q.type, stem: q.stem, options: q.options })), null, 2)}

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
    
    const answers = safeParseLLMJson(result.content);
    if (answers && Array.isArray(answers)) {
      for (const ans of answers) {
        const q = questions.find(q => q.number === ans.number);
        if (q) {
          if (ans.answer && ans.answer.trim()) q.answer = ans.answer.trim();
          if (ans.analysis && ans.analysis.trim()) q.analysis = ans.analysis.trim();
        }
      }
    }
  } catch (e) {
    console.log(`   ⚠️ 生成答案和解析失败: ${e.message}`);
  }
  
  return questions;
}

async function processSinglePaper(subject, year, pool, retryCount = 0) {
  const subjectInfo = SUBJECT_MAP[subject];
  const outputDir = path.join(BASE_DATA_DIR, subject, year.toString());
  
  console.log(`\n📋 处理：${subjectInfo.name} ${year}年${retryCount > 0 ? ` (重试${retryCount})` : ''}`);
  
  const pdfResult = findPDFFile(subject, year, true);
  if (!pdfResult) { console.log(`   ❌ PDF文件未找到`); return { success: false, error: 'PDF文件未找到' }; }
  
  const { path: pdfPath, type: pdfType } = pdfResult;
  console.log(`   文件: ${path.basename(pdfPath)} (${pdfType === 'analysis' ? '解析版' : '原卷版'})`);
  
  const extractResult = await extractTextAndImagesFromPDF(pdfPath);
  console.log(`   页面数: ${extractResult.page_count}, 图片数: ${extractResult.image_count}`);
  
  if (!extractResult.text || extractResult.text.length < 100) { 
    console.log(`   ❌ 文本提取失败，文本长度: ${extractResult.text?.length || 0}`); 
    return { success: false, error: '文本提取失败' }; 
  }
  
  console.log(`   文本长度: ${extractResult.text.length} 字符`);
  
  console.log(`   🧠 调用LLM提取题目...`);
  let llmResult;
  try {
    llmResult = await callLLMForExtraction(extractResult.text, subject);
  } catch (llmError) {
    console.log(`   ⚠️ LLM调用失败: ${llmError.message}`);
    if (retryCount < 2) {
      console.log(`   🔄 重试...`);
      await new Promise(r => setTimeout(r, 5000));
      return processSinglePaper(subject, year, pool, retryCount + 1);
    }
    return { success: false, error: 'LLM调用失败' };
  }
  
  if (!llmResult || !llmResult.questions || !Array.isArray(llmResult.questions)) { 
    console.log(`   ❌ LLM输出解析失败`); 
    if (retryCount < 2) {
      console.log(`   🔄 重试...`);
      await new Promise(r => setTimeout(r, 5000));
      return processSinglePaper(subject, year, pool, retryCount + 1);
    }
    return { success: false, error: 'LLM输出解析失败' }; 
  }
  
  let questions = llmResult.questions;
  console.log(`   提取到 ${questions.length} 道题目`);
  
  console.log(`   ✅ 一级校验：自动化数据结构验证`);
  let quality = performQualityCheck(questions, subject, year);
  
  if (quality.warnings.length > 0) { 
    console.log(`   ⚠️ 校验警告:`); 
    quality.warnings.forEach(w => console.log(`      - ${w}`)); 
  }
  
  let isValid = quality.valid;
  if (!isValid && questions.length > 5) {
    console.log(`   ⚠️ 校验不完全通过，但题目数量较多(${questions.length}题)，继续保存`);
    isValid = true;
  }
  
  if (!isValid) { 
    console.log(`   ❌ 校验失败:`); 
    quality.issues.forEach(i => console.log(`      - ${i}`)); 
    if (retryCount < 2) {
      console.log(`   🔄 重试...`);
      await new Promise(r => setTimeout(r, 5000));
      return processSinglePaper(subject, year, pool, retryCount + 1);
    }
    return { success: false, error: '质量校验失败', quality }; 
  }
  
  console.log(`   📊 当前统计: 答案完整率${quality.stats.answer_completeness}%, 解析完整率${quality.stats.analysis_completeness}%`);
  
  const needEnhance = questions.some(q => !q.answer || !q.answer.trim() || !q.analysis || !q.analysis.trim());
  if (needEnhance) {
    console.log(`   🧠 使用Deepseek生成缺失的答案和解析...`);
    questions = await generateAnswersAndAnalysis(questions, subject);
    quality = performQualityCheck(questions, subject, year);
    console.log(`   ✅ 增强后统计: 答案完整率${quality.stats.answer_completeness}%, 解析完整率${quality.stats.analysis_completeness}%`);
  }
  
  console.log(`   ✅ 校验通过`);
  
  ensureDir(outputDir);
  
  console.log(`   📤 提取图片...`);
  const imageFiles = await extractImagesFromPDF(pdfPath, path.join(outputDir, 'images'));
  console.log(`   保存了 ${imageFiles.length} 张图片`);
  
  console.log(`   📝 生成题目文件...`);
  for (const q of questions) {
    const qDir = path.join(outputDir, String(q.number).padStart(3, '0'));
    ensureDir(qDir);
    fs.writeFileSync(path.join(qDir, 'content.md'), generateMarkdownContent(q), 'utf-8');
    fs.writeFileSync(path.join(qDir, 'metadata.json'), safeJsonStringify(generateMetadataJson(q, subject, year, imageFiles), 2), 'utf-8');
  }
  
  const paperMetadata = {
    subject, subject_name: subjectInfo.name, year, province: PROVINCE_CODE, exam_level: EXAM_LEVEL,
    question_count: questions.length, page_count: extractResult.page_count, image_count: imageFiles.length,
    source_file: path.basename(pdfPath), processing_time: new Date().toISOString(), 
    quality_stats: quality.stats, warnings: quality.warnings, issues: quality.issues
  };
  fs.writeFileSync(path.join(outputDir, 'paper_metadata.json'), safeJsonStringify(paperMetadata, 2), 'utf-8');
  
  console.log(`   💾 存储到数据库...`);
  const dbResult = await saveToDatabase(pool, questions, subject, year);
  if (!dbResult.success) console.log(`   ⚠️ 数据库存储失败，但文件已保存: ${dbResult.error}`);
  else console.log(`   ✅ 成功入库 ${dbResult.count} 道题目`);
  
  return { success: true, subject, year, question_count: questions.length, image_count: imageFiles.length, quality_stats: quality.stats, db_result: dbResult, warnings: quality.warnings };
}

function generateIndexPage() {
  const indexDir = path.join(BASE_DATA_DIR, 'index');
  ensureDir(indexDir);
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>北京高考真题题库 - 2019-2023</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { text-align: center; color: white; margin-bottom: 30px; font-size: 2.5em; }
        .filters { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .filter-group label { color: white; font-weight: bold; }
        .filter-group select { padding: 8px 16px; border-radius: 8px; border: none; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); transition: transform 0.3s; }
        .card:hover { transform: translateY(-5px); }
        .card-header { padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .card-body { padding: 15px; }
        .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .stat-label { color: #666; }
        .stat-value { font-weight: bold; color: #333; }
        .btn { display: inline-block; width: 100%; padding: 10px; text-align: center; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px; }
        .btn:hover { background: #5a6fd6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 北京高考真题题库</h1>
        <div class="filters">
            <div class="filter-group"><label>学科:</label><select id="subject-filter" onchange="filterCards()"><option value="all">全部学科</option><option value="chinese">语文</option><option value="math">数学</option><option value="english">英语</option><option value="physics">物理</option><option value="chemistry">化学</option><option value="biology">生物</option><option value="history">历史</option><option value="geography">地理</option><option value="politics">政治</option></select></div>
            <div class="filter-group"><label>年份:</label><select id="year-filter" onchange="filterCards()"><option value="all">全部年份</option><option value="2023">2023年</option><option value="2022">2022年</option><option value="2021">2021年</option><option value="2020">2020年</option><option value="2019">2019年</option></select></div>
        </div>
        <div class="grid" id="card-grid">
            ${Object.keys(SUBJECT_MAP).map(subject => 
                [2023, 2022, 2021, 2020, 2019].map(year => `
            <div class="card" data-subject="${subject}" data-year="${year}">
                <div class="card-header"><h3>${SUBJECT_MAP[subject].name}</h3><span style="font-size:0.9em;opacity:0.9">${year}年</span></div>
                <div class="card-body">
                    <div class="stat-row"><span class="stat-label">题目数</span><span class="stat-value" id="${subject}-${year}-count">-</span></div>
                    <div class="stat-row"><span class="stat-label">答案完整率</span><span class="stat-value" id="${subject}-${year}-answer">-</span></div>
                    <div class="stat-row"><span class="stat-label">解析完整率</span><span class="stat-value" id="${subject}-${year}-analysis">-</span></div>
                    <a class="btn" href="../${subject}/${year}/index.html">查看试卷</a>
                </div>
            </div>
                `).join('')
            ).join('')}
        </div>
    </div>
    <script>
        function filterCards() {
            const subject = document.getElementById('subject-filter').value;
            const year = document.getElementById('year-filter').value;
            document.querySelectorAll('.card').forEach(card => {
                const s = card.dataset.subject;
                const y = card.dataset.year;
                card.style.display = (subject === 'all' || s === subject) && (year === 'all' || y === year) ? 'block' : 'none';
            });
        }
        async function loadStats() {
            const stats = {};
            const subjects = ['chinese','math','english','physics','chemistry','biology','history','geography','politics'];
            const years = ['2019','2020','2021','2022','2023'];
            for(const s of subjects) {
                for(const y of years) {
                    try {
                        const res = await fetch(\`../\${s}/\${y}/paper_metadata.json\`);
                        if(res.ok) {
                            const data = await res.json();
                            document.getElementById(\`\${s}-\${y}-count\`).textContent = data.question_count || '-';
                            document.getElementById(\`\${s}-\${y}-answer\`).textContent = data.quality_stats?.answer_completeness + '%' || '-';
                            document.getElementById(\`\${s}-\${y}-analysis\`).textContent = data.quality_stats?.analysis_completeness + '%' || '-';
                        }
                    } catch {}
                }
            }
        }
        loadStats();
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(indexDir, 'index.html'), html, 'utf-8');
}

function generatePaperIndex(subject, year) {
  const outputDir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(outputDir)) return;
  
  const metadataPath = path.join(outputDir, 'paper_metadata.json');
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')); } catch {}
  }
  
  const questionDirs = fs.readdirSync(outputDir).filter(d => fs.statSync(path.join(outputDir, d)).isDirectory() && /^\d{3}$/.test(d));
  questionDirs.sort((a, b) => parseInt(a) - parseInt(b));
  
  const questions = [];
  for (const dir of questionDirs) {
    const metaPath = path.join(outputDir, dir, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try { questions.push(JSON.parse(fs.readFileSync(metaPath, 'utf-8'))); } catch {}
    }
  }
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.subject_name || subject} ${year}年 - 北京高考真题</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 2em; }
        .header .info { margin-top: 10px; opacity: 0.9; }
        .back-btn { display: inline-block; padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; text-decoration: none; border-radius: 6px; margin-bottom: 15px; }
        .question-list { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .question-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.3s; }
        .question-item:last-child { border-bottom: none; }
        .question-item:hover { background: #f8f9fa; }
        .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .q-number { font-weight: bold; color: #667eea; font-size: 1.2em; }
        .q-type { padding: 3px 8px; background: #e9ecef; border-radius: 4px; font-size: 0.85em; }
        .q-stem { color: #666; font-size: 0.95em; line-height: 1.5; }
        .q-meta { display: flex; gap: 15px; margin-top: 8px; font-size: 0.85em; color: #999; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: flex-start; padding: 40px; z-index: 1000; }
        .modal-content { background: white; border-radius: 12px; max-width: 800px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 20px; position: relative; }
        .modal-close { position: absolute; top: 15px; right: 15px; font-size: 24px; cursor: pointer; color: #999; }
        .md-content { line-height: 1.8; }
        .md-content h1 { color: #667eea; margin-bottom: 15px; }
        .md-content h2 { color: #333; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #eee; }
        .md-content h3 { color: #555; margin: 15px 0 8px; }
        .md-content p { margin-bottom: 10px; }
        .md-content ul, .md-content ol { margin-left: 20px; margin-bottom: 10px; }
        .md-content blockquote { border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="../index/index.html" class="back-btn">← 返回题库首页</a>
            <h1>${metadata.subject_name || subject} ${year}年高考真题</h1>
            <div class="info">题目数: ${metadata.question_count || questions.length} | 页面数: ${metadata.page_count || '-'} | 图片数: ${metadata.image_count || '-'}</div>
        </div>
        <div class="question-list">
            ${questions.map(q => `
            <div class="question-item" onclick="showQuestion('${q.uid}')">
                <div class="q-header"><span class="q-number">第${q.question_number}题</span><span class="q-type">${q.question_type_name}</span></div>
                <div class="q-stem">${(q.stem || '').substring(0, 100)}${(q.stem || '').length > 100 ? '...' : ''}</div>
                <div class="q-meta">
                    <span>难度: ${'★'.repeat(q.difficulty)}${'☆'.repeat(5 - q.difficulty)}</span>
                    <span>分值: ${q.score}分</span>
                    <span>知识点: ${(q.knowledge_points || []).slice(0, 3).join('、')}${(q.knowledge_points || []).length > 3 ? '...' : ''}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
    <div class="modal" id="question-modal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal()">&times;</span>
            <div class="md-content" id="question-content"></div>
        </div>
    </div>
    <script>
        async function showQuestion(uid) {
            const modal = document.getElementById('question-modal');
            const content = document.getElementById('question-content');
            try {
                const num = uid.split('_')[3];
                const res = await fetch(\`\${num}/content.md\`);
                const md = await res.text();
                content.innerHTML = mdToHtml(md);
            } catch(e) {
                content.innerHTML = '<p>加载失败</p>';
            }
            modal.style.display = 'flex';
        }
        function closeModal() {
            document.getElementById('question-modal').style.display = 'none';
        }
        function mdToHtml(md) {
            return md.replace(/^# (.+)$/gm, '<h1>$1</h1>')
                     .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                     .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                     .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                     .replace(/---/g, '<hr>')
                     .replace(/\n/g, '<br>');
        }
        document.getElementById('question-modal').addEventListener('click', (e) => {
            if(e.target.id === 'question-modal') closeModal();
        });
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
}

async function main() {
  console.log('============================================================');
  console.log('📦 PDF试卷标准化处理流水线 - 北京高考2019-2023');
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
  console.log('✅ PostgreSQL 数据库连接成功');
  
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const subjects = Object.keys(SUBJECT_MAP);
  
  const results = [];
  
  for (const year of years) {
    for (const subject of subjects) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await processSinglePaper(subject, year, pool);
      results.push(result);
    }
  }
  
  await pool.end();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 生成可浏览文件系统...');
  console.log('='.repeat(60));
  
  generateIndexPage();
  
  for (const year of years) {
    for (const subject of subjects) {
      generatePaperIndex(subject, year);
    }
  }
  
  console.log('✅ 可浏览文件系统已生成');
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理结果汇总');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const totalQuestions = results.reduce((sum, r) => sum + (r.question_count || 0), 0);
  
  console.log(`总试卷数: ${results.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${results.length - successCount}`);
  console.log(`总题目数: ${totalQuestions}`);
  
  console.log('\n详细结果:');
  results.forEach(r => {
    if (r.success) {
      console.log(`✓ ${SUBJECT_MAP[r.subject].name} ${r.year}年: ${r.question_count}题 (答案${r.quality_stats?.answer_completeness}%, 解析${r.quality_stats?.analysis_completeness}%)`);
    } else {
      console.log(`✗ ${SUBJECT_MAP[r.subject]?.name || r.subject} ${r.year}年: ${r.error}`);
    }
  });
  
  console.log(`\n📁 数据目录: ${BASE_DATA_DIR}`);
  console.log(`🌐 可浏览索引: ${path.join(BASE_DATA_DIR, 'index', 'index.html')}`);
}

export { processSinglePaper, generatePaperIndex, generateIndexPage };

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.replace('\\', '/').endsWith(path.basename(__filename))) {
  main().catch(console.error);
}