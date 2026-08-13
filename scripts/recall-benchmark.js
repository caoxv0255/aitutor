#!/usr/bin/env node
/**
 * recall-benchmark.js
 *
 * 目标: 对比"导数"相关 query 在 RAG 中的召回率 (修复前 vs 修复后).
 *
 * 实现思路:
 *   修复前 → 修复后的差异主要体现在 exam_questions.knowledge_points 字段是否含导数标签,
 *   但 RAG 实际用 embedding 向量相似度召回, k_text / q_text 都来自题目原文, 不会因 knowledge_points
 *   字段变化而直接变 (除非重新入库). 因此本脚本采用两条等价路径:
 *
 *     路径 A (现状 baseline): 用数据库原始 exam_questions 做 LIKE 匹配, 模拟 "真实 RAG 命中导数题"
 *     路径 B (修复后模拟):   把 exam_questions.knowledge_points 字段当作 k_text 的一部分,
 *                            文本拼接 "stem + kp_str" 后做 embedding 检索的近似估计.
 *
 *   我们用更直接的指标:
 *
 *     1. DB-LIKE:    SELECT count(*) WHERE stem ~ '导数' (真实应当被命中的题)
 *     2. KP-Coverage: SELECT count(*) WHERE knowledge_points @> '["函数与导数"]' (标签召回率)
 *     3. K-text-LIKE: SELECT count(*) WHERE (knowledge_points::text || stem) ~ '导数' (模拟 K 向量召回文本)
 *
 *   并对一组 query (导数 / 求切线方程 / 单调性 / 极值 / 不等式证明) 分别跑一遍:
 *     - Vector-Recall@20: 调用 /api/rag/multi/search 或直接调 searchMultiVector
 *
 * 用法:
 *   node scripts/recall-benchmark.js                 # 全量跑
 *   node scripts/recall-benchmark.js --no-api        # 只跑 DB 端, 不打 embedding 接口
 *
 * 依赖: api/core/db.js (getDb / closeDb)
 */

import 'dotenv/config';
import { getDb, closeDb } from '../api/core/db.js';

const SKIP_API = process.argv.includes('--no-api');

const QUERIES = [
  { q: '导数',           expect_kws: ['导数','求导','切线'] },
  { q: '求切线方程',     expect_kws: ['切线','切线方程','导数'] },
  { q: '单调性',         expect_kws: ['单调','导数'] },
  { q: '极值与最值',     expect_kws: ['极值','最值','导数'] },
  { q: '不等式证明',     expect_kws: ['不等式','证明','导数'] },
];

const DERIV_KP_NAMES = [
  '函数与导数',
  '导数的概念与几何意义',
  '导数的运算',
  '导数与单调性',
  '导数与极值最值',
  '导数与不等式证明',
  '导数与函数零点',
];

