#!/usr/bin/env node
/**
 * 验证 exam_papers 表中 paper_type 的正确性
 * 对比数据库中的 paper_type 与 getPaperType() 计算的期望值
 *
 * 用法:
 *   node scripts/verify-paper-types-v2.js              # 仅验证
 *   node scripts/verify-paper-types-v2.js --fix        # 验证并修复
 */
import { getDb } from '../api/core/db.js';
import { getPaperType, PAPER_TYPE_LABELS } from './lib/paper-evolution.js';

const shouldFix = process.argv.includes('--fix');

async function run() {
  const db = await getDb();

  console.log(`🔍 验证 paper_type 正确性 ${shouldFix ? '(修复模式)' : '(只读模式)'}`);
  console.log('='.repeat(60));

  const res = await db.query(`
    SELECT id, province_code, year, subject, exam_level, paper_type
    FROM exam_papers
    WHERE exam_level = 'gaokao'
    ORDER BY province_code, year, subject
  `);

  console.log(`高考记录总数: ${res.rows.length}\n`);

  let matched = 0;
  let mismatched = 0;
  let nullInDb = 0;
  let nullExpected = 0;
  const mismatches = [];

  for (const row of res.rows) {
    const expected = getPaperType(row.province_code, row.year, row.subject);

    if (expected === null) {
      nullExpected++;
      if (row.paper_type !== null) {
        mismatched++;
        mismatches.push({
          id: row.id,
          province: row.province_code,
          year: row.year,
          subject: row.subject,
          dbValue: row.paper_type,
          expectedValue: 'NULL',
          reason: '期望NULL但数据库有值'
        });
      }
      continue;
    }

    if (row.paper_type === null) {
      nullInDb++;
      mismatched++;
      mismatches.push({
        id: row.id,
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        dbValue: 'NULL',
        expectedValue: expected,
        reason: '数据库NULL但期望有值'
      });
      continue;
    }

    if (row.paper_type === expected) {
      matched++;
    } else {
      mismatched++;
      mismatches.push({
        id: row.id,
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        dbValue: row.paper_type,
        expectedValue: expected,
        reason: '值不匹配'
      });
    }
  }

  console.log('验证结果:');
  console.log(`  匹配: ${matched} 条`);
  console.log(`  不匹配: ${mismatched} 条`);
  console.log(`  数据库NULL: ${nullInDb} 条`);
  console.log(`  期望NULL: ${nullExpected} 条`);

  if (mismatches.length > 0) {
    console.log(`\n不一致记录 (前50条):`);
    console.log('  ID    | 省份     | 年份 | 学科      | 数据库值      | 期望值        | 原因');
    console.log('  ------|----------|------|-----------|--------------|--------------|------');
    for (const m of mismatches.slice(0, 50)) {
      const dbLabel = m.dbValue === 'NULL' ? 'NULL' : (PAPER_TYPE_LABELS[m.dbValue] || m.dbValue);
      const expLabel = m.expectedValue === 'NULL' ? 'NULL' : (PAPER_TYPE_LABELS[m.expectedValue] || m.expectedValue);
      console.log(`  ${String(m.id).padEnd(5)} | ${m.province.padEnd(8)} | ${m.year} | ${m.subject.padEnd(9)} | ${dbLabel.padEnd(12)} | ${expLabel.padEnd(12)} | ${m.reason}`);
    }
    if (mismatches.length > 50) {
      console.log(`  ... 还有 ${mismatches.length - 50} 条`);
    }

    if (shouldFix) {
      console.log(`\n修复 ${mismatches.length} 条不一致记录...`);
      let fixed = 0;
      let errors = 0;
      for (const m of mismatches) {
        try {
          if (m.expectedValue === 'NULL') {
            await db.query('UPDATE exam_papers SET paper_type = NULL WHERE id = $1', [m.id]);
          } else {
            await db.query('UPDATE exam_papers SET paper_type = $1 WHERE id = $2', [m.expectedValue, m.id]);
          }
          fixed++;
        } catch (err) {
          console.error(`  ❌ 修复失败 ${m.id}: ${err.message}`);
          errors++;
        }
      }
      console.log(`  已修复: ${fixed}, 错误: ${errors}`);
    } else {
      console.log('\n⚠️  只读模式。添加 --fix 参数执行修复。');
    }
  } else {
    console.log('\n✅ 所有记录的 paper_type 均与期望值一致！');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('验证失败:', err);
  process.exit(1);
});
