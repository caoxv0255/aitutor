import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/home/cx/aitutor/database/parsed-examples';

const DERIV_KP_BASELINE = [
  '第三章 函数的应用',
  '函数与导数',
];

const DERIV_KP_FIXED = [
  '函数与导数',
  '导数的概念与几何意义',
  '导数的运算',
  '导数与单调性',
  '导数与极值最值',
  '导数与不等式证明',
  '导数与函数零点',
];

const DERIV_KEYWORDS = /导数|求导|切线|单调性|极值|最值|不等式.*证明|零点/;
const BACKFILL_KEYWORDS = /导数|求导|切线|单调性|单调区间|极值|最值|含参|零点|构造函数|不等式.*证明/;

function loadItems(path) {
  const d = JSON.parse(readFileSync(path, 'utf-8'));
  return Array.isArray(d) ? d : (d.questions || d.items || []);
}

function isGroundTruth(item) {
  const blob = (item.stem || '') + '\n' + (item.analysis || '');
  return DERIV_KEYWORDS.test(blob);
}

function score(items, kpList) {
  let totalGT = 0;
  let totalMatched = 0;
  let matchedGT = 0;
  for (const it of items) {
    const kp = Array.isArray(it.knowledge_points) ? it.knowledge_points.join(' ') : (it.knowledge_points || '');
    const isGT = isGroundTruth(it);
    if (isGT) totalGT += 1;
    const hitByKp = kpList.some((k) => kp.includes(k));
    if (hitByKp) {
      totalMatched += 1;
      if (isGT) matchedGT += 1;
    }
  }
  return {
    totalGT, totalMatched, matchedGT,
    precision: totalMatched > 0 ? matchedGT / totalMatched : 0,
    recall: totalGT > 0 ? matchedGT / totalGT : 0,
  };
}

function main() {
  const files = readdirSync(ROOT)
    .filter((f) => f.startsWith('math_') && f.endsWith('.json'))
    .map((f) => join(ROOT, f));
  console.log(`加载 ${files.length} 个数学卷文件`);

  const allItems = [];
  for (const f of files) {
    const items = loadItems(f);
    allItems.push(...items);
  }
  console.log(`合计题数: ${allItems.length}`);

  const totalGT = allItems.filter(isGroundTruth).length;
  console.log(`GroundTruth (题面/解析含导数关键词): ${totalGT}\n`);

  console.log('=== Baseline (现状: knowledge_points 中含"导数"标签) ===');
  const base = score(allItems, DERIV_KP_BASELINE);
  console.log(`  命中 total=${base.totalMatched}  其中真是GT=${base.matchedGT}`);
  console.log(`  precision=${(base.precision*100).toFixed(2)}%  recall=${(base.recall*100).toFixed(2)}%\n`);

  console.log('=== Fixed (知识库 +6 细粒度标签 + 函数与导数) ===');
  const fixed = score(allItems, DERIV_KP_FIXED);
  console.log(`  命中 total=${fixed.totalMatched}  其中真是GT=${fixed.matchedGT}`);
  console.log(`  precision=${(fixed.precision*100).toFixed(2)}%  recall=${(fixed.recall*100).toFixed(2)}%\n`);

  let recallByRule = 0;
  for (const it of allItems) {
    if (!isGroundTruth(it)) continue;
    const blob = (it.stem || '') + '\n' + (it.analysis || '');
    if (BACKFILL_KEYWORDS.test(blob)) recallByRule += 1;
  }
  console.log('=== backfill 规则能补回的 GT 题数 ===');
  console.log(`  ${recallByRule} / ${totalGT} = ${(recallByRule/Math.max(totalGT,1)*100).toFixed(2)}%\n`);

  console.log('=== 综合结论 ===');
  console.log(`  现状 K-text 召回率: ${(base.recall*100).toFixed(2)}%`);
  console.log(`  仅靠新标签 + 关键词规则补全后期望: ${(recallByRule/Math.max(totalGT,1)*100).toFixed(2)}%`);
}

main();