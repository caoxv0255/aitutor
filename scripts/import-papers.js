#!/usr/bin/env node
/**
 * 试卷数据导入脚本
 * 扫描 database/ 目录，识别各省份试卷文件，创建试卷记录
 */
import { getDb } from '../api/db.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// 省份名称到 code 的映射
const PROVINCE_MAP = {
  '北京卷': 'beijing', '北京': 'beijing',
  '上海卷': 'shanghai', '上海': 'shanghai',
  '天津卷': 'tianjin', '天津': 'tianjin',
  '山东卷': 'shandong', '山东': 'shandong',
  '广东卷': 'guangdong', '广东': 'guangdong',
  '浙江卷': 'zhejiang', '浙江': 'zhejiang',
  '江苏卷': 'jiangsu', '江苏': 'jiangsu',
  '河南卷': 'henan', '河南': 'henan',
  '四川卷': 'sichuan', '四川': 'sichuan',
  '河北卷': 'hebei', '河北': 'hebei',
  '湖北卷': 'hubei', '湖北': 'hubei',
  '湖南卷': 'hunan', '湖南': 'hunan',
  '福建卷': 'fujian', '福建': 'fujian',
  '安徽卷': 'anhui', '安徽': 'anhui',
  '辽宁卷': 'liaoning', '辽宁': 'liaoning',
  '重庆卷': 'chongqing', '重庆': 'chongqing',
  '江西卷': 'jiangxi', '江西': 'jiangxi',
  '贵州卷': 'guizhou', '贵州': 'guizhou',
  '广西卷': 'guangxi', '广西': 'guangxi',
  '云南卷': 'yunnan', '云南': 'yunnan',
  '山西卷': 'shanxi', '山西': 'shanxi',
  '陕西卷': 'shaanxi', '陕西': 'shaanxi',
  '甘肃卷': 'gansu', '甘肃': 'gansu',
  '黑龙江卷': 'heilongjiang', '黑龙江': 'heilongjiang',
  '吉林卷': 'jilin', '吉林': 'jilin',
  '内蒙古卷': 'neimenggu', '内蒙古': 'neimenggu',
  '青海卷': 'qinghai', '青海': 'qinghai',
  '宁夏卷': 'ningxia', '宁夏': 'ningxia',
  '海南卷': 'hainan', '海南': 'hainan',
  '新疆卷': 'xinjiang', '新疆': 'xinjiang',
  '西藏卷': 'xizang', '西藏': 'xizang',
  '新课标全国Ⅰ卷': 'national_i', '新课标全国I卷': 'national_i',
  '新课标全国Ⅱ卷': 'national_ii', '新课标全国II卷': 'national_ii',
  '全国甲卷': 'national_a', '全国乙卷': 'national_b',
  '北京高考语文': 'beijing', '北京高考数学': 'beijing',
  '北京高考英语': 'beijing', '北京高考物理': 'beijing',
  '北京高考化学': 'beijing', '北京高考生物': 'beijing',
  '北京高考历史': 'beijing', '北京高考政治': 'beijing',
  '北京高考地理': 'beijing',
};

// 学科名称映射
const SUBJECT_MAP = {
  '语文': 'chinese', '数学': 'math', '英语': 'english',
  '物理': 'physics', '化学': 'chemistry', '生物': 'biology',
  '政治': 'politics', '历史': 'history', '地理': 'geography',
  '文综': 'comprehensive_arts', '理综': 'comprehensive_science',
};

// 年份正则
const YEAR_REGEX = /20(\d{2})/;

function detectProvince(filename) {
  for (const [key, code] of Object.entries(PROVINCE_MAP)) {
    if (filename.includes(key)) return code;
  }
  return null;
}

function detectSubject(filename) {
  for (const [key, code] of Object.entries(SUBJECT_MAP)) {
    if (filename.includes(key)) return code;
  }
  return null;
}

function detectYear(filename) {
  const match = filename.match(YEAR_REGEX);
  if (match) return 2000 + parseInt(match[1]);
  return null;
}

async function importPapers() {
  const pool = await getDb();
  const databaseDir = join(ROOT, 'database');

  console.log('🔍 扫描 database/ 目录...\n');

  const entries = readdirSync(databaseDir);
  let totalCreated = 0;

  for (const entry of entries) {
    const entryPath = join(databaseDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    // 识别省份
    const provinceCode = detectProvince(entry);
    if (!provinceCode) {
      console.log(`⏭️  跳过（未识别省份）: ${entry}`);
      continue;
    }

    console.log(`📁 处理: ${entry} → ${provinceCode}`);

    // 扫描目录中的文件
    const files = readdirSync(entryPath);
    const papers = new Map(); // key: year-subject, value: { year, subject, files }

    for (const file of files) {
      const year = detectYear(file);
      const subject = detectSubject(file);
      if (!year || !subject) continue;

      const key = `${year}-${subject}`;
      if (!papers.has(key)) {
        papers.set(key, { year, subject, files: [] });
      }
      papers.get(key).files.push(file);
    }

    // 创建试卷记录
    for (const [key, paper] of papers) {
      const { year, subject, files } = paper;

      // 判断是高考还是中考
      const examLevel = entry.includes('中考') ? 'zhongkao' : 'gaokao';

      try {
        const result = await pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
            paper_file_path = EXCLUDED.paper_file_path
          RETURNING id
        `, [provinceCode, year, subject, examLevel, files[0]]);

        const paperId = result.rows[0].id;

        // 记录所有文件
        for (const file of files) {
          console.log(`  📄 ${year} ${subject}: ${file}`);
        }

        totalCreated++;
      } catch (err) {
        if (err.code !== '23505') { // 忽略唯一约束冲突
          console.error(`  ❌ 创建失败: ${key} - ${err.message}`);
        }
      }
    }
  }

  console.log(`\n✅ 试卷数据导入完成！共创建 ${totalCreated} 条试卷记录`);

  // 显示统计
  const stats = await pool.query(`
    SELECT
      province_code,
      COUNT(*) as paper_count,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM exam_papers
    GROUP BY province_code
    ORDER BY paper_count DESC
  `);

  console.log('\n📊 各省份试卷统计:');
  for (const row of stats.rows) {
    console.log(`  ${row.province_code}: ${row.paper_count} 套 (${row.min_year}-${row.max_year})`);
  }
}

importPapers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  });
