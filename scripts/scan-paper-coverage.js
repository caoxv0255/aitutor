#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const GAOKAO_DIR = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../database/高考真题');

const PROVINCE_MAP = {
  '北京': 'beijing', '上海': 'shanghai', '天津': 'tianjin', '重庆': 'chongqing',
  '河北': 'hebei', '河南': 'henan', '山东': 'shandong', '江苏': 'jiangsu',
  '浙江': 'zhejiang', '福建': 'fujian', '广东': 'guangdong', '湖北': 'hubei',
  '湖南': 'hunan', '安徽': 'anhui', '江西': 'jiangxi', '四川': 'sichuan',
  '陕西': 'shaanxi', '贵州': 'guizhou', '云南': 'yunnan', '新疆': 'xinjiang',
  '西藏': 'xizang', '内蒙古': 'neimenggu', '宁夏': 'ningxia', '青海': 'qinghai',
  '甘肃': 'gansu', '黑龙江': 'heilongjiang', '吉林': 'jilin', '山西': 'shanxi',
  '辽宁': 'liaoning', '海南': 'hainan', '广西': 'guangxi'
};

const SUBJECT_MAP = {
  '语文': 'chinese', '数学': 'math', '英语': 'english',
  '物理': 'physics', '化学': 'chemistry', '生物': 'biology',
  '历史': 'history', '政治': 'politics', '地理': 'geography'
};

const SUBJECT_LABELS = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  history: '历史', politics: '政治', geography: '地理'
};

const PROVINCE_NAME_MAP = {
  'beijing': '北京', 'shanghai': '上海', 'tianjin': '天津', 'chongqing': '重庆',
  'hebei': '河北', 'henan': '河南', 'shandong': '山东', 'jiangsu': '江苏',
  'zhejiang': '浙江', 'fujian': '福建', 'guangdong': '广东', 'hubei': '湖北',
  'hunan': '湖南', 'anhui': '安徽', 'jiangxi': '江西', 'sichuan': '四川',
  'shaanxi': '陕西', 'guizhou': '贵州', 'yunnan': '云南', 'xinjiang': '新疆',
  'xizang': '西藏', 'neimenggu': '内蒙古', 'ningxia': '宁夏', 'qinghai': '青海',
  'gansu': '甘肃', 'heilongjiang': '黑龙江', 'jilin': '吉林', 'shanxi': '山西',
  'liaoning': '辽宁', 'hainan': '海南', 'guangxi': '广西'
};

function initCoverage() {
  const coverage = {};
  for (const code of Object.keys(PROVINCE_NAME_MAP)) {
    coverage[code] = {};
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      coverage[code][subject] = {};
      for (let year = 2008; year <= 2025; year++) {
        coverage[code][subject][year] = { hasOriginal: false, hasAnalysis: false, files: [] };
      }
    }
  }
  return coverage;
}

function detectProvinceFromPath(dirPath) {
  const dirName = path.basename(dirPath);
  for (const [name, code] of Object.entries(PROVINCE_MAP)) {
    if (dirName.includes(name)) {
      return code;
    }
  }
  return null;
}

function detectSubjectFromPath(dirPath) {
  const dirName = path.basename(dirPath);
  for (const [name, code] of Object.entries(SUBJECT_MAP)) {
    if (dirName.includes(name)) {
      return code;
    }
  }
  return null;
}

function parseFileName(filename) {
  const yearMatch = filename.match(/(\d{4})年/);
  if (!yearMatch) return null;
  
  const year = parseInt(yearMatch[1]);
  if (year < 2008 || year > 2025) return null;
  
  let hasOriginal = false;
  let hasAnalysis = false;
  
  if (filename.includes('原卷版') || filename.includes('空白卷') || filename.includes('真题')) {
    if (!filename.includes('解析') && !filename.includes('答案')) {
      hasOriginal = true;
    }
  }
  
  if (filename.includes('解析') || filename.includes('答案')) {
    hasAnalysis = true;
  }
  
  if (filename.includes('原卷版') && filename.includes('解析')) {
    hasOriginal = true;
    hasAnalysis = true;
  }
  
  return { year, hasOriginal, hasAnalysis, filename };
}

