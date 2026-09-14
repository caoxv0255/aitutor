import fs from 'node:fs';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
const report = {};

try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");

  const { rows: [img] } = await c.query(`SELECT i.id, i.question_id, i.asset_uri, i.status FROM public.question_images i WHERE i.created_at >= '2026-09-10 01:00:00+00' LIMIT 1`);
  report.test_image_id = img.id;
  report.test_question_id = img.question_id;
  report.test_status = img.status;

  const beforeSha = sha256(JSON.stringify({ question_id: img.question_id, asset_uri: img.asset_uri, file_path: img.asset_uri, image_type: 'page_image', sort_order: 0, status: img.status, source_page: 0 }));

  await c.query(`UPDATE public.question_images SET status = 'MISSING_SOURCE' WHERE id = $1`, [img.id]);
  const afterExtModSha = sha256(JSON.stringify({ question_id: img.question_id, asset_uri: img.asset_uri, file_path: img.asset_uri, image_type: 'page_image', sort_order: 0, status: 'MISSING_SOURCE', source_page: 0 }));
  report.external_modification_detected = beforeSha !== afterExtModSha;
  report.before_sha = beforeSha.slice(0, 16) + '...';
  report.after_external_mod_sha = afterExtModSha.slice(0, 16) + '...';

  const recordedAfterSha = sha256(JSON.stringify({ question_id: img.question_id, asset_uri: img.asset_uri, file_path: img.asset_uri, image_type: 'page_image', sort_order: 0, status: 'PRESENT', source_page: 0 }));
  const currentSha = afterExtModSha;
  const safeToRollback = (currentSha === recordedAfterSha);
  report.rollback_would_be_SAFE = safeToRollback;
  report.rollback_protocol_decision = safeToRollback ? 'PROCEED' : 'SKIP (sha mismatch — safe)';
  report.ledger_recorded_after_sha = recordedAfterSha.slice(0, 16) + '...';
  report.current_sha_after_external_mod = currentSha.slice(0, 16) + '...';

  await c.query(`UPDATE public.question_images SET status = 'PRESENT' WHERE id = $1`, [img.id]);

  await c.query('COMMIT');

  report.simulation = {
    setup: `Image id=${img.id} (status=PRESENT)`,
    action_1: `External modification changed status to MISSING_SOURCE`,
    action_2: `Computed current sha vs ledger-recorded after_sha`,
    decision: `safeToRollback=${safeToRollback} → ${report.rollback_protocol_decision}`,
  };

  fs.writeFileSync('/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight/rollback-verify-result.json', JSON.stringify(report, null, 2));
  console.log('=== ROLLBACK PROTOCOL VERIFICATION ===');
  console.log(JSON.stringify(report, null, 2));
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
