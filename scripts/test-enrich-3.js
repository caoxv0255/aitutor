import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY?.substring(0, 15));
console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30));

import { getDb } from '../api/core/db.js';
import { generateSemanticDescription, generateSolutionDescription, parseMathStructure } from '../services/subject-parser.js';

const pool = await getDb();

const r = await pool.query(`
  SELECT q.id, q.stem, q.options, q.answer, q.analysis, q.subject_code
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND q.subject_code = 'math'
    AND (q.semantic_description IS NULL OR q.semantic_description = '')
  LIMIT 3
`);
console.log(`\n找到 ${r.rows.length} 道待处理数学题`);

for (const q of r.rows) {
  console.log(`\n--- 处理题目 #${q.id} ---`);
  console.log(`题干: ${(q.stem || '').substring(0, 60)}...`);

  // 1. 语义描述
  console.log('生成语义描述...');
  try {
    const sem = await generateSemanticDescription(q.stem, q.subject_code);
    console.log(`语义: "${sem?.substring(0, 80)}"`);
  } catch (e) {
    console.log(`语义失败: ${e.message}`);
  }

  // 2. 解法描述
  console.log('生成解法描述...');
  try {
    const sol = await generateSolutionDescription(q.stem, q.answer, q.analysis, q.subject_code);
    console.log(`解法: "${sol?.substring(0, 80)}"`);
  } catch (e) {
    console.log(`解法失败: ${e.message}`);
  }

  // 3. 数学结构
  console.log('解析数学结构...');
  try {
    const m = await parseMathStructure(q.stem);
    console.log(`结构: problem_type=${m.problem_type}, techniques=${m.techniques?.join(',')}`);
  } catch (e) {
    console.log(`结构失败: ${e.message}`);
  }
}

await pool.end();
