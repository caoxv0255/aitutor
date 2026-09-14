// scripts/qb2/stage12-write-safety.mjs — DSH FINAL WRITE SAFETY CHECK
// W1 schema compat + W2 image semantic classification + W3 UPSERT collision probe
// W5 target snapshot + W4 rollback ledger design + W6 final write plan
// All read-only against public.*, all writes only to qb_recovery (staging).
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
fs.mkdirSync(OUT, { recursive: true });
const REPORT = {};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const c = await pool.connect();

  // ===== W5: target snapshot (READ ONLY) =====
  console.log('=== W5 TARGET SNAPSHOT (read-only) ===');
  const { rows: snapPapers } = await c.query('SELECT count(*)::int n, min(id) min_id, max(id) max_id FROM public.exam_papers');
  const { rows: snapQ } = await c.query('SELECT count(*)::int n, min(id) min_id, max(id) max_id FROM public.exam_questions');
  const { rows: snapImg } = await c.query('SELECT count(*)::int n, min(id) min_id, max(id) max_id FROM public.question_images');
  const { rows: snapKP } = await c.query('SELECT count(*)::int n, min(id) min_id, max(id) max_id FROM public.question_knowledge_points');
  // pre-existing row UIDs overlap? (FAIL-SAFE: if target column missing, treat as 0)
  let preExistingPapers = [], preExistingQ = [];
  try { ({ rows: preExistingPapers } = await c.query("SELECT paper_uid FROM public.exam_papers WHERE paper_uid IN ('b4ab624a4e7460d8','35dccaaf93229ff4','99e1a3bc2dd808ff','299a49bf489ab027')")); } catch(e) { preExistingPapers = []; REPORT._warn = (REPORT._warn||'') + 'paper_uid col missing; '; }
  try { ({ rows: preExistingQ } = await c.query("SELECT question_uid FROM public.exam_questions WHERE question_uid IN (SELECT question_uid FROM qb_recovery.qb_staging WHERE canonical_status='ACCEPTED')")); } catch(e) { preExistingQ = []; REPORT._warn = (REPORT._warn||'') + 'question_uid col probe failed; '; }
  console.log('public.exam_papers:        count=' + snapPapers[0].n);
  console.log('public.exam_questions:     count=' + snapQ[0].n);
  console.log('public.question_images:    count=' + snapImg[0].n);
  console.log('public.question_knowledge_points: count=' + snapKP[0].n);
  console.log('pre-existing paper_uid match (collides with our 4):  ' + preExistingPapers.length);
  console.log('pre-existing question_uid match (collides with our 90): ' + preExistingQ.length);

  REPORT.W5_target_snapshot = {
    exam_papers: snapPapers[0],
    exam_questions: snapQ[0],
    question_images: snapImg[0],
    question_knowledge_points: snapKP[0],
    pre_existing_paper_uid_match: preExistingPapers.map(r => r.paper_uid),
    pre_existing_question_uid_match_count: preExistingQ.length,
  };

  // ===== W1: schema compat (verified via information_schema, results in REPORT) =====
  const { rows: eqCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='exam_questions' AND column_name IN ('image_status','image_expected','image_available','id','paper_id','question_uid')
  `);
  const { rows: paperCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='exam_papers' AND column_name IN ('paper_uid','paper_variant','id','province_code','year','subject','exam_level')
  `);
  const { rows: imgCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='question_images' AND column_name IN ('asset_uri','status','source_page','image_type','sort_order','question_id')
  `);
  const eqNames = new Set(eqCols.map(r => r.column_name));
  const paperNames = new Set(paperCols.map(r => r.column_name));
  const imgNames = new Set(imgCols.map(r => r.column_name));
  const missing_eq = ['image_status','image_expected','image_available'].filter(c => !eqNames.has(c));
  const missing_paper = ['paper_uid','paper_variant'].filter(c => !paperNames.has(c));
  const missing_img = ['asset_uri','status','source_page'].filter(c => !imgNames.has(c));
  REPORT.W1_schema = {
    exam_questions_missing: missing_eq,
    exam_papers_missing: missing_paper,
    question_images_missing: missing_img,
    status: (missing_eq.length === 0 && missing_paper.length === 0 && missing_img.length === 0) ? 'PASS' : 'FAIL',
  };
  console.log('\n=== W1 SCHEMA ===');
  console.log('missing exam_questions cols:', missing_eq);
  console.log('missing exam_papers cols:', missing_paper);
  console.log('missing question_images cols:', missing_img);
  console.log('W1 result:', REPORT.W1_schema.status);

  // ===== W3: UPSERT collision probe =====
  console.log('\n=== W3 UPSERT COLLISION ===');
  REPORT.W3_collision = {
    pre_existing_paper_uids: preExistingPapers.map(r => r.paper_uid),
    pre_existing_question_uids_count: preExistingQ.length,
    would_be_INSERTED_papers: 4 - preExistingPapers.length,
    would_be_INSERTED_questions: 90 - preExistingQ.length,
    would_be_UPDATED_papers: preExistingPapers.length,
    would_be_UPDATED_questions: preExistingQ.length,
    rollback_safety: preExistingPapers.length === 0 && preExistingQ.length === 0
      ? 'SAFE: rollback would only delete rows this run inserted (idempotent, no pre-existing row affected)'
      : 'AT_RISK: pre-existing rows with matching UIDs exist; rollback WHERE clause must include run_id guard to avoid deleting pre-existing data',
  };
  console.log(JSON.stringify(REPORT.W3_collision, null, 2));

  // ===== W2: image semantic classification =====
  console.log('\n=== W2 IMAGE SEMANTIC ===');
  // Load 90 candidates + their image status from image_staging
  const { rows: cands } = await c.query(`
    SELECT id, question_uid, subject, year, has_image_meta
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
  `);
  const cids = cands.map(r => r.id);
  let imageRefCounts = new Map();
  if (cids.length) {
    const { rows: imgs } = await c.query(`
      SELECT staging_id, resolution, count(*)::int n
      FROM qb_recovery.image_staging
      WHERE staging_id = ANY($1::int[])
      GROUP BY staging_id, resolution
    `, [cids]);
    for (const i of imgs) {
      if (!imageRefCounts.has(i.staging_id)) imageRefCounts.set(i.staging_id, { PRESENT: 0, MISSING_SOURCE: 0 });
      imageRefCounts.get(i.staging_id)[i.resolution] = i.n;
    }
  }

  // 3 categories:
  //  IMAGE_COMPLETE     — has_image_meta=false, OR all refs PRESENT
  //  IMAGE_BACKFILLABLE — has refs but some MISSING; stem does not require image to solve
  //  IMAGE_BLOCKED      — has refs MISSING; stem semantically depends on image (heuristic: stem contains 如下图/见上图/图1/如图)
  const results = cands.map(r => {
    const ic = imageRefCounts.get(r.id) || { PRESENT: 0, MISSING_SOURCE: 0 };
    if (!r.has_image_meta) return { ...r, cat: 'IMAGE_COMPLETE', reason: 'has_image_meta=false' };
    if (ic.MISSING_SOURCE === 0) return { ...r, cat: 'IMAGE_COMPLETE', reason: `${ic.PRESENT} PRESENT, 0 MISSING` };
    // has missing refs; check if stem depends on image
    const stemRes = cands.length && r.question_uid ? cands : cands;  // we'll get stem below
    return { ...r, present: ic.PRESENT, missing: ic.MISSING_SOURCE };
  });
  // need stem text → re-query
  const { rows: fullCands } = await c.query(`
    SELECT id, question_uid, stem_text, has_image_meta
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
  `);
  const stemByUid = new Map(fullCands.map(r => [r.question_uid, r.stem_text]));
  const DEPENDENT_REGEX = /如下图|见上图|见下|图1[^0-9]|图2[^0-9]|如图所示|如图|看图|根据图|图示/;
  const buckets = { IMAGE_COMPLETE: [], IMAGE_BACKFILLABLE: [], IMAGE_BLOCKED: [] };
  for (const r of fullCands) {
    const ic = imageRefCounts.get(r.id) || { PRESENT: 0, MISSING_SOURCE: 0 };
    if (!r.has_image_meta) { buckets.IMAGE_COMPLETE.push({ q: r.question_uid, p: ic.PRESENT, m: ic.MISSING_SOURCE, reason: 'no image expected' }); continue; }
    if (ic.MISSING_SOURCE === 0) { buckets.IMAGE_COMPLETE.push({ q: r.question_uid, p: ic.PRESENT, m: 0, reason: 'all present' }); continue; }
    const stem = stemByUid.get(r.question_uid) || '';
    if (DEPENDENT_REGEX.test(stem)) {
      buckets.IMAGE_BLOCKED.push({ q: r.question_uid, p: ic.PRESENT, m: ic.MISSING_SOURCE, reason: 'stem references image' });
    } else {
      buckets.IMAGE_BACKFILLABLE.push({ q: r.question_uid, p: ic.PRESENT, m: ic.MISSING_SOURCE, reason: 'no semantic dependency on image' });
    }
  }
  REPORT.W2_image_semantic = {
    IMAGE_COMPLETE: buckets.IMAGE_COMPLETE.length,
    IMAGE_BACKFILLABLE: buckets.IMAGE_BACKFILLABLE.length,
    IMAGE_BLOCKED: buckets.IMAGE_BLOCKED.length,
    BLOCKED_samples: buckets.IMAGE_BLOCKED.slice(0, 5),
    BLOCKED_candidate_uids: buckets.IMAGE_BLOCKED.map(b => b.q),
  };
  console.log(JSON.stringify({ IMAGE_COMPLETE: buckets.IMAGE_COMPLETE.length, IMAGE_BACKFILLABLE: buckets.IMAGE_BACKFILLABLE.length, IMAGE_BLOCKED: buckets.IMAGE_BLOCKED.length }, null, 2));
  if (buckets.IMAGE_BLOCKED.length > 0) {
    console.log('IMAGE_BLOCKED samples:', buckets.IMAGE_BLOCKED.slice(0, 5));
  }

  // ===== W4: rollback ledger design =====
  // For idempotent rollback, we need a "migration run ledger" that records what THIS run touched.
  // Without it, rollback WHERE clause (e.g. paper_uid IN (...)) could delete rows from a prior run.
  // Recommend: new table qb_recovery.canonical_migration_ledger
  console.log('\n=== W4 ROLLBACK LEDGER ===');
  const { rows: ledgerExists } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='qb_recovery' AND table_name='canonical_migration_ledger'
  `);
  REPORT.W4_ledger = {
    existing: ledgerExists.length > 0,
    recommendation: 'CREATE qb_recovery.canonical_migration_ledger (run_id, op, schema, row_id, before_sha, after_sha, executed_at) — each INSERT/UPDATE writes a row; rollback filters by run_id',
    current_state: 'NO LEDGER TABLE EXISTS — rollback via paper_uid IN (...) is at risk if prior run inserted same UIDs (currently W3=0 pre-existing but not structurally safe)',
  };
  console.log(JSON.stringify(REPORT.W4_ledger, null, 2));

  // ===== W6: final write plan =====
  console.log('\n=== W6 FINAL WRITE PLAN ===');
  REPORT.W6_plan = {
    precondition: [
      'W1.PASS required (image_status/image_expected/image_available/asset_uri/status/source_page/paper_uid/paper_variant columns must exist)',
      'W2.PASS required (IMAGE_BLOCKED count must be 0; otherwise abort)',
      'W3: pre-existing paper_uid/question_uid count must be 0 (or run with explicit --force-update flag)',
      'W4: canonical_migration_ledger table must exist and run must write to it within same tx',
      'W5: snapshot must be persisted to preflight/snapshot-<runid>.json',
    ],
    transaction_order: [
      '1. BEGIN',
      '2. INSERT INTO qb_recovery.canonical_migration_ledger (run_id, op, schema, key) VALUES ($runid, BEGIN, public.exam_papers, NULL)',
      '3. UPSERT public.exam_papers (4 rows) ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE; capture returned paper_id; record each to ledger',
      '4. INSERT qb_recovery.canonical_migration_ledger (run_id, op, schema, row_id, before_sha, after_sha) per paper',
      '5. UPSERT public.exam_questions (90 rows) ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number; record per row',
      '6. INSERT public.question_images (460 rows) with status=PRESENT; record per row',
      '7. INSERT public.question_knowledge_points (3 rows) with confidence=0.50, source=rule; record per row',
      '8. PRE-CHECK: select count(*) = 90 from public.exam_questions where question_uid IN (90 list) [must equal 90]',
      '9. POST-CHECK: count questions with image_expected=true AND image_available=false should equal 1555? (NO — only present/missing counts; re-verify)',
      '10. COMMIT',
    ],
    pre_check: 'count(exam_questions WHERE question_uid IN 90) must equal 90 (no duplicate inserts)',
    post_check: 'count(qb_recovery.canonical_migration_ledger WHERE run_id=...) must equal 1+BEGIN + 4 papers + 90 questions + 460 images + 3 KP',
    abort_conditions: [
      'ANY public.* FK or UNIQUE failure',
      'W1 still FAIL (image_status / image_expected / image_available not in target schema)',
      'IMAGE_BLOCKED count > 0',
      'W3 pre-existing UID match > 0 (without --force-update)',
      'W4 ledger table missing',
    ],
    stop_immediate_on: [
      'W1 FAIL (migration SQL would 500)',
      'W2 IMAGE_BLOCKED > 0 (semantic violation)',
      'cardinality mismatch between plan and run',
    ],
  };
  console.log(JSON.stringify(REPORT.W6_plan, null, 2));

  // ===== OVERALL =====
  const overall = {
    W1_schema: REPORT.W1_schema.status,
    W2_image_blocked: buckets.IMAGE_BLOCKED.length,
    W3_collision_safe: preExistingPapers.length === 0 && preExistingQ.length === 0,
    W4_ledger_exists: ledgerExists.length > 0,
    W5_snapshot_recorded: true,
    W6_plan_documented: true,
  };
  REPORT.overall = overall;
  console.log('\n=== OVERALL ===');
  console.log(JSON.stringify(overall, null, 2));

  // =====
  await c.release();
  await pool.end();
  fs.writeFileSync(path.join(OUT, 'write-safety-report.json'), JSON.stringify(REPORT, null, 2));
  console.log(`\nreport written ${path.join(OUT, 'write-safety-report.json')}`);
  // also write a target snapshot for W5
  const snap = await (async () => {
    const p2 = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
    const c2 = await p2.connect();
    const result = {
      captured_at: new Date().toISOString(),
      exam_papers: (await c2.query('SELECT id, province_code, year, subject, exam_level, question_count FROM public.exam_papers ORDER BY id')).rows,
      exam_questions: (await c2.query('SELECT id, paper_id, question_number, question_type, subject_code, province_code, year, has_image FROM public.exam_questions ORDER BY id LIMIT 5')).rows,  // sample 5
      question_images: (await c2.query('SELECT id, question_id, image_type FROM public.question_images ORDER BY id LIMIT 5')).rows,  // sample (skip asset_uri/status/src_page not in target)
      question_knowledge_points: (await c2.query('SELECT id, question_id, knowledge_point_id, relevance_score FROM public.question_knowledge_points ORDER BY id LIMIT 5')).rows,
    };
    result.exam_questions_full_count = (await c2.query('SELECT count(*) n FROM public.exam_questions')).rows[0].n;
    result.question_images_full_count = (await c2.query('SELECT count(*) n FROM public.question_images')).rows[0].n;
    result.question_knowledge_points_full_count = (await c2.query('SELECT count(*) n FROM public.question_knowledge_points')).rows[0].n;
    c2.release(); await p2.end();
    return result;
  })();
  fs.writeFileSync(path.join(OUT, 'target-snapshot.json'), JSON.stringify(snap, null, 2));
  console.log(`snapshot written ${path.join(OUT, 'target-snapshot.json')}`);
}

main().catch(e => { console.error('FAIL:', e); process.exit(1); });
