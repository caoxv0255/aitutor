#!/usr/bin/env node
/* 18-formula-fidelity.js —— G11 的**实测**部分: 对公式资产做可自动验证的分级。

背景: 规范 G11 = 「关键公式 >=F2」, 但 **F0–F3 的定义 (外部规范 §24) 不在本仓库**,
      且 `question_formulas` 表连 formula_quality 列都没有 (§5.3b 迁移从未实施)。
      所以本脚本只做**客观可验证**的测量, 不替用户定阈值。

两把尺子 (都可自动验证, 不依赖人工判断)
--------------------------------------
  A. **可编译性** —— KaTeX 严格模式能否渲染。这一条是硬门槛:
     不可编译的 LaTeX 在课件/试卷渲染端就是坏资产。
  B. **结构保真度** —— LaTeX 是否保留数学结构 (分式/根号/上下标/求和积分/矩阵),
     还是退化成单符号/纯文本。用结构标记密度判定。

用法: node 18-formula-fidelity.js <latex文件> [<latex文件2> ...]
输出: 每个文件的 {总数, 可编译, 编译失败, 含结构, 结构计数} + 总表
*/
const fs = require('fs');
const katex = require('katex');

// 结构标记: 有这些才算「保留了数学结构」, 而不是把公式压成一个符号
const STRUCT = [
  [/\\frac|\\dfrac|\\tfrac/, 'frac'],
  [/\\sqrt/, 'sqrt'],
  [/\^|\\sum|\\prod/, 'sup'],
  [/_|\\lim|\\max|\\min/, 'sub'],
  [/\\int|\\oint/, 'int'],
  [/\\begin\{(array|matrix|pmatrix|bmatrix|cases|aligned)/, 'matrix'],
  [/\\Delta|\\alpha|\\beta|\\gamma|\\theta|\\pi|\\lambda|\\mu|\\omega|\\Sigma|\\Omega/, 'greek'],
  [/\\text|\\mathrm|\\operatorname|\\vec|\\bar|\\hat|\\tilde/, 'text'],
];

function classify(latex) {
  const hits = [];
  for (const [rx, name] of STRUCT) if (rx.test(latex)) hits.push(name);
  let ok = true, err = '';
  try {
    katex.renderToString(latex, { throwOnError: true, strict: 'error', displayMode: true });
  } catch (e) {
    ok = false;
    err = String(e.message || e).slice(0, 90);
  }
  return { ok, err, structure: hits };
}

function run(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(s => s.trim().length);
  const res = {
    file, total: lines.length, compilable: 0, failed: 0,
    structN: 0, structHist: {}, errSamples: [], failedSamples: [],
  };
  for (const L of lines) {
    const c = classify(L);
    if (c.ok) res.compilable++; else {
      res.failed++;
      if (res.failedSamples.length < 5) res.failedSamples.push([L.slice(0, 80), c.err]);
    }
    if (c.structure.length) {
      res.structN++;
      for (const s of c.structure) res.structHist[s] = (res.structHist[s] || 0) + 1;
    }
  }
  res.pctCompile = (100 * res.compilable / Math.max(res.total, 1)).toFixed(2);
  res.pctStruct = (100 * res.structN / Math.max(res.total, 1)).toFixed(2);
  return res;
}

const files = process.argv.slice(2);
if (!files.length) { console.error('用法: node 18-formula-fidelity.js <latex文件>'); process.exit(2); }
const out = [];
for (const f of files) {
  const r = run(f);
  out.push(r);
  console.log(`\n=== ${f} ===`);
  console.log(`总数 ${r.total}  可编译 ${r.compilable} (${r.pctCompile}%)  编译失败 ${r.failed}`);
  console.log(`含数学结构 ${r.structN} (${r.pctStruct}%)  结构分布: ${JSON.stringify(r.structHist)}`);
  if (r.failedSamples.length) {
    console.log('失败样例:');
    for (const [s, e] of r.failedSamples) console.log(`   ${s} → ${e}`);
  }
}
fs.writeFileSync('/tmp/formula-fidelity.json', JSON.stringify(out, null, 2));
console.log('\n详细结果: /tmp/formula-fidelity.json');
