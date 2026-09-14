// scripts/qb2/stage7-reconciliation.mjs — DSH STAGING ONLY (REPAIR v2)
// P1-A: rename accepted_count -> transformable_count, rejected -> transform_blocked_count
// P1-A: explicit canonical_readiness chain
// P1-C: separate physical_asset_count vs resolved_reference_count
// P1-D: KP lineage metric
// Equation: input = transformable + transform_blocked + review_required + duplicate
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");

  const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE7';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage7', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;

  const input = parseInt((await client.query('SELECT count(*)::bigint n FROM qb_recovery.qb_staging')).rows[0].n, 10);
  const transformable = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_status='ACCEPTED'`)).rows[0].n, 10);
  const transform_blocked = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_status='REJECTED'`)).rows[0].n, 10);
  const review_required = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_status='REVIEW_REQUIRED'`)).rows[0].n, 10);
  const duplicate = parseInt((await client.query(`SELECT count(*)::bigint n FROM (SELECT rel_path FROM qb_recovery.qb_staging GROUP BY rel_path HAVING count(*)>1) x`)).rows[0].n, 10);

  const identity_est = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE identity_status='ESTABLISHED'`)).rows[0].n, 10);
  const identity_amb = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE identity_status='AMBIGUOUS'`)).rows[0].n, 10);
  const identity_unk = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE identity_status='UNKNOWN'`)).rows[0].n, 10);
  const content_complete = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE content_status_split='COMPLETE'`)).rows[0].n, 10);
  const content_incomplete = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE content_status_split='INCOMPLETE'`)).rows[0].n, 10);
  const content_undefined = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE content_status_split='UNDEFINED'`)).rows[0].n, 10);
  const content_corrupted = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE content_status_split='CORRUPTED'`)).rows[0].n, 10);

  const step_rejected = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_ready_step IS NULL`)).rows[0].n, 10);
  const step_schema = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_ready_step='schema_valid'`)).rows[0].n, 10);
  const step_content = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_ready_step='content_complete'`)).rows[0].n, 10);
  const step_provenance = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_ready_step='provenance_valid'`)).rows[0].n, 10);
  const step_ready = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE canonical_ready_step='canonical_ready'`)).rows[0].n, 10);

  const physical_assets_total = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.asset_inventory WHERE namespace='page_image' AND status='READY'`)).rows[0].n, 10);
  const physical_assets_struct_valid = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.asset_inventory WHERE namespace='page_image' AND status='READY' AND binary_validation_status='VALID'`)).rows[0].n, 10);
  const resolved_references = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.image_staging WHERE resolution='RESOLVED'`)).rows[0].n, 10);
  const unresolved_references = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.image_staging WHERE resolution='MISSING_SOURCE'`)).rows[0].n, 10);
  const total_image_refs = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.image_staging`)).rows[0].n, 10);
  const assets_quarantined = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.asset_inventory WHERE status='QUARANTINED'`)).rows[0].n, 10);
  const assets_corrupted = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.asset_inventory WHERE binary_validation_status='CORRUPTED'`)).rows[0].n, 10);
  const assets_valid = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.asset_inventory WHERE binary_validation_status='VALID'`)).rows[0].n, 10);

  const kp_source_q = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.qb_staging WHERE knowledge_points_raw IS NOT NULL AND jsonb_array_length(knowledge_points_raw)>0`)).rows[0].n, 10);
  const kp_total_cand = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.kp_staging_candidate`)).rows[0].n, 10);
  const kp_mapped = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='MAPPED'`)).rows[0].n, 10);
  const kp_unmapped = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='UNMAPPED'`)).rows[0].n, 10);
  const kp_review = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='REVIEW_REQUIRED'`)).rows[0].n, 10);

  const conflict_total = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.conflict_registry WHERE run_label=$1`, [runLabel])).rows[0].n, 10);
  const conflict_missing = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.conflict_registry WHERE run_label=$1 AND conflict_kind IN ('MISSING_SOURCE','KNOWN_MISSING_PAGE')`, [runLabel])).rows[0].n, 10);
  const conflict_corrupted = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.conflict_registry WHERE run_label=$1 AND conflict_kind='BINARY_CORRUPTED'`, [runLabel])).rows[0].n, 10);
  const conflict_empty = parseInt((await client.query(`SELECT count(*)::bigint n FROM qb_recovery.conflict_registry WHERE run_label=$1 AND conflict_kind='EMPTY_DIR'`, [runLabel])).rows[0].n, 10);

  const metrics = [
    ['input_count', input, '296 qdirs in tar (chinese 161 + history 135)'],
    ['transformable_count', transformable, 'canonical_status=ACCEPTED'],
    ['transform_blocked_count', transform_blocked, 'canonical_status=REJECTED (content UNDEFINED/CORRUPTED)'],
    ['review_required_count', review_required, 'canonical_status=REVIEW_REQUIRED'],
    ['duplicate_count', duplicate, 'distinct (rel_path) groups with >1 rows'],
    ['identity_established', identity_est, 'D063 Rule A uid parses + matches subject/year'],
    ['identity_ambiguous', identity_amb, 'uid parseable but conflicts with filename meta'],
    ['identity_unknown', identity_unk, 'no parseable uid'],
    ['content_complete', content_complete, 'stem + answer + analysis all non-empty/non-placeholder'],
    ['content_incomplete', content_incomplete, 'some field missing/placeholder but recoverable'],
    ['content_undefined', content_undefined, 'stem == undefined'],
    ['content_corrupted', content_corrupted, 'mojibake / latex-stripped / option-fragment'],
    ['ready_step_rejected', step_rejected, 'canonical_ready_step IS NULL'],
    ['ready_step_schema_valid', step_schema, 'options_structured failed'],
    ['ready_step_content_complete', step_content, 'content not COMPLETE'],
    ['ready_step_provenance_valid', step_provenance, 'content COMPLETE, content_matches_repo=false'],
    ['ready_step_canonical_candidate', step_ready, 'all 5 readiness checks passed'],
    ['physical_assets_total', physical_assets_total, 'page_image namespace, status=READY'],
    ['physical_assets_structurally_valid', physical_assets_struct_valid, '+ binary_validation_status=VALID'],
    ['resolved_reference_count', resolved_references, 'image_staging.resolution=RESOLVED'],
    ['unresolved_reference_count', unresolved_references, 'image_staging.resolution=MISSING_SOURCE'],
    ['total_image_references', total_image_refs, 'image_staging total'],
    ['asset_count_quarantined', assets_quarantined, 'central_assets namespace'],
    ['asset_count_corrupted', assets_corrupted, 'binary_validation_status=CORRUPTED'],
    ['asset_count_valid', assets_valid, 'binary_validation_status=VALID'],
    ['kp_source_questions_with_kp', kp_source_q, 'distinct qdirs with non-empty knowledge_points_raw'],
    ['kp_total_candidates', kp_total_cand, 'kp_staging_candidate total (expanded)'],
    ['kp_mapped', kp_mapped, 'mapping_status=MAPPED'],
    ['kp_unmapped', kp_unmapped, 'mapping_status=UNMAPPED'],
    ['kp_review_required', kp_review, 'mapping_status=REVIEW_REQUIRED'],
    ['conflict_count_current_run', conflict_total, 'conflict_registry rows tagged with run_label'],
    ['conflict_missing_source', conflict_missing, 'MISSING_SOURCE + KNOWN_MISSING_PAGE'],
    ['conflict_binary_corrupted', conflict_corrupted, 'BINARY_CORRUPTED (was TRUNCATION_SUSPECT pre-P1-B)'],
    ['conflict_empty_dir', conflict_empty, 'EMPTY_DIR (3 processed-images subdirs)'],
  ];

  await client.query('TRUNCATE qb_recovery.dry_run_reconciliation');
  for (const [m, v, n] of metrics) {
    await client.query('INSERT INTO qb_recovery.dry_run_reconciliation (run_label, metric, value, note) VALUES ($1,$2,$3,$4)',
      [runLabel, m, v, n]);
  }

  const meanRefsPerAsset = physical_assets_struct_valid > 0 ? (resolved_references / physical_assets_struct_valid).toFixed(2) : '0';
  const expandRatio = kp_source_q > 0 ? (kp_total_cand / kp_source_q).toFixed(2) : '0';

  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await client.query('COMMIT');

  console.log('=== DRY-RUN RECONCILIATION ===');
  for (const [m, v, n] of metrics) {
    console.log(`  ${m.padEnd(36)} ${String(v).padStart(6)}  | ${n}`);
  }
  console.log('\n=== DERIVED ===');
  console.log(`  resolved_references per physical_asset (struct valid): ${meanRefsPerAsset}`);
  console.log(`  candidates per source_question:                          ${expandRatio}`);
  console.log('\n=== EQUATION CHECK ===');
  console.log(`  input (${input}) = transformable (${transformable}) + transform_blocked (${transform_blocked}) + review_required (${review_required}) + duplicate (${duplicate})?  ${input === (transformable + transform_blocked + review_required + duplicate)}`);
  console.log(`  input (${input}) = transformable (${transformable}) + transform_blocked (${transform_blocked}) + duplicate (${duplicate})?  ${input === (transformable + transform_blocked + duplicate)}`);
} catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { client.release(); pool.end(); }
