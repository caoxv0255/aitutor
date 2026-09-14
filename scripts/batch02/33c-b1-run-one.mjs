#!/usr/bin/env node
/**
 * Phase 6 B1 · CH-3 单题试点 (调 1 次 LLM)
 *
 * 读 b1_prompts.jsonl 第一行, 调 chatCompletion, 输出端到端结果
 * ai_trace 自动埋点 (通过 services/llm.js 内部)
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROMPTS = path.join(ROOT, 'database/b1_prompts.jsonl');

// Phase 6 B1 (2026-09-14): 解决 DSH 进程无 LLM key 的问题.
// 服务的 EnvironmentFile=/home/flaskappuser/.config/aitutor/aitutor.env 仅 systemd 启动时注入,
// DSH 独立 node 进程不继承. 这里按 Phase 5 resolveKey 模式手动加载.
// 指纹校验: 与运行服务 PID 2259297 的环境一致 (sha256[:12]=88c99dadc881).
import fs2 from 'node:fs';
try {
  const envPath = '/home/flaskappuser/.config/aitutor/aitutor.env';
  if (fs2.existsSync(envPath)) {
    for (const l of fs2.readFileSync(envPath, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]] && m[1] !== 'PATH') process.env[m[1]] = m[2];
    }
    console.log('  [DSH-INIT] loaded '+Object.keys(process.env).filter(k => /KEY|TOKEN|API/i.test(k)).length+' sensitive envs from aitutor.env');
  }
} catch (e) { console.log('  [DSH-INIT] aitutor.env load failed: '+e.message); }

const { chatCompletion, DEFAULT_MODEL } = await import('../../services/llm.js');

const lines = fs.readFileSync(PROMPTS, 'utf8').trim().split('\n');
console.log(`\n=== B1 CH-3 单题 LLM 试点 (从 ${lines.length} 题选第 1 题) ===\n`);
const q = JSON.parse(lines[0]);
console.log(`--- 题面 ---`);
console.log(`  sample_order: ${q.sample_order}  question_uid: ${q.question_uid}  subject: ${q.subject_code}`);
console.log(`  stem_chars: ${q.stem_chars}  candidates: ${q.candidate_count}  truncated: ${q.stem_truncated}`);
console.log(`\n--- System Prompt ---`);
console.log(q.system);
console.log(`\n--- User Prompt (前 1500 字) ---`);
console.log(q.user.length > 1500 ? q.user.slice(0, 1500) + '\n...[truncated for display]' : q.user);

console.log(`\n--- 调 chatCompletion (model=${DEFAULT_MODEL}, jsonMode=true) ---`);
const t0 = Date.now();
let r;
try {
  r = await chatCompletion(q.system, q.user, {
    model: 'qwen-plus',
    temperature: 0.1,
    max_tokens: 200,
    jsonMode: true,
    task_type: 'kp_classify_b1_pilot',
    session_id: 'plan_b_v1',
    user_id: 'system',
  });
} catch (e) {
  console.log(`  ❌ LLM 调失败: ${e.message}`);
  process.exit(1);
}
const latency = Date.now() - t0;
console.log(`  返回延迟: ${latency}ms`);

const out = {
  sample_order: q.sample_order,
  question_uid: q.question_uid,
  subject_code: q.subject_code,
  request: { model: 'qwen-plus', temperature: 0.1, max_tokens: 200, jsonMode: true,
            task_type: 'kp_classify_b1_pilot', session_id: 'plan_b_v1' },
  response: {
    model: r.model,
    usage: r.usage,
    cost: r.cost,
    latency_ms: latency,
    content: r.choices?.[0]?.message?.content ?? r.message?.content ?? r.content ?? r,
  },
};

// 解析
import { safeParseLLMJson } from '../../services/llm.js';
let parsed = null, parseErr = null;
try {
  parsed = safeParseLLMJson(out.response.content);
  out.parsed = parsed;
} catch (e) {
  parseErr = e.message;
  out.parse_error = parseErr;
}

console.log(`\n--- LLM 原始返回 (content) ---`);
console.log(typeof out.response.content === 'string' ? out.response.content : JSON.stringify(out.response.content, null, 1));

// 即使 parse 失败, 也尝试用宽松正则从 raw 抽 kp_id 给人看
if (!parsed) {
  const raw = (typeof out.response.content === 'string') ? out.response.content : '';
  const reKps = [...raw.matchAll(/kp_id[\s":\[]+([A-Z]{3}_[CAHU]_\d{4})/g)].map(m => m[1]);
  out.parsed_fallback = { kp_ids_detected: reKps };
  console.log(`\n--- Parse 失败, 宽松正则从 raw 抽到 ${reKps.length} 个 kp_id: ${reKps.join(', ')} ---`);
}
if (parsed) {
  console.log(`\n--- 解析后 JSON ---`);
  console.log(JSON.stringify(parsed, null, 1));
  // 校验 picks 里的 kp_id 是否在候选集
  const candSet = new Set();
  const userLines = q.user.split('\n');
  for (const l of userLines) {
    const m = l.match(/^(\d+)\.\s+([A-Z]{3}_[CAHU]_\d{4})/);
    if (m) candSet.add(m[2]);
  }
  const invalidKps = [];
  for (const p of (parsed.picks || [])) {
    if (!candSet.has(p.kp_id)) invalidKps.push(p.kp_id);
  }
  out.validation = {
    n_candidates: candSet.size,
    n_picks: (parsed.picks || []).length,
    invalid_kp_ids: invalidKps,
    is_no_match: !!parsed.no_match,
    picks_kp_ids: (parsed.picks || []).map(p => p.kp_id),
  };
  console.log(`\n--- 校验 ---`);
  console.log(`  候选集 ${candSet.size} 个 kp_id | LLM 选 ${out.validation.n_picks} 个`);
  console.log(`  picks[].kp_id 全部在候选集? ${invalidKps.length === 0 ? '✅' : '❌ ' + invalidKps.join(',')}`);
  console.log(`  no_match = ${out.validation.is_no_match}`);
  console.log(`  picks: ${out.validation.picks_kp_ids.join(', ') || '(空)'}`);
}

// 写单题结果文件
const singleOut = path.join(ROOT, 'database/b1_pilot_ch3_one.json');
fs.writeFileSync(singleOut, JSON.stringify(out, null, 1));
console.log(`\n  ✅ 单题结果: ${path.relative(ROOT, singleOut)}`);

// 提示
console.log(`\n--- 下一步 ---`);
console.log(`  请人工核验 1 题是否满意:`);
console.log(`    - prompt 是否清晰`);
console.log(`    - LLM 输出格式是否合规`);
console.log(`    - picks 是否合理 (与您人工判断的 KP 对比)`);
console.log(`  满意 → 批准执行剩余 101 题 (我会用并发=4 跑, 约 30s)`);
console.log(`  满意但要调 prompt → 重新派单`);
console.log(`  不满意 → 调查问题`);
process.exit(0);