function scanDirectory(baseDir) {
  const coverage = initCoverage();
  
  try {
    const provinceDirs = fs.readdirSync(baseDir);
    
    for (const provinceDir of provinceDirs) {
      const provincePath = path.join(baseDir, provinceDir);
      if (!fs.statSync(provincePath).isDirectory()) continue;
      
      const provinceCode = detectProvinceFromPath(provincePath);
      if (!provinceCode) continue;
      
      const subjectDirs = fs.readdirSync(provincePath);
      
      for (const subjectDir of subjectDirs) {
        const subjectPath = path.join(provincePath, subjectDir);
        if (!fs.statSync(subjectPath).isDirectory()) continue;
        
        const subject = detectSubjectFromPath(subjectPath);
        if (!subject) continue;
        
        const files = fs.readdirSync(subjectPath);
        
        for (const file of files) {
          if (!file.endsWith('.pdf')) continue;
          if (file.startsWith('~$')) continue;
          
          const parsed = parseFileName(file);
          if (!parsed) continue;
          
          const { year, hasOriginal, hasAnalysis, filename } = parsed;
          
          coverage[provinceCode][subject][year].files.push(filename);
          if (hasOriginal) coverage[provinceCode][subject][year].hasOriginal = true;
          if (hasAnalysis) coverage[provinceCode][subject][year].hasAnalysis = true;
        }
      }
    }
  } catch (err) {
    console.error('扫描目录失败:', err.message);
    process.exit(1);
  }
  
  return coverage;
}

function printSummary(coverage) {
  console.log('\n' + '='.repeat(140));
  console.log('📊 2008~2025年各省份各学科高考试卷覆盖情况统计');
  console.log('='.repeat(140));
  
  console.log('\n' + ' '.repeat(10) + '省份 | 语文 | 数学 | 英语 | 物理 | 化学 | 生物 | 历史 | 政治 | 地理 | 总计');
  console.log(' '.repeat(10) + '-----|------|------|------|------|------|------|------|------|------|------');
  
  for (const [code, provinceData] of Object.entries(coverage)) {
    const name = PROVINCE_NAME_MAP[code] || code;
    let total = 0;
    let row = ` ${name.padEnd(4)} |`;
    
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      let count = 0;
      for (let year = 2008; year <= 2025; year++) {
        const yearData = provinceData[subject][year];
        if (yearData.hasOriginal || yearData.hasAnalysis) {
          count++;
        }
      }
      total += count;
      const status = count === 18 ? '✓' : count;
      row += ` ${status.toString().padEnd(5)}|`;
    }
    
    row += ` ${total}`;
    console.log(row);
  }
  
  console.log('\n' + '='.repeat(140));
  console.log('📋 详细覆盖情况（年份×学科）');
  console.log('='.repeat(140));
  
  for (const [code, provinceData] of Object.entries(coverage)) {
    const name = PROVINCE_NAME_MAP[code] || code;
    let hasMissing = false;
    
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      for (let year = 2008; year <= 2025; year++) {
        const yearData = provinceData[subject][year];
        if (!yearData.hasOriginal || !yearData.hasAnalysis) {
          hasMissing = true;
          break;
        }
      }
      if (hasMissing) break;
    }
    
    if (!hasMissing) {
      console.log(`✅ ${name}：全部学科覆盖完整`);
      continue;
    }
    
    console.log(`\n📍 ${name}（${code}）`);
    console.log('  ' + '-'.repeat(130));
    
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      let subjectMissing = [];
      
      for (let year = 2008; year <= 2025; year++) {
        const yearData = provinceData[subject][year];
        const issues = [];
        if (!yearData.hasOriginal) issues.push('缺原卷');
        if (!yearData.hasAnalysis) issues.push('缺解析');
        
        if (issues.length > 0) {
          subjectMissing.push({ year, issues });
        }
      }
      
      if (subjectMissing.length > 0) {
        console.log(`  📚 ${SUBJECT_LABELS[subject]}：`);
        for (const m of subjectMissing) {
          const files = provinceData[subject][m.year].files.length > 0 
            ? `（有${provinceData[subject][m.year].files.length}个文件）` 
            : '';
          console.log(`    ${m.year}年：${m.issues.join('、')}${files}`);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(140));
  console.log('🔍 仅含部分年份数据的省份（学科数<9或年份<18）');
  console.log('='.repeat(140));
  
  for (const [code, provinceData] of Object.entries(coverage)) {
    const name = PROVINCE_NAME_MAP[code] || code;
    let validSubjects = 0;
    
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      let count = 0;
      for (let year = 2008; year <= 2025; year++) {
        const yearData = provinceData[subject][year];
        if (yearData.files.length > 0) {
          count++;
        }
      }
      if (count > 0) validSubjects++;
    }
    
    if (validSubjects < 9) {
      console.log(`⚠️ ${name}：仅${validSubjects}个学科有数据`);
    }
  }
  
  console.log('\n' + '='.repeat(140));
  console.log('📝 统计说明：');
  console.log('  • 年份范围：2008~2025年（共18年）');
  console.log('  • 学科数量：9个（语文、数学、英语、物理、化学、生物、历史、政治、地理）');
  console.log('  • 完整标准：每个年份同时拥有原卷版和解析版');
  console.log('  • 原卷版识别：文件名含"原卷版"、"空白卷"、"真题"（不含"解析"/"答案"）');
  console.log('  • 解析版识别：文件名含"解析"、"答案"');
  console.log('='.repeat(140));
}

const coverage = scanDirectory(GAOKAO_DIR);
printSummary(coverage);