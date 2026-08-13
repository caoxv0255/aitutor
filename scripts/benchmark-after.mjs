import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/home/cx/aitutor/database/parsed-examples';

const DERIV_KP_FIXED = [
  '函数与导数',
  '导数的概念与几何意义',
  '导数的运算',
  '导数与单调性',
  '导数与极值最值',
  '导数与不等式证明',
  '导数与函数零点',
];

// 与 scripts/backfill-derivative-knowledge.js 同源的规则
const RULES = [
  { name: '导数的概念与几何意义', patterns: [/切线方程/, /切线斜率/, /导数的几何意义/, /瞬时变化率/, /求曲线.*切线/, /在点.*处的切线/] },
  { name: '导数的运算',           patterns: [/求导/, /求 f'\(x\)/, /求 y'\b/, /二阶导/, /f''\(.+\)/, /复合函数求导/, /隐函数求导/, /参数方程求导/] },
  { name: '导数与单调性',         patterns: [/单调递增/, /单调递减/, /单调区间/, /单调性/] },
  { name: '导数与极值最值',       patterns: [/极值/, /极大值/, /极小值/, /最大值/, /最小值/, /最值/] },
  { name: '导数与不等式证明',     patterns: [/证明.*不等式/, /不等式.*证明/, /构造函数法/, /切线法.*证明/, /放缩/, /证.*≥/, /证.*≤/] },
  { name: '导数与函数零点',       patterns: [/零点.*个数/, /零点个数/, /含参.*零点/, /有.*零点/, /无.*零点/, /零点存在/] },
];
const PARENT_KP = '函数与导数';

function classify(text) {
  if (!text) return new Set();
  const hits = new Set();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) hits.add(rule.name);
  }
  if (hits.size > 0) hits.add(PARENT_KP);
  return hits;
}

function loadItems(path) {
  const d = JSON.parse(readFileSync(path, 'utf-8'));
  return Array.isArray(d) ? d : (d.questions || d.items || []);
}

function isGroundTruth(item) {
  const blob = (item.stem || '') + '\n' + (item.analysis || '');
  return /导数|求导|切线|单调性|极值|最值|不等式.*证明|零点/.test(blob);
}

function main() {
  const files = readdirSync(ROOT)
    .filter((f) => f.startsWith('math_') && f.endsWith('.json'))
    .map((f) => join(ROOT, f));
  const allItems = [];
  for (const f of files) allItems.push(...loadItems(f));
  console.log(`合计题数: ${allItems.length}`);

  const totalGT = allItems.filter(isGroundTruth).length;
  console.log(`GroundTruth: ${totalGT}\n`);

  // 模拟回填后的 kp 集合
  let recalledGT = 0;
  let totalMatched = 0;
  let matchedGT = 0;
  const missed = [];
  for (const it of allItems) {
    const isGT = isGroundTruth(it);
    const originalKp = Array.isArray(it.knowledge_points) ? [...it.knowledge_points] : [];
    const text = `${it.stem || ''}\n${it.analysis || ''}`;
    const detected = classify(text);
    const newKp = new Set(originalKp);
    for (const k of detected) newKp.add(k);
    const kpArr = [...newKp];

    const hitByKp = DERIV_KP_FIXED.some((k) => kpArr.includes(k));
    if (hitByKp) {
      totalMatched += 1;
      if (isGT) matchedGT += 1;
    }
    if (isGT && hitByKp) recalledGT += 1;
    if (isGT && !hitByKp) missed.push({ id: it.id, qn: it.question_number, stem: (it.stem||'').slice(0, 50) });
  }

  console.log('=== 模拟回填后 ===');
  console.log(`  totalMatched=${totalMatched}  matchedGT=${matchedGT}`);
  console.log(`  precision=${(matchedGT/Math.max(totalMatched,1)*100).toFixed(2)}%`);
  console.log(`  recall (K-text 标签召回率)=${(recalledGT/Math.max(totalGT,1)*100).toFixed(2)}%`);
  console.log(`  漏召回 GT 数: ${missed.length}`);
  if (missed.length > 0) {
    console.log('  漏召回样本:');
    for (const m of missed.slice(0, 5)) console.log(`    id=${m.id} qn=${m.qn} stem="${m.stem}..."`);
  }
}

main();