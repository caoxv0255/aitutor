#!/usr/bin/env node
import { getDb } from '../api/core/db.js';
import { readdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
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

const SUBJECT_PROMPT_MAP = {
  physics: `这是一份物理高考试卷，请仔细分析每一道题。物理题通常包含公式、单位、图表描述和计算过程。选择题注意是单选还是多选，解答题要提取完整的解题步骤和公式应用。`,
  chemistry: `这是一份化学高考试卷，请仔细分析每一道题。化学题涉及化学方程式、元素符号、物质结构和实验操作。注意区分选择题和填空题的格式。`,
  biology: `这是一份生物高考试卷，请仔细分析每一道题。生物题涉及细胞结构、遗传规律、生态系统和生命活动调节。注意图表和实验设计题的提取。`,
  history: `这是一份历史高考试卷，请仔细分析每一道题。历史题涉及时间、事件、人物和历史概念。注意材料分析题和论述题的提取。`,
  politics: `这是一份政治高考试卷，请仔细分析每一道题。政治题涉及政治概念、经济原理、哲学观点和时事政策。注意材料分析题的提取。`,
  geography: `这是一份地理高考试卷，请仔细分析每一道题。地理题涉及地图分析、气候、地形和人文地理。注意图表题和综合分析题的提取。`,
  math: `这是一份数学高考试卷，请仔细分析每一道题。数学题包含公式、计算过程和证明。注意区分选择题、填空题和解答题。`,
  chinese: `这是一份语文高考试卷，请仔细分析每一道题。语文题包括现代文阅读、古诗文、语言运用和作文题。`,
  english: `这是一份英语高考试卷，请仔细分析每一道题。英语题包括听力（如有）、阅读理解、完形填空、语法填空和写作。注意分值可能为小数。`
};

const EXTRACTION_PROMPT_TEMPLATE = `{subject_specific}

请从以下高考试卷内容中提取所有题目，按以下格式返回 JSON（不要添加任何其他内容）：

{
  "paper_info": {
    "subject": "{subject}",
    "year": {year},
    "province": "beijing"
  },
  "questions": [
    {
      "number": 1,
      "type": "choice",
      "stem": "题干内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "B",
      "analysis": "解析内容",
      "knowledge_points": ["知识点1", "知识点2"],
      "difficulty": 3,
      "score": 5
    }
  ]
}

注意：
1. type 只能是：choice（单选）, multi_choice（多选）, fill（填空）, solve（解答）
2. difficulty 范围 1-5
3. knowledge_points 必须从下方【标准知识点列表】中选择，不要自己编造，最多选3个最相关的
4. 如果无法确定答案或解析，留空字符串
5. 保持 JSON 格式正确，不要添加 markdown 代码块标记，不要添加任何解释文字
6. 只返回 JSON 对象本身

【标准知识点列表】：
{knowledge_points_list}`;

const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

async function callLLM(content, subject, year, knowledgePointsList, retryCount = 0) {
  const maxContentLength = 10000;
  const truncated = content.length > maxContentLength ? content.substring(0, maxContentLength) : content;
  
  const subjectSpecific = SUBJECT_PROMPT_MAP[subject] || SUBJECT_PROMPT_MAP.math;
  
  const prompt = EXTRACTION_PROMPT_TEMPLATE
    .replace('{subject_specific}', subjectSpecific)
    .replace('{subject}', subject)
    .replace('{year}', year)
    .replace('{knowledge_points_list}', knowledgePointsList);
  
  const temperature = retryCount === 0 ? 0.1 : 0.3;
  const maxTokens = retryCount === 0 ? 4000 : 6000;
  
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手，擅长从试卷内容中提取结构化题目数据。请严格按照要求的JSON格式输出。' },
        { role: 'user', content: prompt + '\n\n以下是试卷内容：\n' + truncated }
      ],
      temperature: temperature,
      max_tokens: maxTokens
    })
  });

  const result = await response.json();
  
  if (result.error) {
    throw new Error('LLM 调用失败: ' + JSON.stringify(result));
  }
  
  if (result.choices && result.choices[0]) {
    return result.choices[0].message.content;
  }
  
  if (retryCount < 2) {
    console.log(`  🔄 重试第 ${retryCount + 1} 次...`);
    await new Promise(r => setTimeout(r, 1000));
    return callLLM(content, subject, year, knowledgePointsList, retryCount + 1);
  }
  
  throw new Error('LLM 未返回有效内容');
}

function extractJSON(text) {
  if (!text) return null;
  
  let cleaned = text.trim();
  
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }
  
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  
  let jsonStr = braceMatch[0];
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      const fixed = jsonStr
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");
      return JSON.parse(fixed);
    } catch (e2) {
      const result = parseFallbackJSON(jsonStr);
      if (result) return result;
      return null;
    }
  }
}

