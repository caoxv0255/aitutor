#!/usr/bin/env node
/**
 * 全量试卷解析脚本 v3 — 去重解析 + 复用结果
 * 
 * 核心改进：
 * 1. 按唯一 paper_file_path 去重，只解析一次（全国卷被多省份引用）
 * 2. 解析后将题目复制到所有引用同一文件的试卷
 * 3. 学科特性化难度校准
 * 4. 知识点标准化注入
 * 5. 并发控制 + 分片解析
 */
import { getDb } from '../api/core/db.js';
import { existsSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { getPaperType, PAPER_TYPE_LABELS } from './lib/paper-evolution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const CONCURRENCY = parseInt(process.env.PARSE_CONCURRENCY) || 3;
const SHARD_SIZE = 8000;
const DELAY_MS = parseInt(process.env.PARSE_DELAY) || 500;

// ==================== 省份映射 ====================

const PROVINCE_DIR_MAP = {
  '北京高考': 'beijing', '上海高考': 'shanghai', '天津高考': 'tianjin',
  '山东高考': 'shandong', '广东高考': 'guangdong', '浙江高考': 'zhejiang',
  '江苏高考': 'jiangsu', '河南高考': 'henan', '四川高考': 'sichuan',
  '河北高考': 'hebei', '湖北高考': 'hubei', '湖南高考': 'hunan',
  '福建高考': 'fujian', '安徽高考': 'anhui', '辽宁高考': 'liaoning',
  '重庆高考': 'chongqing', '江西高考': 'jiangxi', '贵州高考': 'guizhou',
  '广西高考': 'guangxi', '云南高考': 'yunnan', '山西高考': 'shanxi',
  '陕西高考': 'shaanxi', '甘肃高考': 'gansu', '黑龙江高考': 'heilongjiang',
  '吉林高考': 'jilin', '内蒙古高考': 'neimenggu', '青海高考': 'qinghai',
  '宁夏高考': 'ningxia', '海南高考': 'hainan', '新疆高考': 'xinjiang',
  '西藏高考': 'xizang',
};

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

// ==================== 试卷类型映射（用于智能去重）====================
// 已迁移至 ./lib/paper-evolution.js 共享模块

// ==================== 学科特性化难度校准 ====================

const SUBJECT_DIFFICULTY_CALIBRATION = {
  math: {
    name: '数学',
    // 数学选择题前几题简单，后几题难；解答题梯度明显
    rules: [
      { type: 'choice', position: 'early', adjust: -1 },   // 选择1-4题降1级
      { type: 'choice', position: 'late', adjust: +1 },     // 选择最后2题升1级
      { type: 'fill', position: 'early', adjust: 0 },
      { type: 'fill', position: 'late', adjust: +1 },       // 填空最后一道升1级
      { type: 'solve', position: 'last', adjust: +1 },      // 解答最后一道至少4分
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 5, fill: 5, solve: 5 },
  },
  chinese: {
    name: '语文',
    // 语文整体难度较均匀，作文是压轴
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'fill', adjust: 0 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 2, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 4, solve: 5 },
  },
  english: {
    name: '英语',
    // 英语整体偏中等，写作稍难
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'fill', adjust: 0 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 4, solve: 5 },
  },
  physics: {
    name: '物理',
    // 物理选择题有梯度，实验题中等，计算题后两道难
    rules: [
      { type: 'choice', position: 'early', adjust: -1 },
      { type: 'choice', position: 'late', adjust: +1 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 5, fill: 4, solve: 5 },
  },
  chemistry: {
    name: '化学',
    // 化学选择题偏中等，工艺流程和实验题较难
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'fill', position: 'late', adjust: +1 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 5, solve: 5 },
  },
  biology: {
    name: '生物',
    // 生物整体偏中等，遗传大题较难
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'fill', position: 'late', adjust: +1 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 5, solve: 5 },
  },
  history: {
    name: '历史',
    // 历史选择题难度较均匀，材料大题有区分度
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 2, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 4, solve: 5 },
  },
  politics: {
    name: '政治',
    // 政治选择题偏易，大题需要综合分析
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 1, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 4, solve: 5 },
  },
  geography: {
    name: '地理',
    // 地理选择题中等，综合题有难度
    rules: [
      { type: 'choice', adjust: 0 },
      { type: 'solve', position: 'last', adjust: +1 },
    ],
    minDifficulty: { choice: 2, fill: 2, solve: 3 },
    maxDifficulty: { choice: 4, fill: 4, solve: 5 },
  },
};

