import { getDb } from '../api/core/db.js';
import { generateSemanticDescription, generateSolutionDescription } from '../services/subject-parser.js';

async function main() {
  const db = await getDb();
  const r = await db.query(`
    SELECT q.id, q.stem, q.answer, q.analysis 
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
      AND q.subject_code = 'english' AND q.semantic_description IS NULL
    LIMIT 5
  `);
  console.log('测试5道英语题...');
  let total = 0;
  for (let i = 0; i < r.rows.length; i++) {
    const q = r.rows[i];
    const t0 = Date.now();
    try {
      await generateSemanticDescription(q.stem, 'english');
      await generateSolutionDescription(q.stem, q.answer, q.analysis, 'english');
      const dt = Date.now() - t0;
      total += dt;
      console.log(`  题${i+1}: ${dt}ms`);
    } catch(e) {
      console.log(`  题${i+1}失败: ${e.message.substring(0,50)}`);
    }
  }
  const avg = Math.round(total / r.rows.length);
  console.log(`\n平均: ${avg}ms/题`);
  console.log(`预计759题总耗时: ${Math.round(avg * 759 / 1000 / 60)} 分钟`);
  process.exit(0);
}
main().catch(console.error);