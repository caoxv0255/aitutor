#!/usr/bin/env node
/**
 * 修复跨省共享文件路径
 * Phase 3共享的文件在Phase 4重命名后，数据库路径未更新
 *
 * 策略：对于指向其他省份目录的路径，在源省份目录中搜索标准化后的文件名
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

function detectPathProvince(filePath) {
  if (!filePath) return null;
  const dirPart = filePath.split(/[/\\]/)[0] || '';
  for (const [code, cn] of Object.entries(PROVINCE_CN)) {
    if (dirPart.includes(cn)) return code;
  }
  return null;
}

function normalizePath(filePath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return filePath;
  const prefixes = [
    `database/高考真题/${provinceCn}高考/`,
    `database\\高考真题\\${provinceCn}高考\\`,
    `${provinceCn}高考/`,
    `${provinceCn}高考\\`
  ];
  for (const prefix of prefixes) {
    if (filePath.startsWith(prefix)) return filePath.substring(prefix.length);
  }
  return filePath;
}

function resolveInProvince(filePath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return null;
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  const candidates = [
    join(provinceDir, filePath),
    join(provinceDir, filePath.replace(/\//g, '\\')),
    join(provinceDir, normalizePath(filePath, provinceCode)),
    join(provinceDir, normalizePath(filePath, provinceCode).replace(/\//g, '\\')),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function searchFileInProvince(provinceCode, year, subject, mathType) {
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

  const original = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           !fName.includes('解析') &&
           !fName.includes('答案') &&
           !fName.includes('含解析') &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (subject === 'math' && mathType) {
    const target = mathType === 'arts' ? '文科' : '理科';
    const match = original.find(f => f.includes(target));
    if (match) return match;
  }
  if (original.length > 0) return original[0];

  const any = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });
  if (any.length > 0) return any[0];
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

  console.log(`🔧 修复跨省共享路径 ${isDryRun ? '(DRY-RUN)' : ''}`);
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
  let markedPlaceholder = 0;
  const notFoundList = [];

  for (const row of res.rows) {
    // 先在本省目录检查
    const localPath = resolveInProvince(row.paper_file_path, row.province_code);
    if (localPath) {
      alreadyOk++;
      continue;
    }

    // 检测路径指向的省份
    const pathProvince = detectPathProvince(row.paper_file_path);

    // 如果路径指向其他省份，在源省份目录搜索
    if (pathProvince && pathProvince !== row.province_code) {
      const sourcePath = resolveInProvince(row.paper_file_path, pathProvince);
      if (sourcePath) {
        // 源省份文件存在，路径OK
        alreadyOk++;
        continue;
      }

      // 源省份文件不存在（可能被重命名），搜索标准化文件名
      const found = searchFileInProvince(pathProvince, row.year, row.subject, row.math_type);
      if (found) {
        const relativePath = toRelativePath(found, pathProvince);
        console.log(`  [FIX] ${row.province_code} ${row.year} ${row.subject} → ${pathProvince}: ${relativePath}`);
        if (!isDryRun) {
          try {
            await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [relativePath, row.id]);
          } catch (err) {
            console.error(`     ❌ 更新失败: ${err.message}`);
            continue;
          }
        }
        fixed++;
        continue;
      }
    }

    // 在本省目录搜索
    const localFound = searchFileInProvince(row.province_code, row.year, row.subject, row.math_type);
    if (localFound) {
      const relativePath = toRelativePath(localFound, row.province_code);
      console.log(`  [LOCAL] ${row.province_code} ${row.year} ${row.subject}: ${relativePath}`);
      if (!isDryRun) {
        try {
          await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [relativePath, row.id]);
        } catch (err) {
          console.error(`     ❌ 更新失败: ${err.message}`);
          continue;
        }
      }
      fixed++;
      continue;
    }

    // 真正找不到，标记为占位
    notFound++;
    notFoundList.push({
      province: row.province_code,
      year: row.year,
      subject: row.subject,
      path: row.paper_file_path
    });

    if (!isDryRun) {
      try {
        await db.query('UPDATE exam_papers SET question_count = -1 WHERE id = $1', [row.id]);
        markedPlaceholder++;
      } catch (err) {
        console.error(`     ❌ 标记失败: ${err.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('修复统计:');
  console.log(`  已存在(无需修改): ${alreadyOk}`);
  console.log(`  路径修复: ${fixed}`);
  console.log(`  未找到(标记占位): ${notFound}`);
  console.log(`  错误: 0`);

  if (notFoundList.length > 0) {
    console.log(`\n未找到文件清单:`);
    for (const m of notFoundList) {
      console.log(`  ${m.province} ${m.year} ${m.subject}: ${m.path}`);
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
