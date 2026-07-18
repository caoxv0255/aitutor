#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  console.log('检查并修复题目与试卷关联错误...');
  
  const zhongkaoRes = await pool.query(`
    SELECT eq.id, eq.subject_code, eq.year, eq.question_number, eq.paper_id,
           ep.exam_level, ep.subject as paper_subject
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      AND ep.exam_level = 'zhongkao'
    ORDER BY eq.year, eq.subject_code, eq.question_number
    LIMIT 20
  `);
  
  console.log('\n错误关联到zhongkao的题目样本:');
  zhongkaoRes.rows.forEach(r => {
    console.log(`  [${r.subject_code}] ${r.year}年第${r.question_number}题 (paper_id:${r.paper_id}, exam_level:${r.exam_level}, paper_subject:${r.paper_subject})`);
  });
  
  const zhongkaoCount = await pool.query(`
    SELECT eq.subject_code, COUNT(*) as cnt
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      AND ep.exam_level = 'zhongkao'
    GROUP BY eq.subject_code
    ORDER BY cnt DESC
  `);
  
  console.log('\n错误关联到zhongkao的题目按学科分布:');
  zhongkaoCount.rows.forEach(r => {
    console.log(`  ${r.subject_code}: ${r.cnt} 题`);
  });
  
  const fixCount = await pool.query(`
    SELECT COUNT(*) as fix_cnt
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      AND ep.exam_level = 'zhongkao'
  `);
  
  const totalFix = fixCount.rows[0].fix_cnt;
  console.log(`\n需要修复的题目总数: ${totalFix} 道`);
  
  if (totalFix > 0) {
    console.log('\n正在修复题目与试卷关联...');
    
    const updateRes = await pool.query(`
      UPDATE exam_questions eq
      SET paper_id = (
        SELECT ep.id 
        FROM exam_papers ep
        WHERE ep.province_code = eq.province_code
          AND ep.year = eq.year
          AND ep.subject = eq.subject_code
          AND ep.exam_level = 'gaokao'
        LIMIT 1
      )
      FROM exam_papers ep_old
      WHERE eq.paper_id = ep_old.id
        AND eq.province_code = 'beijing' 
        AND eq.year BETWEEN 2021 AND 2025
        AND ep_old.exam_level = 'zhongkao'
        AND EXISTS (
          SELECT 1 FROM exam_papers ep_new
          WHERE ep_new.province_code = eq.province_code
            AND ep_new.year = eq.year
            AND ep_new.subject = eq.subject_code
            AND ep_new.exam_level = 'gaokao'
        )
    `);
    
    console.log(`修复完成！共更新 ${updateRes.rowCount} 道题目`);
    
    const verifyRes = await pool.query(`
      SELECT ep.exam_level, COUNT(*) as cnt 
      FROM exam_questions eq
      JOIN exam_papers ep ON eq.paper_id = ep.id
      WHERE eq.province_code = 'beijing' AND eq.year BETWEEN 2021 AND 2025
      GROUP BY ep.exam_level
    `);
    
    console.log('\n修复后的exam_level分布:');
    verifyRes.rows.forEach(r => {
      console.log(`  ${r.exam_level}: ${r.cnt} 题`);
    });
  } else {
    console.log('无需修复');
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('修复失败:', err.message);
  process.exit(1);
});