function parseFallbackJSON(str) {
  try {
    const questionsStart = str.indexOf('"questions"');
    if (questionsStart === -1) return null;
    
    const bracketStart = str.indexOf('[', questionsStart);
    if (bracketStart === -1) return null;
    
    const questions = [];
    let pos = bracketStart + 1;
    let depth = 1;
    let currentObj = '';
    
    while (pos < str.length && depth > 0) {
      const char = str[pos];
      
      if (char === '{') {
        depth++;
        currentObj += char;
      } else if (char === '}') {
        depth--;
        currentObj += char;
        if (depth === 1) {
          try {
            const q = JSON.parse(currentObj);
            if (q && (q.stem || q.number)) {
              questions.push(sanitizeQuestion(q));
            }
          } catch (e) {
            try {
              const fixed = currentObj
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '')
                .replace(/\t/g, ' ');
              const q = JSON.parse(fixed);
              if (q && (q.stem || q.number)) {
                questions.push(sanitizeQuestion(q));
              }
            } catch (e2) {
              // skip this question
            }
          }
          currentObj = '';
          pos++;
          while (pos < str.length && (str[pos] === ',' || str[pos] === ' ' || str[pos] === '\n' || str[pos] === '\r')) {
            pos++;
          }
          continue;
        }
      } else if (char === '[') {
        depth++;
        currentObj += char;
      } else {
        currentObj += char;
      }
      pos++;
    }
    
    if (questions.length > 0) {
      return {
        paper_info: { subject: 'math', year: 2025, province: 'beijing' },
        questions: questions
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function sanitizeQuestion(q) {
  return {
    number: q.number || 0,
    type: q.type || 'choice',
    stem: (q.stem || '').toString().substring(0, 2000),
    options: Array.isArray(q.options) ? q.options.map(o => (o || '').toString().substring(0, 500)) : null,
    answer: (q.answer || '').toString().substring(0, 500) || null,
    analysis: (q.analysis || '').toString().substring(0, 2000) || null,
    knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.map(k => (k || '').toString().substring(0, 100)) : null,
    difficulty: typeof q.difficulty === 'number' ? Math.max(1, Math.min(5, q.difficulty)) : null,
    score: typeof q.score === 'number' ? q.score : null
  };
}

function detectYear(filename) {
  const match = filename.match(/(20\d{2})/);
  return match ? parseInt(match[1]) : null;
}

function detectSubject(filename) {
  const name = filename.toLowerCase();
  if (name.includes('语文')) return 'chinese';
  if (name.includes('数学')) return 'math';
  if (name.includes('英语')) return 'english';
  if (name.includes('物理')) return 'physics';
  if (name.includes('化学')) return 'chemistry';
  if (name.includes('生物')) return 'biology';
  if (name.includes('政治')) return 'politics';
  if (name.includes('历史')) return 'history';
  if (name.includes('地理')) return 'geography';
  return null;
}

function detectProvince(dirname) {
  const name = dirname.toLowerCase();
  if (name.includes('北京')) return 'beijing';
  if (name.includes('上海')) return 'shanghai';
  if (name.includes('湖南')) return 'hunan';
  if (name.includes('湖北')) return 'hubei';
  if (name.includes('广东')) return 'guangdong';
  if (name.includes('江苏')) return 'jiangsu';
  if (name.includes('浙江')) return 'zhejiang';
  if (name.includes('山东')) return 'shandong';
  if (name.includes('河南')) return 'henan';
  if (name.includes('四川')) return 'sichuan';
  return null;
}

function scanFiles(dir, results = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        scanFiles(fullPath, results);
      } else {
        const ext = extname(entry).toLowerCase();
        if (['.doc', '.docx', '.pdf'].includes(ext)) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // skip
    }
  }
  return results;
}

function extractText(filePath) {
  const ext = extname(filePath).toLowerCase();
  const tmpScript = join(tmpdir(), `extract_text_${Date.now()}.py`);
  
  const script = `
import sys
import os

try:
    ext = '${ext}'
    path = r"""${filePath}"""
    if ext == '.pdf':
        try:
            import PyPDF2
            with open(path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                content = ''
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        content += text + '\\n'
                print(content)
        except ImportError:
            print('')
    elif ext in ['.doc', '.docx']:
        try:
            import docx
            doc = docx.Document(path)
            content = '\\n'.join([p.text for p in doc.paragraphs])
            for table in doc.tables:
                for row in table.rows:
                    cells = [cell.text for cell in row.cells]
                    content += '\\n' + ' | '.join(cells)
            print(content)
        except Exception as e:
            print('')
    else:
        print('')
except Exception as e:
    print('')
`;
  
  try {
    writeFileSync(tmpScript, script, 'utf-8');
    const output = execSync(`${PYTHON_CMD} "${tmpScript}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    });
    try { unlinkSync(tmpScript); } catch (e) {}
    return output || '';
  } catch (e) {
    try { unlinkSync(tmpScript); } catch (e2) {}
    return '';
  }
}

async function parseQuestions() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database');

  console.log('🔍 扫描试卷文件...\n');

  const allFiles = scanFiles(databaseDir);
  console.log(`📂 找到 ${allFiles.length} 个试卷文件\n`);

  const targetFiles = allFiles.filter(f => {
    const relPath = f.replace(databaseDir, '');
    return relPath.includes('北京高考') && 
           !relPath.includes('赠品') &&
           !relPath.includes('考前') &&
           !relPath.includes('答案') &&
           !relPath.includes('解析');
  });

  console.log(`🎯 筛选出 ${targetFiles.length} 个北京高考原卷文件\n`);

  const knowledgePointsCache = {};
  async function getKnowledgePointsList(subject) {
    if (knowledgePointsCache[subject]) return knowledgePointsCache[subject];
    
    const result = await pool.query(
      'SELECT name FROM knowledge_points WHERE subject = $1 ORDER BY frequency DESC, difficulty DESC',
      [subject]
    );
    
    const list = result.rows.map(r => r.name).join('\n');
    knowledgePointsCache[subject] = list;
    return list;
  }

  let totalParsed = 0;
  let totalQuestions = 0;
  let totalSkipped = 0;

  for (const filePath of targetFiles) {
    const filename = filePath.split('\\').pop().split('/').pop();
    const year = detectYear(filename);
    const subject = detectSubject(filename);
    const province = 'beijing';

    if (!year || !subject) {
      console.log(`⏭️  跳过（无法识别年份/学科）: ${filename}`);
      totalSkipped++;
      continue;
    }

    const paperResult = await pool.query(
      'SELECT id, question_count FROM exam_papers WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4',
      [province, year, subject, 'gaokao']
    );

    if (paperResult.rows.length > 0 && paperResult.rows[0].question_count > 0) {
      console.log(`⏭️  已解析跳过: ${year}年${subject} (${paperResult.rows[0].question_count} 题)`);
      totalSkipped++;
      continue;
    }

    console.log(`📄 解析: ${year}年 ${subject} - ${filename}`);

    try {
      const content = extractText(filePath);

      if (!content || content.trim().length < 100) {
        console.log(`  ⚠️  文件内容过短，跳过`);
        totalSkipped++;
        continue;
      }

      console.log(`  📝 文本长度: ${content.length} 字符`);
      console.log(`  📚 加载知识点列表...`);
      
      const knowledgePointsList = await getKnowledgePointsList(subject);
      console.log(`  🤖 调用 LLM 提取题目...`);

      const result = await callLLM(content, subject, year, knowledgePointsList);
      const data = extractJSON(result);

      if (!data || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        console.log(`  ⚠️  LLM 未返回有效题目，跳过`);
        totalSkipped++;
        continue;
      }

      let paperId;
      if (paperResult.rows.length > 0) {
        paperId = paperResult.rows[0].id;
        await pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);
      } else {
        const insertResult = await pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
          VALUES ($1, $2, $3, 'gaokao', $4)
          RETURNING id
        `, [province, year, subject, filePath]);
        paperId = insertResult.rows[0].id;
      }

      for (const q of data.questions) {
        await pool.query(`
          INSERT INTO exam_questions (
            paper_id, question_number, question_type, stem, options,
            answer, analysis, knowledge_points, difficulty, score,
            subject_code, province_code, year
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          paperId,
          q.number,
          q.type || 'choice',
          q.stem || '',
          q.options ? JSON.stringify(q.options) : null,
          q.answer || null,
          q.analysis || null,
          q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
          q.difficulty || null,
          q.score || null,
          subject,
          province,
          year
        ]);
      }

      await pool.query(`
        UPDATE exam_papers
        SET
          question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1),
          difficulty_avg = (SELECT AVG(difficulty) FROM exam_questions WHERE paper_id = $1 AND difficulty IS NOT NULL)
        WHERE id = $1
      `, [paperId]);

      totalParsed++;
      totalQuestions += data.questions.length;
      console.log(`  ✅ 提取 ${data.questions.length} 道题目`);

      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`  ❌ 失败: ${err.message}`);
      totalSkipped++;
    }
  }

  console.log(`\n✅ 解析完成！`);
  console.log(`  成功解析: ${totalParsed} 套试卷`);
  console.log(`  提取题目: ${totalQuestions} 道`);
  console.log(`  跳过: ${totalSkipped} 个`);

  const stats = await pool.query(`
    SELECT
      subject_code,
      COUNT(DISTINCT paper_id) as paper_count,
      COUNT(*) as question_count
    FROM exam_questions
    WHERE province_code = 'beijing' AND year IS NOT NULL
    GROUP BY subject_code
    ORDER BY question_count DESC
  `);

  console.log('\n📊 北京高考各学科题目统计:');
  for (const row of stats.rows) {
    console.log(`  ${row.subject_code}: ${row.question_count} 道 (${row.paper_count} 套试卷)`);
  }

  process.exit(0);
}

parseQuestions()
  .catch(err => {
    console.error('❌ 解析失败:', err.message);
    process.exit(1);
  });
