import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();
  const r = await db.query(`
    SELECT 
      q.question_type,
      COUNT(*) as cnt,
      AVG(LENGTH(q.stem)) as avg_len,
      MAX(LENGTH(q.stem)) as max_len
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
      AND q.subject_code = 'english'
    GROUP BY q.question_type
    ORDER BY cnt DESC
  `);
  console.log('英语题型分布:');
  console.log('='.repeat(70));
  for (const row of r.rows) {
    console.log(
      row.question_type?.padEnd(20) || 'unknown'.padEnd(20),
      String(row.cnt).padEnd(8),
      '平均长度:', Math.round(row.avg_len),
      '最大长度:', row.max_len
    );
  }
  process.exit(0);
}
main().catch(console.error);