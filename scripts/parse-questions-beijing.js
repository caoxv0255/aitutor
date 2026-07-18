#!/usr/bin/env node
/**
 * 北京地区专项多模态解析脚本
 *
 * 与 parse-questions-v4.js 的差异：
 *   1. 仅解析 province_code = 'beijing' 的试卷
 *   2. 自动处理文理数学分卷（math_type: arts/science/unified）
 *   3. 输出北京专项统计报告
 *   4. 北京地区文件输出至 database/questions/beijing/
 *
 * 使用方法：
 *   node scripts/parse-questions-beijing.js              # 解析所有未解析的北京试卷
 *   node scripts/parse-questions-beijing.js --subject math --year 2025  # 解析指定学科/年份
 *   node scripts/parse-questions-beijing.js --force      # 强制重新解析（包括已解析的）
 */

import { getDb } from '../api/core/db.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { getEmbedding } from '../services/embedding.js';
import {
  parsePhysicsStructure,
  parseChemistryStructure,
  parseMathStructure,
  generateSemanticDescription,
  generateSolutionDescription,
  generateFormulaSemantics,
  buildQText,
  buildSText,
  buildKText,
  buildAText
} from '../services/subject-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const QUESTIONS_DIR = join(ROOT, 'database', 'questions', 'beijing');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const CONCURRENCY = parseInt(process.env.PARSE_CONCURRENCY) || 2;
const DELAY_MS = parseInt(process.env.PARSE_DELAY) || 1000;

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const SUBJECT_DIFFICULTY_CALIBRATION = {
  math: { rules: [{ type: 'choice', position: 'early', adjust: -1 }, { type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 5, fill: 5, solve: 5 } },
  physics: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 5, fill: 4, solve: 5 } },
  chemistry: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 5, solve: 5 } },
  biology: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 5, solve: 5 } },
  history: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 2, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 4, solve: 5 } },
  politics: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 4, solve: 5 } },
  geography: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 2, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 4, solve: 5 } },
  chinese: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 2, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 4, solve: 5 } },
  english: { rules: [{ type: 'solve', position: 'last', adjust: +1 }], minDifficulty: { choice: 1, fill: 2, solve: 3 }, maxDifficulty: { choice: 4, fill: 4, solve: 5 } },
};

const SUBJECT_PROMPT_MAP = {
  physics: '这是一份北京高考物理试卷。物理题包含公式（F=ma）、单位、图表描述和计算过程。',
  chemistry: '这是一份北京高考化学试卷。化学题涉及化学方程式、元素符号、物质结构和实验操作。',
  biology: '这是一份北京高考生物试卷。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。',
  history: '这是一份北京高考历史试卷。历史题涉及时间、事件、人物和历史概念。',
  politics: '这是一份北京高考政治试卷。',
  geography: '这是一份北京高考地理试卷。',
  math: '这是一份北京高考数学试卷。北京数学题注重基础与综合应用，含函数、几何、概率、解析几何等。公式用LaTeX格式表示。',
  chinese: '这是一份北京高考语文试卷。',
  english: '这是一份北京高考英语试卷。',
};

const EXTRACTION_PROMPT = `【北京高考·{subject_hint}】

请从以下北京高考试卷内容中提取所有题目，按以下 JSON 格式返回（不要添加任何其他内容）：

{
  "questions": [
    {
      "number": 1,
      "type": "choice",
      "stem": "题干内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "A",
      "analysis": "本题考查...解题思路是...",
      "knowledge_points": ["知识点1", "知识点2"],
      "difficulty": 3,
      "score": 5,
      "has_image": false,
      "image_description": "",
      "latex_formulas": []
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

【北京特色考点提示】：
- 北京数学：突出基础与方法，强调通性通法
- 北京物理：注重情境化、生活化
- 北京化学：兼顾基础与综合应用

【标准知识点列表】：
{kp_list}`;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    subject: null,
    year: null,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subject' && args[i + 1]) {
      options.subject = args[++i];
    } else if (args[i] === '--year' && args[i + 1]) {
      options.year = parseInt(args[++i]);
    } else if (args[i] === '--force') {
      options.force = true;
    }
  }
  return options;
}

