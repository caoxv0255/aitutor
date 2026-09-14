#!/usr/bin/env node
/**
 * Phase 6 B1 · CH-2 prompt 准备 (不调 LLM)
 *
 * 对 102 题样本, 每题:
 *   1. 拼题干+选项 (截断 800 字)
 *   2. SQL 筛该学科全部 v2 词 (~170)
 *   3. 字符 trigram 重合度排序, 取 top-30
 *   4. 生成 system + user prompt
 * 输出: database/b1_prompts.jsonl (一行一题, 含 sample_order, system, user, candidates)
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'database/b1_prompts.jsonl');
const K = 30;             // top-K
const MAX_STEM = 800;     // 题干+选项截断
const SUBJ_CN = { chinese:'语文', math:'数学', english:'英语', physics:'物理', chemistry:'化学', biology:'生物', history:'历史', geography:'地理', politics:'政治' };
const TYPE_CN = { choice:'选择题', solve:'解答题', fill:'填空题', short_answer:'简答题', multiple_choice:'多选', single_choice:'单选', judgement:'判断题' };

const pool = new pg.Pool({connectionString:fs.readFileSync(path.join(ROOT,'.env'),'utf8').match(/^DATABASE_URL=(.+)$/m)[1]});
const c = await pool.connect();

const samples = (await c.query(`
  SELECT s.sample_order, s.subject_code, eq.question_uid, eq.question_type, eq.year, eq.province_code,
         eq.stem, eq.options::text AS opts
    FROM public.b1_sample_seed s
    JOIN public.exam_questions eq ON eq.question_uid=s.question_uid
   ORDER BY s.sample_order
`)).rows;
console.log(`\n=== B1 CH-2 准备 ${samples.length} 题的 prompt ===`);

// 一次性加载 v2 全部词 (1558 行, 全学科)
const v2All = (await c.query(`
  SELECT kp_id, subject, name, dimension_type FROM public.knowledge_points_v2 ORDER BY subject, dimension_type, kp_id
`)).rows;
const v2BySubject = {};
for (const r of v2All) (v2BySubject[r.subject] ??= []).push(r);
for (const s of Object.keys(v2BySubject)) console.log(`  ${s.padEnd(11)} 候选 ${v2BySubject[s].length} 条`);

// trigram 集合
function trigrams(s) {
  s = String(s).replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3));
  return set;
}
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const out = fs.createWriteStream(OUT);
for (const q of samples) {
  // 1. 题干+选项
  let opts = '';
  try { const a = JSON.parse(q.opts || '[]'); opts = Array.isArray(a) ? a.join(' | ') : ''; } catch {}
  const stemFull = `${q.stem || ''} ${opts}`.trim();
  const stem = stemFull.length > MAX_STEM ? stemFull.slice(0, MAX_STEM) + '...' : stemFull;
  // 2. 筛学科候选
  const cand = v2BySubject[q.subject_code] || [];
  // 3. 字符 trigram 排序
  const tg = trigrams(stem);
  const scored = cand.map(c => ({ c, s: jaccard(tg, trigrams(c.name)) }))
    .sort((a, b) => b.s - a.s).slice(0, Math.min(K, cand.length));
  // 4. prompt
  const candidatesList = scored.map((x, i) => `${i+1}. ${x.c.kp_id} | ${x.c.name} | ${x.c.dimension_type}`).join('\n');
  const subjCn = SUBJ_CN[q.subject_code] || q.subject_code;
  const typeCn = TYPE_CN[q.question_type] || q.question_type;

  const system = `你是中国中学(中考/高考)出题与教学专家，任务是为一道客观题从给定候选知识点列表中挑选最匹配者。

要求：
1. 严格从候选列表中挑选（凭 kp_id 引用），不编造
2. 一道题可对应 1–3 个知识点（多角度考查时）
3. 英语题：优先选择 1-2 个 ability（能力维度），若题目明确对应特定教材单元，可补充 1 个 textbook_unit
4. 不确定时，宁可少选或不选（no_match=true），不强行匹配
5. 仅返回严格 JSON，不附加解释文字
6. JSON 转义约束: reason 字段内**禁止使用单引号** ('), 必须使用中文双引号 ("") 或全角双引号 ("")
7. 术语边界: 「应用文写作」仅指书信/通知/演讲稿/请假条/启事/证明信等**实用文体**, 不包括材料作文/散文/诗歌/小说等文学性写作. 文学性写作不选 ability=应用文写作`;

  const user = `学科：${q.subject_code}（${subjCn}）  题型：${typeCn}  年份：${q.year || '?'}  省份：${q.province_code || '?'}

题干与选项（${stemFull.length > MAX_STEM ? `已截断到前 ${MAX_STEM} 字` : '完整'}）：
${stem}

候选 v2 知识点（按字符相关度排序，已预筛 top-${scored.length}）：
${candidatesList}

请输出 JSON（reason 字段内禁止单引号, 用中文双引号或转义双引号）：
{
  "picks": [
    { "kp_id": "CHE_C_0042", "confidence": 0.9, "reason": "题问离子方程式书写，对应离子反应概念" }
  ],
  "no_match": false
}

约束：
- picks[].kp_id 必须严格等于候选列表中的某个 kp_id（凭 ID 引用）
- no_match=true 时 picks 必须是空数组
- confidence ∈ [0,1]，< 0.3 表示很勉强
- 选 1–3 个；英语题至少 1 个 ability（如果候选里有）`;

  out.write(JSON.stringify({
    sample_order: q.sample_order, question_uid: q.question_uid,
    subject_code: q.subject_code, question_type: q.question_type,
    stem_chars: stem.length, stem_truncated: stemFull.length > MAX_STEM,
    candidate_count: scored.length,
    system, user,
  }) + '\n');
}
out.end();
await new Promise(r => out.on('finish', r));
console.log(`\n  ✅ 写出: ${path.relative(ROOT, OUT)}`);
console.log(`  102 题 prompt, 每题 input ~${(samples[0].stem||'').length>200?'3k':'1.5k'} tokens (含 30 候选 + 截断题干 + 指令)`);

c.release(); await pool.end();
process.exit(0);
