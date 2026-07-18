#!/usr/bin/env node
/**
 * 全量试卷解析脚本 v2
 * 改进：
 * 1. 支持所有省份（从 DB 的 exam_papers 读取待解析试卷）
 * 2. 用 PyMuPDF 替代 PyPDF2 提取 PDF 文本（质量大幅提升）
 * 3. DOCX 提取时标记图片位置 [图片N]
 * 4. 长试卷自动分片，避免截断丢题
 * 5. 并发控制（默认3路并发）
 * 6. 优先使用 DOCX（比 PDF 文本质量更好）
 */
import { getDb } from '../api/core/db.js';
import { existsSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
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
const CONCURRENCY = parseInt(process.env.PARSE_CONCURRENCY) || 3;
const SHARD_SIZE = 8000; // 每片最大字符数

// 省份目录名 → code 映射
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

const SUBJECT_PROMPT_MAP = {
  physics: '这是一份物理高考试卷。物理题通常包含公式（如 F=ma）、单位、图表描述和计算过程。选择题注意是单选还是多选，解答题要提取完整的解题步骤和公式应用。',
  chemistry: '这是一份化学高考试卷。化学题涉及化学方程式、元素符号、物质结构和实验操作。注意区分选择题和填空题的格式。方程式中的箭头和条件请尽量保留。',
  biology: '这是一份生物高考试卷。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。注意图表和实验设计题的提取。',
  history: '这是一份历史高考试卷。历史题涉及时间、事件、人物和历史概念。注意材料分析题和论述题的提取。',
  politics: '这是一份政治高考试卷。政治题涉及政治概念、经济原理、哲学观点和时事政策。注意材料分析题的提取。',
  geography: '这是一份地理高考试卷。地理题涉及地图分析、气候、地形和人文地理。注意图表题和综合分析题的提取。',
  math: '这是一份数学高考试卷。数学题包含公式、计算过程和证明。注意区分选择题、填空题和解答题。公式用文字描述即可，如 x^2 表示平方。',
  chinese: '这是一份语文高考试卷。语文题包括现代文阅读、古诗文、语言运用和作文题。',
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
      "answer": "",
      "analysis": "",
      "knowledge_points": ["知识点1"],
      "difficulty": 3,
      "score": 5
    }}
  ]
}}

注意：
1. type 只能是：choice（单选）, multi_choice（多选）, fill（填空）, solve（解答/计算/证明）
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
3. knowledge_points 必须从下方【标准知识点列表】中选择，最多3个
4. 如果无法确定答案或解析，留空字符串
5. 保持 JSON 格式正确，不要添加 markdown 代码块标记
6. 必须提取所有题目，包括填空题和解答题
7. [图片N] 表示原图中有图片，在 stem 中保留该标记

【标准知识点列表】：
{kp_list}`;

const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// ==================== 文本提取 ====================

function extractTextFromPDF(filePath) {
  const tmpScript = join(tmpdir(), `pdf_extract_${Date.now()}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
import fitz  # PyMuPDF

