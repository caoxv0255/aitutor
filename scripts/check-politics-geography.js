#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  console.log('检查政治和地理学科题目数据...\n');
  
  console.log('=== 政治学科 ===');
  const politicsRes = await pool.query(`
    SELECT id, year, question_number, question_type, 
           LENGTH(stem) as stem_length,
           (stem IS NULL OR stem = '') as empty_stem,
           (answer IS NULL OR answer = '') as empty_answer,
           (analysis IS NULL OR analysis = '') as empty_analysis
    FROM exam_questions 
    WHERE subject_code = 'politics' AND province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    ORDER BY year, question_number
    LIMIT 10
  `);
  
  console.log(`政治题目总数: ${politicsRes.rows.length}`);
  politicsRes.rows.forEach(r => {
    console.log(`  ${r.year}年第${r.question_number}题: 类型=${r.question_type}, 题干长度=${r.stem_length}, 空题干=${r.empty_stem}, 空答案=${r.empty_answer}, 空解析=${r.empty_analysis}`);
    if (r.stem && r.stem.length < 100) {
      console.log(`    题干: ${r.stem.substring(0, 80)}...`);
    }
  });
  
  console.log('\n=== 地理学科 ===');
  const geoRes = await pool.query(`
    SELECT id, year, question_number, question_type, 
           LENGTH(stem) as stem_length,
           (stem IS NULL OR stem = '') as empty_stem,
           (answer IS NULL OR answer = '') as empty_answer,
           (analysis IS NULL OR analysis = '') as empty_analysis
    FROM exam_questions 
    WHERE subject_code = 'geography' AND province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    ORDER BY year, question_number
    LIMIT 10
  `);
  
  console.log(`地理题目总数: ${geoRes.rows.length}`);
  geoRes.rows.forEach(r => {
    console.log(`  ${r.year}年第${r.question_number}题: 类型=${r.question_type}, 题干长度=${r.stem_length}, 空题干=${r.empty_stem}, 空答案=${r.empty_answer}, 空解析=${r.empty_analysis}`);
    if (r.stem && r.stem.length < 100) {
      console.log(`    题干: ${r.stem.substring(0, 80)}...`);
    }
  });
  
  console.log('\n=== 各学科题目数量统计 ===');
  const statsRes = await pool.query(`
    SELECT subject_code, COUNT(*) as count
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    GROUP BY subject_code
    ORDER BY count DESC
  `);
  
  statsRes.rows.forEach(r => console.log(`  ${r.subject_code}: ${r.count}题`));
  
  await pool.end();
}

main().catch(err => {
  console.error('检查失败:', err.message);
  process.exit(1);
});