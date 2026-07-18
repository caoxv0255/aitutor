#!/usr/bin/env node
/**
 * 扫描本地高考真题目录，统计各省份各学科的文件情况
 */
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:\\Desktop\\aitutor\\database\\高考真题';

const SUBJECT_DIRS = {
  '1': 'chinese', '2': 'math', '3': 'english',
  '4': 'physics', '5': 'chemistry', '6': 'biology',
  '7': 'history', '8': 'politics', '9': 'geography',
};

function countFiles(dir) {
  let count = 0;
  const exts = ['.pdf', '.doc', '.docx'];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          count += countFiles(fullPath);
        } else if (exts.includes(extname(entry).toLowerCase())) {
          count++;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return count;
}

async function main() {
  const provinces = readdirSync(ROOT).filter(d => {
    try { return statSync(join(ROOT, d)).isDirectory(); } catch { return false; }
  }).sort();

  console.log(`省份目录数: ${provinces.length}\n`);

  const matrix = {};
  const missingDirs = [];

  for (const provDir of provinces) {
    const provName = provDir.replace('高考', '');
    matrix[provName] = {};

    const provPath = join(ROOT, provDir);
    const subjDirs = readdirSync(provPath).filter(d => {
      try { return statSync(join(provPath, d)).isDirectory(); } catch { return false; }
    });

    // 检查每个学科目录
    for (const [num, subj] of Object.entries(SUBJECT_DIRS)) {
      const expectedDirPrefix = `${num}. `;
      const found = subjDirs.find(d => d.startsWith(expectedDirPrefix));
      if (found) {
        const fileCount = countFiles(join(provPath, found));
        matrix[provName][subj] = { dir: found, files: fileCount };
      } else {
        matrix[provName][subj] = { dir: null, files: 0 };
        missingDirs.push({ province: provName, subject: subj, subject_num: num });
      }
    }
  }

  // 输出矩阵
  const subjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'politics', 'geography'];
  const subjHeader = ['省份'].concat(subjects.map(s => s.substring(0, 4))).join('\t');
  console.log('=== 各省份学科文件数矩阵 ===');
  console.log(subjHeader);
  for (const [prov, subjData] of Object.entries(matrix)) {
    const row = [prov.padEnd(4)];
    for (const subj of subjects) {
      const data = subjData[subj] || { files: 0 };
      row.push(String(data.files).padStart(4));
    }
    console.log(row.join('\t'));
  }

  // 输出缺失目录
  console.log(`\n=== 缺失学科目录 (${missingDirs.length}个) ===`);
  const missingBySubj = {};
  for (const m of missingDirs) {
    if (!missingBySubj[m.subject]) missingBySubj[m.subject] = [];
    missingBySubj[m.subject].push(m.province);
  }
  for (const [subj, provs] of Object.entries(missingBySubj)) {
    console.log(`  ${subj} (${provs.length}个省份缺失): ${provs.join(', ')}`);
  }

  // 总文件数统计
  let totalFiles = 0;
  for (const prov of Object.values(matrix)) {
    for (const subj of Object.values(prov)) {
      totalFiles += subj.files;
    }
  }
  console.log(`\n本地总文件数: ${totalFiles}`);
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
