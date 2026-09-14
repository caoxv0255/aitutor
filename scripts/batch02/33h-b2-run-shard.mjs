#!/usr/bin/env node
/**
 * Phase 6 B2 · CH-3 分批跑 LLM
 * 用法: node 33h-b2-run-shard.mjs --offset 0 --limit 500
 * 输出: database/b2_results_<offset>_<limit>.jsonl (可合并)
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envPath = '/home/flaskappuser/.config/aitutor/aitutor.env';
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]] && m[1] !== 'PATH') process.env[m[1]] = m[2];
  }
}
const { chatCompletion, safeParseLLMJson } = await import('../../services/llm.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROMPTS = path.join(ROOT, 'database/b2_prompts.jsonl');

const args = process.argv.slice(2);
const offset = parseInt(args[args.indexOf('--offset') + 1] || '0', 10);
const limit = parseInt(args[args.indexOf('--limit') + 1] || '500', 10);
const CONCURRENCY = 4;

const all = fs.readFileSync(PROMPTS, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const queue = all.slice(offset, offset + limit);
console.log(`\n=== B2 跑分片 [${offset}..${offset + queue.length}) (${queue.length} 题, 并发 ${CONCURRENCY}) ===`);

const OUT = path.join(ROOT, `database/b2_results_${offset}_${limit}.jsonl`);

const results = [];
async function worker(idx) {
  const q = queue[idx];
  const t0 = Date.now();
  try {
    const r = await chatCompletion(q.system, q.user, {
      model: 'qwen-plus', temperature: 0.1, max_tokens: 600,
      jsonMode: true, task_type: 'kp_classify_b2_shard',
      session_id: `plan_b_v2_${offset}`, user_id: 'system',
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
    process.stdout.write(idx % 100 === 0 ? `\n[${idx+1}/${queue.length}] ` : `.${idx + 1}`);
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
  while (true) { const i = next++; if (i >= queue.length) break; await worker(i); }
});
const t0 = Date.now();
await Promise.all(workers);
const totalMs = Date.now() - t0;
process.stdout.write('\n');

fs.writeFileSync(OUT, results.map(r => JSON.stringify(r)).join('\n') + '\n');

const n = results.length;
const nOk = results.filter(r => r.parse_ok).length;
const totCost = results.reduce((a, r) => a + (r.cost || 0), 0);
const totTok = results.reduce((a, r) => a + (r.usage?.total_tokens || 0), 0);
const noMatch = results.filter(r => r.no_match === true).length;
const totPicks = results.reduce((a, r) => a + (r.picks?.length || 0), 0);
console.log(`\n  完成: ${n} 题, 耗时 ${(totalMs/1000).toFixed(1)}s, 解析成功 ${nOk}`);
console.log(`  token: ${totTok.toLocaleString()} | 成本: ¥${totCost.toFixed(4)}`);
console.log(`  no_match: ${noMatch} | picks: ${totPicks} (平均 ${(totPicks/n).toFixed(2)}/题)`);
console.log(`  写出: ${path.relative(ROOT, OUT)}`);

process.exit(0);
