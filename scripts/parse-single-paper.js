#!/usr/bin/env node

import { getDb } from '../api/core/db.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const SUBJECT_PROMPT_MAP = {
  physics: '这是一份物理高考试卷。物理题通常包含公式（如 F=ma）、单位、图表描述和计算过程。选择题注意是单选还是多选，解答题要提取完整的解题步骤和公式应用。',
  chemistry: '这是一份化学高考试卷。化学题涉及化学方程式、元素符号、物质结构和实验操作。注意区分选择题和填空题的格式。方程式中的箭头和条件请尽量保留。',
  biology: '这是一份生物高考试卷。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。注意图表和实验设计题的提取。',
  history: '这是一份历史高考试卷。历史题涉及时间、事件、人物和历史概念。注意材料分析题和论述题的提取。',
  politics: '这是一份政治高考试卷。政治题涉及政治概念、经济原理、哲学观点和时事政策。注意材料分析题的提取。',
  geography: '这是一份地理高考试卷。地理题涉及地图分析、气候、地形和人文地理。注意图表题和综合分析题的提取。',
  math: '这是一份数学高考试卷。数学题包含公式、计算过程和证明。注意区分选择题、填空题和解答题。公式用LaTeX格式表示，如 $x^2$ 或 $$\\sum_{i=1}^{n} i$$。',
  chinese: '这是一份语文高考试卷。语文题包括现代文阅读、古诗文、语言运用和作文题。注意：1) 阅读理解题有多个子题（如1-4题共用一篇阅读材料）；2) 作文题可能没有标准答案；3) 严格按照文档中标注的题号进行提取。',
  english: '这是一份英语高考试卷。英语题包括听力（如有）、阅读理解、完形填空、语法填空和写作。注意分值可能为小数。',
};

const EXTRACTION_PROMPT = `{subject_hint}

请从以下高考试卷内容中提取所有题目，严格按照文档中标注的题号进行提取，不要合并或拆分题目。按以下 JSON 格式返回（不要添加任何其他内容）：

{
  "questions": [
    {
      "number": 1,
      "type": "choice",
      "stem": "题干内容（包含阅读材料、题目文本及所有相关小题）",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "A",
      "analysis": "本题考查...解题思路是...",
      "knowledge_points": ["知识点1"],
      "difficulty": 3,
      "score": 5,
      "has_image": false,
      "image_description": "",
      "latex_formulas": [],
      "sub_questions": [
        {
          "sub_number": "1",
          "stem": "子题1内容",
          "answer": "答案",
          "analysis": "解析"
        }
      ]
    }
  ]
}

注意：
1. type 只能是：choice（单选）, multi_choice（多选）, fill（填空）, solve（解答/计算/证明/作文/综合）
2. difficulty 难度等级 1-5
3. knowledge_points 必须从下方【标准知识点列表】中选择，最多3个最相关的
4. 必须提取答案（answer）和解析（analysis）
5. has_image: 是否包含图片
6. image_description: 如果有图片，用文字描述图片内容
7. latex_formulas: 所有公式用LaTeX格式表示，如 $x^2$ 或 $$公式$$
8. sub_questions: 如果一道题包含多个小题（如阅读题1-4），请将阅读材料放在stem中，每个小题放在sub_questions数组中
9. 严格按照文档中标注的题号进行提取，不要遗漏任何题号

【标准知识点列表】：
{kp_list}`;

function extractTextFromDOCX(filePath) {
  const tmpScript = join(tmpdir(), `docx_extract_${Date.now()}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import docx
    path = r"""${filePath}"""
    doc = docx.Document(path)
    content_parts = []
    img_counter = 0
    for para in doc.paragraphs:
        has_image = False
        for run in para.runs:
            drawings = run._element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
            if drawings or run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                has_image = True
                break
        text = para.text.strip()
        if has_image:
            img_counter += 1
            content_parts.append((text + f" [图片{img_counter}]") if text else f"[图片{img_counter}]")
        elif text:
            content_parts.append(text)
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells: content_parts.append(" | ".join(cells))
    sys.stdout.buffer.write("\\n".join(content_parts).encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${process.platform === 'win32' ? 'python' : 'python3'} "${tmpScript}"`, {
      encoding: 'buffer', timeout: 60000, maxBuffer: 50 * 1024 * 1024
    });
    try { require('fs').unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { require('fs').unlinkSync(tmpScript); } catch {}
    return '';
  }
}

