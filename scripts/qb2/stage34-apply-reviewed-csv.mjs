#!/usr/bin/env node
// scripts/qb2/stage34-apply-reviewed-csv.mjs
// D090 follow-up: 读取人工抽审后的 CSV 写入 question_knowledge_points
// 使用: 仅读取 docs/audits/stage33-candidates-for-review-FILLED.csv 中 review_kp_id 非空的行
// 写入: 严格按 review_kp_id，relevance_score=0.95, source='human_review'
// 留痕: 通过 canonical_migration_ledger (run_label='stage34-apply-reviewed')
// 幂等: ON CONFLICT DO NOTHING (重复跑安全)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUN_LABEL = 'stage34-apply-reviewed';
const TIMESTAMP = new Date().toISOString();

function loadDatabaseUrl() {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[stage34] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// 简单 CSV 解析（仅支持 stage33 生成的格式）
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => row[h] = fields[idx] || '');
    rows.push(row);
  }
  return { header, rows };
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === ',') { fields.push(cur); cur = ''; }
      else if (c === '"') inQuote = true;
      else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

async function main() {
  const csvPath = path.resolve(__dirname, '..', '..', 'docs', 'audits', 'stage33-candidates-for-review-FILLED.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('[stage34] 找不到 ' + csvPath);
    console.error('[stage34] 请先抽审 stage33-candidates-for-review.csv，填充 review_kp_id 列，重命名为 -FILLED.csv');
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, 'utf8');
  const { rows } = parseCSV(text);
  // 仅取 review_kp_id 非空且 review_status='accepted' 的行
  const accepted = rows.filter(r =>
    r.review_kp_id && r.review_kp_id.trim() !== '' &&
    (!r.review_status || r.review_status === 'accepted')
  );
  console.log('[stage34] CSV 总行数: ' + rows.length);
  console.log('[stage34] 已审校 (review_kp_id 非空): ' + accepted.length);

  if (accepted.length === 0) {
    console.log('[stage34] 无审校数据，退出');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let invalidKp = 0;
  const ledgerOps = [];

  try {
    await client.query('BEGIN');

    for (const r of accepted) {
      const qid = parseInt(r.question_id, 10);
      const kpId = r.review_kp_id.trim();
      if (isNaN(qid) || !kpId) { skipped++; continue; }

      const insRes = await client.query(
        `INSERT INTO public.question_knowledge_points
           (question_id, knowledge_point_id, relevance_score, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (question_id, knowledge_point_id) DO NOTHING
         RETURNING id`,
        [qid, kpId, 0.95, 'human_review']
      );

      if (insRes.rowCount === 0) { skipped++; continue; }
      inserted++;

      const afterSha = crypto.createHash('sha256')
        .update(`${qid}:${kpId}:0.95:human_review`)
        .digest('hex');
      ledgerOps.push([
        RUN_LABEL, 'qkp', kpId, qid, 'INSERTED',
        null, afterSha,
        JSON.stringify({
          question_uid: r.question_uid,
          subject_code: r.subject_code,
          kp_id: kpId,
          source: 'human_review',
          notes: r.notes || ''
        })
      ]);
    }

    if (ledgerOps.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < ledgerOps.length; i += BATCH) {
        const slice = ledgerOps.slice(i, i + BATCH);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const op of slice) {
          placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++}::jsonb)`);
          values.push(...op);
        }
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
            (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
           VALUES ${placeholders.join(',')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FATAL]', e.message);
    throw e;
  } finally {
    client.release();
  }

  // 复跑覆盖率
  const cov = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT question_id) FROM public.question_knowledge_points) AS with_kp,
      (SELECT COUNT(*) FROM public.exam_questions) AS total_questions
  `);
  const { with_kp, total_questions } = cov.rows[0];
  const coveragePct = ((Number(with_kp) / Number(total_questions)) * 100).toFixed(2);

  const result = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    csv_input_rows: rows.length,
    csv_accepted_rows: accepted.length,
    inserted,
    skipped,
    invalid_kp_count: invalidKp,
    coverage_after: {
      questions_with_kp: Number(with_kp),
      total_questions: Number(total_questions),
      coverage_pct: Number(coveragePct)
    }
  };

  const outDir = path.resolve(__dirname, '..', '..', 'docs', 'audits');
  const outPath = path.join(outDir, 'stage34-apply-reviewed-report.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log('\n=== 结果 ===');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n报告 → ${outPath}`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[stage34] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
