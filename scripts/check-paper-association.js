#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  console.log('检查题目与试卷关联情况...');
  
  const totalRes = await pool.query(`
    SELECT COUNT(*) as total 
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
  `);
  
  const joinedRes = await pool.query(`
    SELECT COUNT(*) as joined 
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      AND ep.exam_level = 'gaokao'
  `);
  
  const noPaperRes = await pool.query(`
    SELECT COUNT(*) as no_paper 
    FROM exam_questions eq
    LEFT JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      AND ep.id IS NULL
  `);
  
  const diffLevelRes = await pool.query(`
    SELECT ep.exam_level, COUNT(*) as cnt 
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
    GROUP BY ep.exam_level
  `);
  
  console.log(`\n北京2021-2025年题目总数: ${totalRes.rows[0].total}`);
  console.log(`关联到gaokao试卷的题目数: ${joinedRes.rows[0].joined}`);
  console.log(`未关联到试卷的题目数: ${noPaperRes.rows[0].no_paper}`);
  
  console.log('\nexam_level分布:');
  diffLevelRes.rows.forEach(r => {
    console.log(`  ${r.exam_level}: ${r.cnt} 题`);
  });
  
  const noPaperDetails = await pool.query(`
    SELECT id, subject_code, year, question_number, paper_id 
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
      AND paper_id IS NULL
    LIMIT 10
  `);
  
  console.log('\n没有paper_id的题目样本:');
  noPaperDetails.rows.forEach(r => {
    console.log(`  [${r.subject_code}] ${r.year}年第${r.question_number}题 (id:${r.id})`);
  });
  
  await pool.end();
}

main().catch(err => {
  console.error('检查失败:', err.message);
  process.exit(1);
});