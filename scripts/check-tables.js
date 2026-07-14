import { getDb } from '../api/core/db.js';

const pool = await getDb();
const r = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'exam_questions'
  ORDER BY ordinal_position
`);
console.log('exam_questions 表字段:');
r.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

console.log('\nquestion_vectors 表字段:');
const r2 = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'question_vectors'
  ORDER BY ordinal_position
`);
r2.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

await pool.end();