function extractText(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.docx') return extractTextFromDOCX(filePath);
  return '';
}

function analyzeQuestionNumbers(content) {
  const lines = content.split('\n');
  const questionNumbers = [];
  let currentQuestion = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qMatch = line.trim().match(/^[\(（]?(\d{1,2})[\.、）\)]/);
    const qMatch2 = line.trim().match(/^第(\d{1,2})题/);
    
    if (qMatch || qMatch2) {
      if (currentQuestion.length > 0) {
        questionNumbers.push(currentQuestion);
      }
      currentQuestion = [line];
    } else {
      currentQuestion.push(line);
    }
  }
  
  if (currentQuestion.length > 0) {
    questionNumbers.push(currentQuestion);
  }
  
  return questionNumbers;
}

function groupByReadingMaterial(questionGroups) {
  const groups = [];
  let currentGroup = { startNum: 1, endNum: 0, content: [] };
  
  for (const group of questionGroups) {
    const firstLine = group[0].trim();
    const qMatch = firstLine.match(/^[\(（]?(\d{1,2})[\.、）\)]/) || firstLine.match(/^第(\d{1,2})题/);
    const qNum = qMatch ? parseInt(qMatch[1]) : null;
    
    const isReadingMaterial = firstLine.includes('阅读下面') || 
                             firstLine.includes('阅读下面的') ||
                             firstLine.includes('阅读下面材料') ||
                             firstLine.includes('阅读下面文言文') ||
                             firstLine.includes('阅读下面诗歌') ||
                             firstLine.includes('阅读下面文章');
    
    if (isReadingMaterial && currentGroup.content.length > 0) {
      groups.push(currentGroup);
      currentGroup = { startNum: qNum || 1, endNum: 0, content: [] };
    }
    
    currentGroup.content.push(...group);
    if (qNum) currentGroup.endNum = qNum;
  }
  
  if (currentGroup.content.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

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
      console.log(`    🔄 LLM错误重试 ${retryCount + 1}...`);
      await new Promise(r => setTimeout(r, 2000));
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
    type: ['choice', 'multi_choice', 'fill', 'solve'].includes(q.type) ? q.type : 'choice',
    stem: (q.stem || '').toString().substring(0, 4000),
    options: Array.isArray(q.options) ? q.options.map(o => String(o || '').substring(0, 500)) : null,
    answer: (q.answer || '').toString().substring(0, 500) || null,
    analysis: (q.analysis || '').toString().substring(0, 4000) || null,
    knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.map(k => String(k || '').substring(0, 100)) : null,
    difficulty: typeof q.difficulty === 'number' ? Math.max(1, Math.min(5, Math.round(q.difficulty))) : null,
    score: typeof q.score === 'number' ? q.score : null,
    has_image: q.has_image || false,
    image_description: (q.image_description || '').toString().substring(0, 1000),
    latex_formulas: Array.isArray(q.latex_formulas) ? q.latex_formulas : [],
    sub_questions: Array.isArray(q.sub_questions) ? q.sub_questions.map(sq => ({
      sub_number: String(sq.sub_number || ''),
      stem: String(sq.stem || ''),
      answer: String(sq.answer || ''),
      analysis: String(sq.analysis || '')
    })) : null
  };
}

async function getKPList(pool, subject) {
  try {
    const r = await pool.query('SELECT name FROM knowledge_points WHERE subject = $1 ORDER BY frequency DESC, difficulty DESC', [subject]);
    return r.rows.map(x => x.name).join('\n') || '无';
  } catch {
    return '无';
  }
}

function generateQuestionUID(subject, year, provinceCode, questionNumber) {
  return `${subject}_${year}_${provinceCode}_${questionNumber}`;
}

