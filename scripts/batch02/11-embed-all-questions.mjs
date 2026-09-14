#!/usr/bin/env node
// scripts/batch02/11-embed-all-questions.mjs
// Dispatch 022 后置 · 给全量 public.exam_questions 生成 1024-dim embedding
//
// 复用 services/embedding.js, 单事务 + 单题 dedup + 限流

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const RUN_LABEL = 'batch02-11-embed-all';

if (!process.env.DASHSCOPE_API_KEY && !process.env.EMBEDDING_API_KEY) {
  console.error('[11] FATAL: DASHSCOPE_API_KEY or EMBEDDING_API_KEY required');
  process.exit(1);
}

function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[11] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

async function getEmbedding(text) {
  const { getEmbedding: _getEmb } = await import('../../services/embedding.js');
  return _getEmb(text);
}

function buildEmbeddingText(q) {
  const parts = [q.stem];
  if (q.options) parts.push('【选项】' + q.options);
  if (q.answer) parts.push('【答案】' + q.answer);
  if (q.analysis) parts.push('【解析】' + q.analysis);
  return parts.join('\n').slice(0, 8000);
}

async function main() {
  console.log('='.repeat(78));
  console.log(`  Batch-02 全量 Embedding Backfill · ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  // 1) 加载所有无 embedding 的题目
  const candidates = await pool.query(`
    SELECT q.id, q.question_uid, q.paper_id, q.question_number,
           q.subject_code, q.question_type, q.difficulty,
           q.stem, q.options, q.answer, q.analysis
    FROM public.exam_questions q
    LEFT JOIN public.question_vectors qv ON qv.question_id = q.id
    WHERE q.stem IS NOT NULL
      AND length(q.stem) >= 6
      AND qv.question_id IS NULL
    ORDER BY q.paper_id, q.question_number
  `);
  console.log(`\n[1] 候选题目 (全量, 无 embedding): ${candidates.rowCount}`);

  if (candidates.rowCount === 0) {
    await pool.end();
    return;
  }

  // 2) 基线
  const beforeVec = await pool.query(`SELECT count(*)::bigint AS cnt FROM public.question_vectors`);
  console.log(`[2] question_vectors 基线: ${beforeVec.rows[0].cnt} 行`);

  // 3) 逐题处理
  const client = await pool.connect();
  let inserted = 0, failed = 0;
  const errors = [];
  const t0 = Date.now();

  try {
    for (let i = 0; i < candidates.rows.length; i++) {
      const q = candidates.rows[i];
      const text = buildEmbeddingText(q);
      let vec;
      try {
        vec = await getEmbedding(text);
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push({ qid: q.id, error: e.message.slice(0, 100) });
        continue;
      }
      if (!vec || vec.length !== 1024) {
        failed++;
        if (errors.length < 5) errors.push({ qid: q.id, error: `dim mismatch: ${vec?.length}` });
        continue;
      }

      const vecStr = `[${vec.join(',')}]`;
      const afterSha = crypto.createHash('sha256')
        .update(`embedding:${q.question_uid}:${vec.length}`).digest('hex');

      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO public.question_vectors
             (question_id, question_uid, subject_code, question_type, difficulty,
              q_embedding, q_text, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8::jsonb)
           ON CONFLICT (question_id) DO UPDATE SET
             q_embedding = EXCLUDED.q_embedding,
             q_text = EXCLUDED.q_text,
             updated_at = now()`,
          [
            q.id, q.question_uid, q.subject_code, q.question_type, q.difficulty,
            vecStr, q.stem.slice(0, 1000),
            JSON.stringify({
              dim: vec.length,
              source: 'batch02-11-embed-all',
              model: process.env.EMBEDDING_MODEL || 'text-embedding-v3'
            })
          ]
        );
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
             (run_label, entity_type, canonical_uid, canonical_id, action, detail)
           VALUES ($1, 'question_vectors', $2, $3, 'EMBEDDED', $4::jsonb)`,
          [RUN_LABEL, q.question_uid, q.id,
           JSON.stringify({ paper_id: q.paper_id, dim: vec.length })]
        );
        await client.query('COMMIT');
        inserted++;
        if (inserted % 50 === 0 || inserted === candidates.rowCount) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          const rate = (inserted / elapsed).toFixed(2);
          console.log(`    [${inserted}/${candidates.rowCount}] ${elapsed}s (${rate} 题/s) qid=${q.id} ${q.question_uid}`);
        }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        if (errors.length < 5) errors.push({ qid: q.id, error: `db: ${e.message.slice(0, 100)}` });
      }
    }
  } finally {
    client.release();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== Result ===`);
  console.log(`inserted: ${inserted}`);
  console.log(`failed:   ${failed}`);
  console.log(`elapsed:  ${elapsed}s`);
  console.log(`rate:     ${(inserted / elapsed).toFixed(2)} 题/s`);

  // 4) 验证
  const afterVec = await pool.query(`
    SELECT
      count(*) AS total_vectors,
      count(DISTINCT qv.question_id) AS distinct_questions,
      (SELECT count(*) FROM public.exam_questions) AS total_questions,
      count(*) FILTER (WHERE qv.q_embedding IS NOT NULL) AS with_embedding
    FROM public.question_vectors qv
  `);
  const { total_vectors, distinct_questions, total_questions, with_embedding } = afterVec.rows[0];
  console.log(`\n[4] 验证:`);
  console.log(`    question_vectors 总行: ${total_vectors}`);
  console.log(`    distinct question_id:  ${distinct_questions}`);
  console.log(`    with q_embedding:     ${with_embedding}`);
  console.log(`    总 exam_questions:    ${total_questions}`);
  console.log(`    覆盖率:                ${((Number(with_embedding)/Number(total_questions))*100).toFixed(2)}%`);

  if (errors.length > 0) {
    console.log(`\n错误样例 (前 ${errors.length}):`);
    for (const e of errors) console.log(`  - qid=${e.qid}: ${e.error}`);
  }

  // 写报告
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'batch02-11-embed-report.json'),
    JSON.stringify({
      run_label: RUN_LABEL,
      timestamp: new Date().toISOString(),
      candidates_total: candidates.rowCount,
      inserted,
      failed,
      elapsed_seconds: Number(elapsed),
      rate_per_sec: Number((inserted / elapsed).toFixed(2)),
      coverage: {
        total_questions: Number(total_questions),
        with_embedding: Number(with_embedding),
        coverage_pct: Number(((Number(with_embedding) / Number(total_questions)) * 100).toFixed(2))
      },
      errors_sample: errors
    }, null, 2)
  );
  console.log(`\n报告 → docs/audits/batch02-11-embed-report.json`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[11] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
