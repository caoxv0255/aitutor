#!/usr/bin/env node
/**
 * 修复独立命题省份的占位文件路径
 * 检测独立命题省份的文件路径是否指向其他省份的文件（占位符），
 * 并在本省目录下搜索正确文件进行修正。
 *
 * 用法:
 *   node scripts/fix-placeholder-paths.js              # 实际执行
 *   node scripts/fix-placeholder-paths.js --dry-run    # 仅预览不写入
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';
import { getMathSplit } from './lib/paper-evolution.js';

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

function resolveFilePath(filePath) {
  if (!filePath) return null;
  if (existsSync(filePath)) return filePath;

  const dirPart = filePath.split(/[/\\]/)[0];
  const filePart = filePath.substring(dirPart.length + 1);

  for (const cn of Object.values(PROVINCE_CN)) {
    if (dirPart.includes(cn)) {
      const provinceDir = join(DATABASE_DIR, cn + '高考');
      const candidates = [
        join(provinceDir, dirPart, filePart),
        join(provinceDir, filePath),
      ];
      for (const c of candidates) {
        if (existsSync(c)) return c;
      }
    }
  }

  const candidates = [
    join(DATABASE_DIR, filePath),
    join(DATABASE_DIR, dirPart, filePart),
    join(ROOT, filePath),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function findCorrectFileInProvinceDir(provinceCode, year, subject, mathType) {
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

  const candidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           !fName.includes('解析') &&
           !fName.includes('答案') &&
           !fName.includes('含解析') &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (subject === 'math') {
    const mathSplit = getMathSplit(provinceCode, year);
    if (mathSplit) {
      const targetType = mathType === 'arts' ? '文科' : mathType === 'science' ? '理科' : null;
      if (targetType) {
        const match = candidates.find(f => f.includes(targetType));
        if (match) return match;
      }
      const arts = candidates.find(f => f.includes('文科'));
      if (arts) return arts;
      const science = candidates.find(f => f.includes('理科'));
      if (science) return science;
    } else {
      const nonSplit = candidates.find(f => !f.includes('文科') && !f.includes('理科'));
      if (nonSplit) return nonSplit;
    }
  }

  if (candidates.length > 0) {
    return candidates[0];
  }

  const analysisCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (analysisCandidates.length > 0) {
    return analysisCandidates[0];
  }

  return null;
}

function getFileProvince(filePath) {
  if (!filePath) return null;
  const dirPart = filePath.split(/[/\\]/)[0] || '';
  const fileName = filePath.split(/[/\\]/).pop() || '';

  for (const [code, cn] of Object.entries(PROVINCE_CN)) {
    if (dirPart.includes(cn) || fileName.includes(cn + '市') || fileName.includes(cn + '省')) {
      return code;
    }
  }
  return null;
}

async function run() {
  const db = await getDb();

  console.log(`🔧 修复独立命题省份占位文件路径 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_type = 'independent' AND paper_file_path IS NOT NULL
    ORDER BY province_code, year, subject
  `);

  let fixed = 0;
  let notFound = 0;
  let alreadyCorrect = 0;
  let errors = 0;
  const notFoundList = [];
  const fixedList = [];

  for (const row of res.rows) {
    const fileProvince = getFileProvince(row.paper_file_path);

    if (!fileProvince || fileProvince === row.province_code) {
      alreadyCorrect++;
      continue;
    }

    const correctFile = findCorrectFileInProvinceDir(row.province_code, row.year, row.subject, row.math_type);

    if (correctFile) {
      const provinceCn = PROVINCE_CN[row.province_code];
      const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
      const relativePath = correctFile.replace(provinceDir + '\\', '').replace(provinceDir + '/', '').replace(/\\/g, '/');

      if (relativePath !== row.paper_file_path) {
        const oldResolved = resolveFilePath(row.paper_file_path);
        const newResolved = resolveFilePath(relativePath);

        if (newResolved && existsSync(newResolved)) {
          console.log(`  ✅ ${row.province_code} ${row.year} ${row.subject}:`);
          console.log(`     旧: ${row.paper_file_path} (来自${PROVINCE_CN[fileProvince]})`);
          console.log(`     新: ${relativePath} (本省)`);

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
          fixedList.push({
            province: row.province_code,
            year: row.year,
            subject: row.subject,
            oldPath: row.paper_file_path,
            newPath: relativePath
          });
        } else {
          notFound++;
          notFoundList.push({
            province: row.province_code,
            year: row.year,
            subject: row.subject,
            currentPath: row.paper_file_path,
            fileProvince: fileProvince
          });
        }
      }
    } else {
      notFound++;
      notFoundList.push({
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        currentPath: row.paper_file_path,
        fileProvince: fileProvince
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('修复统计:');
  console.log(`  已修复: ${fixed}`);
  console.log(`  未找到本省文件: ${notFound}`);
  console.log(`  已正确(本省文件): ${alreadyCorrect}`);
  console.log(`  错误: ${errors}`);

  if (fixedList.length > 0) {
    console.log(`\n修复详情 (前20条):`);
    for (const item of fixedList.slice(0, 20)) {
      console.log(`  ${item.province} ${item.year} ${item.subject}: ${item.oldPath.substring(0, 40)}... → ${item.newPath.substring(0, 40)}...`);
    }
  }

  if (notFoundList.length > 0) {
    const byProvince = {};
    for (const item of notFoundList) {
      if (!byProvince[item.province]) byProvince[item.province] = [];
      byProvince[item.province].push(`${item.year} ${item.subject}`);
    }
    console.log(`\n未找到本省文件的记录 (按省份, 共${notFoundList.length}条):`);
    for (const [p, items] of Object.entries(byProvince).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${p} (${items.length}条): ${items.slice(0, 8).join(', ')}${items.length > 8 ? '...' : ''}`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入数据库。去掉 --dry-run 参数执行实际更新。');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
