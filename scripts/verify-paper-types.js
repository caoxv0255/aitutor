#!/usr/bin/env node
/**
 * 验证 exam_papers 表的 paper_type 和 math_type 字段
 * 对比数据库实际值与共享模块 getPaperType/getMathSplit 的期望值
 *
 * 用法: node scripts/verify-paper-types.js
 */
import { getDb } from '../api/core/db.js';
import {
  getPaperType,
  getMathSplit,
  PAPER_TYPE_LABELS,
  PROVINCE_NAME_MAP
} from './lib/paper-evolution.js';

async function run() {
  const db = await getDb();

  console.log('🔍 验证 exam_papers 的 paper_type 和 math_type');
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, exam_level, paper_type, math_type
    FROM exam_papers
    WHERE exam_level = 'gaokao'
    ORDER BY province_code, year, subject
  `);

  console.log(`共 ${res.rows.length} 条记录\n`);

  let mismatches = 0;
  let mathIssues = 0;
  const mismatchByProvince = {};

  for (const row of res.rows) {
    const expectedPaperType = getPaperType(row.province_code, row.year, row.subject);

    if (expectedPaperType && row.paper_type !== expectedPaperType) {
      mismatches++;
      const pName = PROVINCE_NAME_MAP[row.province_code] || row.province_code;
      if (!mismatchByProvince[pName]) mismatchByProvince[pName] = [];
      mismatchByProvince[pName].push({
        year: row.year,
        subject: row.subject,
        expected: expectedPaperType,
        actual: row.paper_type
      });
    }

    if (row.subject === 'math') {
      const mathSplit = getMathSplit(row.province_code, row.year);
      if (mathSplit !== null) {
        if (mathSplit) {
          if (row.math_type !== 'arts' && row.math_type !== 'science') {
            mathIssues++;
            const pName = PROVINCE_NAME_MAP[row.province_code] || row.province_code;
            console.log(`  ⚠️  ${pName} ${row.year} 数学: math_type="${row.math_type}" (期望 arts/science)`);
          }
        } else {
          if (row.math_type !== 'unified') {
            mathIssues++;
            const pName = PROVINCE_NAME_MAP[row.province_code] || row.province_code;
            console.log(`  ⚠️  ${pName} ${row.year} 数学: math_type="${row.math_type}" (期望 unified)`);
          }
        }
      }
    } else {
      if (row.math_type && row.math_type !== 'unified') {
        mathIssues++;
        const pName = PROVINCE_NAME_MAP[row.province_code] || row.province_code;
        console.log(`  ⚠️  ${pName} ${row.year} ${row.subject}: math_type="${row.math_type}" (非数学学科应为 null 或 unified)`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('验证结果:');
  console.log(`  paper_type 不一致: ${mismatches} 条`);
  console.log(`  math_type 异常:    ${mathIssues} 条`);

  if (mismatches > 0) {
    console.log('\n📋 paper_type 不一致详情（按省份）:');
    for (const [province, items] of Object.entries(mismatchByProvince)) {
      console.log(`\n  ${province} (${items.length}条):`);
      for (const item of items.slice(0, 10)) {
        const expLabel = PAPER_TYPE_LABELS[item.expected] || item.expected;
        const actLabel = PAPER_TYPE_LABELS[item.actual] || item.actual || 'NULL';
        console.log(`    ${item.year} ${item.subject}: 期望=${expLabel}(${item.expected}) 实际=${actLabel}(${item.actual})`);
      }
      if (items.length > 10) {
        console.log(`    ... 还有 ${items.length - 10} 条`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 paper_type 分布统计:');
  const distRes = await db.query(`
    SELECT paper_type, COUNT(*) as count
    FROM exam_papers
    WHERE exam_level = 'gaokao'
    GROUP BY paper_type
    ORDER BY count DESC
  `);
  for (const r of distRes.rows) {
    const label = PAPER_TYPE_LABELS[r.paper_type] || r.paper_type || '(NULL)';
    console.log(`  ${label}: ${r.count}`);
  }

  console.log('\n📊 math_type 分布统计:');
  const mathDistRes = await db.query(`
    SELECT math_type, COUNT(*) as count
    FROM exam_papers
    WHERE exam_level = 'gaokao'
    GROUP BY math_type
    ORDER BY count DESC
  `);
  for (const r of mathDistRes.rows) {
    console.log(`  ${r.math_type || '(NULL)'}: ${r.count}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 专项抽查:');

  const spotChecks = [
    { province: 'shandong', year: 2015, subject: 'math', desc: '山东2015数学(应=independent)', expectedType: 'independent' },
    { province: 'shandong', year: 2010, subject: 'chinese', desc: '山东2010语文(应=independent)', expectedType: 'independent' },
    { province: 'xinjiang', year: 2025, subject: 'math', desc: '新疆2025数学(应=new_gaokao_ii, math_type=arts/science)', expectedType: 'new_gaokao_ii' },
    { province: 'anhui', year: 2022, subject: 'chinese', desc: '安徽2022语文(应=national_b)', expectedType: 'national_b' },
    { province: 'zhejiang', year: 2023, subject: 'english', desc: '浙江2023英语(应=new_gaokao_i)', expectedType: 'new_gaokao_i' },
    { province: 'henan', year: 2025, subject: 'chinese', desc: '河南2025语文(应=new_gaokao_i)', expectedType: 'new_gaokao_i' },
    { province: 'sichuan', year: 2025, subject: 'chinese', desc: '四川2025语文(应=new_gaokao_ii)', expectedType: 'new_gaokao_ii' },
    { province: 'guangdong', year: 2015, subject: 'math', desc: '广东2015数学(应=independent)', expectedType: 'independent' },
    { province: 'hubei', year: 2018, subject: 'chinese', desc: '湖北2018语文(应=independent)', expectedType: 'independent' },
    { province: 'chongqing', year: 2019, subject: 'math', desc: '重庆2019数学(应=independent)', expectedType: 'independent' }
  ];

  for (const check of spotChecks) {
    const r = await db.query(
      'SELECT paper_type, math_type FROM exam_papers WHERE province_code=$1 AND year=$2 AND subject=$3 AND exam_level=$4',
      [check.province, check.year, check.subject, 'gaokao']
    );

    if (r.rows.length === 0) {
      console.log(`  ⚠️  ${check.desc}: 无记录`);
      continue;
    }

    for (const row of r.rows) {
      const ok = row.paper_type === check.expectedType;
      const label = PAPER_TYPE_LABELS[row.paper_type] || row.paper_type || 'NULL';
      const mathInfo = check.subject === 'math' ? `, math_type=${row.math_type}` : '';
      console.log(`  ${ok ? '✅' : '❌'} ${check.desc}: paper_type=${label}${mathInfo}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  if (mismatches === 0 && mathIssues === 0) {
    console.log('✅ 所有记录验证通过！');
  } else {
    console.log(`⚠️  发现 ${mismatches} 条 paper_type 不一致, ${mathIssues} 条 math_type 异常`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('验证失败:', err);
  process.exit(1);
});
