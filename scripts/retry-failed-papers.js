#!/usr/bin/env node
/**
 * 重试脚本 — 专门处理之前失败的试卷
 * 1. 使用win32com解析.doc文件（串行，避免Word冲突）
 * 2. 使用重试机制处理fetch failed
 */
import { getDb } from '../api/core/db.js';
import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
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
const MAX_RETRIES = 3;
const DELAY_MS = 1000;

// 试卷类型映射已迁移至 ./lib/paper-evolution.js 共享模块

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const SUBJECT_PROMPT_MAP = {
  physics: '这是一份物理高考试卷。物理题通常包含公式（如 F=ma）、单位、图表描述和计算过程。',
  chemistry: '这是一份化学高考试卷。化学题涉及化学方程式、元素符号、物质结构和实验操作。',
  biology: '这是一份生物高考试卷。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。',
  history: '这是一份历史高考试卷。历史题涉及时间、事件、人物和历史概念。',
  politics: '这是一份政治高考试卷。政治题涉及政治概念、经济原理、哲学观点和时事政策。',
  geography: '这是一份地理高考试卷。地理题涉及地图分析、气候、地形和人文地理。',
  math: '这是一份数学高考试卷。数学题包含公式、计算过程和证明。注意区分选择题、填空题和解答题。',
  chinese: '这是一份语文高考试卷。语文题包括现代文阅读、古诗文、语言运用和作文题。',
  english: '这是一份英语高考试卷。英语题包括听力、阅读理解、完形填空、语法填空和写作。',
};

const EXTRACTION_PROMPT = `{subject_hint}

请从以下高考试卷内容中提取所有题目，按以下JSON格式返回：

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
1. type: choice（单选）, multi_choice（多选）, fill（填空）, solve（解答/计算/证明/作文/综合）
2. difficulty 1-5：1简单送分，2较易，3中等，4较难，5困难压轴
3. knowledge_points 最多3个最相关的知识点
4. **必须提取答案（answer）和解析（analysis）**，从试卷内容中查找答案区域或根据题目逻辑推断。选择题答案为选项字母（如A、B、C、D），多选题为多个字母（如AB、ACD），填空题为具体答案，解答题简要写出关键步骤和结果。
5. 如果试卷内容中确实找不到答案或无法推断，才留空字符串。
6. 保持JSON格式正确，不要添加markdown标记

【标准知识点列表】：
{kp_list}`;

// ==================== 文本提取 ====================

