#!/usr/bin/env node
/**
 * 试卷题目解析脚本
 * 使用 LLM 解析 PDF/DOCX 文件，提取结构化题目数据
 */
import { getDb } from '../api/db.js';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// LLM 配置
const LLM_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const LLM_KEY = process.env.DASHSCOPE_API_KEY;
const LLM_MODEL = 'qwen-plus';

// 题目提取 Prompt
const EXTRACTION_PROMPT = `请从以下高考试卷内容中提取所有题目，按以下格式返回 JSON（不要添加任何其他内容）：

{
  "paper_info": {
    "subject": "math",
    "year": 2025,
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
      "knowledge_points": ["函数", "导数"],
      "difficulty": 3,
      "score": 5
    }
  ]
}

注意：
1. type 只能是：choice（单选）, multi_choice（多选）, fill（填空）, solve（解答）
2. difficulty 范围 1-5
3. knowledge_points 是数组，包含该题考查的知识点
4. 如果无法确定答案或解析，留空字符串
5. 保持 JSON 格式正确`;

async function callLLM(content) {
  const response = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考试卷题目提取助手，擅长从试卷内容中提取结构化题目数据。' },
        { role: 'user', content: EXTRACTION_PROMPT + '\n\n以下是试卷内容：\n' + content }
      ],
      temperature: 0.1,
      max_tokens: 4000
    })
  });

  const result = await response.json();
  if (result.choices && result.choices[0]) {
    return result.choices[0].message.content;
  }
  throw new Error('LLM 调用失败: ' + JSON.stringify(result));
}

function extractJSON(text) {
  // 尝试从文本中提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // 尝试修复常见问题
      const fixed = jsonMatch[0]
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/，/g, ',')
        .replace(/：/g, ':');
      return JSON.parse(fixed);
    }
  }
  return null;
}

async function parseQuestions() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database');

  console.log('🔍 开始解析试卷题目...\n');

  const entries = readdirSync(databaseDir);
  let totalParsed = 0;
  let totalQuestions = 0;

  for (const entry of entries) {
    const entryPath = join(databaseDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    // 扫描文件
    const files = readdirSync(entryPath);
    for (const file of files) {
      const filePath = join(entryPath, file);
      if (statSync(filePath).isDirectory()) continue;

      const ext = extname(file).toLowerCase();
      if (!['.doc', '.docx', '.pdf', '.txt'].includes(ext)) continue;

      console.log(`📄 解析: ${file}`);

      try {
        // 读取文件内容（简化版：直接读取文本，实际应使用专门的 PDF/DOCX 解析库）
        let content = '';
        if (ext === '.txt') {
          content = readFileSync(filePath, 'utf-8');
        } else {
          // 对于 PDF/DOCX，使用 python 脚本提取文本
          try {
            content = execSync(`python3 -c "
import sys
try:
    if '${ext}' == '.pdf':
        import PyPDF2
        with open('${filePath}', 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            content = ''
            for page in reader.pages:
                content += page.extract_text() + '\\n'
            print(content)
    elif '${ext}' in ['.doc', '.docx']:
        import docx
        doc = docx.Document('${filePath}')
        content = '\\n'.join([p.text for p in doc.paragraphs])
        print(content)
except Exception as e:
    print('ERROR: ' + str(e))
"`, { encoding: 'utf-8', timeout: 30000 });
          } catch (e) {
            console.log(`  ⚠️  文件解析失败，跳过: ${e.message}`);
            continue;
          }
        }

        if (!content || content.trim().length < 100) {
          console.log(`  ⚠️  文件内容过短，跳过`);
          continue;
        }

        // 调用 LLM 提取题目
        const result = await callLLM(content);
        const data = extractJSON(result);

        if (!data || !data.questions || !Array.isArray(data.questions)) {
          console.log(`  ⚠️  LLM 未返回有效题目，跳过`);
          continue;
        }

        const { paper_info, questions } = data;
        const province = paper_info.province || 'beijing';
        const year = paper_info.year || 2025;
        const subject = paper_info.subject || 'math';

        // 查找或创建试卷记录
        const paperResult = await pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
          VALUES ($1, $2, $3, 'gaokao', $4)
          ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
            paper_file_path = EXCLUDED.paper_file_path
          RETURNING id
        `, [province, year, subject, file]);

        const paperId = paperResult.rows[0].id;

        // 插入题目
        for (const q of questions) {
          await pool.query(`
            INSERT INTO exam_questions (
              paper_id, question_number, question_type, stem, options,
              answer, analysis, knowledge_points, difficulty, ability_tags, score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (paper_id, question_number) DO UPDATE SET
              stem = EXCLUDED.stem,
              options = EXCLUDED.options,
              answer = EXCLUDED.answer,
              analysis = EXCLUDED.analysis
          `, [
            paperId,
            q.number,
            q.type || 'choice',
            q.stem,
            q.options ? JSON.stringify(q.options) : null,
            q.answer || null,
            q.analysis || null,
            q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
            q.difficulty || null,
            q.ability_tags ? JSON.stringify(q.ability_tags) : null,
            q.score || null
          ]);
        }

        // 更新试卷的题目数量和平均难度
        await pool.query(`
          UPDATE exam_papers
          SET
            question_count = (SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1),
            difficulty_avg = (SELECT AVG(difficulty) FROM exam_questions WHERE paper_id = $1 AND difficulty IS NOT NULL)
          WHERE id = $1
        `, [paperId]);

        totalParsed++;
        totalQuestions += questions.length;
        console.log(`  ✅ 提取 ${questions.length} 道题目`);

      } catch (err) {
        console.error(`  ❌ 失败: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ 解析完成！共解析 ${totalParsed} 个文件，提取 ${totalQuestions} 道题目`);

  // 显示统计
  const stats = await pool.query(`
    SELECT
      province_code,
      COUNT(DISTINCT paper_id) as paper_count,
      COUNT(*) as question_count
    FROM exam_questions
    GROUP BY province_code
    ORDER BY question_count DESC
  `);

  console.log('\n📊 各省份题目统计:');
  for (const row of stats.rows) {
    console.log(`  ${row.province_code}: ${row.question_count} 道 (${row.paper_count} 套试卷)`);
  }
}

parseQuestions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 解析失败:', err.message);
    process.exit(1);
  });
