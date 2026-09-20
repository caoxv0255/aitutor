import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ONE = JSON.parse(fs.readFileSync(path.join(ROOT,'database/b1_pilot_ch3_one.json'),'utf8'));
const BATCH = fs.readFileSync(path.join(ROOT,'database/b1_results.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
// 合并: CH-3 + CH-4
const merged = [{
  sample_order: ONE.sample_order, question_uid: ONE.question_uid, subject_code: ONE.subject_code,
  model: ONE.response.model, usage: ONE.response.usage, cost: ONE.response.cost, latency_ms: ONE.response.latency_ms,
  parse_ok: ONE.parsed ? true : false, content: ONE.response.content, kp_ids: ONE.validation?.picks_kp_ids || [],
  no_match: ONE.parsed?.no_match, picks: ONE.parsed?.picks, source: 'CH-3',
}, ...BATCH.map(r => ({
  sample_order: r.sample_order, question_uid: r.question_uid, subject_code: r.subject_code,
  model: r.model, usage: r.usage, cost: r.cost, latency_ms: r.latency_ms, parse_ok: r.parse_ok,
  content: r.content, kp_ids: r.kp_ids, no_match: r.no_match, picks: r.picks, source: 'CH-4',
}))].sort((a,b)=>a.sample_order - b.sample_order);
fs.writeFileSync(path.join(ROOT,'database/b1_results_all.jsonl'), merged.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(`\n=== B1 102 题合并 ===`);
console.log(`  合并: ${merged.length} 题 (CH-3: 1 + CH-4: 101)`);
console.log(`  ✅ 写出: database/b1_results_all.jsonl`);
// 基础统计
const n = merged.length;
const nOk = merged.filter(r => r.parse_ok).length;
const nFallback = merged.filter(r => !r.parse_ok && r.kp_ids.length > 0).length;
const nFail = merged.filter(r => r.parse_ok === false && r.kp_ids.length === 0).length;
const totCost = merged.reduce((a, r) => a + (r.cost || 0), 0);
const totTok = merged.reduce((a, r) => a + (r.usage?.total_tokens || 0), 0);
const bySubj = {};
for (const r of merged) bySubj[r.subject_code] = (bySubj[r.subject_code] || 0) + 1;
const noMatchN = merged.filter(r => r.no_match === true).length;
const nPicks = merged.reduce((a, r) => a + r.kp_ids.length, 0);
console.log(`\n  解析: 成功 ${nOk} | 兜底 ${nFallback} | 失败 ${nFail}`);
console.log(`  题目: 102 | 总 token: ${totTok.toLocaleString()} | 总成本: ¥${totCost.toFixed(4)} | 平均: ${(totCost/n).toFixed(4)}/题`);
console.log(`  no_match=true: ${noMatchN} 题 | 总 picks 数: ${nPicks} | 平均: ${(nPicks/n).toFixed(2)}/题`);
console.log('  学科分布:', Object.entries(bySubj).sort().map(([s,n])=>`${s}=${n}`).join(' '));
// 输出待人工判读报告 (markdown 表格格式)
let md = `# B1 试点 102 题判读报告（待人工核验）\n\n`;
md += `**日期**: ${new Date().toISOString().slice(0,10)}  \n`;
md += `**run_label**: plan_b_v1  \n`;
md += `**结果文件**: \`database/b1_results_all.jsonl\` (102 行)\n\n`;
md += `## 总体统计\n\n`;
md += `| 指标 | 值 |\n|---|---|\n`;
md += `| 题目数 | 102 |\n`;
md += `| JSON 解析成功 | ${nOk} (${(nOk*100/n).toFixed(1)}%) |\n`;
md += `| 解析失败 (宽松正则兜底) | ${nFallback} |\n`;
md += `| 完全失败 | ${nFail} |\n`;
md += `| 总 token | ${totTok.toLocaleString()} |\n`;
md += `| 总成本 | ¥${totCost.toFixed(4)} |\n`;
md += `| 平均成本 | ¥${(totCost/n).toFixed(4)}/题 |\n`;
md += `| no_match=true 题数 | ${noMatchN} |\n`;
md += `| 总 picks 数 | ${nPicks} (平均 ${(nPicks/n).toFixed(2)}/题) |\n\n`;
md += `## 9 学科分布\n\n`;
md += `| 学科 | 题数 | 占比 |\n|---|---|---|\n`;
const subjOrder = ['chinese','math','english','physics','chemistry','biology','history','geography','politics'];
for (const s of subjOrder) {
  const c = bySubj[s] || 0;
  md += `| ${s} | ${c} | ${(c*100/n).toFixed(1)}% |\n`;
}
md += `\n## 102 题明细 (待人工判读)\n\n`;
md += `> 判读口径: ✅正确 / ⚠️部分 (含父级概念, 如选"力学"但题考"牛顿第二定律") / ❌错误 / 🚫no_match\n\n`;
md += `| # | 学科 | uid | 题干(40字) | LLM picks | 现有归因 | 待判读 |\n`;
md += `|---|---|---|---|---|---|---|\n`;
// 读样本/现有归因
const samples = JSON.parse(fs.readFileSync(path.join(ROOT,'database/b1_sample.json'),'utf8'));
const byUid = new Map(samples.questions.map(q => [q.question_uid, q]));
for (const r of merged) {
  const q = byUid.get(r.question_uid) || {};
  const stem = (q.stem || '').replace(/\n/g,' ').slice(0, 40);
  const ch = q.existing_attribution?.chapter_name || '(none)';
  const chm = q.existing_attribution?.method || '';
  const picks = r.kp_ids.join(' / ') || '(空)';
  md += `| ${r.sample_order} | ${r.subject_code} | ${r.question_uid} | ${stem} | ${picks} | ${ch} [${chm}] |  |\n`;
}
fs.writeFileSync(path.join(ROOT,'docs/audits/phase6-b1-judging-sheet.md'), md);
console.log(`  ✅ 判读表: docs/audits/phase6-b1-judging-sheet.md`);
