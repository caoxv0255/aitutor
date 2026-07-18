import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();
  const result = await db.query(`
    SELECT 
      eq.subject_code,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE eq.semantic_description IS NOT NULL) as enhanced
    FROM exam_questions eq
    JOIN exam_papers p ON eq.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
    GROUP BY eq.subject_code
    ORDER BY eq.subject_code
  `);
  console.log('北京高考各科AI增强统计:');
  console.log('='.repeat(60));
  console.log('学科'.padEnd(10), '总数'.padEnd(8), '已增强'.padEnd(8), '完成率');
  console.log('-'.repeat(60));
  let total = 0, enh = 0;
  for (const row of result.rows) {
    const pct = row.total > 0 ? (row.enhanced / row.total * 100).toFixed(1) + '%' : '0%';
    console.log(
      row.subject_code.padEnd(10),
      String(row.total).padEnd(8),
      String(row.enhanced).padEnd(8),
      pct
    );
    total += parseInt(row.total);
    enh += parseInt(row.enhanced);
  }
  console.log('-'.repeat(60));
  console.log('合计'.padEnd(10), String(total).padEnd(8), String(enh).padEnd(8), (enh/total*100).toFixed(1)+'%');
  process.exit(0);
}
main().catch(console.error);