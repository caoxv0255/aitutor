// scripts/qb2/stage4-image-map.mjs — DSH STAGING ONLY (REPAIR v2)
// P1-C: emit physical_asset_count + resolved_reference_count explicitly
// P1-B: also classify image references as RESOLVED / MISSING_SOURCE (no change in behavior, just run)
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");
  const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE4';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage4', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;
  console.log(`[run] ${runLabel}`);

  // image_staging was truncated by stage3 already; rebuild it
  await client.query('TRUNCATE qb_recovery.image_staging RESTART IDENTITY');
  // re-establish UNIQUE
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_image_staging_ref') THEN
      ALTER TABLE qb_recovery.image_staging ADD CONSTRAINT uq_image_staging_ref UNIQUE (staging_id, ref_filename, ref_sort);
    END IF;
  END $$;`);

  // build filename -> asset_id index from page_image namespace only
  const { rows: assets } = await client.query(`
    SELECT asset_id, rel_path, namespace, status, binary_validation_status
    FROM qb_recovery.asset_inventory
    WHERE namespace = 'page_image'
  `);
  const byFilename = new Map();
  let physicalReady = 0;
  for (const a of assets) {
    const fn = a.rel_path.split('/').pop();
    byFilename.set(fn, a.asset_id);
    if (a.status === 'READY' && (a.binary_validation_status === 'VALID' || a.binary_validation_status === null)) physicalReady++;
  }
  console.log(`[page_image_assets] total=${assets.length} structurally_valid=${physicalReady}`);

  // image_staging rebuild from qb_staging
  const { rows: stagings } = await client.query(`
    SELECT id, question_uid, subject, year, images_raw
    FROM qb_recovery.qb_staging
    WHERE images_raw IS NOT NULL AND jsonb_array_length(images_raw) > 0
  `);
  let totalRefs = 0, resolvedRefs = 0, missingRefs = 0;
  for (const s of stagings) {
    for (let i = 0; i < s.images_raw.length; i++) {
      const ref = s.images_raw[i];
      const fn = ref.filename || ref.name;
      const page = ref.page;
      const assetId = byFilename.get(fn) || null;
      totalRefs++;
      const resolution = assetId ? 'RESOLVED' : 'MISSING_SOURCE';
      if (assetId) resolvedRefs++; else missingRefs++;
      const note = assetId
        ? `physical_asset=${fn} sha256=${assetId.slice(0,12)} page=${page} (valid: see binary_validation_status)`
        : `filename=${fn} page=${page} not in asset_inventory; needs original PDF re-extraction`;
      await client.query(`
        INSERT INTO qb_recovery.image_staging
          (staging_id, ref_filename, ref_page, ref_sort, asset_id, resolution, resolution_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (staging_id, ref_filename) DO NOTHING
      `, [s.id, fn, page || null, i, assetId, resolution, note]);
    }
  }
  console.log(`[image_staging] total_refs=${totalRefs} resolved=${resolvedRefs} missing=${missingRefs}`);
  console.log(`[interpretation] physical_assets_usable=${physicalReady}, resolved_references=${resolvedRefs}, mean_assets_per_reference=${(resolvedRefs/Math.max(physicalReady,1)).toFixed(2)}`);

  // === conflict_registry updates: register MISSING_SOURCE for unresolved refs
  // (run-scoped; not accumulating)
  for (const s of stagings) {
    for (let i = 0; i < s.images_raw.length; i++) {
      const ref = s.images_raw[i];
      const fn = ref.filename || ref.name;
      if (!byFilename.has(fn)) {
        await client.query(`
          INSERT INTO qb_recovery.conflict_registry
            (run_label, conflict_kind, ref_table, ref_path, ref_id, detail)
          VALUES ($1,'MISSING_SOURCE','image_staging',$2,$3,$4)
          ON CONFLICT (run_label, conflict_kind, ref_table, ref_path, ref_id)
          DO NOTHING
        `, [runLabel, `database/question-bank/${s.subject}/${s.year}/${String(s.question_uid).split('_').pop()}`,
            fn, JSON.stringify({ staging_id: s.id, question_uid: s.question_uid, subject: s.subject, year: s.year, page: ref.page })]);
      }
    }
  }
  // Register KNOWN_MISSING_PAGE
  const knownMissing = [
    { subject: 'chinese', year: 2020, page: 1, qnum: '024' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '024' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '011' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '011' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '009' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '009' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '020' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '020' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '016' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '016' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '022' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '022' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '018' },
    { subject: 'chinese', year: 2020, page: 7, qnum: '018' },
    { subject: 'chinese', year: 2020, page: 1, qnum: '001' },
    { subject: 'chinese', year: 2024, page: 1, qnum: '001' },
  ];
  for (const m of knownMissing) {
    await client.query(`
      INSERT INTO qb_recovery.conflict_registry
        (run_label, conflict_kind, ref_table, ref_path, ref_id, detail)
      VALUES ($1,'KNOWN_MISSING_PAGE','image_staging',$2,$3,$4)
      ON CONFLICT DO NOTHING
    `, [runLabel, `database/question-bank/${m.subject}/${m.year}/${m.qnum}`,
        `page_${m.page}_img_1.png`, JSON.stringify({ subject: m.subject, year: m.year, page: m.page, qnum: m.qnum,
          expected_filename: `page_${m.page}_img_1.png`,
          reason: 'chinese 2020/2024 — known missing from prior research' })]);
  }
  // EMPTY_DIR for processed-images
  for (const sub of ['chemistry', 'physics', 'politics']) {
    await client.query(`
      INSERT INTO qb_recovery.conflict_registry
        (run_label, conflict_kind, ref_table, ref_path, ref_id, detail)
      VALUES ($1,'EMPTY_DIR','source_inventory',$2,$3,$4)
      ON CONFLICT DO NOTHING
    `, [runLabel, `database/question-bank/assets/processed-images/${sub}`, sub,
        JSON.stringify({ namespace: 'processed-images', subject: sub, reason: 'empty dir in tar' })]);
  }

  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await client.query('COMMIT');
} catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { client.release(); pool.end(); }
