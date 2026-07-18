#!/usr/bin/env node
/**
 * 试卷数据导入脚本
 * 扫描 database/ 目录，识别各省份试卷文件，创建试卷记录
 * 支持从全国卷文件名中识别并分配到对应省份
 */
import { getDb } from '../api/core/db.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PROVINCE_NAME_MAP, getEvolutionInfo } from './lib/paper-evolution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const SUBJECT_MAP = {
  '语文': 'chinese', '数学': 'math', '英语': 'english',
  '物理': 'physics', '化学': 'chemistry', '生物': 'biology',
  '政治': 'politics', '历史': 'history', '地理': 'geography',
  '文综': 'comprehensive_arts', '理综': 'comprehensive_science',
};

const YEAR_REGEX = /20(\d{2})/;

const PAPER_TYPE_PATTERNS = {
  'new_gaokao_i': [/新高考[ⅠI]卷/, /新课标全国[ⅠI]卷/, /全国一卷/, /全国I卷/],
  'new_gaokao_ii': [/新高考[ⅡII]卷/, /新课标全国[ⅡII]卷/, /全国二卷/, /全国II卷/],
  'national_a': [/全国甲卷/],
  'national_b': [/全国乙卷/],
  'national_i': [/全国[ⅠI]卷/, /新课标[ⅠI]卷/],
  'national_ii': [/全国[ⅡII]卷/, /新课标[ⅡII]卷/],
  'national_iii': [/全国[ⅢIII]卷/, /新课标[ⅢIII]卷/],
  'new_i': [/新课标[ⅠI]卷/],
  'new_ii': [/新课标[ⅡII]卷/]
};

function detectPaperTypeFromFilename(filename) {
  for (const [type, patterns] of Object.entries(PAPER_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filename)) {
        return type;
      }
    }
  }
  return null;
}

function detectProvince(filename) {
  const provinceMap = {
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
    '西藏卷': 'xizang', '西藏': 'xizang'
  };
  
  for (const [key, code] of Object.entries(provinceMap)) {
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

  let totalCreated = 0;

  function scanDirectory(dirPath, parentCategory = '') {
    const entries = readdirSync(dirPath);
    const results = [];

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      const provinceCode = detectProvince(entry);
      if (provinceCode) {
        results.push({
          name: entry,
          code: provinceCode,
          path: entryPath,
          category: parentCategory || (entry.includes('中考') ? 'zhongkao' : 'gaokao')
        });
      } else if (entry.includes('高考') || entry.includes('中考')) {
        const category = entry.includes('中考') ? 'zhongkao' : 'gaokao';
        results.push(...scanDirectory(entryPath, category));
      }
    }

    return results;
  }

  const provinces = scanDirectory(databaseDir);

  for (const province of provinces) {
    console.log(`📁 处理: ${province.name} → ${province.code} (${province.category})`);

    const subjectDirs = readdirSync(province.path);
    const papers = new Map();

    for (const dir of subjectDirs) {
      const dirPath = join(province.path, dir);
      if (!statSync(dirPath).isDirectory()) continue;

      const subject = detectSubject(dir);
      if (!subject) continue;

      const subjectFiles = readdirSync(dirPath);
      for (const sf of subjectFiles) {
        if (!sf.match(/\.(pdf|doc|docx)$/i)) continue;

        const year = detectYear(sf);
        if (!year) continue;

        const key = `${year}-${subject}`;
        if (!papers.has(key)) {
          papers.set(key, { year, subject, files: [] });
        }
        papers.get(key).files.push(join(dir, sf));
      }
    }

    for (const [key, paper] of papers) {
      const { year, subject, files } = paper;

      let targetProvince = province.code;
      const filename = files[0];
      const fileProvince = detectProvince(filename);
      
      if (fileProvince && fileProvince !== 'national_i' && fileProvince !== 'national_ii') {
        targetProvince = fileProvince;
      }

      try {
        const result = await pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
            paper_file_path = EXCLUDED.paper_file_path
          RETURNING id
        `, [targetProvince, year, subject, province.category, files[0]]);

        for (const file of files) {
          console.log(`  📄 ${year} ${subject}: ${file}`);
        }

        totalCreated++;
      } catch (err) {
        if (err.code !== '23505') {
          console.error(`  ❌ 创建失败: ${key} - ${err.message}`);
        }
      }
    }
  }

  console.log('\n📊 第二步：处理全国卷文件，分配到对应省份');
  console.log('='.repeat(60));

  const nationalPaperTypeDirs = [];
  for (const province of provinces) {
    const subjectDirs = readdirSync(province.path);
    for (const dir of subjectDirs) {
      const dirPath = join(province.path, dir);
      if (!statSync(dirPath).isDirectory()) continue;

      const subject = detectSubject(dir);
      if (!subject) continue;

      const subjectFiles = readdirSync(dirPath);
      for (const sf of subjectFiles) {
        if (!sf.match(/\.(pdf|doc|docx)$/i)) continue;

        const year = detectYear(sf);
        if (!year) continue;

        const fileProvince = detectProvince(sf);
        if (fileProvince && fileProvince !== 'national_i' && fileProvince !== 'national_ii') {
          continue;
        }

        const paperType = detectPaperTypeFromFilename(sf);
        if (!paperType) continue;

        for (const [targetProvinceCode] of Object.entries(PROVINCE_NAME_MAP)) {
          const expectedType = getEvolutionInfo(targetProvinceCode, year)?.main;
          if (expectedType === paperType) {
            const existing = await pool.query(`
              SELECT id FROM exam_papers
              WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = 'gaokao'
            `, [targetProvinceCode, year, subject]);

            if (existing.rows.length === 0) {
              try {
                await pool.query(`
                  INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
                  VALUES ($1, $2, $3, $4, $5)
                `, [targetProvinceCode, year, subject, 'gaokao', join(dir, sf)]);
                
                console.log(`  ✅ ${PROVINCE_NAME_MAP[targetProvinceCode]} ${year}年${subject}: 从${PROVINCE_NAME_MAP[province.code]}的${sf}分配`);
                totalCreated++;
              } catch (err) {
                if (err.code !== '23505') {
                  console.error(`  ❌ ${PROVINCE_NAME_MAP[targetProvinceCode]} ${year}年${subject}: ${err.message}`);
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n✅ 试卷数据导入完成！共创建/更新 ${totalCreated} 条试卷记录`);

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
    console.log(`  ${PROVINCE_NAME_MAP[row.province_code] || row.province_code}: ${row.paper_count} 套 (${row.min_year}-${row.max_year})`);
  }
}

importPapers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  });