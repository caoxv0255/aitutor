import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const res = await db.query(`
    SELECT id, province_code, year, paper_file_path 
    FROM exam_papers 
    WHERE subject = 'math' AND year < 2020 
    ORDER BY year DESC, province_code 
    LIMIT 30
  `);
  
  console.log('=== 老年份数学试卷样本 ===');
  console.table(res.rows);
  
  const mathCount = await db.query(`
    SELECT year, COUNT(*) as count 
    FROM exam_papers 
    WHERE subject = 'math' AND exam_level = 'gaokao' 
    GROUP BY year 
    ORDER BY year
  `);
  console.log('\n=== 各年数学试卷数量 ===');
  console.table(mathCount.rows);
}

run().catch(console.error);