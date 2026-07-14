#!/usr/bin/env node
/**
 * 修复错误学科文件路径
 * 检测文件名中包含的学科与数据库记录的学科不一致的情况，
 * 并在同目录下搜索正确学科+相同年份的文件进行修正。
 *
 * 用法:
 *   node scripts/fix-wrong-subject-paths.js              # 实际执行
 *   node scripts/fix-wrong-subject-paths.js --dry-run    # 仅预览不写入
 */
import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dirname as pathDirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);
const ROOT = join(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理'
};

const ALL_SUBJECT_KEYWORDS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

const PROVINCE_CN_MAP = {
  '北京': 'beijing', '上海': 'shanghai', '天津': 'tianjin', '重庆': 'chongqing',
  '河北': 'hebei', '河南': 'henan', '山东': 'shandong', '江苏': 'jiangsu',
  '浙江': 'zhejiang', '福建': 'fujian', '广东': 'guangdong', '湖北': 'hubei',
  '湖南': 'hunan', '安徽': 'anhui', '江西': 'jiangxi', '四川': 'sichuan',
  '陕西': 'shaanxi', '贵州': 'guizhou', '云南': 'yunnan', '新疆': 'xinjiang',
  '西藏': 'xizang', '内蒙古': 'neimenggu', '宁夏': 'ningxia', '青海': 'qinghai',
  '甘肃': 'gansu', '黑龙江': 'heilongjiang', '吉林': 'jilin', '山西': 'shanxi',
  '辽宁': 'liaoning', '海南': 'hainan', '广西': 'guangxi'
};

function resolveDirectory(filePath) {
  if (!filePath) return null;
  const dirPart = filePath.split(/[/\\]/)[0];
  const filePart = filePath.substring(dirPart.length + 1);

  for (const cn of Object.keys(PROVINCE_CN_MAP)) {
    if (dirPart.includes(cn)) {
      return join(ROOT, 'database', '高考真题', cn + '高考', dirPart);
    }
  }
  return join(ROOT, 'database', '高考真题', dirPart);
}

function findCorrectFile(dirPath, year, subjectCn) {
  if (!existsSync(dirPath)) return null;

  let files;
  try {
    files = readdirSync(dirPath);
  } catch {
    return null;
  }

  const yearStr = year.toString();
  const candidates = files.filter(f => {
    const fStr = String(f);
    return fStr.includes(yearStr) &&
           fStr.includes(subjectCn) &&
           !fStr.includes('解析') &&
           !fStr.includes('答案') &&
           !fStr.includes('含解析') &&
           (fStr.endsWith('.pdf') || fStr.endsWith('.doc') || fStr.endsWith('.docx'));
  });

  if (candidates.length > 0) {
    return candidates[0];
  }

  const analysisCandidates = files.filter(f => {
    const fStr = String(f);
    return fStr.includes(yearStr) &&
           fStr.includes(subjectCn) &&
           (fStr.endsWith('.pdf') || fStr.endsWith('.doc') || fStr.endsWith('.docx'));
  });

  if (analysisCandidates.length > 0) {
    return analysisCandidates[0];
  }

  return null;
}

async function run() {
  const db = await getDb();

  console.log(`🔧 修复错误学科文件路径 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(80));

  const res = await db.query(`
    SELECT id, province_code, year, subject, paper_file_path
    FROM exam_papers
    WHERE exam_level = 'gaokao' AND paper_file_path IS NOT NULL
    ORDER BY province_code, year, subject
  `);

  let fixed = 0;
  let notFound = 0;
  let errors = 0;
  const notFoundList = [];

  for (const row of res.rows) {
    if (!row.paper_file_path) continue;

    const fileName = row.paper_file_path.split(/[/\\]/).pop() || '';
    const expectedSubjectCn = SUBJECT_CN[row.subject];
    if (!expectedSubjectCn) continue;

    const fileSubject = ALL_SUBJECT_KEYWORDS.find(s => fileName.includes(s));

    if (fileSubject && fileSubject !== expectedSubjectCn) {
      const dirPath = resolveDirectory(row.paper_file_path);
      const correctFile = findCorrectFile(dirPath, row.year, expectedSubjectCn);

      if (correctFile) {
        const dirPart = row.paper_file_path.split(/[/\\]/)[0];
        const newPath = `${dirPart}/${correctFile}`.replace(/\\/g, '/');

        if (newPath !== row.paper_file_path) {
          console.log(`  ✅ ${row.province_code} ${row.year} ${row.subject}:`);
          console.log(`     旧: ${row.paper_file_path}`);
          console.log(`     新: ${newPath}`);

          if (!isDryRun) {
            try {
              await db.query('UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2', [newPath, row.id]);
            } catch (err) {
              console.error(`     ❌ 更新失败: ${err.message}`);
              errors++;
              continue;
            }
          }
          fixed++;
        }
      } else {
        console.log(`  ⚠️  ${row.province_code} ${row.year} ${row.subject}: 文件名含"${fileSubject}"，未找到${expectedSubjectCn}替代文件`);
        notFound++;
        notFoundList.push({
          province: row.province_code,
          year: row.year,
          subject: row.subject,
          currentPath: row.paper_file_path,
          issue: `文件名含"${fileSubject}"，应为"${expectedSubjectCn}"`
        });
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('修复统计:');
  console.log(`  已修复: ${fixed}`);
  console.log(`  未找到替代文件: ${notFound}`);
  console.log(`  错误: ${errors}`);

  if (notFoundList.length > 0) {
    console.log('\n未找到替代文件的记录:');
    for (const item of notFoundList) {
      console.log(`  ${item.province} ${item.year} ${item.subject}: ${item.issue}`);
      console.log(`    当前路径: ${item.currentPath}`);
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
