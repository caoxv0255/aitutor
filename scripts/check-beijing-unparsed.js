import { getDb } from '../api/core/db.js';
const db = await getDb();

const distRes = await db.query(`
  SELECT question_count, count(*) as cnt
  FROM exam_papers
  WHERE province_code = 'beijing' AND exam_level = 'gaokao'
  GROUP BY question_count ORDER BY question_count
`);
console.log('Beijing gaokao question_count distribution:');
for (const r of distRes.rows) {
  console.log(`  count=${r.question_count}: ${r.cnt} papers`);
}

const nullRes = await db.query(`
  SELECT id, year, subject, math_type, paper_file_path
  FROM exam_papers
  WHERE province_code = 'beijing' AND exam_level = 'gaokao'
  AND (question_count IS NULL OR question_count = 0)
  ORDER BY year, subject
`);
console.log(`\nBeijing papers with NULL/0 count: ${nullRes.rows.length}`);
for (const r of nullRes.rows) {
  console.log(`  ${r.year} ${r.subject} (${r.math_type}): ${r.paper_file_path}`);
}
process.exit(0);
