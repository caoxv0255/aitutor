#!/usr/bin/env node
/**
 * 高考试卷完整性检查脚本
 *
 * 数据库实际学科结构：
 *   - 非数学学科: chinese, english, physics, chemistry, biology, politics, history, geography (8科)
 *   - 数学学科: math + math_type (arts/science/unified)
 *
 * 老高考(mathSplit=true): 每省年应有 math_arts + math_science 两条数学记录
 * 新高考(mathSplit=false): 每省年应有 math(unified) 一条数学记录
 *
 * 检查内容：
 *   1. 缺失记录：应有但没有数据库记录
 *   2. math_type缺失：老高考数学应有arts/science但为NULL
 *   3. 占位文件：question_count = -1
 *   4. 未解析：question_count = 0 或 NULL
 */
import { getDb } from '../api/core/db.js';
import {
  PROVINCE_PAPER_EVOLUTION,
  PROVINCE_NAME_MAP,
  MINOR_SUBJECTS,
  getEvolutionInfo
} from './lib/paper-evolution.js';

const NON_MATH_SUBJECTS = ['chinese', 'english', 'physics', 'chemistry', 'biology', 'politics', 'history', 'geography'];

async function run() {
  const db = await getDb();

  const targetProvince = (() => {
    const idx = process.argv.indexOf('--province');
    return idx >= 0 ? process.argv[idx + 1] : null;
  })();

  console.log('🔍 高考试卷完整性检查');
  console.log('='.repeat(80));

  // 1. 计算每个省每年应有的学科列表
  const expected = {};
  for (const [provinceCode, evolution] of Object.entries(PROVINCE_PAPER_EVOLUTION)) {
    if (targetProvince && provinceCode !== targetProvince) continue;
    expected[provinceCode] = {};
    for (const period of evolution) {
      for (let year = period.start; year <= period.end; year++) {
        expected[provinceCode][year] = getExpectedSubjects(provinceCode, year);
      }
    }
  }

  // 2. 查询数据库实际记录
  const provinces = targetProvince
    ? [targetProvince]
    : Object.keys(PROVINCE_PAPER_EVOLUTION);

  const provList = provinces.map(p => `'${p}'`).join(',');
  const res = await db.query(`
    SELECT id, province_code, year, subject, math_type, paper_type, question_count, paper_file_path
    FROM exam_papers
    WHERE exam_level = 'gaokao'
      AND province_code IN (${provList})
    ORDER BY province_code, year, subject, math_type
  `);

  // 3. 构建实际记录索引
  const actual = {};
  for (const row of res.rows) {
    if (!actual[row.province_code]) actual[row.province_code] = {};
    if (!actual[row.province_code][row.year]) actual[row.province_code][row.year] = [];

    let key = row.subject;
    if (row.subject === 'math' && row.math_type) {
      key = `math_${row.math_type}`;
    }
    actual[row.province_code][row.year].push({ ...row, key });
  }

  // 4. 对比找出缺失
  const missingRecords = [];
  const extraRecords = [];
  const placeholderRecords = [];
  const zeroRecords = [];
  const nullRecords = [];
  const mathTypeNullRecords = []; // 老高考数学但math_type=NULL

  let totalExpected = 0;
  let totalActual = 0;

  for (const provinceCode of provinces) {
    const provExpected = expected[provinceCode] || {};
    const provActual = actual[provinceCode] || {};

    for (const [yearStr, expSubjects] of Object.entries(provExpected)) {
      const year = parseInt(yearStr);
      const actRecords = provActual[year] || [];
      const actKeys = actRecords.map(r => r.key);

      totalExpected += expSubjects.length;
      totalActual += actRecords.length;

      // 找缺失的学科
      for (const expSubject of expSubjects) {
        if (!actKeys.includes(expSubject)) {
          missingRecords.push({
            province: provinceCode,
            provinceCn: PROVINCE_NAME_MAP[provinceCode],
            year,
            subject: expSubject
          });
        }
      }

      // 检查现有记录状态
      for (const rec of actRecords) {
        // 老高考数学但math_type为NULL
        if (rec.subject === 'math' && !rec.math_type) {
          const period = getEvolutionInfo(provinceCode, year);
          if (period && period.mathSplit) {
            mathTypeNullRecords.push({
              province: rec.province_code,
              provinceCn: PROVINCE_NAME_MAP[rec.province_code],
              year: rec.year,
              paperType: rec.paper_type,
              questionCount: rec.question_count
            });
          }
        }

        if (rec.question_count === -1) {
          placeholderRecords.push({
            province: rec.province_code,
            provinceCn: PROVINCE_NAME_MAP[rec.province_code],
            year: rec.year,
            subject: rec.key,
            paperType: rec.paper_type
          });
        } else if (rec.question_count === 0) {
          zeroRecords.push({
            province: rec.province_code,
            provinceCn: PROVINCE_NAME_MAP[rec.province_code],
            year: rec.year,
            subject: rec.key,
            paperType: rec.paper_type
          });
        } else if (rec.question_count === null) {
          nullRecords.push({
            province: rec.province_code,
            provinceCn: PROVINCE_NAME_MAP[rec.province_code],
            year: rec.year,
            subject: rec.key,
            paperType: rec.paper_type
          });
        }
      }
    }

    // 找多余记录
    for (const [yearStr, actRecords] of Object.entries(provActual)) {
      const year = parseInt(yearStr);
      const expSubjects = provExpected[year] || [];
      for (const rec of actRecords) {
        if (!expSubjects.includes(rec.key)) {
          extraRecords.push({
            province: rec.province_code,
            provinceCn: PROVINCE_NAME_MAP[rec.province_code],
            year: rec.year,
            subject: rec.key,
            paperType: rec.paper_type
          });
        }
      }
    }
  }

  // 5. 输出结果
  console.log(`\n📊 总体统计:`);
  console.log(`  预期记录数: ${totalExpected}`);
  console.log(`  实际记录数: ${totalActual}`);
  console.log(`  缺失记录: ${missingRecords.length}`);
  console.log(`  多余记录: ${extraRecords.length}`);
  console.log(`  占位文件(-1): ${placeholderRecords.length}`);
  console.log(`  未解析(0): ${zeroRecords.length}`);
  console.log(`  NULL计数: ${nullRecords.length}`);
  console.log(`  math_type=NULL(老高考): ${mathTypeNullRecords.length}`);

  // 6. 缺失记录详情
  if (missingRecords.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`❌ 缺失记录详情 (${missingRecords.length}条)`);
    console.log('='.repeat(80));

    // 按学科统计
    const bySubject = {};
    for (const m of missingRecords) {
      if (!bySubject[m.subject]) bySubject[m.subject] = [];
      bySubject[m.subject].push(m);
    }
    console.log('\n按学科分布:');
    for (const [subj, items] of Object.entries(bySubject).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${subj}: ${items.length}条`);
    }

    // 按省份分组
    console.log('\n按省份分布:');
    const byProvince = {};
    for (const m of missingRecords) {
      if (!byProvince[m.province]) byProvince[m.province] = [];
      byProvince[m.province].push(m);
    }
    for (const [prov, items] of Object.entries(byProvince).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${items[0].provinceCn}: ${items.length}条`);

      // 按年份分组，紧凑显示
      const byYear = {};
      for (const item of items) {
        if (!byYear[item.year]) byYear[item.year] = [];
        byYear[item.year].push(item.subject);
      }
      // 合并相同学科的连续年份
      const yearEntries = Object.entries(byYear).sort((a, b) => a[0] - b[0]);
      let prevSubjects = null;
      let rangeStart = null;
      let rangeEnd = null;
      const ranges = [];
      for (const [yearStr, subs] of yearEntries) {
        const subsStr = subs.sort().join(',');
        if (prevSubjects === subsStr) {
          rangeEnd = yearStr;
        } else {
          if (prevSubjects !== null) {
            ranges.push({ start: rangeStart, end: rangeEnd, subjects: prevSubjects.split(',') });
          }
          rangeStart = yearStr;
          rangeEnd = yearStr;
          prevSubjects = subsStr;
        }
      }
      if (prevSubjects !== null) {
        ranges.push({ start: rangeStart, end: rangeEnd, subjects: prevSubjects.split(',') });
      }
      for (const r of ranges) {
        const yearStr = r.start === r.end ? `${r.start}年` : `${r.start}-${r.end}年`;
        console.log(`    ${yearStr}: ${r.subjects.join(', ')}`);
      }
    }
  }

  // 7. math_type=NULL详情
  if (mathTypeNullRecords.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`⚠️  math_type=NULL的老高考数学 (${mathTypeNullRecords.length}条)`);
    console.log('='.repeat(80));

    const byProvince = {};
    for (const r of mathTypeNullRecords) {
      if (!byProvince[r.province]) byProvince[r.province] = [];
      byProvince[r.province].push(r);
    }
    for (const [prov, items] of Object.entries(byProvince).sort()) {
      const years = items.map(i => i.year).sort((a, b) => a - b);
      const yearRanges = compactYears(years);
      console.log(`  ${items[0].provinceCn}: ${items.length}条 (${yearRanges})`);
    }
  }

  // 8. 占位文件统计
  if (placeholderRecords.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 占位文件 (question_count=-1, ${placeholderRecords.length}条)`);
    console.log('='.repeat(80));

    const bySubject = {};
    for (const p of placeholderRecords) {
      if (!bySubject[p.subject]) bySubject[p.subject] = 0;
      bySubject[p.subject]++;
    }
    console.log('\n按学科分布:');
    for (const [subj, cnt] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${subj}: ${cnt}条`);
    }

    const byProvince = {};
    for (const p of placeholderRecords) {
      if (!byProvince[p.province]) byProvince[p.province] = 0;
      byProvince[p.province]++;
    }
    console.log('\n按省份分布 (前10):');
    for (const [prov, cnt] of Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      const cn = PROVINCE_NAME_MAP[prov] || prov;
      console.log(`  ${cn}: ${cnt}条`);
    }
  }

  // 9. 未解析统计
  if (zeroRecords.length > 0 || nullRecords.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 未解析试卷 (question_count=0或NULL)`);
    console.log('='.repeat(80));
    console.log(`\n  零计数(0): ${zeroRecords.length}条`);
    console.log(`  NULL: ${nullRecords.length}条`);
    console.log(`  合计: ${zeroRecords.length + nullRecords.length}条`);

    if (zeroRecords.length > 0) {
      const byProvince = {};
      for (const r of zeroRecords) {
        if (!byProvince[r.province]) byProvince[r.province] = 0;
        byProvince[r.province]++;
      }
      console.log('\n零计数按省份分布 (前10):');
      for (const [prov, cnt] of Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        const cn = PROVINCE_NAME_MAP[prov] || prov;
        console.log(`  ${cn}: ${cnt}条`);
      }
    }
  }

  // 10. 多余记录
  if (extraRecords.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ℹ️  多余记录 (${extraRecords.length}条) — DB有但预期模型未列出`);
    console.log('='.repeat(80));
    const bySubject = {};
    for (const e of extraRecords) {
      if (!bySubject[e.subject]) bySubject[e.subject] = 0;
      bySubject[e.subject]++;
    }
    console.log('\n按学科分布:');
    for (const [subj, cnt] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${subj}: ${cnt}条`);
    }
  }

  // 11. 完整性评分
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📈 完整性评分`);
  console.log('='.repeat(80));

  const recordCompleteness = ((totalActual - missingRecords.length) / totalExpected * 100).toFixed(1);
  const fileCompleteness = ((totalActual - missingRecords.length - placeholderRecords.length) / totalExpected * 100).toFixed(1);
  const parseCompleteness = ((totalActual - missingRecords.length - placeholderRecords.length - zeroRecords.length - nullRecords.length) / totalExpected * 100).toFixed(1);

  console.log(`  记录完整性: ${recordCompleteness}% (${totalActual - missingRecords.length}/${totalExpected})`);
  console.log(`  文件完整性: ${fileCompleteness}% (有真实文件/${totalExpected})`);
  console.log(`  解析完整性: ${parseCompleteness}% (已解析出题目/${totalExpected})`);

  // 12. 重点缺口总结
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔴 重点缺口总结`);
  console.log('='.repeat(80));

  const mathScienceMissing = missingRecords.filter(m => m.subject === 'math_science');
  const mathArtsMissing = missingRecords.filter(m => m.subject === 'math_arts');
  const mathUnifiedMissing = missingRecords.filter(m => m.subject === 'math_unified');

  console.log(`  1. 理科数学(math_science)缺失: ${mathScienceMissing.length}条 — 老高考各省应有理科数学但未导入`);
  console.log(`  2. 文科数学(math_arts)缺失: ${mathArtsMissing.length}条 — math_type=NULL的88条记录未归类`);
  console.log(`  3. 统一数学(math_unified)缺失: ${mathUnifiedMissing.length}条`);
  console.log(`  4. math_type=NULL(老高考): ${mathTypeNullRecords.length}条 — 需区分arts/science`);
  console.log(`  5. 占位文件(-1): ${placeholderRecords.length}条 — 有记录但无真实文件`);
  console.log(`  6. 未解析(0+NULL): ${zeroRecords.length + nullRecords.length}条 — 有文件但未解析出题目`);

  if (mathScienceMissing.length > 0) {
    console.log(`\n  理科数学缺失详情:`);
    const byProvince = {};
    for (const m of mathScienceMissing) {
      if (!byProvince[m.province]) byProvince[m.province] = [];
      byProvince[m.province].push(m.year);
    }
    for (const [prov, years] of Object.entries(byProvince).sort()) {
      const cn = PROVINCE_NAME_MAP[prov] || prov;
      const yearRanges = compactYears(years);
      console.log(`    ${cn}: ${years.length}条 (${yearRanges})`);
    }
  }

  process.exit(0);
}

function getExpectedSubjects(provinceCode, year) {
  const period = getEvolutionInfo(provinceCode, year);
  if (!period) return [];

  const subjects = [...NON_MATH_SUBJECTS];

  if (period.mathSplit) {
    subjects.push('math_arts');
    subjects.push('math_science');
  } else {
    // 新高考统一数学，DB中math_type=unified，key为math_unified
    subjects.push('math_unified');
  }

  return subjects;
}

function compactYears(years) {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

run().catch(err => {
  console.error('检查失败:', err);
  process.exit(1);
});