try:
    path = r"""${filePath}"""
    doc = fitz.open(path)
    content_parts = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text:
            content_parts.append(text)
        # 标记页面中的图片
        images = page.get_images(full=True)
        if images:
            for idx, img in enumerate(images):
                content_parts.append(f"\\n[图片{page_num+1}_{idx+1}]\\n")
    doc.close()
    result = "\\n".join(content_parts)
    # 输出，用特殊标记包围防止截断
    sys.stdout.buffer.write(result.encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${PYTHON_CMD} "${tmpScript}"`, {
      encoding: 'buffer',
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024
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
import docx
from docx.opc.constants import RELATIONSHIP_TYPE as RT

try:
    path = r"""${filePath}"""
    doc = docx.Document(path)
    content_parts = []
    img_counter = 0

    # 遍历所有段落，遇到内嵌图片时标记
    for para in doc.paragraphs:
        # 检查段落中是否有图片
        has_image = False
        for run in para.runs:
            if run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing') or \
               run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pict'):
                has_image = True
                break
            # 检查 inline shapes
            drawings = run._element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
            if drawings:
                has_image = True
                break

        text = para.text.strip()
        if has_image:
            img_counter += 1
            if text:
                content_parts.append(text + f" [图片{img_counter}]")
            else:
                content_parts.append(f"[图片{img_counter}]")
        elif text:
            content_parts.append(text)

    # 表格内容
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                content_parts.append(" | ".join(cells))

    result = "\\n".join(content_parts)
    sys.stdout.buffer.write(result.encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${PYTHON_CMD} "${tmpScript}"`, {
      encoding: 'buffer',
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024
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
  if (ext === '.docx' || ext === '.doc') return extractTextFromDOCX(filePath);
  return '';
}

// ==================== 文件查找 ====================

// 在省份目录下查找原卷文件（优先DOCX，排除解析版/答案）
function findOriginalFile(provinceDir, year, subject) {
  const SUBJECT_CN = {
    chinese: '语文', math: '数学', english: '英语',
    physics: '物理', chemistry: '化学', biology: '生物',
    politics: '政治', history: '历史', geography: '地理',
  };
  const subjectCN = SUBJECT_CN[subject] || subject;
  const results = [];

  function scan(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          scan(fullPath);
        } else {
          const name = entry;
          const ext = extname(name).toLowerCase();
          if (!['.pdf', '.doc', '.docx'].includes(ext)) continue;
          if (name.startsWith('~$')) continue;
          // 必须匹配年份
          if (!name.includes(String(year))) continue;
          // 必须匹配学科
          if (!name.includes(subjectCN)) continue;
          // 排除解析版/答案
          if (name.includes('解析') || name.includes('答案')) continue;
          results.push(fullPath);
        }
      } catch {}
    }
  }

  scan(provinceDir);

  // 优先 DOCX > DOC > PDF
  const priority = ['.docx', '.doc', '.pdf'];
  results.sort((a, b) => {
    const ea = extname(a).toLowerCase();
    const eb = extname(b).toLowerCase();
    return priority.indexOf(ea) - priority.indexOf(eb);
  });

  return results[0] || null;
}

// ==================== 文本分片 ====================

