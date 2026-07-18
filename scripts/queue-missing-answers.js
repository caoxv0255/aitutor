import { getDb } from '../api/core/db.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function run() {
  const db = await getDb();
  
  const papersToRetry = await db.query(`
    SELECT p.id as paper_id, p.province_code, p.year, p.subject, p.paper_file_path
    FROM exam_papers p
    LEFT JOIN exam_questions q ON p.id = q.paper_id
    WHERE p.exam_level = 'gaokao' AND p.paper_file_path IS NOT NULL
    GROUP BY p.id, p.province_code, p.year, p.subject, p.paper_file_path
    HAVING SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) > 0
       AND COUNT(q.id) > 0
       AND SUM(CASE WHEN q.answer IS NOT NULL AND TRIM(q.answer) != '' THEN 1 ELSE 0 END) < COUNT(q.id)
    ORDER BY p.year DESC, p.province_code
  `);
  
  console.log(`需要重新解析答案/解析的试卷数: ${papersToRetry.rows.length}`);
  
  const validPapers = [];
  for (const paper of papersToRetry.rows) {
    const fullPath = join(ROOT, paper.paper_file_path);
    if (existsSync(fullPath)) {
      validPapers.push(paper);
    }
  }
  
  console.log(`文件存在的试卷数: ${validPapers.length}`);
  
  await db.query(`
    INSERT INTO exam_papers_to_retry (paper_id, province_code, year, subject, paper_file_path, retry_reason)
    SELECT id, province_code, year, subject, paper_file_path, 'missing_answer_analysis'
    FROM exam_papers
    WHERE id IN (${validPapers.map(p => p.paper_id).join(',')})
    ON CONFLICT (paper_id) DO UPDATE SET retry_reason = 'missing_answer_analysis'
  `);
  
  console.log(`已添加 ${validPapers.length} 份试卷到重试队列`);
  
  await db.end();
}

run().catch(console.error);