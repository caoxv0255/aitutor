#!/usr/bin/env node
/**
 * 分析占位文件的当前路径情况
 */
import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();

  // 1. 路径情况统计
  const pathStats = await db.query(`
    SELECT
      CASE
        WHEN paper_file_path IS NULL THEN 'null_path'
        WHEN paper_file_path = '' THEN 'empty_path'
        WHEN paper_file_path LIKE '%北京%' THEN 'shared_beijing'
        ELSE 'other_path'
      END AS path_type,
      COUNT(*) AS cnt
    FROM exam_papers
    WHERE question_count = -1
    GROUP BY path_type
    ORDER BY cnt DESC
  `);
  console.log('=== 占位文件路径情况 ===');
  pathStats.rows.forEach(r => console.log(`  ${r.path_type}: ${r.cnt}`));

  // 2. 各省份占位文件中，有路径的 vs 无路径的
  const provStats = await db.query(`
    SELECT province_code,
      COUNT(*) AS total,
      COUNT(paper_file_path) AS has_path,
      COUNT(*) - COUNT(paper_file_path) AS null_path
    FROM exam_papers
    WHERE question_count = -1
    GROUP BY province_code
    ORDER BY province_code
  `);
  console.log('\n=== 各省份占位文件路径情况 ===');
  console.log('省份            总数  有路径  无路径');
  provStats.rows.forEach(r => {
    console.log(`  ${r.province_code.padEnd(14)} ${String(r.total).padStart(4)}  ${String(r.has_path).padStart(6)}  ${String(r.null_path).padStart(6)}`);
  });

  // 3. 有路径的占位文件样本（共享北京文件的情况）
  const sharedSample = await db.query(`
    SELECT province_code, year, subject, math_type, paper_file_path
    FROM exam_papers
    WHERE question_count = -1
      AND paper_file_path LIKE '%北京%'
    ORDER BY province_code, year
    LIMIT 20
  `);
  console.log('\n=== 共享北京文件的占位样本 ===');
  sharedSample.rows.forEach(r => {
    console.log(`  ${r.province_code} ${r.year} ${r.subject} ${r.math_type || ''} -> ${r.paper_file_path}`);
  });

  // 4. 无路径的占位文件按省份+学科统计
  const nullByProvSubj = await db.query(`
    SELECT province_code,
      CASE
        WHEN subject = 'math' AND math_type = 'arts' THEN 'math_arts'
        WHEN subject = 'math' AND math_type = 'science' THEN 'math_science'
        WHEN subject = 'math' AND math_type = 'unified' THEN 'math_unified'
        ELSE subject
      END AS subj_key,
      COUNT(*) AS cnt
    FROM exam_papers
    WHERE question_count = -1
      AND paper_file_path IS NULL
    GROUP BY province_code, subj_key
    ORDER BY province_code, subj_key
  `);
  console.log('\n=== 无路径占位文件按省份+学科分布（前30行）===');
  nullByProvSubj.rows.slice(0, 30).forEach(r => {
    console.log(`  ${r.province_code.padEnd(14)} ${r.subj_key.padEnd(14)} ${r.cnt}`);
  });

  // 5. 按年份统计占位文件
  const yearStats = await db.query(`
    SELECT year, COUNT(*) AS cnt
    FROM exam_papers
    WHERE question_count = -1
    GROUP BY year
    ORDER BY year
  `);
  console.log('\n=== 占位文件按年份分布 ===');
  yearStats.rows.forEach(r => console.log(`  ${r.year}: ${r.cnt}`));

  await db.end();
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
