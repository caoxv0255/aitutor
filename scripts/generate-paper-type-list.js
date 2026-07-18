#!/usr/bin/env node

import {
  PROVINCE_NAME_MAP,
  PAPER_TYPE_LABELS,
  getEvolutionInfo
} from './lib/paper-evolution.js';

const SUBJECT_LABELS = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  history: '历史', politics: '政治', geography: '地理'
};

console.log('📋 2008~2025年各省份高考试卷类型清单');
console.log('='.repeat(120));
console.log('');

for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
  console.log(`📍 ${name}（${code}）`);
  console.log(`  ${'-'.repeat(50)}`);

  for (let year = 2008; year <= 2025; year++) {
    const period = getEvolutionInfo(code, year);
    if (period) {
      const typeLabel = PAPER_TYPE_LABELS[period.main] || period.main;
      const compLabel = period.comp ? ` | 综合:${PAPER_TYPE_LABELS[period.comp] || period.comp}` : '';
      const mathLabel = period.mathSplit ? ' (文理数学)' : ' (统一数学)';
      console.log(`  ${year}年：${typeLabel}${compLabel}${mathLabel}`);
    }
  }

  console.log('');
}

console.log('='.repeat(120));
console.log('');
console.log('📊 试卷类型汇总统计（按主科）：');
console.log('');

const typeStats = {};
for (const [code, name] of Object.entries(PROVINCE_NAME_MAP)) {
  for (let year = 2008; year <= 2025; year++) {
    const period = getEvolutionInfo(code, year);
    if (period) {
      const type = period.main;
      if (!typeStats[type]) {
        typeStats[type] = { name: PAPER_TYPE_LABELS[type] || type, provinces: [] };
      }
      if (!typeStats[type].provinces.includes(name)) {
        typeStats[type].provinces.push(name);
      }
    }
  }
}

for (const [type, info] of Object.entries(typeStats)) {
  console.log(`  • ${info.name}：${info.provinces.join('、')}`);
}

console.log('');
console.log('📝 试卷类型说明：');
console.log('  • 自主命题：省份自行组织命题（北京、上海、天津全程全科自主命题）');
console.log('  • 新高考I卷：2020年起实施，适用于3+3/3+1+2新高考改革省份主科');
console.log('  • 新高考II卷：2020年起实施，适用于新高考改革省份主科');
console.log('  • 全国甲卷：2022年起（原全国III卷），适用于西部省份');
console.log('  • 全国乙卷：2022年起（原全国I+II卷合并），适用于中部省份');
console.log('  • 全国I卷/II卷/III卷：老高考时期使用的试卷类型');
console.log('  • 新高考改革后，物化生政史地六小科由各省自主命题');
console.log('  • 新疆、西藏2025年虽语数外使用新高考II卷，但仍保留文理数学+文理综模式');
