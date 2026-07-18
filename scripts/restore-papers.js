#!/usr/bin/env node

import { getDb } from '../api/core/db.js';
import { PROVINCE_NAME_MAP, getEvolutionInfo } from './lib/paper-evolution.js';

const SUBJECT_LIST = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'politics', 'geography'];

const SOURCE_PROVINCE_FOR_TYPE = {
  'independent': 'beijing',
  'new_gaokao_i': 'shandong',
  'new_gaokao_ii': 'chongqing',
  'national_a': 'sichuan',
  'national_b': 'henan',
  'national_i': 'henan',
  'national_ii': 'heilongjiang',
  'national_iii': 'sichuan',
  'new_i': 'shandong',
  'new_ii': 'chongqing'
};

const FALLBACK_SOURCE_PROVINCE = 'beijing';

async function restorePapers() {
  const pool = await getDb();
  let totalRestored = 0;

  console.log('📋 试卷数据恢复脚本');
  console.log('='.repeat(60));
  console.log('\n正在检查各省份各学科的覆盖情况...\n');

  const missingRecords = [];

  for (const [provinceCode, provinceName] of Object.entries(PROVINCE_NAME_MAP)) {
    for (const subject of SUBJECT_LIST) {
      for (let year = 2008; year <= 2025; year++) {
        const result = await pool.query(`
          SELECT id FROM exam_papers
          WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = 'gaokao'
        `, [provinceCode, year, subject]);

        if (result.rows.length === 0) {
          missingRecords.push({ provinceCode, provinceName, year, subject });
        }
      }
    }
  }

  console.log(`发现 ${missingRecords.length} 条缺失记录\n`);

  for (const missing of missingRecords) {
    const { provinceCode, provinceName, year, subject } = missing;
    const paperType = getEvolutionInfo(provinceCode, year)?.main;
    
    if (!paperType) {
      console.log(`  ❌ ${provinceName} ${year}年${subject}: 无法确定试卷类型`);
      continue;
    }

    const sourceProvinceCode = SOURCE_PROVINCE_FOR_TYPE[paperType];
    
    if (!sourceProvinceCode) {
      console.log(`  ❌ ${provinceName} ${year}年${subject}: 未配置源省份 (${paperType})`);
      continue;
    }

    let sourceResult = await pool.query(`
      SELECT paper_file_path FROM exam_papers
      WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = 'gaokao'
    `, [sourceProvinceCode, year, subject]);

    let actualSourceCode = sourceProvinceCode;
    
    if (sourceResult.rows.length === 0 && sourceProvinceCode !== FALLBACK_SOURCE_PROVINCE) {
      console.log(`  ⚠️ ${provinceName} ${year}年${subject}: 源省份${PROVINCE_NAME_MAP[sourceProvinceCode]}没有数据，尝试备用源${PROVINCE_NAME_MAP[FALLBACK_SOURCE_PROVINCE]}`);
      
      sourceResult = await pool.query(`
        SELECT paper_file_path FROM exam_papers
        WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = 'gaokao'
      `, [FALLBACK_SOURCE_PROVINCE, year, subject]);
      
      if (sourceResult.rows.length === 0) {
        console.log(`  ❌ ${provinceName} ${year}年${subject}: 备用源${PROVINCE_NAME_MAP[FALLBACK_SOURCE_PROVINCE]}也没有数据`);
        continue;
      }
      actualSourceCode = FALLBACK_SOURCE_PROVINCE;
    }

    const sourceFilePath = sourceResult.rows[0].paper_file_path;

    try {
      await pool.query(`
        INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
        VALUES ($1, $2, $3, $4, $5)
      `, [provinceCode, year, subject, 'gaokao', sourceFilePath]);

      console.log(`  ✅ ${provinceName} ${year}年${subject}: 从${PROVINCE_NAME_MAP[actualSourceCode]}恢复`);
      totalRestored++;
    } catch (err) {
      if (err.code !== '23505') {
        console.error(`  ❌ ${provinceName} ${year}年${subject}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ 恢复完成！共恢复 ${totalRestored} 条试卷记录`);

  console.log('\n📊 各省份试卷统计:');
  const stats = await pool.query(`
    SELECT province_code, COUNT(*) as paper_count
    FROM exam_papers
    GROUP BY province_code
    ORDER BY paper_count DESC
  `);

  for (const row of stats.rows) {
    console.log(`  ${PROVINCE_NAME_MAP[row.province_code] || row.province_code}: ${row.paper_count} 套`);
  }
}

restorePapers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 恢复失败:', err.message);
    process.exit(1);
  });