function shardContent(content, maxSize = SHARD_SIZE) {
  if (content.length <= maxSize) return [content];

  const shards = [];
  // 按题号分割（匹配 "1." "2." "第1题" 等模式）
  const lines = content.split('\n');
  let current = '';
  let lastQuestionStart = 0;

  for (const line of lines) {
    // 检测新题目开始的模式
    const isQuestionStart = /^[\(（]?\d{1,2}[\.、）\)]/.test(line.trim()) ||
                            /^第\d{1,2}题/.test(line.trim()) ||
                            /^[一二三四五六七八九十]+[、.]/.test(line.trim());

    if (isQuestionStart && current.length > maxSize * 0.5) {
      shards.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }

  if (current.trim()) {
    // 如果最后一片太长，强制按大小切
    while (current.length > maxSize) {
      shards.push(current.substring(0, maxSize));
      current = current.substring(maxSize);
    }
    if (current.trim()) shards.push(current.trim());
  }

  return shards;
}

// ==================== LLM 调用 ====================

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
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出，不要添加任何解释。' },
        { role: 'user', content: prompt + '\n\n以下是试卷内容：\n' + content }
      ],
      temperature,
      max_tokens: maxTokens
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

  if (result.choices && result.choices[0]) {
    return result.choices[0].message.content;
  }

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
  try {
    return JSON.parse(jsonStr.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
  } catch {}
  // fallback: 逐个题目对象解析
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
        const obj = JSON.parse(str.substring(start, pos + 1)
          .replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
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

// ==================== 并发控制 ====================

async function runConcurrent(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// ==================== 主流程 ====================

async function parseAllQuestions() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database', '高考真题');

  // 1. 从 DB 获取所有未解析的试卷
  const papersResult = await pool.query(`
    SELECT id, province_code, year, subject, exam_level, paper_file_path
    FROM exam_papers
    WHERE question_count IS NULL OR question_count = 0
    ORDER BY province_code, year DESC, subject
  `);

  const papers = papersResult.rows;
  console.log(`📊 待解析试卷: ${papers.length} 套\n`);

  if (papers.length === 0) {
    console.log('✅ 所有试卷已解析完毕！');
    process.exit(0);
  }

  // 2. 知识点缓存
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

  // 3. 省份目录映射
  const provinceDirs = {};
  if (existsSync(databaseDir)) {
    for (const entry of readdirSync(databaseDir)) {
      const fullPath = join(databaseDir, entry);
      if (!statSync(fullPath).isDirectory()) continue;
      for (const [dirName, code] of Object.entries(PROVINCE_DIR_MAP)) {
        if (entry.includes(dirName.replace('高考', '')) || entry === dirName) {
          provinceDirs[code] = fullPath;
          break;
        }
      }
    }
  }

  // 4. 统计
  let totalParsed = 0, totalQuestions = 0, totalSkipped = 0, totalFailed = 0;

  // 5. 构建解析任务
  const tasks = papers.map(paper => async () => {
    const { id: paperId, province_code, year, subject, exam_level, paper_file_path } = paper;
    const label = `${province_code}/${year}/${subject}`;

    // 查找原卷文件
    let filePath = null;

    // 方式1: 从 paper_file_path 直接查找
    if (paper_file_path) {
      // paper_file_path 可能是相对路径或绝对路径
      const candidates = [
        paper_file_path,
        join(databaseDir, paper_file_path),
        join(ROOT, paper_file_path),
      ];
      // 如果路径包含省份目录名，也尝试拼接
      for (const [dirName, code] of Object.entries(PROVINCE_DIR_MAP)) {
        if (code === province_code) {
          candidates.push(join(databaseDir, dirName, paper_file_path));
        }
      }
      for (const c of candidates) {
        if (existsSync(c)) { filePath = c; break; }
      }
    }

    // 方式2: 从省份目录扫描查找
    if (!filePath && provinceDirs[province_code]) {
      filePath = findOriginalFile(provinceDirs[province_code], year, subject);
    }

    if (!filePath) {
      console.log(`  ⏭️  找不到文件: ${label}`);
      totalSkipped++;
      return;
    }

    try {
      // 提取文本
      const content = extractText(filePath);
      if (!content || content.trim().length < 50) {
        console.log(`  ⚠️  文本过短: ${label} (${(content || '').length}字符)`);
        totalSkipped++;
        return;
      }

      // 分片
      const shards = shardContent(content);
      const kpList = await getKPList(subject);

      let allQuestions = [];
      for (let si = 0; si < shards.length; si++) {
        console.log(`  📄 [${label}] 片段${si + 1}/${shards.length} (${shards[si].length}字符)`);
        const llmResult = await callLLM(shards[si], subject, year, kpList, si, shards.length);
        const data = extractJSON(llmResult);

        if (data && data.questions && Array.isArray(data.questions)) {
          // 如果是多片，调整题号
          const offset = allQuestions.length;
          for (const q of data.questions) {
            const sanitized = sanitizeQuestion(q);
            if (shards.length > 1) {
              sanitized.number = offset + (q.number || (data.questions.indexOf(q) + 1));
            }
            allQuestions.push(sanitized);
          }
        }

        // 速率限制
        await new Promise(r => setTimeout(r, 300));
      }

      if (allQuestions.length === 0) {
        console.log(`  ⚠️  无题目: ${label}`);
        totalSkipped++;
        return;
      }

      // 写入数据库
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
          q.difficulty, q.score, subject, province_code, year
        ]);
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
      console.log(`  ✅ ${label}: ${allQuestions.length}题 (${shards.length}片)`);

    } catch (err) {
      console.error(`  ❌ ${label}: ${err.message}`);
      totalFailed++;
    }
  });

  // 6. 执行
  console.log(`🚀 开始解析 (并发=${CONCURRENCY})...\n`);
  await runConcurrent(tasks, CONCURRENCY);

  // 7. 统计
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ 解析完成！`);
  console.log(`  成功: ${totalParsed} 套`);
  console.log(`  题目: ${totalQuestions} 道`);
  console.log(`  跳过: ${totalSkipped} 套（无文件/无内容）`);
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
  const typeStats = await pool.query(`
    SELECT question_type, COUNT(*) as cnt FROM exam_questions GROUP BY question_type ORDER BY cnt DESC
  `);
  console.log('\n📊 题型分布:');
  for (const row of typeStats.rows) {
    console.log(`  ${row.question_type}: ${row.cnt}`);
  }

  await pool.end();
  process.exit(0);
}

parseAllQuestions().catch(err => {
  console.error('❌ 解析失败:', err.message);
  process.exit(1);
});
