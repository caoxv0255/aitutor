#!/usr/bin/env node
/**
 * 修复缺失文件路径
 * 处理 Phase 4 重命名后未更新数据库路径的记录
 *
 * 问题：部分数据库路径使用完整格式 (database/高考真题/北京高考/...)
 * Phase 4 标准化脚本只更新了相对路径格式的记录
 *
 * 策略：
 * 1. 规范化路径（去掉 database/高考真题/{province}高考/ 前缀）
 * 2. 如果文件存在 → 更新路径
 * 3. 如果文件不存在 → 搜索标准化后的文件名
 * 4. 找到则更新，找不到则标记为占位
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);
const ROOT = join(__dirname, '..');
const DATABASE_DIR = join(ROOT, 'database', '高考真题');

const isDryRun = process.argv.includes('--dry-run');

const PROVINCE_CN = {
  beijing: '北京', shanghai: '上海', tianjin: '天津', chongqing: '重庆',
  hebei: '河北', henan: '河南', shandong: '山东', jiangsu: '江苏',
  zhejiang: '浙江', fujian: '福建', guangdong: '广东', hubei: '湖北',
  hunan: '湖南', anhui: '安徽', jiangxi: '江西', sichuan: '四川',
  shaanxi: '陕西', guizhou: '贵州', yunnan: '云南', xinjiang: '新疆',
  xizang: '西藏', neimenggu: '内蒙古', ningxia: '宁夏', qinghai: '青海',
  gansu: '甘肃', heilongjiang: '黑龙江', jilin: '吉林', shanxi: '山西',
  liaoning: '辽宁', hainan: '海南', guangxi: '广西'
};

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理'
};

const PAPER_TYPE_LABELS_CN = {
  'independent': null,
  'national_i': '全国I卷',
  'national_ii': '全国II卷',
  'national_iii': '全国III卷',
  'national_a': '全国甲卷',
  'national_b': '全国乙卷',
  'new_gaokao_i': '新高考I卷',
  'new_gaokao_ii': '新高考II卷'
};

function normalizePath(filePath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return filePath;

  const prefix1 = `database/高考真题/${provinceCn}高考/`;
  const prefix2 = `database\\高考真题\\${provinceCn}高考\\`;
  const prefix3 = `${provinceCn}高考/`;
  const prefix4 = `${provinceCn}高考\\`;

  if (filePath.startsWith(prefix1)) return filePath.substring(prefix1.length);
  if (filePath.startsWith(prefix2)) return filePath.substring(prefix2.length);
  if (filePath.startsWith(prefix3)) return filePath.substring(prefix3.length);
  if (filePath.startsWith(prefix4)) return filePath.substring(prefix4.length);
  return filePath;
}

function resolveFilePath(filePath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return null;
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  const normalized = normalizePath(filePath, provinceCode);

  const candidates = [
    join(provinceDir, normalized),
    join(provinceDir, normalized.replace(/\//g, '\\')),
    join(DATABASE_DIR, filePath),
    join(ROOT, filePath),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function searchStandardFile(provinceCode, year, subject, paperType, mathType) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return null;
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  if (!existsSync(provinceDir)) return null;

  const subjectCn = SUBJECT_CN[subject];
  if (!subjectCn) return null;
  const yearStr = year.toString();

  let allFiles;
  try {
    allFiles = readdirSync(provinceDir, { recursive: true }).map(f => String(f));
  } catch {
    return null;
  }

  // 搜索原卷版
  const originalCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           !fName.includes('解析') &&
           !fName.includes('答案') &&
           !fName.includes('含解析') &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  // 数学分文理
  if (subject === 'math') {
    if (mathType === 'arts') {
      const match = originalCandidates.find(f => f.includes('文科'));
      if (match) return match;
    } else if (mathType === 'science') {
      const match = originalCandidates.find(f => f.includes('理科'));
      if (match) return match;
    }
  }

  if (originalCandidates.length > 0) return originalCandidates[0];

  // 搜索任意版本
  const anyCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (subject === 'math') {
    if (mathType === 'arts') {
      const match = anyCandidates.find(f => f.includes('文科'));
      if (match) return match;
    } else if (mathType === 'science') {
      const match = anyCandidates.find(f => f.includes('理科'));
      if (match) return match;
    }
  }

  if (anyCandidates.length > 0) return anyCandidates[0];
  return null;
}

function toRelativePath(fullPath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  return fullPath
    .replace(provinceDir + '\\', '')
    .replace(provinceDir + '/', '')
    .replace(/\\/g, '/');
}

async function run() {
  const db = await getDb();

  console.log(`🔧 修复缺失文件路径 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(60));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type, question_count
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL AND question_count != -1
    ORDER BY province_code, year, subject
  `);

  let fixed = 0;
  let notFound = 0;
  let alreadyOk = 0;
  let errors = 0;
  const notFoundList = [];

  for (const row of res.rows) {
    const fullPath = resolveFilePath(row.paper_file_path, row.province_code);

    if (fullPath) {
      // 文件存在，检查路径是否需要规范化
      const normalized = normalizePath(row.paper_file_path, row.province_code);
      if (normalized !== row.paper_file_path) {
        console.log(`  [NORMALIZE] ${row.province_code} ${row.year} ${row.subject}: ${normalized}`);
        if (!isDryRun) {
          try {
            await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [normalized, row.id]);
          } catch (err) {
            console.error(`     ❌ 更新失败: ${err.message}`);
            errors++;
            continue;
          }
        }
        fixed++;
      } else {
        alreadyOk++;
      }
      continue;
    }

    // 文件不存在，搜索标准化文件名
    const foundFile = searchStandardFile(row.province_code, row.year, row.subject, row.paper_type, row.math_type);

    if (foundFile) {
      const relativePath = toRelativePath(foundFile, row.province_code);
      console.log(`  [SEARCH] ${row.province_code} ${row.year} ${row.subject}: ${relativePath}`);
      if (!isDryRun) {
        try {
          await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [relativePath, row.id]);
        } catch (err) {
          console.error(`     ❌ 更新失败: ${err.message}`);
          errors++;
          continue;
        }
      }
      fixed++;
    } else {
      notFound++;
      notFoundList.push({
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        path: row.paper_file_path
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('修复统计:');
  console.log(`  已存在(无需修改): ${alreadyOk}`);
  console.log(`  路径修复: ${fixed}`);
  console.log(`  未找到文件: ${notFound}`);
  console.log(`  错误: ${errors}`);

  if (notFoundList.length > 0) {
    console.log(`\n未找到文件 (前30条):`);
    for (const m of notFoundList.slice(0, 30)) {
      console.log(`  ${m.province} ${m.year} ${m.subject}: ${m.path}`);
    }
    if (notFoundList.length > 30) {
      console.log(`  ... 还有 ${notFoundList.length - 30} 条`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入。去掉 --dry-run 执行实际更新。');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
