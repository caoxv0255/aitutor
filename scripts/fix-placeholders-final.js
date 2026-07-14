#!/usr/bin/env node
/**
 * 最终占位文件修复脚本
 * 三层策略：本省文件搜索 → 全国卷共享 → 标记占位(question_count=-1)
 *
 * 改进点：
 * 1. Layer 1 增加解析版文件搜索（原卷版找不到时搜索解析版）
 * 2. Layer 2 增加 math_type 匹配（数学分文理时区分arts/science）
 * 3. Layer 3 标记 question_count = -1 表示占位文件
 *
 * 用法:
 *   node scripts/fix-placeholders-final.js              # 实际执行
 *   node scripts/fix-placeholders-final.js --dry-run    # 仅预览
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

const NATIONAL_TYPES = ['national_i', 'national_ii', 'national_iii', 'national_a', 'national_b', 'new_gaokao_i', 'new_gaokao_ii'];

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
  for (const [code, cn] of Object.entries(PROVINCE_CN)) {
    if (dirPart.includes(cn)) return code;
  }
  const fileName = filePath.split(/[/\\]/).pop() || '';
  for (const [code, cn] of Object.entries(PROVINCE_CN)) {
    if (fileName.includes(cn)) return code;
  }
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

function resolveRelativePath(relativePath, provinceCode) {
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return null;
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');
  const candidates = [
    join(provinceDir, relativePath),
    join(provinceDir, relativePath.replace(/\//g, '\\')),
  ];
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

  // 优先搜索原卷版/空白卷
  const originalCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           !fName.includes('解析') &&
           !fName.includes('答案') &&
           !fName.includes('含解析') &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  // 如果是数学且分文理，按math_type筛选
  if (subject === 'math') {
    const mathSplit = getMathSplit(provinceCode, year);
    if (mathSplit) {
      const targetType = mathType === 'arts' ? '文科' : mathType === 'science' ? '理科' : null;
      if (targetType) {
        const match = originalCandidates.find(f => f.includes(targetType));
        if (match) return match;
      }
      // 如果math_type为NULL，尝试文科优先
      const arts = originalCandidates.find(f => f.includes('文科'));
      if (arts) return arts;
      const science = originalCandidates.find(f => f.includes('理科'));
      if (science) return science;
    } else {
      // 不分文理，排除文理科文件
      const nonSplit = originalCandidates.find(f => !f.includes('文科') && !f.includes('理科'));
      if (nonSplit) return nonSplit;
    }
  }

  if (originalCandidates.length > 0) return originalCandidates[0];

  // 其次搜索解析版/答案版
  const analysisCandidates = allFiles.filter(f => {
    const fName = f.split(/[/\\]/).pop() || '';
    return fName.includes(yearStr) &&
           fName.includes(subjectCn) &&
           (fName.endsWith('.pdf') || fName.endsWith('.doc') || fName.endsWith('.docx'));
  });

  if (subject === 'math') {
    const mathSplit = getMathSplit(provinceCode, year);
    if (mathSplit) {
      const targetType = mathType === 'arts' ? '文科' : mathType === 'science' ? '理科' : null;
      if (targetType) {
        const match = analysisCandidates.find(f => f.includes(targetType));
        if (match) return match;
      }
      const arts = analysisCandidates.find(f => f.includes('文科'));
      if (arts) return arts;
      const science = analysisCandidates.find(f => f.includes('理科'));
      if (science) return science;
    } else {
      const nonSplit = analysisCandidates.find(f => !f.includes('文科') && !f.includes('理科'));
      if (nonSplit) return nonSplit;
    }
  }

  if (analysisCandidates.length > 0) return analysisCandidates[0];
  return null;
}

async function run() {
  const db = await getDb();

  console.log(`🔧 最终占位文件修复 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type, question_count
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL
    ORDER BY province_code, year, subject
  `);

  // 识别占位文件
  const placeholders = [];
  for (const row of res.rows) {
    const fileProvince = getFileProvince(row.paper_file_path);
    if (fileProvince && fileProvince !== row.province_code) {
      placeholders.push({ ...row, fileProvince });
    }
  }

  console.log(`总记录: ${res.rows.length}, 占位文件: ${placeholders.length}\n`);

  // 构建全国卷共享索引（非占位文件）
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
  let layer3Marked = 0;
  let errors = 0;
  const fixedList = [];
  const markedList = [];

  for (const row of placeholders) {
    // Layer 1: 本省文件搜索
    const layer1File = findInProvinceDir(row.province_code, row.year, row.subject, row.math_type);

    if (layer1File) {
      const relativePath = toRelativePath(layer1File, row.province_code);
      const resolved = resolveRelativePath(relativePath, row.province_code);

      if (resolved && existsSync(resolved) && relativePath !== row.paper_file_path) {
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
        fixedList.push({ layer: 1, ...row, newPath: relativePath });
        continue;
      }
    }

    // Layer 2: 全国卷共享
    const key = `${row.paper_type}_${row.year}_${row.subject}`;
    const shareable = NATIONAL_TYPES.includes(row.paper_type) ? (shareableIndex[key] || []) : [];

    // 对数学记录，优先匹配math_type
    let suitable = null;
    if (row.subject === 'math' && row.math_type) {
      suitable = shareable.find(s =>
        s.provinceCode !== row.province_code && s.mathType === row.math_type
      );
    }
    if (!suitable) {
      suitable = shareable.find(s => s.provinceCode !== row.province_code);
    }

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
      fixedList.push({ layer: 2, ...row, newPath: suitable.paperFilePath, sharedFrom: suitable.provinceCode });
      continue;
    }

    // Layer 3: 标记为占位文件
    if (row.question_count !== -1) {
      console.log(`  [L3] ${row.province_code} ${row.year} ${row.subject} → 标记占位`);
      if (!isDryRun) {
        try {
          await db.query('UPDATE exam_papers SET question_count = -1 WHERE id = $1', [row.id]);
        } catch (err) {
          console.error(`     ❌ 标记失败: ${err.message}`);
          errors++;
          continue;
        }
      }
      layer3Marked++;
      markedList.push({ ...row });
    } else {
      // 已经标记过
      layer3Marked++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('修复统计:');
  console.log(`  Layer 1 - 本省文件修复: ${layer1Fixed}`);
  console.log(`  Layer 2 - 全国卷共享修复: ${layer2Fixed}`);
  console.log(`  Layer 3 - 标记为占位: ${layer3Marked}`);
  console.log(`  错误: ${errors}`);
  console.log(`  总修复: ${layer1Fixed + layer2Fixed}`);

  // 按学科统计Layer3
  if (markedList.length > 0) {
    const bySubject = {};
    for (const item of markedList) {
      bySubject[item.subject] = (bySubject[item.subject] || 0) + 1;
    }
    console.log(`\n占位文件按学科分布:`);
    for (const [s, c] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s}: ${c}`);
    }

    const byType = {};
    for (const item of markedList) {
      byType[item.paper_type] = (byType[item.paper_type] || 0) + 1;
    }
    console.log(`\n占位文件按卷型分布:`);
    for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      const label = PAPER_TYPE_LABELS[t] || t;
      console.log(`  ${label}: ${c}`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入数据库。去掉 --dry-run 执行实际更新。');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
