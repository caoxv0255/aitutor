#!/usr/bin/env node
/**
 * 批量难度校正脚本
 * 用 LLM + 明确难度标准，批量重新标注已有题目的难度
 * 每次送 10 道题给 LLM，节省 token
 */
import { getDb } from '../api/core/db.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const BATCH_SIZE = 10;
const CONCURRENCY = 2;

const DIFFICULTY_PROMPT = `你是一位有15年教学经验的高考命题专家。请根据以下标准，判断这些高考题的难度等级。

【难度分级标准】
1分（简单）：直接套用单一概念或公式，一步得出答案，送分题
2分（较易）：需要1-2个知识点，简单计算或推理，稍加思考即可
3分（中等）：需要2-3个知识点组合，多步骤计算或中等阅读量，常规题型
4分（较难）：需要综合运用多个知识点，复杂计算或推理，有一定陷阱，区分度高
5分（困难）：跨模块综合题，需要创造性思维或复杂推导，通常是压轴题或最后一题

【位置参考（仅作辅助，以内容判断为准）】
- 选择题：第1-3题≈1-2分，中间题≈3分，最后1-2题≈4分
- 填空题：前几道≈2-3分，最后一道≈4分
- 解答题：前2-3道≈3分，中间2道≈4分，最后1道≈5分

请按以下 JSON 格式返回每道题的难度等级（只返回 JSON，不要其他内容）：
{
  "results": [
    {"id": 1, "difficulty": 3}
  ]
}

以下是题目列表（每题含 id、题型、在试卷中的位置、题干）：
{questions_text}
`;

