import { getDb } from '../api/core/db.js';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

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
    ORDER BY p.year DESC, p.province_code
    LIMIT 20
  `);
  
  console.log(`需要重新解析答案/解析的试卷数(前20份): ${papersToRetry.rows.length}`);
  
  for (const paper of papersToRetry.rows) {
    const fullPath = join(ROOT, paper.paper_file_path);
    
    if (!existsSync(fullPath)) {
      console.log(`跳过: 文件不存在 ${paper.paper_file_path}`);
      continue;
    }
    
    console.log(`\n正在重新解析: ${paper.province_code} ${paper.year} ${paper.subject}`);
    
    try {
      await db.query('DELETE FROM exam_questions WHERE paper_id = $1', [paper.paper_id]);
      
      const result = await import('./retry-failed-papers.js');
      if (result.parsePaper) {
        await result.parsePaper(paper.paper_id, paper.province_code, paper.year, paper.subject, paper.paper_file_path);
      }
      
      console.log(`成功: ${paper.province_code} ${paper.year} ${paper.subject}`);
    } catch (error) {
      console.log(`失败: ${paper.province_code} ${paper.year} ${paper.subject} - ${error.message}`);
    }
  }
  
  await db.end();
}

run().catch(console.error);