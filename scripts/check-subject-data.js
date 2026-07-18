#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  console.log('检查各学科题目数据...');
  
  const res = await pool.query(`
    SELECT subject_code, COUNT(*) as cnt 
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 
    GROUP BY subject_code ORDER BY cnt DESC
  `);
  
  console.log('\n学科题目数量分布:');
  res.rows.forEach(r => {
    console.log(`  ${r.subject_code}: ${r.cnt} 题`);
  });
  
  console.log('\n政治学科数据:');
  const politicsRes = await pool.query(`
    SELECT id, year, question_number, question_type, stem, answer, analysis, LENGTH(stem) as len
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 AND subject_code = 'politics'
    ORDER BY year, question_number
    LIMIT 10
  `);
  politicsRes.rows.forEach(r => {
    console.log(`  [${r.year}] 第${r.question_number}题 (${r.question_type}, ${r.len}字符): "${r.stem.substring(0, 50)}..."`);
    console.log(`    答案: ${r.answer ? r.answer.substring(0, 30) : '空'}`);
    console.log(`    解析: ${r.analysis ? r.analysis.substring(0, 50) : '空'}`);
  });
  
  console.log('\n地理学科数据:');
  const geoRes = await pool.query(`
    SELECT id, year, question_number, question_type, stem, answer, analysis, LENGTH(stem) as len
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 AND subject_code = 'geography'
    ORDER BY year, question_number
    LIMIT 10
  `);
  geoRes.rows.forEach(r => {
    console.log(`  [${r.year}] 第${r.question_number}题 (${r.question_type}, ${r.len}字符): "${r.stem.substring(0, 50)}..."`);
    console.log(`    答案: ${r.answer ? r.answer.substring(0, 30) : '空'}`);
    console.log(`    解析: ${r.analysis ? r.analysis.substring(0, 50) : '空'}`);
  });
  
  await pool.end();
}

main().catch(err => {
  console.error('检查失败:', err.message);
  process.exit(1);
});