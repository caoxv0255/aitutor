#!/usr/bin/env node
/**
 * 修复88条math_type=NULL的老高考数学记录
 *
 * 这些记录特点：
 *   - 都是老高考(mathSplit=true)期间的数学记录
 *   - paper_file_path指向北京统一数学试卷（占位文件）
 *   - question_count=-1（占位标记）
 *   - 文件名无文/理科标识
 *
 * 修复方案：将math_type设为'arts'（文科数学）
 *   理由：这些是占位记录，需归类为arts或science；
 *         已有arts=366条 vs science=12条，arts为老高考数学的主要类型；
 *         后续获取真实文件时再校正。
 */
import { getDb } from '../api/core/db.js';
import { getMathSplit } from './lib/paper-evolution.js';

async function run() {
  const db = await getDb();

  console.log('🔧 修复math_type=NULL的老高考数学记录');
  console.log('='.repeat(60));

  // 查询所有需要修复的记录
  const res = await db.query(`
    SELECT id, province_code, year, subject, math_type, paper_type, question_count, paper_file_path
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND subject = 'math' AND math_type IS NULL
    ORDER BY province_code, year
  `);

  console.log(`待修复记录: ${res.rows.length}条\n`);

  let fixed = 0;
  let skipped = 0;
  const byProvince = {};

  for (const row of res.rows) {
    const mathSplit = getMathSplit(row.province_code, row.year);

    if (!mathSplit) {
      // 新高考统一数学，不应有NULL，设为unified
      console.log(`  [UNIFIED] ${row.province_code} ${row.year} → unified`);
      await db.query('UPDATE exam_papers SET math_type = $1 WHERE id = $2', ['unified', row.id]);
      fixed++;
      if (!byProvince[row.province_code]) byProvince[row.province_code] = 0;
      byProvince[row.province_code]++;
    } else {
      // 老高考分文理，设为arts
      await db.query('UPDATE exam_papers SET math_type = $1 WHERE id = $2', ['arts', row.id]);
      fixed++;
      if (!byProvince[row.province_code]) byProvince[row.province_code] = 0;
      byProvince[row.province_code]++;
    }
  }

  console.log(`\n修复完成: ${fixed}条已更新, ${skipped}条跳过\n`);
  console.log('按省份分布:');
  for (const [prov, cnt] of Object.entries(byProvince).sort()) {
    console.log(`  ${prov}: ${cnt}条`);
  }

  // 验证修复结果
  const verify = await db.query(`
    SELECT math_type, count(*) as cnt
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND subject = 'math'
    GROUP BY math_type ORDER BY cnt DESC
  `);
  console.log('\n修复后math_type分布:');
  for (const r of verify.rows) {
    console.log(`  ${r.math_type || 'NULL'}: ${r.cnt}条`);
  }

  // 确认NULL是否清零
  const nullCheck = await db.query(`
    SELECT count(*) as cnt
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND subject = 'math' AND math_type IS NULL
  `);
  console.log(`\n剩余NULL math_type: ${nullCheck.rows[0].cnt}条`);

  process.exit(0);
}

run().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
