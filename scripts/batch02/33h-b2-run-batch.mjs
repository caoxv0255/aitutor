#!/usr/bin/env node
/**
 * Phase 6 B2 · CH-3 批跑 LLM (复用 33d, 改输入/输出)
 * 读 database/b2_prompts.jsonl → 调 LLM (qwen-plus, jsonMode) → b2_results.jsonl
 * 并发=4, 限流+重试由 services/llm.js 内部处理
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

// DSH 独立进程需手动加载 aitutor.env
const envPath = '/home/flaskappuser/.config/aitutor/aitutor.env';
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]] && m[1] !== 'PATH') process.env[m[1]] = m[2];
  }
  console.log('  [DSH-INIT] loaded sensitive envs from aitutor.env');
}
const { chatCompletion, safeParseLLMJson } = await import('../../services/llm.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROMPTS = path.join(ROOT, 'database/b2_prompts.jsonl');
const OUT = path.join(ROOT, 'database/b2_results.jsonl');
const CONCURRENCY = 4;

const all = fs.readFileSync(PROMPTS, 'utf8').trim().split('\n').map(l => JSON.parse(l));
console.log(`\n=== B2 跑 ${all.length} 题 (并发 ${CONCURRENCY}) ===`);

const results = [];
async function worker(idx) {
  const q = all[idx];
  const t0 = Date.now();
  try {
    const r = await chatCompletion(q.system, q.user, {
      model: 'qwen-plus', temperature: 0.1, max_tokens: 600,
      jsonMode: true, task_type: 'kp_classify_b2_full',
      session_id: 'plan_b_v2', user_id: 'system',
    });
    const content = r?.choices?.[0]?.message?.content ?? r?.content;
    let parsed = null, parseErr = null;
    try { parsed = safeParseLLMJson(content); } catch (e) { parseErr = e.message; }
    const picks = (parsed?.picks || []).map(p => p.kp_id);
    const fallback = (!parsed && typeof content === 'string') ?
      [...content.matchAll(/kp_id[\s":\[]+([A-Z]{3}_[CAHU]_\d{4})/g)].map(m => m[1]) : [];
    results.push({
      question_id: q.question_id, question_uid: q.question_uid, subject_code: q.subject_code,
      model: r?.model ?? 'qwen-plus',
      usage: r?.usage, cost: r?.cost, latency_ms: Date.now() - t0,
      parse_ok: !!parsed, parse_err: parseErr,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      picks: parsed?.picks || null, no_match: parsed?.no_match ?? null,
      kp_ids: picks.length ? picks : fallback,
    });
    process.stdout.write(idx % 100 === 0 ? `\n[${idx+1}/${all.length}] ` : `.${idx + 1}`);
  } catch (e) {
    results.push({
      question_id: q.question_id, question_uid: q.question_uid, subject_code: q.subject_code,
      model: 'qwen-plus', parse_ok: false, parse_err: e.message,
      cost: 0, latency_ms: Date.now() - t0, kp_ids: [], picks: null, no_match: null,
    });
    process.stdout.write(`E${idx + 1}`);
  }
}

let next = 0;
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (true) { const i = next++; if (i >= all.length) break; await worker(i); }
});
const t0 = Date.now();
await Promise.all(workers);
const totalMs = Date.now() - t0;
process.stdout.write('\n');
console.log(`  完成: ${results.length} 题, 耗时 ${(totalMs/1000).toFixed(1)}s`);

fs.writeFileSync(OUT, results.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`  ✅ 写出: ${path.relative(ROOT, OUT)}`);

const n = results.length;
const nOk = results.filter(r => r.parse_ok).length;
const nFallback = results.filter(r => !r.parse_ok && r.kp_ids.length > 0).length;
const nFail = results.filter(r => r.parse_ok === false && r.kp_ids.length === 0).length;
const totCost = results.reduce((a, r) => a + (r.cost || 0), 0);
const totTok = results.reduce((a, r) => a + (r.usage?.total_tokens || 0), 0);
console.log(`\n  === 统计 ===`);
console.log(`  解析成功: ${nOk} | 失败但兜底: ${nFallback} | 完全失败: ${nFail}`);
console.log(`  总 token: ${totTok.toLocaleString()} | 总成本: ¥${totCost.toFixed(4)} | 墙钟: ${(totalMs/1000).toFixed(1)}s`);

const bySubj = {};
for (const r of results) bySubj[r.subject_code] = (bySubj[r.subject_code] || 0) + 1;
console.log('  学科:', Object.entries(bySubj).sort().map(([s,n]) => `${s}=${n}`).join(' '));

process.exit(0);
