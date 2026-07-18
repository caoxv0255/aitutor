#!/usr/bin/env node
/**
 * 生成 question_count=-1 的占位文件清单
 * 按省份和学科分类，输出文件名规范和存储路径
 */
import { getDb } from '../api/core/db.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROVINCE_CN = {
  beijing: '北京', shanghai: '上海', tianjin: '天津',
  shandong: '山东', guangdong: '广东', zhejiang: '浙江',
  jiangsu: '江苏', henan: '河南', sichuan: '四川',
  hebei: '河北', hubei: '湖北', hunan: '湖南',
  fujian: '福建', anhui: '安徽', liaoning: '辽宁',
  chongqing: '重庆', jiangxi: '江西', guizhou: '贵州',
  guangxi: '广西', yunnan: '云南', shanxi: '山西',
  shaanxi: '陕西', gansu: '甘肃', heilongjiang: '黑龙江',
  jilin: '吉林', neimenggu: '内蒙古', qinghai: '青海',
  ningxia: '宁夏', hainan: '海南', xinjiang: '新疆',
  xizang: '西藏',
};

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const MATH_TYPE_CN = {
  arts: '文科数学', science: '理科数学', unified: '数学',
};

async function main() {
  const db = await getDb();

  const res = await db.query(`
    SELECT province_code, year, subject, math_type, paper_type, paper_file_path
    FROM exam_papers
    WHERE question_count = -1
    ORDER BY province_code, year, subject, math_type
  `);

  console.log(`总占位文件数: ${res.rows.length}`);

  const byProvince = {};
  const bySubject = {};
  const fileList = [];

  for (const row of res.rows) {
    const provCn = PROVINCE_CN[row.province_code] || row.province_code;
    let subjCn = SUBJECT_CN[row.subject] || row.subject;
    if (row.subject === 'math' && row.math_type) {
      subjCn = MATH_TYPE_CN[row.math_type] || subjCn;
    }

    const dir = `${provCn}高考`;
    const filename = `${row.year}年${provCn}高考${subjCn}试卷原卷版.pdf`;
    const expectedPath = `${dir}/${filename}`;

    byProvince[provCn] = (byProvince[provCn] || 0) + 1;
    const subjKey = row.subject === 'math'
      ? (row.math_type === 'arts' ? 'math_arts' : row.math_type === 'science' ? 'math_science' : 'math_unified')
      : row.subject;
    bySubject[subjKey] = (bySubject[subjKey] || 0) + 1;

    fileList.push({
      province_code: row.province_code,
      province: provCn,
      year: row.year,
      subject: row.subject,
      math_type: row.math_type,
      subject_cn: subjCn,
      paper_type: row.paper_type,
      expected_dir: dir,
      expected_filename: filename,
      expected_path: expectedPath,
      current_path: row.paper_file_path,
    });
  }

  console.log('\n按省份分布:');
  Object.entries(byProvince).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n按学科分布:');
  Object.entries(bySubject).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // 输出JSON清单
  const outputPath = join(__dirname, 'missing-files-list.json');
  writeFileSync(outputPath, JSON.stringify({
    total: fileList.length,
    by_province: byProvince,
    by_subject: bySubject,
    files: fileList,
  }, null, 2));
  console.log(`\n清单已保存至: ${outputPath}`);

  // 输出CSV格式（便于检查）
  const csvLines = ['省份,年份,学科,数学类型,试卷类型,预期目录,预期文件名,预期路径,当前路径'];
  for (const f of fileList) {
    csvLines.push([
      f.province, f.year, f.subject_cn,
      f.math_type || '', f.paper_type || '',
      f.expected_dir, f.expected_filename,
      f.expected_path, f.current_path || '',
    ].map(v => `"${v}"`).join(','));
  }
  const csvPath = join(__dirname, 'missing-files-list.csv');
  writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`CSV清单已保存至: ${csvPath}`);

  // 按省份分组输出路径清单（便于在远程服务器上检查）
  const byProvPaths = {};
  for (const f of fileList) {
    if (!byProvPaths[f.expected_dir]) byProvPaths[f.expected_dir] = [];
    byProvPaths[f.expected_dir].push(f.expected_filename);
  }
  const pathsOutput = Object.entries(byProvPaths)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dir, files]) => {
      files.sort();
      return `\n=== ${dir} (${files.length}个) ===\n${files.join('\n')}`;
    }).join('\n');
  const pathsPath = join(__dirname, 'missing-files-paths.txt');
  writeFileSync(pathsPath, pathsOutput, 'utf-8');
  console.log(`路径清单已保存至: ${pathsPath}`);

  await db.end();
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