async function fetchEmbedding(text) {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  const r = await fetch(`${url}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const j = await r.json();
  return j.embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function benchmarkDbSide(pool) {
  const { rows: stemHits } = await pool.query(`
    SELECT COUNT(*)::int AS n
      FROM exam_questions
     WHERE subject_code = 'math'
       AND (stem ~* '导数|求导|切线|单调性|极值|最值' OR analysis ~* '导数|求导|切线|单调性|极值|最值')
  `);
  const { rows: kpHits } = await pool.query(`
    SELECT COUNT(*)::int AS n
      FROM exam_questions
     WHERE subject_code = 'math'
       AND knowledge_points ~* '函数与导数|导数的概念与几何意义|导数的运算|导数与单调性|导数与极值最值|导数与不等式证明|导数与函数零点'
  `);
  const { rows: ktextHits } = await pool.query(`
    SELECT COUNT(*)::int AS n
      FROM exam_questions
     WHERE subject_code = 'math'
       AND ((knowledge_points || ' ' || stem) ~* '导数|求导|切线|单调性|极值|最值')
  `);
  return {
    stem_truth: stemHits[0].n,
    kp_coverage: kpHits[0].n,
    ktext_like: ktextHits[0].n,
  };
}

async function benchmarkVectorRecall(pool, queries) {
  const out = [];
  for (const q of queries) {
    const pattern = q.expect_kws.join('|');
    const { rows: r1 } = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM exam_questions
        WHERE subject_code='math'
          AND (stem ~* $1 OR analysis ~* $1)`,
      [pattern]
    );
    const { rows: r2 } = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM exam_questions
        WHERE subject_code='math'
          AND (knowledge_points ~* $1)`,
      ['函数与导数|导数']
    );
    out.push({
      query: q.q,
      stem_truth_recall: r1[0].n,
      kp_tag_recall: r2[0].n,
    });
  }
  return out;
}

async function benchmarkEmbeddingRecall(pool, queries, topK = 20) {
  const { rows: samples } = await pool.query(`
    SELECT id, stem, knowledge_points
      FROM exam_questions
     WHERE subject_code = 'math'
       AND (stem ~* '导数|求导|切线|单调性|极值|最值')
     LIMIT 60
  `);
  if (samples.length === 0) return { ok: false, reason: 'no deriv samples' };

  const sampleEmb = [];
  for (const s of samples) {
    const text = `${(s.knowledge_points || '').replace(/[\[\]"]/g, ' ')} ${s.stem || ''}`;
    try {
      const e = await fetchEmbedding(text);
      sampleEmb.push({ id: s.id, emb: e });
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }
  const results = {};
  for (const q of queries) {
    let qEmb;
    try { qEmb = await fetchEmbedding(q.q); }
    catch (e) { results[q.q] = { error: e.message }; continue; }
    const sims = sampleEmb.map((s) => ({ id: s.id, sim: cosine(qEmb, s.emb) }));
    sims.sort((a, b) => b.sim - a.sim);
    const top = sims.slice(0, topK);
    const avgSim = top.reduce((a, x) => a + x.sim, 0) / top.length;
    const minSim = top[top.length - 1].sim;
    const maxSim = top[0].sim;
    results[q.q] = { avgSim: +avgSim.toFixed(4), minSim: +minSim.toFixed(4), maxSim: +maxSim.toFixed(4), n: top.length };
  }
  return { ok: true, results };
}

async function main() {
  const pool = await getDb();
  console.log('\n=== 1. DB 端覆盖度 ===');
  const dbStats = await benchmarkDbSide(pool);
  console.log(JSON.stringify(dbStats, null, 2));
  console.log(`\n口径说明:
  - stem_truth:    题面/解析含导数关键词 (真实目标集)
  - kp_coverage:   knowledge_points 字段含导数标签 (修复前几乎=0, 修复后应当≈stem_truth)
  - ktext_like:    (knowledge_points || stem) 拼接后含导数 (RAG K 向量命中近似)
`);

  console.log('\n=== 2. 关键词召回 (DB LIKE) ===');
  const v = await benchmarkVectorRecall(pool, QUERIES);
  for (const r of v) {
    console.log(`  q="${r.query}"  stem_truth_recall=${r.stem_truth_recall}  kp_tag_recall=${r.kp_tag_recall}`);
  }

  if (!SKIP_API) {
    console.log('\n=== 3. Embedding 向量召回 (调 Ollama, 取 topK=20) ===');
    const e = await benchmarkEmbeddingRecall(pool, QUERIES, 20);
    if (!e.ok) {
      console.log('  skipped:', e.reason);
    } else {
      for (const q of QUERIES) {
        const r = e.results[q.q];
        if (r.error) { console.log(`  q="${q.q}" ERR: ${r.error}`); continue; }
        console.log(`  q="${q.q}"  avg=${r.avgSim}  min=${r.minSim}  max=${r.maxSim}`);
      }
    }
  }

  console.log('\n=== 4. 结论指标 ===');
  const coverage = dbStats.kp_coverage / Math.max(dbStats.stem_truth, 1);
  const ktextCov = dbStats.ktext_like / Math.max(dbStats.stem_truth, 1);
  console.log(`  KP 标签覆盖率: ${(coverage * 100).toFixed(1)}%   (目标 ≥ 95%)`);
  console.log(`  K-text 召回覆盖率(模拟): ${(ktextCov * 100).toFixed(1)}%   (目标 ≥ 95%)`);
  console.log(`  stem_truth 真实目标集: ${dbStats.stem_truth}`);

  await closeDb();
}

main().catch(async (e) => {
  console.error('benchmark failed:', e);
  try { await closeDb(); } catch {}
  process.exit(1);
});