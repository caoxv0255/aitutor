// 直接用 backfill-derivative-knowledge.js 内的 classify 函数, 对离线数据集验证.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RULES = [
  { name: '导数的概念与几何意义', patterns: [/切线方程/, /切线斜率/, /导数的几何意义/, /瞬时变化率/, /求曲线.*切线/, /在点.*处的切线/] },
  { name: '导数的运算',           patterns: [/求导/, /求 f'\(x\)/, /求 y'\b/, /二阶导/, /f''\(.+\)/, /复合函数求导/, /隐函数求导/, /参数方程求导/] },
  { name: '导数与单调性',         patterns: [/单调递增/, /单调递减/, /单调区间/, /单调性/] },
  { name: '导数与极值最值',       patterns: [/极值/, /极大值/, /极小值/, /最大值/, /最小值/, /最值/] },
  { name: '导数与不等式证明',     patterns: [/证明.*不等式/, /不等式.*证明/, /构造函数法/, /切线法.*证明/, /放缩/, /证.*≥/, /证.*≤/] },
  { name: '导数与函数零点',       patterns: [/零点.*个数/, /零点个数/, /含参.*零点/, /零点存在/, /函数.*零点/, /有.*零点/, /无.*零点/] },
];
const SAFE_PARENT_KW = /导数|求导|切线|单调性|极值|最值|零点|含参/;
const PARENT_KP = '函数与导数';
const DERIV_KP_FIXED = ['函数与导数', ...RULES.map(r => r.name)];

function classify(text) {
  if (!text) return new Set();
  const hits = new Set();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) hits.add(rule.name);
  }
  if (SAFE_PARENT_KW.test(text)) hits.add(PARENT_KP);
  return hits;
}

const files = readdirSync('/home/cx/aitutor/database/parsed-examples')
  .filter(f => f.startsWith('math_') && f.endsWith('.json'))
  .map(f => join('/home/cx/aitutor/database/parsed-examples', f));
let total = 0, gt = 0, matched = 0, gtMatched = 0;
const missed = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf-8'));
  const items = Array.isArray(d) ? d : (d.questions || d.items || []);
  for (const it of items) {
    total += 1;
    const blob = `${it.stem||''}\n${it.analysis||''}`;
    const isGT = /导数|求导|切线|单调性|极值|最值|不等式.*证明|零点/.test(blob);
    if (isGT) gt += 1;
    const detected = classify(blob);
    const kpArr = new Set(Array.isArray(it.knowledge_points) ? it.knowledge_points : []);
    for (const k of detected) kpArr.add(k);
    const hit = DERIV_KP_FIXED.some(k => kpArr.has(k));
    if (hit) { matched += 1; if (isGT) gtMatched += 1; }
    else if (isGT) missed.push((it.stem||'').slice(0, 60));
  }
}
console.log(`math_*.json 合计: ${total} 题`);
console.log(`GroundTruth (导数关键词): ${gt}`);
console.log(`匹配标签命中: ${matched} 其中 GT=${gtMatched}`);
console.log(`KP 召回率: ${(gtMatched/Math.max(gt,1)*100).toFixed(2)}%`);
console.log(`漏召回 GT: ${missed.length}`);
if (missed.length > 0) for (const s of missed.slice(0,5)) console.log(`  "${s}"`);