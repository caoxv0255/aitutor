#!/usr/bin/env node

import { PROVINCE_NAME_MAP, PAPER_TYPE_LABELS, getEvolutionInfo } from './lib/paper-evolution.js';

console.log('╔════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                          2008~2025年高考各省份试卷类型分配清单                    ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('【说明】');
console.log('  • 自主命题：北京、上海、天津（全程全科自主命题至2025年）');
console.log('  • 全国I/II卷时期（2008-2015）：全国I卷难度较高，全国II卷难度较低');
console.log('  • 全国I/II/III卷时期（2016-2021）：新增全国III卷，难度介于I卷和II卷之间');
console.log('  • 2022年起：原I/II合并为全国乙卷，原III卷更名全国甲卷');
console.log('  • 新高考时期：新高考I卷/II卷（3+3或3+1+2模式），六小科各省自主命题');
console.log('  • 2024年：黑龙江、甘肃、吉林、安徽、江西、贵州、广西加入新高考');
console.log('  • 2025年：山西、河南、陕西、四川、云南、内蒙古、宁夏、青海加入新高考');
console.log('  • 新疆、西藏2025年虽语数外使用新高考II卷，但仍保留文理数学+文理综模式');
console.log('');

console.log('┌──────┬────────┬──────────────────────────────────────────────────────────────────┐');
console.log('│ 省份 │ 代码   │ 2008  2009  2010  2011  2012  2013  2014  2015  2016  2017  │');
console.log('│      │        │ 2018  2019  2020  2021  2022  2023  2024  2025  主科/综合      │');
console.log('├──────┼────────┼──────────────────────────────────────────────────────────────────┤');

for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
  let yearsLine = '';
  for (let year = 2008; year <= 2025; year++) {
    const period = getEvolutionInfo(code, year);
    const type = period?.main || 'unknown';
    let label = '';
    switch(type) {
      case 'independent': label = '自'; break;
      case 'new_gaokao_i': label = '新I'; break;
      case 'new_gaokao_ii': label = '新II'; break;
      case 'national_i': label = 'I'; break;
      case 'national_ii': label = 'II'; break;
      case 'national_iii': label = 'III'; break;
      case 'national_a': label = '甲'; break;
      case 'national_b': label = '乙'; break;
      default: label = '?';
    }
    yearsLine += label.padStart(5);
  }

  console.log(`│ ${name.padEnd(4)} │ ${code.padEnd(6)}│ ${yearsLine} │`);
}

console.log('└──────┴────────┴──────────────────────────────────────────────────────────────────┘');
console.log('');
console.log('【图例说明】');
console.log('  自  = 自主命题');
console.log('  I   = 全国I卷（2008-2021年）');
console.log('  II  = 全国II卷（2008-2021年）');
console.log('  III = 全国III卷（2016-2021年）');
console.log('  新I = 新高考I卷（2020/2021年起，主科）');
console.log('  新II= 新高考II卷（2020/2021年起，主科）');
console.log('  甲  = 全国甲卷（2022年起，原全国III卷）');
console.log('  乙  = 全国乙卷（2022年起，原全国I+II卷合并）');
console.log('');
console.log('【注】上表展示语数英主科试卷类型。新高考改革后物化生政史地六小科由各省自主命题。');
console.log('    老高考时期文综/理综与主科使用同源全国卷。');
console.log('');

console.log('📊 2025年各省份试卷类型统计：');
console.log('');
const stats2025 = {};
for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
  const period = getEvolutionInfo(code, 2025);
  if (period) {
    const type = period.main;
    if (!stats2025[type]) {
      stats2025[type] = { label: PAPER_TYPE_LABELS[type] || type, provinces: [] };
    }
    stats2025[type].provinces.push(name);
  }
}
for (const [, info] of Object.entries(stats2025)) {
  console.log(`  • ${info.label}（${info.provinces.length}省）：${info.provinces.join('、')}`);
}
