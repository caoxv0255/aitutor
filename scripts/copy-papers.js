#!/usr/bin/env node
import { getDb } from '../api/core/db.js';
import { PROVINCE_NAME_MAP, PAPER_TYPE_LABELS, getEvolutionInfo } from './lib/paper-evolution.js';

const SOURCE_PROVINCES = {
  'independent': 'beijing',
  'new_gaokao_i': 'beijing',
  'new_gaokao_ii': 'beijing',
  'national_a': 'beijing',
  'national_b': 'beijing'
};

const SUBJECTS = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'politics', 'geography'];
const TARGET_YEARS = Array.from({length: 18}, (_, i) => 2008 + i);

async function copyPapers() {
  const pool = await getDb();
  
  console.log('🔍 查询各省份各学科覆盖情况...\n');
  
  const stats = await pool.query(`
    SELECT province_code, subject, year, COUNT(*) as count
    FROM exam_papers
    GROUP BY province_code, subject, year
    ORDER BY province_code, subject, year
  `);
  
  const coverage = {};
  for (const row of stats.rows) {
    if (!coverage[row.province_code]) coverage[row.province_code] = {};
    if (!coverage[row.province_code][row.subject]) coverage[row.province_code][row.subject] = [];
    coverage[row.province_code][row.subject].push(row.year);
  }
  
  console.log('各省份学科覆盖统计（需18年）:');
  console.log('省份 | 语文 | 数学 | 英语 | 物理 | 化学 | 生物 | 历史 | 政治 | 地理 | 状态');
  console.log('-----|------|------|------|------|------|------|------|------|------|------');
  
  const allProvinces = Object.keys(coverage).sort();
  for (const province of allProvinces) {
    const c = coverage[province];
    let status = '✅';
    let statusText = '完整';
    for (const subject of SUBJECTS) {
      const years = c[subject] || [];
      if (years.length < 18) {
        status = '❌';
        statusText = `缺${subject}: ${years.length}/18`;
        break;
      }
    }
    console.log(`${PROVINCE_NAME_MAP[province]?.padEnd(4) || province.padEnd(4)} | ${(c?.chinese?.length||0).toString().padStart(4)} | ${(c?.math?.length||0).toString().padStart(4)} | ${(c?.english?.length||0).toString().padStart(4)} | ${(c?.physics?.length||0).toString().padStart(4)} | ${(c?.chemistry?.length||0).toString().padStart(4)} | ${(c?.biology?.length||0).toString().padStart(4)} | ${(c?.history?.length||0).toString().padStart(4)} | ${(c?.politics?.length||0).toString().padStart(4)} | ${(c?.geography?.length||0).toString().padStart(4)} | ${status} ${statusText}`);
  }
  
  console.log('\n🚀 开始复制缺失数据...');
  let totalCopied = 0;
  let copyActions = [];
  
  for (const [paperType, label] of Object.entries(PAPER_TYPE_LABELS)) {
    const sourceProvince = SOURCE_PROVINCES[paperType];
    if (!sourceProvince) continue;

    const targetProvinces = Object.keys(PROVINCE_NAME_MAP).filter(p => getEvolutionInfo(p, 2025)?.main === paperType);
    
    console.log(`\n--- ${label}（${targetProvinces.length}省）---`);
    console.log(`源省份: ${PROVINCE_NAME_MAP[sourceProvince]}`);
    
    for (const targetProvince of targetProvinces) {
      if (targetProvince === sourceProvince) continue;
      
      for (const subject of SUBJECTS) {
        const sourceYears = coverage[sourceProvince]?.[subject] || [];
        const targetYears = coverage[targetProvince]?.[subject] || [];
        
        const missingYears = TARGET_YEARS.filter(y => !targetYears.includes(y));
        
        if (missingYears.length > 0 && sourceYears.length > 0) {
          copyActions.push({
            source: sourceProvince,
            target: targetProvince,
            subject: subject,
            missingYears: missingYears.length,
            paperType: paperType
          });
        }
      }
    }
  }
  
  console.log('\n📋 需要复制的项目:');
  for (const action of copyActions) {
    console.log(`  ${PROVINCE_NAME_MAP[action.source]} → ${PROVINCE_NAME_MAP[action.target]} (${action.subject}): 缺${action.missingYears}年`);
  }
  
  console.log(`\n🔄 开始执行复制（共${copyActions.length}项）...`);
  
  for (const action of copyActions) {
    const sourcePapers = await pool.query(`
      SELECT year, subject, paper_file_path, exam_level
      FROM exam_papers
      WHERE province_code = $1 AND subject = $2
    `, [action.source, action.subject]);
    
    for (const paper of sourcePapers.rows) {
      try {
        await pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (province_code, year, subject, exam_level) DO NOTHING
        `, [action.target, paper.year, paper.subject, paper.exam_level, paper.paper_file_path]);
        totalCopied++;
      } catch (err) {
        if (err.code !== '23505') {
          console.error(`    ❌ 复制失败: ${action.target} ${paper.year} ${paper.subject} - ${err.message}`);
        }
      }
    }
    
    console.log(`  ✅ ${PROVINCE_NAME_MAP[action.source]} → ${PROVINCE_NAME_MAP[action.target]} (${action.subject}): 完成`);
  }
  
  console.log(`\n✅ 复制完成！共复制 ${totalCopied} 条记录`);
  
  console.log('\n📊 更新后的各省份学科覆盖统计:');
  console.log('省份 | 语文 | 数学 | 英语 | 物理 | 化学 | 生物 | 历史 | 政治 | 地理 | 状态');
  console.log('-----|------|------|------|------|------|------|------|------|------|------');
  
  const updatedStats = await pool.query(`
    SELECT province_code, subject, COUNT(*) as count
    FROM exam_papers
    GROUP BY province_code, subject
    ORDER BY province_code, subject
  `);
  
  const updatedCoverage = {};
  for (const row of updatedStats.rows) {
    if (!updatedCoverage[row.province_code]) updatedCoverage[row.province_code] = {};
    updatedCoverage[row.province_code][row.subject] = row.count;
  }
  
  for (const province of allProvinces) {
    const c = updatedCoverage[province];
    let allComplete = true;
    for (const subject of SUBJECTS) {
      if ((c[subject] || 0) < 18) {
        allComplete = false;
        break;
      }
    }
    const status = allComplete ? '✅' : '❌';
    const total = Object.values(c || {}).reduce((a, b) => a + b, 0);
    console.log(`${PROVINCE_NAME_MAP[province]?.padEnd(4) || province.padEnd(4)} | ${(c?.chinese||0).toString().padStart(4)} | ${(c?.math||0).toString().padStart(4)} | ${(c?.english||0).toString().padStart(4)} | ${(c?.physics||0).toString().padStart(4)} | ${(c?.chemistry||0).toString().padStart(4)} | ${(c?.biology||0).toString().padStart(4)} | ${(c?.history||0).toString().padStart(4)} | ${(c?.politics||0).toString().padStart(4)} | ${(c?.geography||0).toString().padStart(4)} | ${status} ${total}份`);
  }
}

copyPapers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 复制失败:', err.message);
    process.exit(1);
  });