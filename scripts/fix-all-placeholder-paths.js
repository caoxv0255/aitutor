#!/usr/bin/env node
/**
 * 全量占位文件修复脚本
 * 检测所有paper_type的占位文件（指向其他省份），通过三层策略修复：
 *   Layer 1 - 本省文件搜索
 *   Layer 2 - 全国卷共享（同paper_type+year+subject的其他省份文件）
 *   Layer 3 - 保留占位，记录到报告
 *
 * 用法:
 *   node scripts/fix-all-placeholder-paths.js              # 实际执行
 *   node scripts/fix-all-placeholder-paths.js --dry-run    # 仅预览不写入
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';
import { getMathSplit, PAPER_TYPE_LABELS } from './lib/paper-evolution.js';

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

const provinceFileCache = {};

function getProvinceFiles(provinceCode) {
  if (provinceFileCache[provinceCode]) return provinceFileCache[provinceCode];
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return [];
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  if (!existsSync(provinceDir)) {
    provinceFileCache[provinceCode] = [];
    return [];
  }
  try {
    const files = readdirSync(provinceDir, { recursive: true }).map(f => String(f));
    provinceFileCache[provinceCode] = files;
    return files;
  } catch {
    provinceFileCache[provinceCode] = [];
    return [];
  }
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

function resolveFilePath(filePath) {
  if (!filePath) return null;
  if (existsSync(filePath)) return filePath;
  const dirPart = filePath.split(/[/\\]/)[0];
  const filePart = filePath.substring(dirPart.length + 1);
  for (const cn of Object.values(PROVINCE_CN)) {
    if (dirPart.includes(cn)) {
      const provinceDir = join(DATABASE_DIR, cn + '高考');
      const candidates = [join(provinceDir, dirPart, filePart), join(provinceDir, filePath)];
      for (const c of candidates) {
        if (existsSync(c)) return c;
      }
    }
  }
  const candidates = [join(DATABASE_DIR, filePath), join(DATABASE_DIR, dirPart, filePart), join(ROOT, filePath)];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function findInProvinceDir(provinceCode, year, subject, mathType) {
  const allFiles = getProvinceFiles(provinceCode);
  if (allFiles.length === 0) return null;

  const subjectCn = SUBJECT_CN[subject];
  if (!subjectCn) return null;
  const yearStr = year.toString();

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

  if (candidates.length > 0) return candidates[0];

  const analysisCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (analysisCandidates.length > 0) return analysisCandidates[0];
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

  console.log(`🔧 全量占位文件修复 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL
    ORDER BY province_code, year, subject
  `);

  const placeholders = [];
  for (const row of res.rows) {
    const fileProvince = getFileProvince(row.paper_file_path);
    if (fileProvince && fileProvince !== row.province_code) {
      placeholders.push({ ...row, fileProvince });
    }
  }

  console.log(`总记录: ${res.rows.length}, 占位文件: ${placeholders.length}\n`);

  const NATIONAL_TYPES = ['national_i', 'national_ii', 'national_iii', 'national_a', 'national_b', 'new_gaokao_i', 'new_gaokao_ii'];

  const shareableIndex = {};
  for (const row of res.rows) {
    if (!NATIONAL_TYPES.includes(row.paper_type)) continue;
    const fileProvince = getFileProvince(row.paper_file_path);
    if (!fileProvince || fileProvince !== row.province_code) continue;
    const key = `${row.paper_type}_${row.year}_${row.subject}`;
    if (!shareableIndex[key]) shareableIndex[key] = [];
    shareableIndex[key].push({
      provinceCode: row.province_code,
      paperFilePath: row.paper_file_path,
      mathType: row.math_type
    });
  }

  let layer1Fixed = 0;
  let layer2Fixed = 0;
  let layer3Retained = 0;
  let errors = 0;
  const fixedList = [];
  const retainedList = [];

  for (const row of placeholders) {
    const layer1File = findInProvinceDir(row.province_code, row.year, row.subject, row.math_type);

    if (layer1File) {
      const relativePath = toRelativePath(layer1File, row.province_code);
      const newResolved = resolveFilePath(relativePath);

      if (newResolved && existsSync(newResolved) && relativePath !== row.paper_file_path) {
        console.log(`  [L1] ${row.province_code} ${row.year} ${row.subject}: ${relativePath}`);
        if (!isDryRun) {
          try {
            await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [relativePath, row.id]);
          } catch (err) {
            console.error(`     ❌ 更新失败: ${err.message}`);
            errors++;
            continue;
          }
        }
        layer1Fixed++;
        fixedList.push({ layer: 1, province: row.province_code, year: row.year, subject: row.subject, newPath: relativePath });
        continue;
      }
    }

    const key = `${row.paper_type}_${row.year}_${row.subject}`;
    const shareable = NATIONAL_TYPES.includes(row.paper_type) ? (shareableIndex[key] || []) : [];
    const suitable = shareable.find(s => s.provinceCode !== row.province_code);

    if (suitable) {
      console.log(`  [L2] ${row.province_code} ${row.year} ${row.subject} ← ${suitable.provinceCode} (${row.paper_type})`);
      if (!isDryRun) {
        try {
          await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [suitable.paperFilePath, row.id]);
        } catch (err) {
          console.error(`     ❌ 更新失败: ${err.message}`);
          errors++;
          continue;
        }
      }
      layer2Fixed++;
      fixedList.push({ layer: 2, province: row.province_code, year: row.year, subject: row.subject, newPath: suitable.paperFilePath, sharedFrom: suitable.provinceCode });
      continue;
    }

    layer3Retained++;
    retainedList.push({
      province: row.province_code,
      year: row.year,
      subject: row.subject,
      paperType: row.paper_type,
      currentPath: row.paper_file_path,
      fileProvince: row.fileProvince
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('修复统计:');
  console.log(`  Layer 1 - 本省文件修复: ${layer1Fixed}`);
  console.log(`  Layer 2 - 全国卷共享修复: ${layer2Fixed}`);
  console.log(`  Layer 3 - 保留占位: ${layer3Retained}`);
  console.log(`  错误: ${errors}`);
  console.log(`  总修复: ${layer1Fixed + layer2Fixed}`);

  if (layer2Fixed > 0) {
    console.log(`\n全国卷共享修复详情 (前20条):`);
    const l2Items = fixedList.filter(f => f.layer === 2);
    for (const item of l2Items.slice(0, 20)) {
      console.log(`  ${item.province} ${item.year} ${item.subject} ← ${item.sharedFrom}`);
    }
    if (l2Items.length > 20) {
      console.log(`  ... 还有 ${l2Items.length - 20} 条`);
    }
  }

  if (retainedList.length > 0) {
    const bySubject = {};
    for (const item of retainedList) {
      if (!bySubject[item.subject]) bySubject[item.subject] = 0;
      bySubject[item.subject]++;
    }
    console.log(`\n保留占位按学科分布:`);
    for (const [s, c] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s}: ${c}`);
    }

    const byType = {};
    for (const item of retainedList) {
      if (!byType[item.paperType]) byType[item.paperType] = 0;
      byType[item.paperType]++;
    }
    console.log(`\n保留占位按卷型分布:`);
    for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      const label = PAPER_TYPE_LABELS[t] || t;
      console.log(`  ${label}: ${c}`);
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
