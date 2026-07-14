import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const papersToRetry = await db.query(`
    SELECT p.id as paper_id, p.province_code, p.year, p.subject, p.paper_file_path,
           COUNT(q.id) as total_questions,
           SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) as no_answer_count
    FROM exam_papers p
    LEFT JOIN exam_questions q ON p.id = q.paper_id
    WHERE p.exam_level = 'gaokao' AND p.paper_file_path IS NOT NULL
    GROUP BY p.id, p.province_code, p.year, p.subject, p.paper_file_path
    HAVING SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) > 0
       AND COUNT(q.id) > 0
    ORDER BY no_answer_count DESC
  `);
  
  console.log(`需要重新解析答案/解析的试卷数: ${papersToRetry.rows.length}`);
  
  const paperIds = papersToRetry.rows.map(p => p.paper_id);
  
  if (paperIds.length > 0) {
    await db.query(`DELETE FROM exam_questions WHERE paper_id IN (${paperIds.join(',')})`);
    
    await db.query(`UPDATE exam_papers SET question_count = 0, total_score = 0 WHERE id IN (${paperIds.join(',')})`);
    
    console.log(`已删除 ${paperIds.length} 份试卷的题目记录`);
    console.log('现在运行 parse-questions-v3.js 重新解析这些试卷');
  }
  
  await db.end();
}

run().catch(console.error);