function extractTextFromPDF(filePath) {
  const tmpScript = join(tmpdir(), `pdf_extract_beijing_${Date.now()}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import fitz
    path = r"""${filePath}"""
    doc = fitz.open(path)
    content_parts = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text:
            content_parts.append(text)
        images = page.get_images(full=True)
        if images:
            for idx, img in enumerate(images):
                content_parts.append(f"\\n[图片{page_num+1}_{idx+1}]\\n")
    doc.close()
    sys.stdout.buffer.write("\\n".join(content_parts).encode('utf-8'))
except ImportError:
    try:
        import PyPDF2
        with open(r"""${filePath}""", 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            content = ''
            for page in reader.pages:
                text = page.extract_text()
                if text: content += text + '\\n'
            sys.stdout.buffer.write(content.encode('utf-8'))
    except:
        pass
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
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

function extractTextFromDOCX(filePath) {
  const tmpScript = join(tmpdir(), `docx_extract_beijing_${Date.now()}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import docx
    path = r"""${filePath}"""
    doc = docx.Document(path)
    content_parts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            content_parts.append(text)
    for table in doc.tables:
        for row in table.tables:
            for cell in row.cells:
                text = cell.text.strip()
                if text: content_parts.append(text)
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

function extractTextFromDOC(filePath) {
  const tmpScript = join(tmpdir(), `doc_extract_beijing_${Date.now()}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import win32com.client
    import pythoncom
    pythoncom.CoInitialize()
    word = win32com.client.Dispatch('Word.Application')
    word.Visible = False
    doc = word.Documents.Open(r"""${filePath}""", ReadOnly=True)
    text = doc.Content.Text
    doc.Close(False)
    word.Application.Quit(-1)
    text = text.replace('\\r', '\\n')
    sys.stdout.buffer.write(text.encode('utf-8'))
except Exception as e:
    try: word.Application.Quit(-1)
    except: pass
    sys.stderr.write(str(e))
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${process.platform === 'win32' ? 'python' : 'python3'} "${tmpScript}"`, {
      encoding: 'buffer', timeout: 120000, maxBuffer: 50 * 1024 * 1024
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
  if (ext === '.pdf') return extractTextFromPDF(filePath);
  if (ext === '.docx') return extractTextFromDOCX(filePath);
  if (ext === '.doc') return extractTextFromDOC(filePath);
  return '';
}

function shardContent(content, maxSize = 8000) {
  if (content.length <= maxSize) return [content];
  const shards = [];
  const lines = content.split('\n');
  let current = '';
  for (const line of lines) {
    const isQStart = /^[\(（]?\d{1,2}[\.、）\)]/.test(line.trim()) || /^第\d{1,2}题/.test(line.trim());
    if (isQStart && current.length > maxSize * 0.5) {
      shards.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim()) {
    while (current.length > maxSize) {
      shards.push(current.substring(0, maxSize));
      current = current.substring(maxSize);
    }
    if (current.trim()) shards.push(current.trim());
  }
  return shards;
}

async function callLLM(content, subject, year, kpList, shardIndex = 0, totalShards = 1, retryCount = 0) {
  const subjectHint = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  let prompt = EXTRACTION_PROMPT
    .replace('{subject_hint}', subjectHint)
    .replace('{kp_list}', kpList || '无');
  if (totalShards > 1) {
    prompt += `\n\n注意：这是试卷的第 ${shardIndex + 1}/${totalShards} 部分，请只提取本部分的题目。`;
  }
  const temperature = retryCount === 0 ? 0.1 : 0.3;
  const maxTokens = retryCount === 0 ? 6000 : 8000;
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的北京高考试卷题目提取助手。请严格按照JSON格式输出，不要添加任何解释。' },
        { role: 'user', content: prompt + '\n\n以下是试卷内容：\n' + content }
      ],
      temperature, max_tokens: maxTokens
    })
  });
  const result = await response.json();
  if (result.error) {
    if (retryCount < 2) {
      console.log(`    🔄 LLM错误重试 ${retryCount + 1}...`);
      await new Promise(r => setTimeout(r, 2000));
      return callLLM(content, subject, year, kpList, shardIndex, totalShards, retryCount + 1);
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
  return null;
}

function sanitizeQuestion(q) {
  return {
    number: q.number || 0,
    type: ['choice', 'multi_choice', 'fill', 'solve'].includes(q.type) ? q.type : 'choice',
    stem: (q.stem || '').toString().substring(0, 2000),
    options: Array.isArray(q.options) ? q.options.map(o => String(o || '').substring(0, 500)) : null,
    answer: (q.answer || '').toString().substring(0, 500) || null,
    analysis: (q.analysis || '').toString().substring(0, 2000) || null,
    knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.map(k => String(k || '').substring(0, 100)) : null,
    difficulty: typeof q.difficulty === 'number' ? Math.max(1, Math.min(5, Math.round(q.difficulty))) : null,
    score: typeof q.score === 'number' ? q.score : null,
    has_image: q.has_image || false,
    image_description: (q.image_description || '').toString().substring(0, 1000),
    latex_formulas: Array.isArray(q.latex_formulas) ? q.latex_formulas : []
  };
}

function calibrateDifficulty(questions, subject) {
  const cal = SUBJECT_DIFFICULTY_CALIBRATION[subject];
  if (!cal) return questions;
  const typeGroups = {};
  for (const q of questions) {
    if (!typeGroups[q.type]) typeGroups[q.type] = [];
    typeGroups[q.type].push(q);
  }
  for (const [type, group] of Object.entries(typeGroups)) {
    const totalOfType = group.length;
    const minDiff = cal.minDifficulty?.[type] || 1;
    const maxDiff = cal.maxDifficulty?.[type] || 5;
    for (let i = 0; i < group.length; i++) {
      const q = group[i];
      if (q.difficulty === null) {
        const posRatio = totalOfType > 1 ? i / (totalOfType - 1) : 0.5;
        q.difficulty = Math.round(minDiff + posRatio * (maxDiff - minDiff));
      }
      for (const rule of cal.rules) {
        if (rule.type !== type) continue;
        const pos = rule.position;
        let matches = false;
        if (!pos) matches = true;
        else if (pos === 'early' && i < Math.ceil(totalOfType * 0.3)) matches = true;
        else if (pos === 'late' && i >= Math.floor(totalOfType * 0.7)) matches = true;
        else if (pos === 'last' && i === totalOfType - 1) matches = true;
        if (matches && rule.adjust) {
          q.difficulty = Math.max(minDiff, Math.min(maxDiff, q.difficulty + rule.adjust));
        }
      }
      q.difficulty = Math.max(minDiff, Math.min(maxDiff, q.difficulty));
    }
  }
  return questions;
}

function generateQuestionUID(subject, year, mathType, questionNumber) {
  const mathTypePart = mathType ? `_${mathType}` : '';
  return `beijing_${subject}${mathTypePart}_${year}_${questionNumber}`;
}

function resolveFilePath(paperFilePath) {
  if (!paperFilePath) return null;
  if (existsSync(paperFilePath)) return paperFilePath;

  const databaseDir = join(ROOT, 'database', '高考真题');
  const candidates = [
    join(databaseDir, '北京高考', paperFilePath),
    join(databaseDir, paperFilePath),
    join(ROOT, paperFilePath),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function processQuestionWithAI(question, subject) {
  const questionText = question.stem + (question.options ? '\n' + question.options.join('\n') : '');

  let semanticDescription = '';
  let solutionDescription = '';
  let formulaSemantics = '';
  let physicsStructure = {};
  let chemistryStructure = {};
  let mathStructure = {};

  try {
    semanticDescription = await generateSemanticDescription(questionText, subject);
  } catch (e) {
    console.log(`    ⚠️  语义描述生成失败: ${e.message}`);
  }

  try {
    solutionDescription = await generateSolutionDescription(questionText, question.answer, question.analysis, subject);
  } catch (e) {
    console.log(`    ⚠️  解法描述生成失败: ${e.message}`);
  }

  if (question.latex_formulas && question.latex_formulas.length > 0) {
    try {
      const formulaTexts = question.latex_formulas.join('\n');
      formulaSemantics = await generateFormulaSemantics(formulaTexts);
    } catch (e) {
      console.log(`    ⚠️  公式语义生成失败: ${e.message}`);
    }
  }

  switch (subject) {
    case 'physics':
      try { physicsStructure = await parsePhysicsStructure(questionText); } catch (e) { console.log(`    ⚠️  物理结构解析失败: ${e.message}`); }
      break;
    case 'chemistry':
      try { chemistryStructure = await parseChemistryStructure(questionText); } catch (e) { console.log(`    ⚠️  化学结构解析失败: ${e.message}`); }
      break;
    case 'math':
      try { mathStructure = await parseMathStructure(questionText); } catch (e) { console.log(`    ⚠️  数学结构解析失败: ${e.message}`); }
      break;
  }

  return {
    semanticDescription,
    solutionDescription,
    formulaSemantics,
    physicsStructure,
    chemistryStructure,
    mathStructure
  };
}

async function generateVectors(question) {
  const qText = buildQText(question);
  const sText = buildSText(question);
  const kText = buildKText(question);
  const aText = buildAText(question);

  let qEmbedding = null, sEmbedding = null, kEmbedding = null, aEmbedding = null;

  try { if (qText.length >= 10) qEmbedding = await getEmbedding(qText); } catch (e) { console.log(`    ⚠️  Q向量生成失败: ${e.message}`); }
  try { if (sText.length >= 10) sEmbedding = await getEmbedding(sText); } catch (e) { console.log(`    ⚠️  S向量生成失败: ${e.message}`); }
  try { if (kText.length >= 10) kEmbedding = await getEmbedding(kText); } catch (e) { console.log(`    ⚠️  K向量生成失败: ${e.message}`); }
  try { if (aText.length >= 10) aEmbedding = await getEmbedding(aText); } catch (e) { console.log(`    ⚠️  A向量生成失败: ${e.message}`); }

  return {
    q_embedding: qEmbedding, s_embedding: sEmbedding, k_embedding: kEmbedding, a_embedding: aEmbedding,
    q_text: qText, s_text: sText, k_text: kText, a_text: aText
  };
}

function saveQuestionFiles(question, questionUid, subject, year, mathType) {
  const mathTypePart = mathType ? `_${mathType}` : '';
  const questionDir = join(QUESTIONS_DIR, subject, `${year}${mathTypePart}`, questionUid);
  if (!existsSync(questionDir)) {
    mkdirSync(questionDir, { recursive: true });
  }

  const metadata = {
    question_id: questionUid,
    region: '北京',
    subject: SUBJECT_CN[subject] || subject,
    subject_code: subject,
    year: year,
    math_type: mathType || null,
    question_no: question.number,
    question_type: question.type,
    difficulty: question.difficulty,
    knowledge_points: question.knowledge_points || [],
    has_image: question.has_image || false,
    has_formula: (question.latex_formulas && question.latex_formulas.length > 0) || false,
    score: question.score,
    created_at: new Date().toISOString()
  };

  writeFileSync(join(questionDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  let mdContent = '---\n';
  Object.entries(metadata).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      mdContent += `${key}:\n`;
      value.forEach(v => { mdContent += `  - ${v}\n`; });
    } else {
      mdContent += `${key}: ${value}\n`;
    }
  });
  mdContent += '---\n\n# 题目\n' + question.stem + '\n';

  if (question.options) {
    mdContent += '\n## 选项\n';
    question.options.forEach(opt => { mdContent += `${opt}\n`; });
  }

  if (question.has_image) {
    mdContent += '\n## 图片语义描述\n' + (question.image_description || '暂无描述') + '\n';
  }

  if (question.latex_formulas && question.latex_formulas.length > 0) {
    mdContent += '\n## 公式\n';
    question.latex_formulas.forEach(f => { mdContent += `${f}\n`; });
  }

  mdContent += '\n# 标准答案\n' + (question.answer || '暂无') + '\n';
  mdContent += '\n# 详细解析\n' + (question.analysis || '暂无') + '\n';
  if (question.semanticDescription) mdContent += '\n# 语义描述\n' + question.semanticDescription + '\n';
  if (question.solutionDescription) mdContent += '\n# 解题方法\n' + question.solutionDescription + '\n';

  writeFileSync(join(questionDir, 'question.md'), mdContent, 'utf-8');

  if (question.q_text || question.s_text || question.k_text || question.a_text) {
    let embeddingContent = '';
    if (question.q_text) embeddingContent += `## Question Embedding\n${question.q_text}\n\n`;
    if (question.s_text) embeddingContent += `## Semantic Embedding\n${question.s_text}\n\n`;
    if (question.k_text) embeddingContent += `## Knowledge Embedding\n${question.k_text}\n\n`;
    if (question.a_text) embeddingContent += `## Solution Embedding\n${question.a_text}\n`;
    writeFileSync(join(questionDir, 'embedding.txt'), embeddingContent.trim(), 'utf-8');
  }

  return questionDir;
}

async function runConcurrent(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        results[i] = { error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function parseBeijingPapers() {
  const options = parseArgs();
  const pool = await getDb();

  console.log('🏛️  北京地区专项多模态解析');
  console.log('='.repeat(60));
  console.log(`📌 范围: 仅 province_code = 'beijing'`);
  console.log(`📌 exam_level: 仅 gaokao（高考）`);
  if (options.subject) console.log(`📌 学科: ${options.subject}`);
  if (options.year) console.log(`📌 年份: ${options.year}`);
  if (options.force) console.log(`📌 强制重新解析: 是`);
  console.log('');

  // 构建查询条件
  const conditions = ["province_code = 'beijing'", "exam_level = 'gaokao'"];
  const params = [];
  let paramIdx = 1;

  if (options.subject) {
    conditions.push(`subject = $${paramIdx}`);
    params.push(options.subject);
    paramIdx++;
  }

  if (options.year) {
    conditions.push(`year = $${paramIdx}`);
    params.push(options.year);
    paramIdx++;
  }

  if (!options.force) {
    conditions.push('(question_count IS NULL OR question_count = 0 OR question_count < 0)');
  }

  const whereClause = conditions.join(' AND ');

  const papersResult = await pool.query(
    `SELECT id, province_code, year, subject, exam_level, math_type, paper_file_path, question_count
     FROM exam_papers
     WHERE ${whereClause}
     ORDER BY subject, year DESC, math_type`,
    params
  );

  const papers = papersResult.rows;
  console.log(`📊 待解析北京试卷: ${papers.length} 套\n`);

  if (papers.length === 0) {
    console.log('✅ 所有符合条件的北京试卷已解析完毕！');
    await pool.end();
    process.exit(0);
  }

  // 北京地区试卷统计
  const subjectCount = {};
  papers.forEach(p => {
    subjectCount[p.subject] = (subjectCount[p.subject] || 0) + 1;
  });
  console.log('📁 学科分布:');
  Object.entries(subjectCount).forEach(([s, c]) => {
    console.log(`   ${SUBJECT_CN[s] || s}: ${c} 套`);
  });
  console.log('');

  const kpCache = {};
  async function getKPList(subject) {
    if (kpCache[subject]) return kpCache[subject];
    try {
      const r = await pool.query('SELECT name FROM knowledge_points WHERE subject = $1 ORDER BY frequency DESC, difficulty DESC LIMIT 100', [subject]);
      const list = r.rows.map(x => x.name).join('\n');
      kpCache[subject] = list || '无';
    } catch {
      kpCache[subject] = '无';
    }
    return kpCache[subject];
  }

  let totalParsed = 0, totalQuestions = 0, totalSkipped = 0, totalFailed = 0;
  const subjectStats = {};

  const tasks = papers.map(paper => async () => {
    const { id: paperId, year, subject, math_type, paper_file_path } = paper;
    const mathTypeLabel = math_type ? `[${math_type === 'arts' ? '文科' : math_type === 'science' ? '理科' : '统一'}]` : '';
    const subjectLabel = `${SUBJECT_CN[subject] || subject} ${year}${mathTypeLabel}`;

    if (!subjectStats[subject]) subjectStats[subject] = { parsed: 0, questions: 0, failed: 0 };

    const resolvedPath = resolveFilePath(paper_file_path);
    if (!resolvedPath) {
      console.log(`  ⏭️  ${subjectLabel}: 找不到文件 - ${paper_file_path}`);
      totalSkipped++;
      subjectStats[subject].failed++;
      return;
    }

    try {
      const content = extractText(resolvedPath);
      if (!content || content.trim().length < 50) {
        console.log(`  ⚠️  ${subjectLabel}: 文本过短`);
        totalSkipped++;
        subjectStats[subject].failed++;
        return;
      }

      const shards = shardContent(content);
      const kpList = await getKPList(subject);

      let allQuestions = [];
      for (let si = 0; si < shards.length; si++) {
        console.log(`  📄 [${subjectLabel}] 片段${si + 1}/${shards.length}`);
        const llmResult = await callLLM(shards[si], subject, year, kpList, si, shards.length);
        const data = extractJSON(llmResult);
        if (data && data.questions && Array.isArray(data.questions)) {
          const offset = allQuestions.length;
          for (const q of data.questions) {
            const sanitized = sanitizeQuestion(q);
            if (shards.length > 1) {
              sanitized.number = offset + (q.number || (data.questions.indexOf(q) + 1));
            }
            allQuestions.push(sanitized);
          }
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      if (allQuestions.length === 0) {
        console.log(`  ⚠️  ${subjectLabel}: 无题目`);
        totalSkipped++;
        subjectStats[subject].failed++;
        return;
      }

      allQuestions = calibrateDifficulty(allQuestions, subject);

      console.log(`  🧠 AI增强处理 (${allQuestions.length}题)...`);
      for (let i = 0; i < allQuestions.length; i++) {
        const q = allQuestions[i];
        console.log(`    处理第 ${q.number} 题 (${Math.round((i + 1) / allQuestions.length * 100)}%)`);
        const aiResult = await processQuestionWithAI(q, subject);
        Object.assign(q, aiResult);
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`  🔹 向量生成...`);
      for (let i = 0; i < allQuestions.length; i++) {
        const q = allQuestions[i];
        const vectors = await generateVectors(q);
        Object.assign(q, vectors);
        await new Promise(r => setTimeout(r, 200));
      }

      console.log(`  💾 存储...`);
      await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);
      await pool.query('DELETE FROM question_vectors WHERE question_id IN (SELECT id FROM exam_questions WHERE paper_id = $1)', [paperId]);
      await pool.query('DELETE FROM question_images WHERE question_id IN (SELECT id FROM exam_questions WHERE paper_id = $1)', [paperId]);
      await pool.query('DELETE FROM question_formulas WHERE question_id IN (SELECT id FROM exam_questions WHERE paper_id = $1)', [paperId]);

      for (const q of allQuestions) {
        const questionUid = generateQuestionUID(subject, year, math_type, q.number);

        const result = await pool.query(`
          INSERT INTO exam_questions (
            question_uid, paper_id, question_number, question_type, stem, options,
            answer, analysis, knowledge_points, difficulty, score,
            subject_code, province_code, year, has_image, has_formula,
            image_descriptions, latex_formulas, formula_semantics,
            semantic_description, solution_description,
            physics_structure, chemistry_structure, math_structure
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          RETURNING id
        `, [
          questionUid, paperId, q.number, q.type, q.stem,
          q.options ? JSON.stringify(q.options) : null,
          q.answer, q.analysis,
          q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
          q.difficulty, q.score, subject, 'beijing', year,
          q.has_image || false,
          (q.latex_formulas && q.latex_formulas.length > 0) || false,
          q.image_description || null,
          q.latex_formulas ? JSON.stringify(q.latex_formulas) : null,
          q.formulaSemantics || null,
          q.semanticDescription || null,
          q.solutionDescription || null,
          q.physicsStructure ? JSON.stringify(q.physicsStructure) : null,
          q.chemistryStructure ? JSON.stringify(q.chemistryStructure) : null,
          q.mathStructure ? JSON.stringify(q.mathStructure) : null
        ]);

        const questionId = result.rows[0].id;

        if (q.q_embedding || q.s_embedding || q.k_embedding || q.a_embedding) {
          await pool.query(`
            INSERT INTO question_vectors (
              question_id, question_uid, subject_code, question_type, difficulty,
              q_embedding, s_embedding, k_embedding, a_embedding,
              q_text, s_text, k_text, a_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            questionId, questionUid, subject, q.type, q.difficulty,
            q.q_embedding ? `[${q.q_embedding.join(',')}]` : null,
            q.s_embedding ? `[${q.s_embedding.join(',')}]` : null,
            q.k_embedding ? `[${q.k_embedding.join(',')}]` : null,
            q.a_embedding ? `[${q.a_embedding.join(',')}]` : null,
            q.q_text || null,
            q.s_text || null,
            q.k_text || null,
            q.a_text || null
          ]);
        }

        if (q.latex_formulas && q.latex_formulas.length > 0) {
          for (let fi = 0; fi < q.latex_formulas.length; fi++) {
            await pool.query(`
              INSERT INTO question_formulas (question_id, latex, semantic_description, sort_order)
              VALUES ($1, $2, $3, $4)
            `, [questionId, q.latex_formulas[fi], null, fi]);
          }
        }

        saveQuestionFiles(q, questionUid, subject, year, math_type);
      }

      await pool.query(`
        UPDATE exam_papers SET
          question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1),
          difficulty_avg = (SELECT AVG(difficulty) FROM exam_questions WHERE paper_id = $1 AND difficulty IS NOT NULL),
          updated_at = NOW()
        WHERE id = $1
      `, [paperId]);

      totalParsed++;
      totalQuestions += allQuestions.length;
      subjectStats[subject].parsed++;
      subjectStats[subject].questions += allQuestions.length;
      console.log(`  ✅ ${subjectLabel}: ${allQuestions.length}题\n`);

    } catch (err) {
      console.error(`  ❌ ${subjectLabel}: ${err.message}\n`);
      totalFailed++;
      subjectStats[subject].failed++;
    }
  });

  console.log(`🚀 开始解析北京试卷 (并发=${CONCURRENCY}, 延迟=${DELAY_MS}ms)...\n`);
  await runConcurrent(tasks, CONCURRENCY);

  console.log('\n' + '='.repeat(60));
  console.log('🏛️  北京地区解析报告');
  console.log('='.repeat(60));
  console.log(`✅ 总计: ${totalParsed} 套试卷, ${totalQuestions} 道题目`);
  console.log(`⏭️  跳过: ${totalSkipped} 套`);
  console.log(`❌ 失败: ${totalFailed} 套\n`);

  console.log('📊 学科统计:');
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    console.log(`  ${SUBJECT_CN[subject] || subject}: ${stats.parsed} 套 / ${stats.questions} 题 / ${stats.failed} 失败`);
  });

  await pool.end();
  process.exit(0);
}

parseBeijingPapers().catch(err => {
  console.error('❌ 解析失败:', err.message);
  process.exit(1);
});