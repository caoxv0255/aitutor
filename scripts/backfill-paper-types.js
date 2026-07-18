#!/usr/bin/env node
/**
 * 回填 exam_papers 表的 paper_type 和 math_type 字段
 * 同时校验/修正 paper_file_path 指向正确的 PDF 文件
 *
 * 用法:
 *   node scripts/backfill-paper-types.js              # 实际执行
 *   node scripts/backfill-paper-types.js --dry-run    # 仅预览不写入
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getPaperType,
  getMathSplit,
  PAPER_TYPE_LABELS,
  PROVINCE_NAME_MAP
} from './lib/paper-evolution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const PROVINCE_DIR_MAP = {
  'beijing': '北京高考', 'shanghai': '上海高考', 'tianjin': '天津高考',
  'shandong': '山东高考', 'guangdong': '广东高考', 'zhejiang': '浙江高考',
  'jiangsu': '江苏高考', 'henan': '河南高考', 'sichuan': '四川高考',
  'hebei': '河北高考', 'hubei': '湖北高考', 'hunan': '湖南高考',
  'fujian': '福建高考', 'anhui': '安徽高考', 'liaoning': '辽宁高考',
  'chongqing': '重庆高考', 'jiangxi': '江西高考', 'guizhou': '贵州高考',
  'guangxi': '广西高考', 'yunnan': '云南高考', 'shanxi': '山西高考',
  'shaanxi': '陕西高考', 'gansu': '甘肃高考', 'heilongjiang': '黑龙江高考',
  'jilin': '吉林高考', 'neimenggu': '内蒙古高考', 'qinghai': '青海高考',
  'ningxia': '宁夏高考', 'hainan': '海南高考', 'xinjiang': '新疆高考',
  'xizang': '西藏高考'
};

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
  science: '理综', liberal_arts: '文综',
  comprehensive_arts: '文综', comprehensive_science: '理综'
};

const isDryRun = process.argv.includes('--dry-run');

async function run() {
  const db = await getDb();

  console.log(`📋 回填 paper_type 和 math_type ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, exam_level, paper_file_path, math_type, paper_type
    FROM exam_papers
    WHERE exam_level = 'gaokao'
    ORDER BY province_code, year, subject
  `);

  console.log(`共 ${res.rows.length} 条记录\n`);

  let updatedPaperType = 0;
  let updatedMathType = 0;
  let updatedFilePath = 0;
  let skipped = 0;
  let errors = 0;
  const errorList = [];

  for (const row of res.rows) {
    const expectedPaperType = getPaperType(row.province_code, row.year, row.subject);

    if (!expectedPaperType) {
      errorList.push(`无法确定 paper_type: ${row.province_code} ${row.year} ${row.subject}`);
      errors++;
      continue;
    }

    const updates = {};
    let needUpdate = false;

    if (row.paper_type !== expectedPaperType) {
      updates.paper_type = expectedPaperType;
      needUpdate = true;
    }

    if (row.subject === 'math') {
      const mathSplit = getMathSplit(row.province_code, row.year);
      if (mathSplit !== null) {
        if (mathSplit) {
          if (row.math_type === 'unified' || !row.math_type) {
            const inferred = inferMathType(row.paper_file_path);
            if (inferred) {
              updates.math_type = inferred;
              needUpdate = true;
            }
          }
        } else {
          if (row.math_type !== 'unified') {
            updates.math_type = 'unified';
            needUpdate = true;
          }
        }
      }
    } else {
      if (row.math_type && row.math_type !== 'unified') {
        updates.math_type = null;
        needUpdate = true;
      }
    }

    const correctedPath = correctFilePath(row);
    if (correctedPath && correctedPath !== row.paper_file_path) {
      updates.paper_file_path = correctedPath;
      needUpdate = true;
    }

    if (needUpdate && !isDryRun) {
      const setParts = [];
      const params = [];
      let paramIdx = 1;
      for (const [key, value] of Object.entries(updates)) {
        setParts.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
      params.push(row.id);
      try {
        await db.query(
          `UPDATE exam_papers SET ${setParts.join(', ')} WHERE id = $${paramIdx}`,
          params
        );
      } catch (err) {
        errorList.push(`更新失败 ${row.id}: ${err.message}`);
        errors++;
        continue;
      }
    }

    if (updates.paper_type) updatedPaperType++;
    if (updates.math_type) updatedMathType++;
    if (updates.paper_file_path) updatedFilePath++;
    if (!needUpdate) skipped++;

    if (needUpdate && (updatedPaperType <= 5 || updatedMathType <= 5 || updatedFilePath <= 5)) {
      console.log(`[${row.province_code} ${row.year} ${row.subject}] ${JSON.stringify(updates)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('回填统计:');
  console.log(`  paper_type 更新: ${updatedPaperType}`);
  console.log(`  math_type 更新:  ${updatedMathType}`);
  console.log(`  文件路径修正:     ${updatedFilePath}`);
  console.log(`  无需更新:         ${skipped}`);
  console.log(`  错误:             ${errors}`);

  if (errorList.length > 0) {
    console.log('\n错误详情:');
    for (const e of errorList.slice(0, 20)) {
      console.log(`  - ${e}`);
    }
    if (errorList.length > 20) {
      console.log(`  ... 还有 ${errorList.length - 20} 条`);
    }
  }

  console.log('\n📊 paper_type 分布:');
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

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入数据库。去掉 --dry-run 参数执行实际更新。');
  }

  process.exit(0);
}

function inferMathType(filePath) {
  if (!filePath) return null;
  if (filePath.includes('文科')) return 'arts';
  if (filePath.includes('理科')) return 'science';
  return null;
}

function correctFilePath(row) {
  if (!row.paper_file_path) return null;

  const fullPath = join(ROOT, row.paper_file_path);
  if (existsSync(fullPath)) return null;

  const provinceDir = PROVINCE_DIR_MAP[row.province_code];
  if (!provinceDir) return null;

  const subjectCn = SUBJECT_CN[row.subject];
  if (!subjectCn) return null;

  const dir = dirname(row.paper_file_path);
  const dirFullPath = join(ROOT, dir);

  if (existsSync(dirFullPath)) {
    const files = readdirSync(dirFullPath);
    const yearStr = row.year.toString();
    const candidates = files.filter(f =>
      f.includes(yearStr) &&
      f.includes(subjectCn) &&
      !f.includes('解析') &&
      !f.includes('答案') &&
      (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'))
    );

    if (row.subject === 'math') {
      const mathSplit = getMathSplit(row.province_code, row.year);
      if (mathSplit) {
        const targetType = row.math_type === 'arts' ? '文科' : row.math_type === 'science' ? '理科' : null;
        if (targetType) {
          const match = candidates.find(f => f.includes(targetType));
          if (match) return `${dir}/${match}`.replace(/\\/g, '/');
        }
      } else {
        const match = candidates.find(f => !f.includes('文科') && !f.includes('理科'));
        if (match) return `${dir}/${match}`.replace(/\\/g, '/');
      }
    } else {
      if (candidates.length > 0) {
        return `${dir}/${candidates[0]}`.replace(/\\/g, '/');
      }
    }
  }

  return null;
}

run().catch(err => {
  console.error('回填失败:', err);
  process.exit(1);
});
