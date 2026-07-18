import { getDb } from '../api/core/db.js';
import { generateSemanticDescription } from '../services/subject-parser.js';

async function main() {
  const db = await getDb();
  const r = await db.query(`
    SELECT q.id, q.stem, q.subject_code
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
      AND q.subject_code = 'english' AND q.semantic_description IS NULL
    LIMIT 1
  `);
  if (r.rows.length === 0) {
    console.log('没有待处理的英语题');
    process.exit(0);
  }
  const q = r.rows[0];
  console.log('题目ID:', q.id);
  console.log('题目长度:', q.stem?.length);
  console.log('题目前200字:', q.stem?.slice(0, 200));
  console.log();
  console.log('调用 LLM...');
  const t0 = Date.now();
  try {
    const result = await generateSemanticDescription(q.stem, 'english');
    console.log('耗时:', Date.now() - t0, 'ms');
    console.log('结果:', result);
  } catch (e) {
    console.log('错误:', e.message);
  }
  process.exit(0);
}
main().catch(console.error);