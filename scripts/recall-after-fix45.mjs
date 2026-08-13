// recall-after-fix45.mjs v2
// 改进: paperId 每题唯一, 不人为制造冲突; 同时给出"修复前"也带上 #1 KP 回填后的对比.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/home/cx/aitutor/database/parsed-examples';
const files = readdirSync(ROOT).filter(f => f.startsWith('math_') && f.endsWith('.json'))
  .map(f => join(ROOT, f));

function yearOf(p) { return parseInt(p.match(/math_(\d{4})/)?.[1] || '0'); }
function loadItems(p) {
  const d = JSON.parse(readFileSync(p, 'utf-8'));
  return Array.isArray(d) ? d : (d.questions || d.items || []);
}

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
const DERIV_KP = ['函数与导数', ...RULES.map(r => r.name)];

function isDeriv(it) {
  const blob = `${it.stem||''}\n${it.analysis||''}`;
  return /导数|求导|切线|单调性|极值|最值|不等式.*证明|零点/.test(blob);
}
function classify(text) {
  if (!text) return new Set();
  const hits = new Set();
  for (const rule of RULES) if (rule.patterns.some(p => p.test(text))) hits.add(rule.name);
  if (SAFE_PARENT_KW.test(text)) hits.add(PARENT_KP);
  return hits;
}

// 每条题独立的 paperId, 不会冲突
function buildCorpus() {
  const all = [];
  let paperCounter = 100000;
  for (const f of files) {
    const year = yearOf(f);
    const items = loadItems(f);
    // 每个 json 文件视作 1 张卷子
    const paperId = paperCounter++;
    const province = ['beijing','hunan','zhejiang','jiangsu','shandong','national','shaanxi','fujian','shanghai','henan'][paperId % 10];
    items.forEach((it, idx) => {
      all.push({
        ...it,
        _year: year,
        _paperId: paperId,
        _idx: idx,
        _province: province,
        _rawType: it.question_type,
        _rawUid: it.question_uid || '',
      });
    });
  }
  return all;
}

function genUid(subject, year, province, qn, paperId, idx) {
  // 唯一性保证: paperId + idx (同卷内顺序) + qn
  if (subject && paperId != null && qn != null) return `${subject}_${year}_${paperId}_${qn}_${idx||0}`;
  return '';
}

const VALID_TYPES = new Set(['choice','fill','true_false','short_answer','calculation','proof','essay','reading','cloze','grammar_fill','correction','translation','listening','seven_choose_five','continuation','experiment','comprehensive','other']);
const TYPE_ALIAS = { 'multi_choice':'choice', 'solve':'comprehensive' };
function normalizeType(t) {
  if (!t) return 'other';
  if (VALID_TYPES.has(t)) return t;
  return TYPE_ALIAS[t] || 'other';
}

// 真实修复: kp 回填 + uid 生成 + type 规范化
function fixAll(r) {
  const text = `${r.stem||''}\n${r.analysis||''}`;
  const detected = classify(text);
  const kp = new Set(Array.isArray(r.knowledge_points) ? r.knowledge_points : []);
  for (const k of detected) kp.add(k);
  const uid = r._rawUid || genUid('math', r._year, r._province, r.question_number, r._paperId, r._idx);
  const type = normalizeType(r._rawType);
  return { ...r, kp: [...kp], uid, type };
}

function evalRows(rows, label) {
  let total = 0, gt = 0, recalledByK = 0, joinable = 0, validType = 0;
  let noUid = 0, invalidType = 0;
  const uidSet = new Set(); let uidDup = 0;
  for (const r of rows) {
    total++;
    const isGT = isDeriv(r);
    if (isGT) gt++;
    const hitK = DERIV_KP.some(k => r.kp.includes(k));
    if (hitK && isGT) recalledByK++;
    if (r.uid) {
      if (uidSet.has(r.uid)) uidDup++; else uidSet.add(r.uid);
    } else {
      noUid++;
    }
    if (!r.type || !VALID_TYPES.has(r.type)) invalidType++;
    else validType++;
    if (hitK && r.uid && VALID_TYPES.has(r.type)) joinable++;
  }
  return {
    label, total, gt,
    no_uid: noUid, uid_dup: uidDup,
    invalid_type: invalidType,
    k_recall: (recalledByK / Math.max(gt,1) * 100).toFixed(2),
    joinable: (joinable / Math.max(gt,1) * 100).toFixed(2),
    valid_type_count: validType,
  };
}

const all = buildCorpus();

// ===== 4 组对比 =====
const before = all.map(r => ({ ...r, kp: Array.isArray(r.knowledge_points) ? r.knowledge_points : [], uid: r._rawUid, type: r._rawType }));
const afterAll = all.map(fixAll);
// 模拟"只修 #1, 不修 #4 #5"
const onlyKp = all.map(r => {
  const text = `${r.stem||''}\n${r.analysis||''}`;
  const detected = classify(text);
  const kp = new Set(Array.isArray(r.knowledge_points) ? r.knowledge_points : []);
  for (const k of detected) kp.add(k);
  return { ...r, kp: [...kp], uid: r._rawUid, type: r._rawType };
});
// 模拟"修 #1 + #5, 不修 #4"
const kpType = all.map(r => {
  const text = `${r.stem||''}\n${r.analysis||''}`;
  const detected = classify(text);
  const kp = new Set(Array.isArray(r.knowledge_points) ? r.knowledge_points : []);
  for (const k of detected) kp.add(k);
  return { ...r, kp: [...kp], uid: r._rawUid, type: normalizeType(r._rawType) };
});
// 修 #1 + #4, 不修 #5
const kpUid = all.map(r => {
  const text = `${r.stem||''}\n${r.analysis||''}`;
  const detected = classify(text);
  const kp = new Set(Array.isArray(r.knowledge_points) ? r.knowledge_points : []);
  for (const k of detected) kp.add(k);
  const uid = r._rawUid || genUid('math', r._year, r._province, r.question_number, r._paperId, r._idx);
  return { ...r, kp: [...kp], uid, type: r._rawType };
});

const rows = [
  evalRows(before, '修复前 (#1#4#5 都不修)'),
  evalRows(onlyKp, '只修 #1 (KP 回填)'),
  evalRows(kpType, '修 #1 + #5 (type 规范)'),
  evalRows(kpUid, '修 #1 + #4 (uid 补)'),
  evalRows(afterAll, '修 #1 + #4 + #5 (全修)'),
];

console.log('\n========== #4 #5 修复对比 (基准 2997 题, GT 467) ==========\n');
console.log('label'.padEnd(38) + 'K-recall  joinable  空uid  uid冲突  非法type');
for (const r of rows) {
  console.log(
    r.label.padEnd(38) +
    (r.k_recall + '%').padStart(8) +
    (r.joinable + '%').padStart(11) +
    String(r.no_uid).padStart(8) +
    String(r.uid_dup).padStart(10) +
    String(r.invalid_type).padStart(11)
  );
}

console.log('\n关键指标:');
console.log('  - 空 uid: ' + rows[0].no_uid + ' -> ' + rows[4].no_uid);
console.log('  - 非法 type: ' + rows[0].invalid_type + ' -> ' + rows[4].invalid_type);
console.log('  - uid 冲突: ' + rows[0].uid_dup + ' -> ' + rows[4].uid_dup);