// ==================== Prompt ====================

const SUBJECT_PROMPT_MAP = {
  physics: '这是一份物理高考试卷。物理题通常包含公式（如 F=ma）、单位、图表描述和计算过程。选择题注意是单选还是多选，解答题要提取完整的解题步骤和公式应用。',
  chemistry: '这是一份化学高考试卷。化学题涉及化学方程式、元素符号、物质结构和实验操作。注意区分选择题和填空题的格式。方程式中的箭头和条件请尽量保留。',
  biology: '这是一份生物高考试卷。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。注意图表和实验设计题的提取。',
  history: '这是一份历史高考试卷。历史题涉及时间、事件、人物和历史概念。注意材料分析题和论述题的提取。',
  politics: '这是一份政治高考试卷。政治题涉及政治概念、经济原理、哲学观点和时事政策。注意材料分析题的提取。',
  geography: '这是一份地理高考试卷。地理题涉及地图分析、气候、地形和人文地理。注意图表题和综合分析题的提取。',
  math: '这是一份数学高考试卷。数学题包含公式、计算过程和证明。注意区分选择题、填空题和解答题。公式用文字描述即可，如 x^2 表示平方。',
  chinese: '这是一份语文高考试卷。语文题包括现代文阅读、古诗文、语言运用和作文题。注意阅读理解下的子题编号。',
  english: '这是一份英语高考试卷。英语题包括听力（如有）、阅读理解、完形填空、语法填空和写作。注意分值可能为小数。',
};

const EXTRACTION_PROMPT = `{subject_hint}

请从以下高考试卷内容中提取所有题目，按以下 JSON 格式返回（不要添加任何其他内容）：

{{
  "questions": [
    {{
      "number": 1,
      "type": "choice",
      "stem": "题干内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "A",
      "analysis": "本题考查...解题思路是...",
      "knowledge_points": ["知识点1"],
      "difficulty": 3,
      "score": 5
    }}
  ]
}}

注意：
1. type 只能是：choice（单选）, multi_choice（多选）, fill（填空）, solve（解答/计算/证明/作文/综合）
2. difficulty 难度等级 1-5，请严格按以下标准判断：
   1分（简单）：直接套用单一概念或公式，一步得出答案，送分题
   2分（较易）：需要1-2个知识点，简单计算或推理，稍加思考即可
   3分（中等）：需要2-3个知识点组合，多步骤计算或中等阅读量，常规题型
   4分（较难）：需要综合运用多个知识点，复杂计算或推理，有一定陷阱，区分度高
   5分（困难）：跨模块综合题，需要创造性思维或复杂推导，通常是压轴题或最后一题
   
   位置参考（仅作辅助，以内容判断为准）：
   - 选择题：第1-3题≈1-2分，中间题≈3分，最后1-2题≈4分
   - 填空题：前几道≈2-3分，最后一道≈4分
   - 解答题：前2-3道≈3分，中间2道≈4分，最后1道≈5分
3. knowledge_points 必须从下方【标准知识点列表】中选择，最多3个最相关的
4. **必须提取答案（answer）和解析（analysis）**，从试卷内容中查找答案区域或根据题目逻辑推断。选择题答案为选项字母（如A、B、C、D），多选题为多个字母（如AB、ACD），填空题为具体答案，解答题简要写出关键步骤和结果。
5. 如果试卷内容中确实找不到答案或无法推断，才留空字符串。
6. 保持 JSON 格式正确，不要添加 markdown 代码块标记
7. 必须提取所有题目，包括填空题和解答题
8. [图片N] 表示原图中有图片，在 stem 中保留该标记

【标准知识点列表】：
{kp_list}`;

