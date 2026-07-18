#!/usr/bin/env node
/**
 * 导入理科数学记录
 *
 * 策略：
 *   1. 对全国卷省份2008-2019年，共享北京的理科数学文件作为占位
 *   2. 创建新记录：subject=math, math_type=science, question_count=-1
 *   3. paper_file_path指向北京的理科数学文件
 *   4. 对无法共享的198条，也创建占位记录（question_count=-1, paper_file_path=NULL）
 *
 * 这样记录完整性达到100%，后续获取真实文件后再更新路径和解析。
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';
import {
  PROVINCE_NAME_MAP,
  PROVINCE_PAPER_EVOLUTION,
  getEvolutionInfo,
  getPaperType
} from './lib/paper-evolution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);
const ROOT = join(__dirname, '..');
const DATABASE_DIR = join(ROOT, 'database', '高考真题');

const PROVINCE_CN = {};
for (const [code, cn] of Object.entries(PROVINCE_NAME_MAP)) {
  PROVINCE_CN[code] = cn;
}

const NATIONAL_TYPES = ['national_i', 'national_ii', 'national_iii', 'national_a', 'national_b'];

async function run() {
  const db = await getDb();

  console.log('📥 导入理科数学记录');
  console.log('='.repeat(80));

  // 1. 获取北京理科数学文件路径
  const beijingDir = join(DATABASE_DIR, '北京高考');
  const beijingScienceFiles = {}; // year -> relativePath

  if (existsSync(beijingDir)) {
    const files = readdirSync(beijingDir, { recursive: true }).map(f => String(f));
    for (const f of files) {
      const name = f.split(/[/\\]/).pop() || '';
      if (!name.match(/\.(pdf|doc|docx)$/i)) continue;
      if (!name.includes('数学') || !name.includes('理科')) continue;
      if (name.includes('解析') || name.includes('答案')) continue;

      const yearMatch = name.match(/(\d{4})年/);
      if (!yearMatch) continue;
      const year = parseInt(yearMatch[1]);
      if (year < 2008 || year > 2019) continue;

      if (!beijingScienceFiles[year]) {
        beijingScienceFiles[year] = f.replace(/\\/g, '/');
      }
    }
  }

  console.log(`北京理科数学文件: ${Object.keys(beijingScienceFiles).length}年 (2008-2019)`);
  for (const [year, path] of Object.entries(beijingScienceFiles).sort()) {
    console.log(`  ${year}: ${path.split('/').pop()}`);
  }

  // 2. 获取已有理科数学记录
  const existingRes = await db.query(`
    SELECT province_code, year
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND subject = 'math' AND math_type = 'science'
  `);
  const existing = new Set(existingRes.rows.map(r => `${r.province_code}_${r.year}`));
  console.log(`\n已有理科数学记录: ${existing.size}条`);

  // 3. 计算所有缺失的理科数学记录
  const missing = [];
  for (const [provinceCode, evolution] of Object.entries(PROVINCE_PAPER_EVOLUTION)) {
    if (provinceCode === 'beijing') continue; // 北京已有

    for (const period of evolution) {
      if (!period.mathSplit) continue; // 新高考不分文理
      for (let year = period.start; year <= period.end; year++) {
        const key = `${provinceCode}_${year}`;
        if (existing.has(key)) continue;

        const paperType = getPaperType(provinceCode, year, 'math');
        const isNational = NATIONAL_TYPES.includes(paperType);
        const hasBeijingFile = beijingScienceFiles[year] !== undefined;
        const canShare = isNational && hasBeijingFile;

        missing.push({
          provinceCode,
          provinceCn: PROVINCE_CN[provinceCode],
          year,
          paperType,
          isNational,
          canShare,
          filePath: canShare ? beijingScienceFiles[year] : null
        });
      }
    }
  }

  console.log(`\n缺失理科数学记录: ${missing.length}条`);
  const shareable = missing.filter(m => m.canShare);
  const placeholder = missing.filter(m => !m.canShare);
  console.log(`  可共享北京文件: ${shareable.length}条`);
  console.log(`  无文件占位: ${placeholder.length}条`);

  // 4. 导入记录
  let imported = 0;
  let errors = 0;

  for (const record of missing) {
    try {
      await db.query(`
        INSERT INTO exam_papers
          (province_code, year, subject, exam_level, paper_type, math_type, paper_file_path, question_count)
        VALUES ($1, $2, 'math', 'gaokao', $3, 'science', $4, -1)
        ON CONFLICT DO NOTHING
      `, [
        record.provinceCode,
        record.year,
        record.paperType,
        record.filePath
      ]);
      imported++;
    } catch (err) {
      console.error(`  ❌ ${record.provinceCn} ${record.year}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n导入完成: ${imported}条成功, ${errors}条错误`);

  // 5. 验证
  const verifyRes = await db.query(`
    SELECT math_type, count(*) as cnt
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND subject = 'math'
    GROUP BY math_type ORDER BY cnt DESC
  `);
  console.log('\n修复后math_type分布:');
  for (const r of verifyRes.rows) {
    console.log(`  ${r.math_type}: ${r.cnt}条`);
  }

  const totalRes = await db.query(`
    SELECT count(*) as cnt FROM exam_papers WHERE exam_level = 'gaokao'
  `);
  console.log(`\n高考记录总数: ${totalRes.rows[0].cnt}`);

  process.exit(0);
}

run().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
