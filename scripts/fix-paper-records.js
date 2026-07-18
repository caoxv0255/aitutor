#!/usr/bin/env node

import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  console.log('修复试卷记录重复和question_count字段...');
  
  console.log('\n1. 检查重复试卷记录:');
  const duplicateRes = await pool.query(`
    SELECT province_code, year, subject, COUNT(*) as cnt
    FROM exam_papers
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    GROUP BY province_code, year, subject
    HAVING COUNT(*) > 1
    ORDER BY year, subject
  `);
  
  console.log(`   发现 ${duplicateRes.rows.length} 组重复试卷记录:`);
  duplicateRes.rows.forEach(r => {
    console.log(`     ${r.year}年 ${r.subject}: ${r.cnt} 条记录`);
  });
  
  console.log('\n2. 查看重复试卷详情:');
  const detailRes = await pool.query(`
    SELECT id, province_code, year, subject, exam_level, question_count, total_score
    FROM exam_papers
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    ORDER BY year, subject, exam_level
  `);
  
  const grouped = {};
  detailRes.rows.forEach(r => {
    const key = `${r.year}-${r.subject}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  
  for (const [key, papers] of Object.entries(grouped)) {
    if (papers.length > 1) {
      console.log(`   ${key}:`);
      papers.forEach(p => {
        console.log(`     id:${p.id}, level:${p.exam_level}, question_count:${p.question_count}, total_score:${p.total_score}`);
      });
    }
  }
  
  console.log('\n3. 更新试卷记录的question_count:');
  const updateRes = await pool.query(`
    UPDATE exam_papers ep
    SET question_count = (
      SELECT COUNT(*) 
      FROM exam_questions eq
      WHERE eq.paper_id = ep.id
    )
    WHERE ep.province_code = 'beijing' AND ep.year BETWEEN 2021 AND 2025
  `);
  
  console.log(`   更新了 ${updateRes.rowCount} 条试卷记录`);
  
  console.log('\n4. 删除重复的zhongkao试卷记录:');
  const deleteRes = await pool.query(`
    DELETE FROM exam_papers
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
      AND exam_level = 'zhongkao'
      AND EXISTS (
        SELECT 1 FROM exam_papers ep2
        WHERE ep2.province_code = exam_papers.province_code
          AND ep2.year = exam_papers.year
          AND ep2.subject = exam_papers.subject
          AND ep2.exam_level = 'gaokao'
      )
  `);
  
  console.log(`   删除了 ${deleteRes.rowCount} 条重复的zhongkao试卷记录`);
  
  console.log('\n5. 验证修复结果:');
  const verifyRes = await pool.query(`
    SELECT ep.year, ep.subject, ep.question_count as paper_count,
           COUNT(eq.id) as actual_count
    FROM exam_papers ep
    LEFT JOIN exam_questions eq ON ep.id = eq.paper_id
    WHERE ep.province_code = 'beijing' AND ep.year BETWEEN 2021 AND 2025
      AND ep.exam_level = 'gaokao'
    GROUP BY ep.year, ep.subject, ep.question_count
    ORDER BY ep.year, ep.subject
  `);
  
  let mismatch = 0;
  console.log(`   ${'年份'.padEnd(6)} ${'学科'.padEnd(10)} ${'期望题数'.padEnd(10)} ${'实际题数'.padEnd(10)} ${'匹配'.padEnd(6)}`);
  console.log(`   ${'-'.repeat(6)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(6)}`);
  verifyRes.rows.forEach(r => {
    const match = r.paper_count === r.actual_count;
    if (!match) mismatch++;
    console.log(`   ${r.year.toString().padEnd(6)} ${r.subject.padEnd(10)} ${r.paper_count.toString().padEnd(10)} ${r.actual_count.toString().padEnd(10)} ${match ? '✅' : '❌'}`);
  });
  
  if (mismatch === 0) {
    console.log('\n   ✅ 所有试卷题目数量匹配！');
  } else {
    console.log(`\n   ⚠️  仍有 ${mismatch} 份试卷题目数量不匹配`);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('修复失败:', err.message);
  process.exit(1);
});