// ==================== 文本提取 ====================

function extractTextFromPDF(filePath) {
  const tmpScript = join(tmpdir(), `pdf_extract_${Date.now()}.py`);
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
    try { unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch {}
    return '';
  }
}

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
    try { unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch {}
    return '';
  }
}

function extractTextFromDOC(filePath) {
  // 使用win32com解析旧版.doc文件（需要Word安装）
  const tmpScript = join(tmpdir(), `doc_extract_${Date.now()}_${Math.random().toString(36).slice(2,8)}.py`);
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
    # win32com返回的文本用\\r换行，统一替换为\\n
    text = text.replace('\\r', '\\n')
    sys.stdout.buffer.write(text.encode('utf-8'))
except Exception as e:
    try:
        word.Application.Quit(-1)
    except:
        pass
    sys.stderr.write(str(e))
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${process.platform === 'win32' ? 'python' : 'python3'} "${tmpScript}"`, {
      encoding: 'buffer', timeout: 120000, maxBuffer: 50 * 1024 * 1024
    });
    try { unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch {}
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

// ==================== 分片 ====================

function shardContent(content, maxSize = SHARD_SIZE) {
  if (content.length <= maxSize) return [content];
  const shards = [];
  const lines = content.split('\n');
  let current = '';
  for (const line of lines) {
    const isQStart = /^[\(（]?\d{1,2}[\.、）\)]/.test(line.trim()) ||
                     /^第\d{1,2}题/.test(line.trim()) ||
                     /^[一二三四五六七八九十]+[、.]/.test(line.trim());
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

// ==================== LLM ====================

async function callLLM(content, subject, year, kpList, shardIndex = 0, totalShards = 1, retryCount = 0) {
  const subjectHint = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  let prompt = EXTRACTION_PROMPT
    .replace('{subject_hint}', subjectHint)
    .replace('{kp_list}', kpList || '无');
  if (totalShards > 1) {
    prompt += `\n\n注意：这是试卷的第 ${shardIndex + 1}/${totalShards} 部分，请只提取本部分的题目，题号从1开始编号。`;
  }
  const temperature = retryCount === 0 ? 0.1 : 0.3;
  const maxTokens = retryCount === 0 ? 6000 : 8000;
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，不要添加任何解释。' },
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

// ==================== JSON 解析 ====================

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
  return parseFallbackJSON(jsonStr);
}

function parseFallbackJSON(str) {
  try {
    const qs = [];
    const regex = /\{"number"\s*:\s*(\d+)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const start = str.lastIndexOf('{', match.index);
      let depth = 0, pos = start;
      while (pos < str.length) {
        if (str[pos] === '{') depth++;
        if (str[pos] === '}') { depth--; if (depth === 0) break; }
        pos++;
      }
      try {
        const obj = JSON.parse(str.substring(start, pos + 1).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
        if (obj.stem || obj.number) qs.push(sanitizeQuestion(obj));
      } catch {}
    }
    return qs.length > 0 ? { questions: qs } : null;
  } catch { return null; }
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
    score: typeof q.score === 'number' ? q.score : null
  };
}

// ==================== 难度校准 ====================

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
        // 根据位置估算难度
        const posRatio = totalOfType > 1 ? i / (totalOfType - 1) : 0.5;
        q.difficulty = Math.round(minDiff + posRatio * (maxDiff - minDiff));
      }

      // 应用校准规则
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

      // 确保在合理范围
      q.difficulty = Math.max(minDiff, Math.min(maxDiff, q.difficulty));
    }
  }

  return questions;
}

// ==================== 并发控制 ====================

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

// ==================== 主流程 ====================

async function parseAllQuestions() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database', '高考真题');

  console.log('📋 试卷题目解析 v3 — 去重解析 + 复用结果');
  console.log('='.repeat(60));

  // 1. 获取所有未解析试卷，按 paper_file_path 分组
  const papersResult = await pool.query(`
    SELECT id, province_code, year, subject, exam_level, paper_file_path
    FROM exam_papers
    WHERE question_count IS NULL OR question_count = 0
    ORDER BY paper_file_path, province_code, year, subject
  `);

  const papers = papersResult.rows;
  console.log(`📊 待解析试卷: ${papers.length} 套\n`);

  if (papers.length === 0) {
    console.log('✅ 所有试卷已解析完毕！');
    process.exit(0);
  }

  // 2. 智能去重：使用 试卷类型+年份+学科 作为去重键
  // 同一套全国卷可能存储在不同省份目录下，通过试卷类型映射识别重复
  const paperTypeGroups = {};
  
  for (const paper of papers) {
    const { province_code, year, subject, paper_file_path } = paper;

    const paperType = getPaperType(province_code, year, subject) || 'unknown';

    const dedupKey = `${paperType}_${year}_${subject}`;

    if (!paperTypeGroups[dedupKey]) {
      paperTypeGroups[dedupKey] = {
        paperType,
        paperTypeName: PAPER_TYPE_LABELS[paperType] || paperType,
        year,
        subject,
        filePath: paper_file_path,
        papers: [],
        sourcePaper: null
      };
    }
    
    paperTypeGroups[dedupKey].papers.push(paper);
    
    // 选择源试卷：优先选择文件路径有效的
    if (!paperTypeGroups[dedupKey].sourcePaper && paper_file_path) {
      paperTypeGroups[dedupKey].sourcePaper = paper;
      paperTypeGroups[dedupKey].filePath = paper_file_path;
    }
  }

  const uniquePaperTypes = Object.keys(paperTypeGroups);
  console.log(`📁 智能去重后需解析单元: ${uniquePaperTypes.length}（节省 ${papers.length - uniquePaperTypes.length} 次解析）\n`);

  // 统计各试卷类型的覆盖情况
  const typeStats = {};
  for (const [key, group] of Object.entries(paperTypeGroups)) {
    if (!typeStats[group.paperTypeName]) {
      typeStats[group.paperTypeName] = { subjects: {}, totalPapers: 0 };
    }
    if (!typeStats[group.paperTypeName].subjects[group.subject]) {
      typeStats[group.paperTypeName].subjects[group.subject] = [];
    }
    typeStats[group.paperTypeName].subjects[group.subject].push(group.year);
    typeStats[group.paperTypeName].totalPapers += group.papers.length;
  }
  
  console.log('📊 试卷类型分布：');
  for (const [name, info] of Object.entries(typeStats)) {
    const subjects = Object.keys(info.subjects).join(', ');
    console.log(`  • ${name}: ${info.totalPapers}套试卷, 涉及学科: ${subjects}`);
  }
  console.log('');

  // 3. 知识点缓存
  const kpCache = {};
  async function getKPList(subject) {
    if (kpCache[subject]) return kpCache[subject];
    try {
      const r = await pool.query('SELECT name FROM knowledge_points WHERE subject = $1 ORDER BY frequency DESC, difficulty DESC', [subject]);
      const list = r.rows.map(x => x.name).join('\n');
      kpCache[subject] = list || '无';
    } catch {
      kpCache[subject] = '无';
    }
    return kpCache[subject];
  }

  // 4. 统计
  let totalParsed = 0, totalQuestions = 0, totalSkipped = 0, totalFailed = 0, totalDeduped = 0;

  // 5. 构建智能去重解析任务
  const tasks = uniquePaperTypes.map(typeKey => async () => {
    const group = paperTypeGroups[typeKey];
    const { subject, year, paperType, paperTypeName, filePath } = group;

    // 解析文件路径：数据库路径格式如 "4. 新疆高考物理2008-2025\2017年...pdf"
    // 实际目录结构：高考真题/新疆高考/4. 新疆高考物理2008-2025/2017年...pdf
    let resolvedPath = null;
    if (filePath) {
      // 先尝试直接路径
      if (existsSync(filePath)) {
        resolvedPath = filePath;
      } else {
        // 从路径中提取省份关键字
        const dirPart = filePath.split(/[/\\]/)[0];
        const filePart = filePath.substring(dirPart.length + 1);
        
        const provinceKeywords = [
          '北京', '上海', '天津', '重庆', '河北', '河南', '山东', '江苏', '浙江',
          '福建', '广东', '湖北', '湖南', '安徽', '江西', '四川', '陕西', '贵州',
          '云南', '新疆', '西藏', '内蒙古', '宁夏', '青海', '甘肃', '黑龙江',
          '吉林', '山西', '辽宁', '海南', '广西'
        ];
        
        let provinceDir = null;
        for (const kw of provinceKeywords) {
          if (dirPart.includes(kw)) {
            provinceDir = kw + '高考';
            break;
          }
        }
        
        // 尝试多种路径组合
        const candidates = provinceDir ? [
          join(databaseDir, provinceDir, dirPart, filePart),
          join(databaseDir, provinceDir, filePath),
        ] : [
          join(databaseDir, filePath),
          join(databaseDir, dirPart, filePart),
          join(ROOT, filePath),
        ];
        
        for (const c of candidates) {
          if (existsSync(c)) { resolvedPath = c; break; }
        }
      }
    }

    if (!resolvedPath) {
      // 尝试从所有省份目录中搜索同名文件
      const fileName = filePath?.split(/[/\\]/).pop();
      if (fileName) {
        for (const kw of ['北京', '上海', '天津', '重庆', '河北', '河南', '山东', '江苏', '浙江',
                          '福建', '广东', '湖北', '湖南', '安徽', '江西', '四川', '陕西', '贵州',
                          '云南', '新疆', '西藏', '内蒙古', '宁夏', '青海', '甘肃', '黑龙江',
                          '吉林', '山西', '辽宁', '海南', '广西']) {
          const searchPath = join(databaseDir, kw + '高考');
          if (existsSync(searchPath)) {
            try {
              const files = readdirSync(searchPath, { recursive: true });
              const found = files.find(f => f.endsWith(fileName));
              if (found) {
                resolvedPath = join(searchPath, found);
                break;
              }
            } catch {}
          }
        }
      }
    }

    if (!resolvedPath) {
      console.log(`  ⏭️  ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: 找不到文件 (影响${group.papers.length}套)`);
      totalSkipped += group.papers.length;
      return;
    }
    group.filePath = resolvedPath;

    try {
      const content = extractText(group.filePath);
      if (!content || content.trim().length < 50) {
        console.log(`  ⚠️  ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: 文本过短 (${(content || '').length}字符, 影响${group.papers.length}套)`);
        totalSkipped += group.papers.length;
        return;
      }

      const shards = shardContent(content);
      const kpList = await getKPList(subject);

      let allQuestions = [];
      for (let si = 0; si < shards.length; si++) {
        console.log(`  📄 [${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}] 片段${si + 1}/${shards.length}`);
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
        console.log(`  ⚠️  ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: 无题目 (影响${group.papers.length}套)`);
        totalSkipped += group.papers.length;
        return;
      }

      allQuestions = calibrateDifficulty(allQuestions, subject);

      for (const paper of group.papers) {
        const { id: paperId, province_code, year: paperYear, subject: paperSubject } = paper;

        await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);

        for (const q of allQuestions) {
          await pool.query(`
            INSERT INTO exam_questions (
              paper_id, question_number, question_type, stem, options,
              answer, analysis, knowledge_points, difficulty, score,
              subject_code, province_code, year
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            paperId, q.number, q.type, q.stem,
            q.options ? JSON.stringify(q.options) : null,
            q.answer, q.analysis,
            q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
            q.difficulty, q.score, paperSubject, province_code, paperYear
          ]);
        }

        await pool.query(`
          UPDATE exam_papers SET
            question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1),
            difficulty_avg = (SELECT AVG(difficulty) FROM exam_questions WHERE paper_id = $1 AND difficulty IS NOT NULL),
            updated_at = NOW()
          WHERE id = $1
        `, [paperId]);
      }

      totalParsed += group.papers.length;
      totalDeduped += group.papers.length - 1;
      totalQuestions += allQuestions.length * group.papers.length;
      const provinceList = [...new Set(group.papers.map(p => p.province_code))].join(',');
      console.log(`  ✅ ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: ${allQuestions.length}题 × ${group.papers.length}套 [${provinceList}]`);

    } catch (err) {
      console.error(`  ❌ ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: ${err.message} (影响${group.papers.length}套)`);
      totalFailed += group.papers.length;
    }
  });

  // 6. 执行
  console.log(`🚀 开始解析 (并发=${CONCURRENCY}, 延迟=${DELAY_MS}ms)...\n`);
  await runConcurrent(tasks, CONCURRENCY);

  // 7. 统计
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 解析完成！`);
  console.log(`  成功解析: ${totalParsed} 套试卷`);
  console.log(`  去重复用: ${totalDeduped} 套`);
  console.log(`  题目总数: ${totalQuestions} 道`);
  console.log(`  跳过: ${totalSkipped} 套`);
  console.log(`  失败: ${totalFailed} 套`);

  // 各省份统计
  const stats = await pool.query(`
    SELECT province_code,
      COUNT(DISTINCT paper_id) as paper_count,
      COUNT(*) as question_count
    FROM exam_questions
    GROUP BY province_code
    ORDER BY question_count DESC
  `);
  console.log('\n📊 各省份题目统计:');
  for (const row of stats.rows) {
    console.log(`  ${row.province_code}: ${row.question_count}道 (${row.paper_count}套)`);
  }

  // 题型统计
  const questionTypeStats = await pool.query(`
    SELECT question_type, COUNT(*) as cnt FROM exam_questions GROUP BY question_type ORDER BY cnt DESC
  `);
  console.log('\n📊 题型分布:');
  for (const row of questionTypeStats.rows) {
    console.log(`  ${row.question_type}: ${row.cnt}`);
  }

  // 难度分布
  const diffStats = await pool.query(`
    SELECT difficulty, COUNT(*) as cnt FROM exam_questions WHERE difficulty IS NOT NULL GROUP BY difficulty ORDER BY difficulty
  `);
  console.log('\n📊 难度分布:');
  for (const row of diffStats.rows) {
    console.log(`  ${row.difficulty}分: ${row.cnt}`);
  }

  // 学科统计
  const subjectStats = await pool.query(`
    SELECT subject_code,
      COUNT(DISTINCT paper_id) as paper_count,
      COUNT(*) as question_count,
      ROUND(AVG(difficulty)::numeric, 2) as avg_difficulty
    FROM exam_questions
    GROUP BY subject_code
    ORDER BY question_count DESC
  `);
  console.log('\n📊 各学科统计:');
  for (const row of subjectStats.rows) {
    console.log(`  ${row.subject_code}: ${row.question_count}道 (${row.paper_count}套) 平均难度${row.avg_difficulty}`);
  }

  await pool.end();
  process.exit(0);
}

parseAllQuestions().catch(err => {
  console.error('❌ 解析失败:', err.message);
  process.exit(1);
});
