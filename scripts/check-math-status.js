import { getDb } from '../api/core/db.js';
const pool = await getDb();
const r = await pool.query(`
  SELECT COUNT(*) as total,
    COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') as has_sem,
    COUNT(*) FILTER (WHERE solution_description IS NOT NULL AND solution_description != '') as has_sol,
    COUNT(*) FILTER (WHERE math_structure IS NOT NULL AND math_structure != '{}') as has_struct
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND q.subject_code = 'math'
`);
console.log('北京数学统计:', JSON.stringify(r.rows[0]));

const sample = await pool.query(`
  SELECT id, semantic_description, solution_description, math_structure
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND q.subject_code = 'math'
    AND q.semantic_description IS NOT NULL AND q.semantic_description != ''
  LIMIT 2
`);
console.log('\n有语义描述的样本:', sample.rows.length);
sample.rows.forEach(r => {
  console.log(`  #${r.id}: sem="${r.semantic_description?.substring(0, 80)}"`);
});
await pool.end();
