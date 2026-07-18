#!/usr/bin/env node
import { getDb } from '../api/core/db.js';

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

const SUBJECT_LABELS = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  history: '历史', politics: '政治', geography: '地理'
};

async function verify() {
  const pool = await getDb();
  
  console.log('📊 各省份各学科覆盖统计（需18年：2008~2025）');
  console.log('省份 | 语文 | 数学 | 英语 | 物理 | 化学 | 生物 | 历史 | 政治 | 地理 | 总计 | 状态');
  console.log('-----|------|------|------|------|------|------|------|------|------|------|------');
  
  const stats = await pool.query(`
    SELECT province_code, subject, COUNT(DISTINCT year) as year_count, COUNT(*) as total_count
    FROM exam_papers
    GROUP BY province_code, subject
    ORDER BY province_code, subject
  `);
  
  const coverage = {};
  for (const row of stats.rows) {
    if (!coverage[row.province_code]) coverage[row.province_code] = {};
    coverage[row.province_code][row.subject] = row.year_count;
  }
  
  let allComplete = true;
  for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
    const c = coverage[code] || {};
    let subjectComplete = true;
    let totalPapers = 0;
    
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      const count = c[subject] || 0;
      totalPapers += count * 2;
      if (count < 18) subjectComplete = false;
    }
    
    const status = subjectComplete ? '✅' : '❌';
    if (!subjectComplete) allComplete = false;
    
    console.log(`${name.padEnd(4)} | ${(c?.chinese||0).toString().padStart(4)} | ${(c?.math||0).toString().padStart(4)} | ${(c?.english||0).toString().padStart(4)} | ${(c?.physics||0).toString().padStart(4)} | ${(c?.chemistry||0).toString().padStart(4)} | ${(c?.biology||0).toString().padStart(4)} | ${(c?.history||0).toString().padStart(4)} | ${(c?.politics||0).toString().padStart(4)} | ${(c?.geography||0).toString().padStart(4)} | ${totalPapers.toString().padStart(4)} | ${status}`);
  }
  
  console.log('');
  if (allComplete) {
    console.log('🎉 所有省份数据完整！');
  } else {
    console.log('⚠️ 部分省份数据不完整，需要补充');
  }
  
  console.log('');
  console.log('📋 缺失详情：');
  for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
    const c = coverage[code] || {};
    const missing = [];
    for (const subject of Object.keys(SUBJECT_LABELS)) {
      const count = c[subject] || 0;
      if (count < 18) {
        missing.push(`${SUBJECT_LABELS[subject]}(${count}/18)`);
      }
    }
    if (missing.length > 0) {
      console.log(`  ${name}: ${missing.join(', ')}`);
    }
  }
}

verify()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });