#!/usr/bin/env node
/**
 * PDF/DOC/DOCX 文件命名标准化脚本
 *
 * 标准命名格式:
 *   {年份}年{省份/卷型}高考{学科}试卷（{版本}）.{ext}
 *   数学分科: {年份}年{省份/卷型}高考数学试卷（文科/理科）（{版本}）.{ext}
 *
 * 用法:
 *   node scripts/standardize-file-names.js              # 实际执行
 *   node scripts/standardize-file-names.js --dry-run    # 仅预览不写入
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
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

const PROVINCE_CODE_BY_CN = {};
for (const [code, cn] of Object.entries(PROVINCE_CN)) {
  PROVINCE_CODE_BY_CN[cn] = code;
}

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理'
};

const SUBJECT_CODE_BY_CN = {};
for (const [code, cn] of Object.entries(SUBJECT_CN)) {
  SUBJECT_CODE_BY_CN[cn] = code;
}

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

function parseFileName(fileName) {
  const result = {
    year: null,
    province: null,
    subject: null,
    mathType: null,
    version: null,
    ext: null
  };

  const ext = fileName.match(/\.(pdf|doc|docx)$/i);
  if (ext) result.ext = ext[1].toLowerCase();

  const yearMatch = fileName.match(/(\d{4})年/);
  if (yearMatch) result.year = parseInt(yearMatch[1]);

  for (const [cn, code] of Object.entries(PROVINCE_CODE_BY_CN)) {
    if (fileName.includes(cn)) {
      result.province = code;
      break;
    }
  }

  for (const [cn, code] of Object.entries(SUBJECT_CODE_BY_CN)) {
    if (fileName.includes(cn)) {
      result.subject = code;
      break;
    }
  }

  if (fileName.includes('文科')) result.mathType = 'arts';
  else if (fileName.includes('理科')) result.mathType = 'science';

  if (fileName.includes('原卷版') || fileName.includes('空白卷') || fileName.includes('真题')) {
    if (!fileName.includes('解析') && !fileName.includes('答案')) {
      result.version = '原卷版';
    }
  }
  if (fileName.includes('解析版') || fileName.includes('含解析')) {
    result.version = '解析版';
  } else if (fileName.includes('解析') && !fileName.includes('原卷')) {
    result.version = '解析版';
  }
  if (fileName.includes('答案') && !fileName.includes('原卷')) {
    if (result.version !== '解析版') {
      result.version = '答案版';
    }
  }
  if (!result.version) {
    if (fileName.includes('解析') || fileName.includes('答案')) {
      result.version = '解析版';
    } else {
      result.version = '原卷版';
    }
  }

  return result;
}

function generateStandardName(parsed, paperType, provinceCode) {
  const parts = [];

  if (parsed.year) {
    parts.push(`${parsed.year}年`);
  }

  if (paperType && paperType !== 'independent' && PAPER_TYPE_LABELS_CN[paperType]) {
    parts.push(PAPER_TYPE_LABELS_CN[paperType]);
  } else if (provinceCode && PROVINCE_CN[provinceCode]) {
    parts.push(PROVINCE_CN[provinceCode]);
  } else if (parsed.province && PROVINCE_CN[parsed.province]) {
    parts.push(PROVINCE_CN[parsed.province]);
  }

  parts.push('高考');

  if (parsed.subject && SUBJECT_CN[parsed.subject]) {
    parts.push(SUBJECT_CN[parsed.subject]);
  }
  parts.push('试卷');

  const versionParts = [];
  if (parsed.subject === 'math' && parsed.mathType) {
    versionParts.push(parsed.mathType === 'arts' ? '文科' : '理科');
  }
  versionParts.push(parsed.version || '原卷版');

  return `${parts.join('')}（${versionParts.join('）（')}）.${parsed.ext || 'pdf'}`;
}

function isTempFile(fileName) {
  return fileName.startsWith('.cache.') ||
         fileName.startsWith('~$') ||
         fileName.startsWith('._') ||
         fileName === 'Thumbs.db' ||
         fileName === '.DS_Store';
}

async function run() {
  const db = await getDb();

  console.log(`📝 文件命名标准化 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const dbPathMap = {};
  const pathRes = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path, paper_type, math_type
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL
  `);
  for (const row of pathRes.rows) {
    dbPathMap[row.paper_file_path] = row;
    const normalized = row.paper_file_path.replace(/\\/g, '/');
    if (normalized !== row.paper_file_path) {
      dbPathMap[normalized] = row;
    }
  }

  let totalFiles = 0;
  let renamedFiles = 0;
  let deletedTempFiles = 0;
  let skippedFiles = 0;
  let dbUpdates = 0;
  let errors = 0;
  const renameMap = {};
  const deletedList = [];
  const errorList = [];

  for (const [code, cn] of Object.entries(PROVINCE_CN)) {
    const provinceDir = join(DATABASE_DIR, cn + '高考');
    if (!existsSync(provinceDir)) continue;

    let allFiles;
    try {
      allFiles = readdirSync(provinceDir, { recursive: true }).map(f => String(f));
    } catch {
      continue;
    }

    for (const relPath of allFiles) {
      const fullPath = join(provinceDir, relPath);
      if (!existsSync(fullPath) || !statSync(fullPath).isFile()) continue;

      const fileName = relPath.split(/[/\\]/).pop() || '';

      if (!fileName.match(/\.(pdf|doc|docx)$/i)) continue;

      totalFiles++;

      if (isTempFile(fileName)) {
        console.log(`  [DEL] ${cn}/${fileName}`);
        if (!isDryRun) {
          try {
            unlinkSync(fullPath);
            deletedTempFiles++;
            deletedList.push({ province: code, file: fileName });
          } catch (err) {
            console.error(`     ❌ 删除失败: ${err.message}`);
            errors++;
          }
        } else {
          deletedTempFiles++;
        }
        continue;
      }

      const parsed = parseFileName(fileName);
      if (!parsed.year || !parsed.subject) {
        skippedFiles++;
        continue;
      }

      const paperType = dbPathMap[relPath.replace(/\\/g, '/')]?.paper_type ||
                        dbPathMap[relPath]?.paper_type;
      const provinceCode = code;

      const standardName = generateStandardName(parsed, paperType, provinceCode);

      if (fileName === standardName) {
        skippedFiles++;
        continue;
      }

      const dir = dirname(fullPath);
      const newFullPath = join(dir, standardName);

      if (existsSync(newFullPath) && newFullPath !== fullPath) {
        console.log(`  [SKIP-CONFLICT] ${cn}/${fileName} → ${standardName} (目标已存在)`);
        skippedFiles++;
        continue;
      }

      console.log(`  [RENAME] ${cn}/${fileName}`);
      console.log(`        → ${standardName}`);

      if (!isDryRun) {
        try {
          renameSync(fullPath, newFullPath);
          renamedFiles++;

          const oldRelPath = relPath.replace(/\\/g, '/');
          const newRelPath = relPath.replace(/[/\\][^/\\]+$/, '/' + standardName).replace(/\\/g, '/');

          renameMap[oldRelPath] = newRelPath;
        } catch (err) {
          console.error(`     ❌ 重命名失败: ${err.message}`);
          errors++;
          errorList.push({ province: code, file: fileName, error: err.message });
        }
      } else {
        renamedFiles++;
      }
    }
  }

  if (!isDryRun && Object.keys(renameMap).length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('更新数据库路径...');

    for (const [oldPath, newPath] of Object.entries(renameMap)) {
      const row = dbPathMap[oldPath];
      if (row) {
        try {
          await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [newPath, row.id]);
          dbUpdates++;
        } catch (err) {
          console.error(`  ❌ DB更新失败 ${oldPath}: ${err.message}`);
          errors++;
        }
      } else {
        const likeRes = await db.query(`
          SELECT id, paper_file_path FROM exam_papers
          WHERE exam_level = 'gaokao' AND paper_file_path = $1
        `, [oldPath]);
        for (const r of likeRes.rows) {
          try {
            await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [newPath, r.id]);
            dbUpdates++;
          } catch (err) {
            console.error(`  ❌ DB更新失败 ${oldPath}: ${err.message}`);
            errors++;
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('标准化统计:');
  console.log(`  总文件数: ${totalFiles}`);
  console.log(`  已重命名: ${renamedFiles}`);
  console.log(`  删除临时文件: ${deletedTempFiles}`);
  console.log(`  跳过(已标准/无法解析/冲突): ${skippedFiles}`);
  console.log(`  数据库路径更新: ${dbUpdates}`);
  console.log(`  错误: ${errors}`);

  if (deletedList.length > 0) {
    console.log(`\n删除的临时文件 (前10条):`);
    for (const d of deletedList.slice(0, 10)) {
      console.log(`  ${d.province}: ${d.file}`);
    }
    if (deletedList.length > 10) {
      console.log(`  ... 还有 ${deletedList.length - 10} 个`);
    }
  }

  if (errorList.length > 0) {
    console.log(`\n错误详情 (前10条):`);
    for (const e of errorList.slice(0, 10)) {
      console.log(`  ${e.province}: ${e.file} - ${e.error}`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN 模式，未实际写入。去掉 --dry-run 参数执行实际更新。');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('标准化失败:', err);
  process.exit(1);
});
