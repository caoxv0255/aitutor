import { getDb } from '../api/core/db.js';
const pool = await getDb();
const r = await pool.query(`
  SELECT id, subject_code, semantic_description, solution_description, math_structure
  FROM exam_questions
  WHERE subject_code = 'math' AND semantic_description IS NOT NULL AND semantic_description != ''
  LIMIT 3
`);
console.log('数学有语义描述的题目:', r.rows.length);
r.rows.forEach(row => {
  console.log(`  #${row.id}: semantic="${row.semantic_description?.substring(0, 80)}..."`);
  console.log(`    solution="${row.solution_description?.substring(0, 80)}..."`);
  console.log(`    math_structure keys: ${Object.keys(row.math_structure || {}).join(', ')}`);
});
const total = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') AS has_sem
  FROM exam_questions
  WHERE subject_code = 'math'
`);
console.log('\n数学统计:', JSON.stringify(total.rows[0]));
await pool.end();