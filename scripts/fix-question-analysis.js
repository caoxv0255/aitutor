#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const CONCURRENCY = 2;
const DELAY_MS = 1000;

const SUBJECT_MAP = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const SUBJECT_PROMPT = {
  chinese: '这是一道语文高考题。请分析题干，给出答案和详细解析。解析要涵盖题目考查的知识点、解题思路和答题技巧。',
  math: '这是一道数学高考题。请分析题干，给出答案和详细解析。公式用LaTeX格式表示。解析要包含解题步骤和关键公式。',
  english: '这是一道英语高考题。请分析题干，给出答案和详细解析。解析要说明语法点、词汇用法和解题思路。',
  physics: '这是一道物理高考题。请分析题干，给出答案和详细解析。解析要包含物理原理、公式应用和计算过程。',
  chemistry: '这是一道化学高考题。请分析题干，给出答案和详细解析。解析要包含化学反应原理、方程式和解题思路。',
  biology: '这是一道生物高考题。请分析题干，给出答案和详细解析。解析要包含生物学概念、原理和解题思路。',
  politics: '这是一道政治高考题。请分析题干，给出答案和详细解析。解析要包含政治理论、基本概念和解题思路。',
  history: '这是一道历史高考题。请分析题干，给出答案和详细解析。解析要包含历史背景、事件分析和解题思路。',
  geography: '这是一道地理高考题。请分析题干，给出答案和详细解析。解析要包含地理原理、图表分析和解题思路。',
};

async function callLLM(question, subject) {
  const subjectHint = SUBJECT_PROMPT[subject] || SUBJECT_PROMPT.math;
  
  let prompt = `${subjectHint}\n\n`;
  prompt += `请分析以下高考题目，返回JSON格式的答案：\n\n`;
  prompt += `题目类型：${question.question_type}\n`;
  prompt += `题干：${question.stem}\n`;
  
  if (question.options) {
    try {
      const opts = JSON.parse(question.options);
      prompt += `选项：${opts.join('\n')}\n`;
    } catch {
      prompt += `选项：${question.options}\n`;
    }
  }
  
  prompt += `\n返回格式（严格JSON）：\n`;
  prompt += `{\n`;
  prompt += `  "answer": "答案内容",\n`;
  prompt += `  "analysis": "详细解析，包含知识点、解题思路、答题方法",\n`;
  prompt += `  "difficulty": 3\n`;
  prompt += `}\n`;
  prompt += `说明：difficulty为1-5的整数，表示难度等级（1简单，5困难）。`;

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的高考题目解析助手。请严格按照JSON格式输出，不要添加任何解释。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 3000
    })
  });

  const result = await response.json();
  
  if (result.error) {
    throw new Error('LLM调用失败: ' + JSON.stringify(result.error));
  }
  
  if (result.choices && result.choices[0]) {
    return result.choices[0].message.content;
  }
  
  throw new Error('LLM未返回有效内容');
}

function parseLLMResponse(text) {
  if (!text) return null;
  
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) cleaned = codeBlockMatch[1];
  
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  
  let jsonStr = braceMatch[0];
  
  try {
    return JSON.parse(jsonStr);
  } catch {}
  
  try {
    return JSON.parse(jsonStr.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
  } catch {}
  
  return null;
}

async function main() {
  const pool = await getDb();
  
  console.log('='.repeat(70));
  console.log('🔧 题目解析修复脚本');
  console.log('='.repeat(70));
  
  const subjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'politics', 'history', 'geography'];
  
  for (const subject of subjects) {
    console.log(`\n📚 处理学科: ${SUBJECT_MAP[subject] || subject}`);
    
    const res = await pool.query(`
      SELECT id, question_number, question_type, stem, options, answer, analysis, difficulty 
      FROM exam_questions 
      WHERE subject_code = $1 AND province_code = 'beijing' AND year BETWEEN 2021 AND 2025
        AND ((analysis IS NULL OR analysis = '') OR (answer IS NULL OR answer = '') OR difficulty IS NULL)
      ORDER BY year, question_number
    `, [subject]);
    
    const questions = res.rows;
    console.log(`  待修复题目数: ${questions.length}`);
    
    if (questions.length === 0) {
      console.log('  ✅ 无需修复');
      continue;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      console.log(`    处理第 ${q.question_number} 题 (${i+1}/${questions.length})...`);
      
      try {
        const llmResult = await callLLM(q, subject);
        const parsed = parseLLMResponse(llmResult);
        
        if (parsed) {
          const updateFields = [];
          const updateValues = [];
          let paramIndex = 1;
          
          if (parsed.answer && (!q.answer || q.answer === '')) {
            updateFields.push(`answer = $${paramIndex++}`);
            updateValues.push(parsed.answer);
          }
          
          if (parsed.analysis && (!q.analysis || q.analysis === '')) {
            updateFields.push(`analysis = $${paramIndex++}`);
            updateValues.push(parsed.analysis);
          }
          
          if (parsed.difficulty && !q.difficulty) {
            updateFields.push(`difficulty = $${paramIndex++}`);
            updateValues.push(Math.max(1, Math.min(5, Math.round(parsed.difficulty))));
          }
          
          if (updateFields.length > 0) {
            updateValues.push(q.id);
            await pool.query(`
              UPDATE exam_questions SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}
            `, updateValues);
            
            successCount++;
            console.log(`      ✅ 修复成功 (${parsed.answer ? '答案' : ''}${parsed.analysis ? '解析' : ''}${parsed.difficulty ? '难度' : ''})`);
          } else {
            console.log(`      ⏭️  无需更新`);
            successCount++;
          }
        } else {
          console.log(`      ❌ LLM返回无效JSON`);
          failCount++;
        }
        
        await new Promise(r => setTimeout(r, DELAY_MS));
        
      } catch (err) {
        console.log(`      ❌ 错误: ${err.message}`);
        failCount++;
      }
    }
    
    console.log(`  📊 完成: ${successCount}成功, ${failCount}失败`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🔧 修复完成!');
  console.log('='.repeat(70));
  
  await pool.end();
}

main().catch(err => {
  console.error('修复失败:', err.message);
  process.exit(1);
});