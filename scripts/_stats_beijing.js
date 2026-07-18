import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();
  const result = await db.query(`
    SELECT 
      eq.subject_code,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE semantic_description IS NOT NULL) as enhanced,
      COUNT(*) FILTER (WHERE qv.q_embedding IS NOT NULL) as has_vectors
    FROM exam_questions eq
    LEFT JOIN question_vectors qv ON eq.id = qv.question_id
    WHERE eq.province_code = 'beijing'
    GROUP BY eq.subject_code
    ORDER BY eq.subject_code
  `);
  console.log('北京地区各科数据统计:');
  console.log('='.repeat(70));
  console.log('学科'.padEnd(10), '总数'.padEnd(8), 'AI增强'.padEnd(8), '有向量'.padEnd(8));
  console.log('-'.repeat(70));
  let total = 0, enh = 0, vec = 0;
  for (const row of result.rows) {
    console.log(
      row.subject_code.padEnd(10),
      String(row.total).padEnd(8),
      String(row.enhanced).padEnd(8),
      String(row.has_vectors).padEnd(8)
    );
    total += parseInt(row.total);
    enh += parseInt(row.enhanced);
    vec += parseInt(row.has_vectors);
  }
  console.log('-'.repeat(70));
  console.log('合计'.padEnd(10), String(total).padEnd(8), String(enh).padEnd(8), String(vec).padEnd(8));
  process.exit(0);
}
main().catch(console.error);