function extractTextFromPDF(filePath) {
  const tmpScript = join(tmpdir(), `pdf_extract_${Date.now()}_${Math.random().toString(36).slice(2,8)}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import fitz
    doc = fitz.open(r"""${filePath}""")
    parts = []
    for i in range(len(doc)):
        t = doc[i].get_text("text")
        if t: parts.append(t)
        imgs = doc[i].get_images(full=True)
        for idx, _ in enumerate(imgs):
            parts.append(f"\\n[图片{i+1}_{idx+1}]\\n")
    doc.close()
    sys.stdout.buffer.write("\\n".join(parts).encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`python "${tmpScript}"`, { encoding: 'buffer', timeout: 60000, maxBuffer: 50 * 1024 * 1024 });
    try { unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch {}
    return '';
  }
}

function extractTextFromDOCX(filePath) {
  const tmpScript = join(tmpdir(), `docx_extract_${Date.now()}_${Math.random().toString(36).slice(2,8)}.py`);
  const script = `# -*- coding: utf-8 -*-
import sys
try:
    import docx
    doc = docx.Document(r"""${filePath}""")
    parts = []
    img_cnt = 0
    for para in doc.paragraphs:
        has_img = False
        for run in para.runs:
            if run._element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip') or \
               run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                has_img = True
                break
        text = para.text.strip()
        if has_img:
            img_cnt += 1
            parts.append((text + f" [图片{img_cnt}]") if text else f"[图片{img_cnt}]")
        elif text:
            parts.append(text)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells: parts.append(" | ".join(cells))
    sys.stdout.buffer.write("\\n".join(parts).encode('utf-8'))
except Exception as e:
    sys.stderr.write(str(e))
`;
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`python "${tmpScript}"`, { encoding: 'buffer', timeout: 60000, maxBuffer: 50 * 1024 * 1024 });
    try { unlinkSync(tmpScript); } catch {}
    return output.toString('utf-8') || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch {}
    return '';
  }
}

function extractTextFromDOC(filePath) {
  // 使用win32com解析旧版.doc文件
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
    text = text.replace('\\r\\n', '\\n').replace('\\r', '\\n')
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
    const output = execSync(`python "${tmpScript}"`, { encoding: 'buffer', timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
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

function shardContent(content, maxSize = 8000) {
  if (content.length <= maxSize) return [content];
  const shards = [];
  const lines = content.split('\n');
  let current = '';
  for (const line of lines) {
    if ((/^[\(（]?\d{1,2}[\.、）\)]/.test(line.trim()) || /^第\d{1,2}题/.test(line.trim()) || /^[一二三四五六七八九十]+[、.]/.test(line.trim())) && current.length > maxSize * 0.5) {
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

// ==================== LLM调用（带重试） ====================

async function callLLMWithRetry(content, subject, kpList, retryCount = 0) {
  const subjectHint = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  const prompt = EXTRACTION_PROMPT.replace('{subject_hint}', subjectHint).replace('{kp_list}', kpList || '无');

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是一个专业的高考试卷题目提取助手。请严格按照JSON格式输出。' },
          { role: 'user', content: prompt + '\n\n以下是试卷内容：\n' + content }
        ],
        temperature: 0.1, max_tokens: 8000
      })
    });

    const result = await response.json();
    if (result.error) throw new Error(JSON.stringify(result.error));
    if (result.choices && result.choices[0]) return result.choices[0].message.content;
    throw new Error('无返回内容');
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      console.log(`    🔄 重试 ${retryCount + 1}/${MAX_RETRIES}: ${err.message.substring(0, 60)}`);
      await new Promise(r => setTimeout(r, 3000 * (retryCount + 1)));
      return callLLMWithRetry(content, subject, kpList, retryCount + 1);
    }
    throw err;
  }
}

function extractJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock) cleaned = codeBlock[1].trim();
  
  // 清除控制字符（保留换行和制表符）
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  
  // 直接尝试解析
  try { return JSON.parse(cleaned); } catch {}
  
  // 提取花括号内容
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) {
    console.log(`     ⚠️ 无法提取JSON (text长度: ${cleaned.length}, 前100字: ${cleaned.substring(0, 100)})`);
    return null;
  }
  let jsonStr = braceMatch[0];
  try { return JSON.parse(jsonStr); } catch (e1) {
    try {
      const fixed = jsonStr.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch (e2) {
      // 尝试修复截断的JSON：找到最后一个完整的题目对象
      const lastCompleteObj = jsonStr.lastIndexOf('},');
      if (lastCompleteObj > 0) {
        const fixed = jsonStr.substring(0, lastCompleteObj + 1) + ']}';
        try {
          const data = JSON.parse(fixed);
          console.log(`     🔧 修复截断JSON: 提取到${data.questions?.length || 0}题`);
          return data;
        } catch {}
      }
      // 尝试逐题提取
      const questions = [];
      const qRegex = /\{\s*"number"\s*:\s*(\d+)[\s\S]*?\}/g;
      let m;
      while ((m = qRegex.exec(jsonStr)) !== null) {
        try {
          const q = JSON.parse(m[0]);
          if (q.stem || q.number) questions.push(q);
        } catch {
          try {
            const q = JSON.parse(m[0].replace(/[\u201c\u201d]/g, '"'));
            if (q.stem || q.number) questions.push(q);
          } catch {}
        }
      }
      if (questions.length > 0) {
        console.log(`     🔧 逐题提取: ${questions.length}题`);
        return { questions };
      }
      console.log(`     ⚠️ JSON解析失败: ${e2.message.substring(0, 60)}`);
      return null;
    }
  }
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

// ==================== 路径解析 ====================

function resolveFilePath(filePath, databaseDir) {
  if (!filePath) return null;
  if (existsSync(filePath)) return filePath;

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
    if (dirPart.includes(kw)) { provinceDir = kw + '高考'; break; }
  }

  const candidates = provinceDir ? [
    join(databaseDir, provinceDir, dirPart, filePart),
    join(databaseDir, provinceDir, filePath),
  ] : [
    join(databaseDir, filePath),
    join(databaseDir, dirPart, filePart),
    join(ROOT, filePath),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // 搜索同名文件
  const fileName = filePath.split(/[/\\]/).pop();
  if (fileName) {
    for (const kw of provinceKeywords) {
      const searchPath = join(databaseDir, kw + '高考');
      if (existsSync(searchPath)) {
        try {
          const files = readdirSync(searchPath, { recursive: true });
          const found = files.find(f => f.endsWith(fileName));
          if (found) return join(searchPath, found);
        } catch {}
      }
    }
  }

  return null;
}

// ==================== 主流程 ====================

async function retryFailed() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database', '高考真题');

  console.log('📋 试卷题目重试脚本 — 修复.doc + fetch failed');
  console.log('='.repeat(60));

  // 获取所有未解析试卷
  const papersResult = await pool.query(`
    SELECT id, province_code, year, subject, paper_file_path
    FROM exam_papers
    WHERE question_count IS NULL OR question_count = 0
    ORDER BY paper_file_path, subject, year
  `);

  const papers = papersResult.rows;
  console.log(`📊 待重试试卷: ${papers.length} 套\n`);

  if (papers.length === 0) {
    console.log('✅ 所有试卷已解析完毕！');
    process.exit(0);
  }

  // 智能去重
  const paperTypeGroups = {};
  for (const paper of papers) {
    const paperType = getPaperType(paper.province_code, paper.year, paper.subject) || 'unknown';
    const dedupKey = `${paperType}_${paper.year}_${paper.subject}`;

    if (!paperTypeGroups[dedupKey]) {
      paperTypeGroups[dedupKey] = {
        paperType, paperTypeName: PAPER_TYPE_LABELS[paperType] || paperType,
        year: paper.year, subject: paper.subject,
        filePath: paper.paper_file_path, papers: []
      };
    }
    paperTypeGroups[dedupKey].papers.push(paper);
    if (!paperTypeGroups[dedupKey].resolvedPath && paper.paper_file_path) {
      const resolved = resolveFilePath(paper.paper_file_path, databaseDir);
      if (resolved) paperTypeGroups[dedupKey].resolvedPath = resolved;
    }
  }

  const uniqueKeys = Object.keys(paperTypeGroups);
  console.log(`📁 去重后需解析: ${uniqueKeys.length} 个单元\n`);

  // 知识点缓存
  const kpCache = {};
  async function getKPList(subject) {
    if (kpCache[subject]) return kpCache[subject];
    try {
      const r = await pool.query('SELECT name FROM knowledge_points WHERE subject = $1 ORDER BY frequency DESC, difficulty DESC', [subject]);
      kpCache[subject] = r.rows.map(x => x.name).join('\n') || '无';
    } catch { kpCache[subject] = '无'; }
    return kpCache[subject];
  }

  let totalParsed = 0, totalQuestions = 0, totalSkipped = 0, totalFailed = 0;

  // 串行处理（避免win32com并发冲突）
  for (let idx = 0; idx < uniqueKeys.length; idx++) {
    const group = paperTypeGroups[uniqueKeys[idx]];
    const { subject, year, paperTypeName, resolvedPath } = group;

    if (!resolvedPath) {
      console.log(`  ⏭️  [${idx+1}/${uniqueKeys.length}] ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject}: 找不到文件 (${group.papers.length}套)`);
      totalSkipped += group.papers.length;
      continue;
    }

    const ext = extname(resolvedPath).toLowerCase();
    console.log(`  📄 [${idx+1}/${uniqueKeys.length}] ${paperTypeName} ${year}${SUBJECT_CN[subject] || subject} (${ext}, ${group.papers.length}套)`);

    try {
      const content = extractText(resolvedPath);
      if (!content || content.trim().length < 50) {
        console.log(`     ⚠️ 文本过短: ${content?.length || 0}字符`);
        totalSkipped += group.papers.length;
        continue;
      }

      const shards = shardContent(content);
      const kpList = await getKPList(subject);

      let allQuestions = [];
      for (let si = 0; si < shards.length; si++) {
        const llmResult = await callLLMWithRetry(shards[si], subject, kpList);
        const data = extractJSON(llmResult);
        if (data?.questions?.length) {
          const offset = allQuestions.length;
          for (const q of data.questions) {
            const sanitized = sanitizeQuestion(q);
            if (shards.length > 1) sanitized.number = offset + (q.number || (data.questions.indexOf(q) + 1));
            allQuestions.push(sanitized);
          }
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      if (allQuestions.length === 0) {
        console.log(`     ⚠️ 无题目`);
        totalSkipped += group.papers.length;
        continue;
      }

      // 写入所有关联试卷
      for (const paper of group.papers) {
        const { id: paperId, province_code, year: paperYear, subject: paperSubject } = paper;
        await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);
        for (const q of allQuestions) {
          await pool.query(`
            INSERT INTO exam_questions (
              paper_id, question_number, question_type, stem, options,
              answer, analysis, knowledge_points, difficulty, score,
              subject_code, province_code, year
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `, [
            paperId, q.number, q.type, q.stem,
            q.options ? JSON.stringify(q.options) : null,
            q.answer, q.analysis,
            q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
            q.difficulty, q.score, paperSubject, province_code, paperYear
          ]);
        }
        await pool.query(`UPDATE exam_papers SET question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id=$1), difficulty_avg = (SELECT AVG(difficulty) FROM exam_questions WHERE paper_id=$1 AND difficulty IS NOT NULL), updated_at=NOW() WHERE id=$1`, [paperId]);
      }

      totalParsed += group.papers.length;
      totalQuestions += allQuestions.length * group.papers.length;
      const provinceList = [...new Set(group.papers.map(p => p.province_code))].join(',');
      console.log(`     ✅ ${allQuestions.length}题 × ${group.papers.length}套 [${provinceList}]`);

    } catch (err) {
      console.error(`     ❌ ${err.message.substring(0, 80)}`);
      totalFailed += group.papers.length;
    }
  }

  // 统计
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 重试完成！`);
  console.log(`  成功: ${totalParsed} 套`);
  console.log(`  题目: ${totalQuestions} 道`);
  console.log(`  跳过: ${totalSkipped} 套`);
  console.log(`  失败: ${totalFailed} 套`);

  const r1 = await pool.query('SELECT COUNT(*) as total FROM exam_questions');
  const r2 = await pool.query('SELECT COUNT(*) as parsed FROM exam_papers WHERE question_count > 0');
  const r3 = await pool.query('SELECT COUNT(*) as total FROM exam_papers');
  console.log(`\n📊 数据库总览:`);
  console.log(`  题目总数: ${r1.rows[0].total}`);
  console.log(`  已解析试卷: ${r2.rows[0].parsed} / ${r3.rows[0].total}`);

  const subjectStats = await pool.query(`
    SELECT subject_code, COUNT(*) as cnt, ROUND(AVG(difficulty)::numeric,2) as avg_diff
    FROM exam_questions GROUP BY subject_code ORDER BY cnt DESC
  `);
  console.log('\n📊 各学科统计:');
  for (const row of subjectStats.rows) {
    console.log(`  ${row.subject_code}: ${row.cnt}题, 平均难度${row.avg_diff}`);
  }

  await pool.end();
  process.exit(0);
}

retryFailed().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
