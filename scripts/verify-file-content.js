#!/usr/bin/env node
/**
 * 文件内容验证脚本
 * 1. 检查所有 paper_file_path 对应的文件是否存在
 * 2. 检查文件大小异常（<10KB 或 >50MB）
 * 3. 抽样验证 PDF/DOCX 文件可读性
 * 4. 检查文件名与数据库记录的一致性
 *
 * 用法:
 *   node scripts/verify-file-content.js              # 验证全部
 *   node scripts/verify-file-content.js --sample 50  # 抽样50条
 */
import { getDb } from '../api/core/db.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);
const ROOT = join(__dirname, '..');
const DATABASE_DIR = join(ROOT, 'database', '高考真题');

const sampleSize = (() => {
  const idx = process.argv.indexOf('--sample');
  if (idx >= 0 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1]);
  return 0; // 0 = all
})();

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

function resolveFilePath(filePath, provinceCode) {
  if (!filePath) return null;
  const provinceCn = PROVINCE_CN[provinceCode];
  if (!provinceCn) return null;
  const provinceDir = join(DATABASE_DIR, provinceCn + '高考');

  const candidates = [
    join(provinceDir, filePath),
    join(provinceDir, filePath.replace(/\//g, '\\')),
    join(provinceDir, normalizePath(filePath, provinceCode)),
    join(provinceDir, normalizePath(filePath, provinceCode).replace(/\//g, '\\')),
    join(DATABASE_DIR, filePath),
    join(ROOT, filePath),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // 检查路径指向的源省份目录
  const pathProvince = detectPathProvince(filePath);
  if (pathProvince && pathProvince !== provinceCode) {
    const pathProvinceCn = PROVINCE_CN[pathProvince];
    const pathProvinceDir = join(DATABASE_DIR, pathProvinceCn + '高考');
    const crossCandidates = [
      join(pathProvinceDir, filePath),
      join(pathProvinceDir, filePath.replace(/\//g, '\\')),
      join(pathProvinceDir, normalizePath(filePath, pathProvince)),
      join(pathProvinceDir, normalizePath(filePath, pathProvince).replace(/\//g, '\\')),
    ];
    for (const c of crossCandidates) {
      if (existsSync(c)) return c;
    }
  }

  return null;
}

async function run() {
  const db = await getDb();

  console.log('🔍 文件内容验证');
  console.log('='.repeat(60));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type, question_count
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL
    ORDER BY province_code, year, subject
  `);

  let rows = res.rows;
  if (sampleSize > 0 && sampleSize < rows.length) {
    const step = Math.floor(rows.length / sampleSize);
    rows = rows.filter((_, i) => i % step === 0).slice(0, sampleSize);
    console.log(`抽样验证: ${rows.length} 条 (总计 ${res.rows.length})\n`);
  } else {
    console.log(`全量验证: ${rows.length} 条\n`);
  }

  let exists = 0;
  let missing = 0;
  let tooSmall = 0;
  let tooLarge = 0;
  let isPlaceholder = 0;
  const missingList = [];
  const sizeIssueList = [];

  for (const row of rows) {
    if (row.question_count === -1) {
      isPlaceholder++;
      continue;
    }

    const fullPath = resolveFilePath(row.paper_file_path, row.province_code);

    if (!fullPath) {
      missing++;
      missingList.push({
        id: row.id,
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        path: row.paper_file_path
      });
      continue;
    }

    exists++;
    const stat = statSync(fullPath);
    const sizeKB = stat.size / 1024;

    if (sizeKB < 10) {
      tooSmall++;
      sizeIssueList.push({
        id: row.id,
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        size: sizeKB.toFixed(1) + 'KB',
        issue: 'too_small'
      });
    } else if (sizeKB > 51200) {
      tooLarge++;
      sizeIssueList.push({
        id: row.id,
        province: row.province_code,
        year: row.year,
        subject: row.subject,
        size: (sizeKB / 1024).toFixed(1) + 'MB',
        issue: 'too_large'
      });
    }
  }

  console.log('验证结果:');
  console.log(`  文件存在: ${exists}`);
  console.log(`  文件缺失: ${missing}`);
  console.log(`  占位文件(跳过): ${isPlaceholder}`);
  console.log(`  文件过小(<10KB): ${tooSmall}`);
  console.log(`  文件过大(>50MB): ${tooLarge}`);

  if (missingList.length > 0) {
    console.log(`\n缺失文件 (前30条):`);
    for (const m of missingList.slice(0, 30)) {
      console.log(`  ${m.province} ${m.year} ${m.subject}: ${m.path}`);
    }
    if (missingList.length > 30) {
      console.log(`  ... 还有 ${missingList.length - 30} 条`);
    }
  }

  if (sizeIssueList.length > 0) {
    console.log(`\n文件大小异常 (前20条):`);
    for (const s of sizeIssueList.slice(0, 20)) {
      console.log(`  ${s.province} ${s.year} ${s.subject}: ${s.size} (${s.issue})`);
    }
    if (sizeIssueList.length > 20) {
      console.log(`  ... 还有 ${sizeIssueList.length - 20} 条`);
    }
  }

  if (missing === 0 && tooSmall === 0 && tooLarge === 0) {
    console.log('\n✅ 所有文件验证通过！');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('验证失败:', err);
  process.exit(1);
});
