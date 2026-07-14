#!/usr/bin/env node
/**
 * 修正 NULL math_type 的数学记录
 * - mathSplit=false (新高考改革后) → 设为 'unified'
 * - mathSplit=true (老高考) → 保持 NULL (置空待修复)
 * - mathSplit=null (未找到) → 保持 NULL，输出警告
 *
 * 用法:
 *   node scripts/fix-math-type-unified.js              # 实际执行
 *   node scripts/fix-math-type-unified.js --dry-run    # 仅预览
 */
import { getDb } from '../api/core/db.js';
import { getMathSplit } from './lib/paper-evolution.js';

const isDryRun = process.argv.includes('--dry-run');

async function run() {
  const db = await getDb();

  console.log(`🔧 修正 NULL math_type ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(60));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_type, math_type, exam_level
    FROM exam_papers
    WHERE subject = 'math' AND math_type IS NULL
    ORDER BY province_code, year
  `);

  console.log(`NULL math_type 数学记录: ${res.rows.length} 条\n`);

  let setUnified = 0;
  let keptNull = 0;
  let notFound = 0;
  const unifiedList = [];
  const keptList = [];
  const notFoundList = [];

  for (const row of res.rows) {
    if (row.exam_level !== 'gaokao') {
      keptNull++;
      keptList.push({ ...row, reason: '非高考记录' });
      continue;
    }

    const mathSplit = getMathSplit(row.province_code, row.year);

    if (mathSplit === null) {
      notFound++;
      notFoundList.push({ ...row, reason: '未找到省份年份映射' });
      continue;
    }

    if (mathSplit === false) {
      console.log(`  [UNIFIED] ${row.province_code} ${row.year} math → unified`);
      if (!isDryRun) {
        await db.query(
          'UPDATE exam_papers SET math_type = $1 WHERE id = $2',
          ['unified', row.id]
        );
      }
      setUnified++;
      unifiedList.push({ province: row.province_code, year: row.year });
    } else {
      keptNull++;
      keptList.push({ ...row, reason: '老高考分文理，置空待修复' });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('修正统计:');
  console.log(`  设为 unified: ${setUnified} 条`);
  console.log(`  保持 NULL (老高考): ${keptNull} 条`);
  console.log(`  未找到映射: ${notFound} 条`);

  if (keptList.length > 0) {
    console.log(`\n保持 NULL 记录 (前20条):`);
    for (const r of keptList.slice(0, 20)) {
      console.log(`  ${r.province_code} ${r.year} - ${r.reason}`);
    }
    if (keptList.length > 20) {
      console.log(`  ... 还有 ${keptList.length - 20} 条`);
    }
  }

  if (notFoundList.length > 0) {
    console.log(`\n未找到映射记录:`);
    for (const r of notFoundList) {
      console.log(`  ${r.province_code} ${r.year} - ${r.reason}`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入。去掉 --dry-run 执行实际更新。');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('修正失败:', err);
  process.exit(1);
});