async function callLLM(questions, retryCount = 0) {
  const questionsText = questions.map((q, i) => {
    const stemShort = q.stem.substring(0, 300).replace(/\n/g, ' ');
    const typeMap = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    const typeCN = typeMap[q.question_type] || q.question_type;
    return `题目${i + 1}（id=${q.id}，题型：${typeCN}，分值：${q.score || '未知'}分）：${stemShort}`;
  }).join('\n\n');

  const prompt = DIFFICULTY_PROMPT.replace('{questions_text}', questionsText);

  const temperature = retryCount === 0 ? 0.1 : 0.2;

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是高考命题专家，擅长评估题目难度。请严格按照给定标准判断。' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: 2000
      })
    });

    const result = await response.json();
    if (result.error) {
      if (retryCount < 2) {
        console.log(`    🔄 LLM错误重试 ${retryCount + 1}...`);
        await new Promise(r => setTimeout(r, 2000));
        return callLLM(questions, retryCount + 1);
      }
      throw new Error('LLM 调用失败: ' + JSON.stringify(result.error));
    }

    const content = result.choices?.[0]?.message?.content;
    return parseJSON(content);
  } catch (e) {
    if (retryCount < 2) {
      console.log(`    🔄 网络错误重试 ${retryCount + 1}: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
      return callLLM(questions, retryCount + 1);
    }
    throw e;
  }
}

function parseJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) cleaned = codeBlockMatch[1];
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  try { return JSON.parse(braceMatch[0]); } catch {}
  try {
    return JSON.parse(braceMatch[0].replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
  } catch {}
  return null;
}

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

async function updateDifficulty() {
  const pool = await getDb();

  // 获取所有需要校正的题目
  const allResult = await pool.query(`
    SELECT id, question_type, question_number, stem, score, paper_id
    FROM exam_questions
    WHERE difficulty IS NULL OR difficulty = 3
    ORDER BY paper_id, question_number
  `);

  const questions = allResult.rows;
  console.log(`📊 待校正题目: ${questions.length} 道\n`);

  if (questions.length === 0) {
    console.log('✅ 没有需要校正的题目');
    process.exit(0);
  }

  // 按 paper_id 分组，确保同一试卷的题在一起（LLM 可以参考位置信息）
  const byPaper = {};
  for (const q of questions) {
    if (!byPaper[q.paper_id]) byPaper[q.paper_id] = [];
    byPaper[q.paper_id].push(q);
  }
  console.log(`📄 涉及试卷: ${Object.keys(byPaper).length} 份\n`);

  // 组装批次
  const batches = [];
  let currentBatch = [];
  for (const paperId of Object.keys(byPaper)) {
    const paperQuestions = byPaper[paperId];
    // 获取该试卷中该题型的总数，用于位置参考
    for (const q of paperQuestions) {
      if (currentBatch.length >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      currentBatch.push(q);
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  console.log(`📦 分批数: ${batches.length} 批 (每批最多${BATCH_SIZE}题)\n`);

  let updated = 0;
  let failed = 0;

  const tasks = batches.map((batch, batchIdx) => async () => {
    const startIdx = batchIdx * BATCH_SIZE + 1;
    try {
      const result = await callLLM(batch);
      if (!result || !result.results || !Array.isArray(result.results)) {
        console.log(`  ⚠️  第${batchIdx + 1}批解析失败`);
        failed += batch.length;
        return;
      }

      const resultMap = {};
      for (const r of result.results) {
        if (r.id && r.difficulty && r.difficulty >= 1 && r.difficulty <= 5) {
          resultMap[r.id] = Math.round(r.difficulty);
        }
      }

      for (const q of batch) {
        if (resultMap[q.id]) {
          await pool.query(
            'UPDATE exam_questions SET difficulty = $1 WHERE id = $2',
            [resultMap[q.id], q.id]
          );
          updated++;
        } else {
          failed++;
        }
      }

      const successCount = Object.keys(resultMap).length;
      console.log(`  ✅ 第${batchIdx + 1}/${batches.length}批: ${successCount}/${batch.length}题`);

      // 速率限制
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ❌ 第${batchIdx + 1}批失败: ${err.message}`);
      failed += batch.length;
    }
  });

  console.log(`🚀 开始批量校正 (并发=${CONCURRENCY})...\n`);
  await runConcurrent(tasks, CONCURRENCY);

  // 更新试卷难度平均值
  console.log('\n🔄 更新试卷难度平均值...');
  await pool.query(`
    UPDATE exam_papers ep SET
      difficulty_avg = (
        SELECT AVG(eq.difficulty)
        FROM exam_questions eq
        WHERE eq.paper_id = ep.id AND eq.difficulty IS NOT NULL
      )
    WHERE EXISTS (
      SELECT 1 FROM exam_questions eq WHERE eq.paper_id = ep.id
    )
  `);

  // 统计最终分布
  const stats = await pool.query(`
    SELECT difficulty, COUNT(*) as cnt FROM exam_questions
    WHERE difficulty IS NOT NULL
    GROUP BY difficulty ORDER BY difficulty
  `);

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ 难度校正完成！');
  console.log(`  更新成功: ${updated} 道`);
  console.log(`  失败: ${failed} 道`);
  console.log('\n📊 校正后难度分布:');
  const total = stats.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
  for (const row of stats.rows) {
    const pct = total > 0 ? (row.cnt / total * 100).toFixed(1) : 0;
    const bar = '█'.repeat(Math.round(row.cnt / total * 30));
    const names = ['', '简单', '较易', '中等', '较难', '困难'];
    console.log(`  ${row.difficulty} (${names[row.difficulty] || '?'}): ${String(row.cnt).padStart(5)}题 ${pct.padStart(5)}% ${bar}`);
  }

  // 按题型的平均难度
  const typeStats = await pool.query(`
    SELECT question_type, COUNT(*) as cnt, ROUND(AVG(difficulty)::numeric, 2) as avg_diff
    FROM exam_questions WHERE difficulty IS NOT NULL
    GROUP BY question_type ORDER BY avg_diff
  `);
  console.log('\n📊 各题型平均难度:');
  for (const row of typeStats.rows) {
    const typeMap = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    const name = typeMap[row.question_type] || row.question_type;
    console.log(`  ${name.padEnd(6)}: ${String(row.cnt).padStart(5)}题, 平均难度 ${row.avg_diff}`);
  }

  await pool.end();
  process.exit(0);
}

updateDifficulty().catch(err => {
  console.error('❌ 难度校正失败:', err.message);
  process.exit(1);
});