async function main() {
  const args = process.argv.slice(2);
  const subject = args[0] || 'chinese';
  const year = parseInt(args[1]) || 2025;
  const provinceCode = args[2] || 'beijing';
  
  console.log(`📋 单试卷解析：${SUBJECT_CN[subject]} ${year}年 ${provinceCode}`);
  console.log('='.repeat(60));
  
  const pool = await getDb();
  
  const paperRes = await pool.query(`
    SELECT id, paper_file_path 
    FROM exam_papers
    WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = 'gaokao'
  `, [provinceCode, year, subject]);
  
  if (paperRes.rows.length === 0) {
    console.log(`❌ 未找到 ${year}年${SUBJECT_CN[subject]}试卷记录`);
    await pool.end();
    return;
  }
  
  const paper = paperRes.rows[0];
  let filePath = paper.paper_file_path;
  
  const databaseDir = join(ROOT, 'database', '高考真题');
  const candidates = [
    filePath,
    join(databaseDir, '北京高考', filePath),
    join(databaseDir, provinceCode + '高考', filePath),
    join(databaseDir, filePath),
    join(databaseDir, '北京高考', filePath.split('/')[0], filePath.split('/')[1]),
  ];
  
  let resolvedPath = null;
  for (const c of candidates) {
    if (existsSync(c)) {
      resolvedPath = c;
      break;
    }
  }
  
  if (!resolvedPath) {
    console.log(`❌ 找不到试卷文件`);
    console.log(`   尝试路径: ${candidates.join(', ')}`);
    await pool.end();
    return;
  }
  
  console.log(`📄 文件路径: ${resolvedPath}`);
  
  console.log('\n1. 提取文本内容...');
  const content = extractText(resolvedPath);
  console.log(`   文本长度: ${content.length} 字符`);
  
  console.log('\n2. 分析题号分布...');
  const questionGroups = analyzeQuestionNumbers(content);
  console.log(`   检测到 ${questionGroups.length} 个题号分组`);
  
  const outputDir = join(ROOT, 'database', 'parsed-examples', 'single-paper');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const rawContentFile = join(outputDir, `${subject}_${year}_raw.txt`);
  writeFileSync(rawContentFile, content, 'utf-8');
  console.log(`   原始文本已保存: ${rawContentFile}`);
  
  const questionAnalysisFile = join(outputDir, `${subject}_${year}_question-analysis.txt`);
  let analysisContent = `${SUBJECT_CN[subject]} ${year}年高考试卷题号分析\n`;
  analysisContent += '='.repeat(60) + '\n\n';
  analysisContent += `检测到 ${questionGroups.length} 个题号分组:\n\n`;
  
  questionGroups.forEach((group, idx) => {
    const firstLine = group[0].trim();
    const qMatch = firstLine.match(/^[\(（]?(\d{1,2})[\.、）\)]/) || firstLine.match(/^第(\d{1,2})题/);
    const qNum = qMatch ? qMatch[1] : '未知';
    analysisContent += `[题号 ${qNum}] 行数: ${group.length}, 首行: "${firstLine.substring(0, 50)}..."\n`;
    analysisContent += `内容预览:\n${group.slice(0, 5).join('\n')}\n\n`;
  });
  
  writeFileSync(questionAnalysisFile, analysisContent, 'utf-8');
  console.log(`   题号分析已保存: ${questionAnalysisFile}`);
  
  console.log('\n3. 按阅读材料分组处理题目...');
  const kpList = await getKPList(pool, subject);
  
  const readingGroups = groupByReadingMaterial(questionGroups);
  console.log(`   划分为 ${readingGroups.length} 个阅读材料组`);
  
  let allQuestions = [];
  const llmOutputFile = join(outputDir, `${subject}_${year}_llm-output.txt`);
  let llmOutput = '';
  
  for (let gi = 0; gi < readingGroups.length; gi++) {
    const group = readingGroups[gi];
    const groupContent = group.content.join('\n');
    console.log(`   处理组 ${gi + 1}/${readingGroups.length} (题号 ${group.startNum}-${group.endNum}, ${group.content.length}行)`);
    
    const llmResult = await callLLM(groupContent, subject, kpList);
    llmOutput += `\n\n===== 组 ${gi + 1} =====\n${llmResult}`;
    
    const data = extractJSON(llmResult);
    if (data && data.questions && Array.isArray(data.questions)) {
      const offset = allQuestions.length;
      for (const q of data.questions) {
        const sanitized = sanitizeQuestion(q);
        sanitized.number = parseInt(q.number) || (offset + data.questions.indexOf(q) + 1);
        allQuestions.push(sanitized);
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  writeFileSync(llmOutputFile, llmOutput, 'utf-8');
  console.log(`   LLM输出已保存: ${llmOutputFile}`);
  
  console.log('\n4. 合并解析结果...');
  console.log(`   提取到 ${allQuestions.length} 道题目`);
  
  const sanitizedQuestions = allQuestions;
  
  const parsedFile = join(outputDir, `${subject}_${year}_parsed.json`);
  writeFileSync(parsedFile, JSON.stringify(sanitizedQuestions, null, 2), 'utf-8');
  console.log(`   解析结果已保存: ${parsedFile}`);
  
  console.log('\n5. 质量检查...');
  
  const qNumbers = sanitizedQuestions.map(q => q.number).sort((a, b) => a - b);
  const minNum = qNumbers[0];
  const maxNum = qNumbers[qNumbers.length - 1];
  
  console.log(`   题号范围: ${minNum} - ${maxNum}`);
  console.log(`   提取题目数: ${sanitizedQuestions.length}`);
  
  const missingNumbers = [];
  for (let i = minNum; i <= maxNum; i++) {
    if (!qNumbers.includes(i)) {
      missingNumbers.push(i);
    }
  }
  
  if (missingNumbers.length > 0) {
    console.log(`   ⚠️  缺失题号: ${missingNumbers.join(', ')}`);
  } else {
    console.log('   ✅ 题号完整 (无缺失)');
  }
  
  const emptyStem = sanitizedQuestions.filter(q => !q.stem || q.stem.trim().length < 10);
  if (emptyStem.length > 0) {
    console.log(`   ⚠️  题干内容过短: 题号 ${emptyStem.map(q => q.number).join(', ')}`);
  } else {
    console.log('   ✅ 题干内容完整');
  }
  
  console.log('\n6. 入库操作...');
  
  await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paper.id]);
  
  let insertedCount = 0;
  for (const q of sanitizedQuestions) {
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
        q.has_image || false,
        (q.latex_formulas && q.latex_formulas.length > 0) || false,
        q.image_description || null,
        q.latex_formulas ? JSON.stringify(q.latex_formulas) : null
      ]);
      insertedCount++;
    } catch (e) {
      console.log(`   ❌ 第${q.number}题入库失败: ${e.message}`);
    }
  }
  
  await pool.query(`
    UPDATE exam_papers SET
      question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1),
      updated_at = NOW()
    WHERE id = $1
  `, [paper.id]);
  
  console.log(`   ✅ 成功入库 ${insertedCount} 道题目`);
  
  console.log('\n7. 验证入库结果...');
  const verifyRes = await pool.query(`
    SELECT question_number, question_type, LENGTH(stem) as stem_len 
    FROM exam_questions WHERE paper_id = $1 ORDER BY question_number
  `, [paper.id]);
  
  console.log(`   ${'题号'.padEnd(6)} ${'题型'.padEnd(10)} ${'题干长度'.padEnd(10)}`);
  console.log(`   ${'-'.repeat(6)} ${'-'.repeat(10)} ${'-'.repeat(10)}`);
  verifyRes.rows.forEach(r => {
    console.log(`   ${r.question_number.toString().padEnd(6)} ${r.question_type.padEnd(10)} ${r.stem_len.toString().padEnd(10)}`);
  });
  
  await pool.end();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 处理完成！');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ 处理失败:', err.message);
  process.exit(1);
});