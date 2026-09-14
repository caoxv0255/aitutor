// scripts/qb2/stage6-dryrun-transform.mjs — DSH STAGING ONLY (REPAIR v2)
// options_raw -> options_structured {A:..} in qb_staging.
// P1-A: tag as transformable vs transform_blocked via canonical_ready_step.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const TAR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database.tar';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-recovery-'));
execSync(`tar -xf "${TAR}" -C "${work}" 2>/dev/null || true`);

function transformOptions(opts) {
  if (!Array.isArray(opts)) return { structured: null, format: 'empty', defect: null };
  const labelOnly = opts.every(o => /^[A-D][\.．、]?\s*$/.test(String(o).trim()));
  if (labelOnly) return { structured: null, format: 'labels_only', defect: 'labels_only_empty' };
  const out = {};
  const seen = new Set();
  let dup = false;
  for (const raw of opts) {
    const m = /^\s*([A-D])[\.．、]\s*(.*)$/.exec(String(raw).trim());
    if (!m) continue;
    const k = m[1]; const v = m[2].trim();
    if (seen.has(k)) { dup = true; continue; }
    seen.add(k); out[k] = v;
  }
  if (Object.keys(out).length === 0) return { structured: null, format: 'malformed', defect: 'unparseable' };
  return { structured: out, format: 'structured', defect: dup ? 'duplicate_label_dedup' : null };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");
  const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE6';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage6', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;

  const { rows: stagings } = await client.query(`
    SELECT id, question_type_raw, options_raw, answer_status, analysis_status,
           has_image_meta, images_raw, knowledge_points_raw
    FROM qb_recovery.qb_staging
  `);
  let structuredOpts = 0, optsDefect = 0;
  for (const s of stagings) {
    const tx = transformOptions(s.options_raw);
    if (tx.format === 'structured' && tx.structured) {
      structuredOpts++;
      await client.query(`UPDATE qb_recovery.qb_staging SET options_structured=$1 WHERE id=$2`, [tx.structured, s.id]);
    }
    if (tx.defect) optsDefect++;
    await client.query(`
      UPDATE qb_recovery.qb_staging
      SET transform_dryrun = $1
      WHERE id = $2
    `, [JSON.stringify({
        planned: {
          options_structured: tx.structured,
          options_format: tx.format,
          options_defect: tx.defect,
          answer_status: s.answer_status,
          analysis_status: s.analysis_status,
          scoring_points: null,
          scoring_status: 'UNKNOWN',
          images_expected: s.has_image_meta ? (Array.isArray(s.images_raw) ? s.images_raw.length : 0) : 0,
        },
        policy: 'dry-run only; canonical write forbidden in this batch',
        provenance: {
          source_kind: 'tar:database.tar',
          extracted_under: 'DSH STAGING',
          confidence_ceiling: 'MATCHED_VIA_SHA256',
        }
      }), s.id]);
  }
  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await client.query('COMMIT');
  console.log(`[stage6] structured_opts=${structuredOpts} optsDefect=${optsDefect}`);
} catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { client.release(); pool.end(); }
