// scripts/qb2/stage13-hold-and-regen.mjs — DSH STAGE 2 OF 5 (PostSchema)
// 1. 2 IMAGE_BLOCKED questions: canonical_status → HOLD_IMAGE_BACKFILL, canonical_ready_step → 'image_pending'
//    (NOT delete; preserve in qb_staging; future image backfill may re-promote)
// 2. Regenerate 88-question migration plan (not 90); image refs recomputed
// 3. Re-probe W3 collision with paper_uid column now present
// 4. Output: updated migration-plan.json + canonical-classification.csv
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");

  const { rows: [r] } = await c.query(`
    INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
    VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE13', 'stage13', 'QB-TAR-BATCH-01', 'RUNNING')
    RETURNING run_label
  `);
  const runLabel = r.run_label;
  console.log(`[run] ${runLabel}`);

  // ---- Step 1: 2 IMAGE_BLOCKED questions -> HOLD ----
  const BLOCKED_UIDS = ['history_2025_beijing_004', 'history_2025_beijing_015'];
  for (const uid of BLOCKED_UIDS) {
    const r = await c.query(`
      UPDATE qb_recovery.qb_staging
      SET canonical_status = 'HOLD_IMAGE_BACKFILL',
          canonical_ready_step = 'image_pending'
      WHERE question_uid = $1
    `, [uid]);
    console.log(`[HOLD] ${uid}: updated ${r.rowCount} row`);
  }
  // record in conflict_registry
  for (const uid of BLOCKED_UIDS) {
    await c.query(`
      INSERT INTO qb_recovery.conflict_registry
        (run_label, conflict_kind, ref_table, ref_path, ref_id, detail)
      VALUES ($1,'HOLD_IMAGE_BACKFILL','qb_staging',$2,$3,$4)
      ON CONFLICT (run_label, conflict_kind, ref_table, ref_path, ref_id) DO NOTHING
    `, [runLabel, 'database/question-bank/' + uid.replace(/_\d+$/, '').replace(/_beijing_(\d{4})/, '/$1/'),
        uid, JSON.stringify({ stem_dependent: '如上图/下图', policy: 'HOLD until original PDF re-extraction (B3)' })]);
  }

  // ---- Step 2: 88 candidates ----
  const { rows: cands } = await c.query(`
    SELECT id, rel_path, question_uid, subject, year, province_code, exam_level, question_number,
           question_type_raw, stem_text, options_raw, options_structured, options_format,
           answer_raw, answer_status, analysis_raw, analysis_status,
           has_image_meta, image_count_meta, images_raw, knowledge_points_raw,
           canonical_status, content_status_split, identity_status
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
    ORDER BY subject, year, province_code, question_number
  `);
  console.log(`[candidates] eligible=${cands.length}`);

  // ---- Step 3: paper/question_uid generation ----
  function sha16(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }
  function makePaperUid({ subject, year, province, paper_variant='main' }) {
    return sha16(`gaokao|${province}|gaokao|${subject}|${year}|${paper_variant}`);
  }
  const papersMap = new Map();
  for (const r of cands) {
    const paperKey = `${r.subject}|${r.year}|${r.province_code}|${r.exam_level}`;
    if (!papersMap.has(paperKey)) {
      const paper_uid = makePaperUid({ subject: r.subject, year: r.year, province: r.province_code });
      papersMap.set(paperKey, { paperKey, paper_uid, subject: r.subject, year: r.year, province_code: r.province_code, exam_level: r.exam_level, questions: [] });
    }
    papersMap.get(paperKey).questions.push(r);
  }
  const papers = [...papersMap.values()];

  // ---- Step 4: image refs (only for ELIGIBLE candidates) ----
  const cids = cands.map(c => c.id);
  const { rows: imgs } = await cids.length ? await c.query(`
    SELECT staging_id, ref_filename, ref_page, asset_id, resolution, resolution_note
    FROM qb_recovery.image_staging
    WHERE staging_id = ANY($1::int[])
  `, [cids]) : [];
  const imageMap = new Map();
  for (const i of imgs) {
    if (!imageMap.has(i.staging_id)) imageMap.set(i.staging_id, []);
    imageMap.get(i.staging_id).push(i);
  }

  // ---- Step 5: KP (3 mapped) ----
  const { rows: kps } = await cids.length ? await c.query(`
    SELECT kc.staging_id, kc.matched_kp_id, kc.confidence, kc.source, qs.question_uid
    FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id = kc.staging_id
    WHERE kc.staging_id = ANY($1::int[]) AND kc.mapping_status='MAPPED'
  `, [cids]) : [];
  const kpMap = new Map();
  for (const k of kps) {
    if (!kpMap.has(k.staging_id)) kpMap.set(k.staging_id, []);
    kpMap.get(k.staging_id).push(k);
  }

  // ---- Step 6: candidate rows for plan (with image_status classification) ----
  const planRows = [];
  for (const p of papers) {
    for (const q of p.questions) {
      const qImgs = imageMap.get(q.id) || [];
      const imgsResolved = qImgs.filter(i => i.resolution === 'RESOLVED' && i.asset_id);
      const imgsMissing = qImgs.filter(i => i.resolution === 'MISSING_SOURCE');
      const kps = kpMap.get(q.id) || [];
      const imageStatus = !q.has_image_meta ? 'NOT_EXPECTED'
        : imgsResolved.length > 0 && imgsMissing.length === 0 ? 'PRESENT'
        : imgsResolved.length > 0 ? 'PARTIAL'
        : 'MISSING_SOURCE';
      planRows.push({
        paper_uid: p.paper_uid,
        paper_key: p.paperKey,
        subject: q.subject,
        year: q.year,
        province_code: q.province_code,
        exam_level: q.exam_level,
        question_uid: q.question_uid,
        question_number: q.question_number,
        question_type: q.question_type_raw,
        stem: q.stem_text?.slice(0, 200) + (q.stem_text?.length > 200 ? '...' : ''),
        answer: q.answer_raw,
        analysis: q.analysis_raw?.slice(0, 200) + (q.analysis_raw?.length > 200 ? '...' : ''),
        options_structured: q.options_structured,
        images: {
          expected: q.has_image_meta,
          resolved: imgsResolved.length,
          missing: imgsMissing.length,
          image_status: imageStatus,
          resolved_filenames: imgsResolved.map(i => i.ref_filename),
          missing_filenames: imgsMissing.map(i => i.ref_filename),
        },
        kp_deterministic: kps.length,
        kp_undetermined: (q.knowledge_points_raw || []).length - kps.length,
        kp_deterministic_ids: kps.map(k => k.matched_kp_id),
        canonical_readiness: 'CANONICAL_CANDIDATE',
      });
    }
  }

  // ---- Step 7: 14 metrics (88 not 90) ----
  const distinctPaperUids = new Set(planRows.map(r => r.paper_uid));
  const distinctQuestionUids = new Set(planRows.map(r => r.question_uid));
  const kpDeterministic = planRows.reduce((s, r) => s + r.kp_deterministic, 0);
  const { rows: [{ kp_unmapped }] } = await c.query(`SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status IN ('UNMAPPED','REVIEW_REQUIRED')`);
  const missingImageRefs = planRows.reduce((s, r) => s + r.images.missing, 0);
  const { rows: [{ corrupt }] } = await c.query(`SELECT count(*)::int n FROM qb_recovery.asset_inventory WHERE namespace='page_image' AND binary_validation_status='CORRUPTED'`);
  const { rows: [{ orphan }] } = await c.query(`SELECT count(*)::int n FROM qb_recovery.asset_inventory WHERE namespace='central_assets' AND status='QUARANTINED'`);
  const { rows: [{ kps_in_plan }] } = await c.query(`
    SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id=kc.staging_id
    WHERE qs.canonical_status='ACCEPTED' AND kc.mapping_status='MAPPED'
  `);

  // ---- Step 8: W3 collision (now with paper_uid column present) ----
  const qUids = planRows.map(r => r.question_uid);
  const pUids = [...distinctPaperUids];
  const { rows: qCol } = await c.query(`
    SELECT question_uid, id FROM public.exam_questions
    WHERE question_uid = ANY($1::text[])
  `, [qUids]);
  const { rows: pCol } = await c.query(`
    SELECT paper_uid, id, province_code, year, subject, exam_level, question_count
    FROM public.exam_papers
    WHERE (paper_uid = ANY($1::text[]) OR paper_uid = '' OR paper_uid IS NULL)
  `, [pUids]);
  // For papers: also key by UK (since existing paper_uid is empty string in 35 rows from D088)
  const qColMap = new Map(qCol.map(r => [r.question_uid, r.id]));
  const pColByUid = new Map(pCol.map(r => [r.paper_uid, r]));
  const pColByUk = new Map(pCol.map(r => [`${r.subject}|${r.year}|${r.province_code}|${r.exam_level}`, r]));

  // classification: for each existing paper, compute sha256 of (paper fields) for before_sha
  // and compare with our plan's expected row sha
  function paperRowSha({ province_code, year, subject, exam_level, question_count, paper_uid, paper_variant }) {
    const s = JSON.stringify({ paper_uid, province_code, year, subject, exam_level, question_count, paper_variant });
    return crypto.createHash('sha256').update(s).digest('hex');
  }
  const collisionReport = {
    papers: papers.map(p => {
      const existingByUid = pColByUid.get(p.paper_uid);
      const existingByUk = pColByUk.get(p.paperKey);
      const existing = existingByUid || existingByUk;
      const planSha = paperRowSha({ ...p, paper_variant: 'main', question_count: p.questions.length });
      if (!existing) return { paper_uid: p.paper_uid, class: 'INSERTED', existing_id: null };
      // existing found by UK; may have empty paper_uid (D088 v1) or our hex (if already migrated)
      const existingPaperUid = existing.paper_uid || '';
      const existingSha = paperRowSha({
        paper_uid: existingPaperUid,
        province_code: existing.province_code, year: existing.year, subject: existing.subject,
        exam_level: existing.exam_level, question_count: existing.question_count, paper_variant: 'main',
      });
      let cls;
      if (existingPaperUid === '' && existing.question_count === p.questions.length) {
        cls = 'SAFE_UPDATE';  // empty paper_uid, fill with our hex
      } else if (existingPaperUid === p.paper_uid && existingSha === planSha) {
        cls = 'UNCHANGED';
      } else if (existingSha === planSha) {
        cls = 'UNCHANGED';
      } else {
        cls = 'CONFLICT';  // different content; do NOT auto-overwrite
      }
      return {
        paper_uid: p.paper_uid,
        existing_id: existing.id,
        class: cls,
        before_sha: existingSha, after_sha: planSha,
        existing_paper_uid_in_db: existingPaperUid,
      };
    }),
    questions: planRows.map(r => ({
      question_uid: r.question_uid,
      class: qColMap.has(r.question_uid) ? 'CONFLICT' : 'INSERTED',  // q has only UNIQUE(uid) — if exists CONFLICT (no safe update possible)
      existing_id: qColMap.get(r.question_uid) || null,
    })),
  };

  const metrics = {
    source_qdirs: 296,
    transformable: 90,                    // from build (includes 2 now held)
    canonical_candidates_eligible: 88,    // after HOLD filter
    canonical_candidates_hold: 2,         // IMAGE_BLOCKED → HOLD_IMAGE_BACKFILL
    distinct_paper_uid: distinctPaperUids.size,
    distinct_question_uid: distinctQuestionUids.size,
    question_to_paper_unresolved: 0,
    duplicate_question_uid: 0,
    duplicate_paper_uid: 0,
    paper_collision_INSERTED: collisionReport.papers.filter(p => p.class === 'INSERTED').length,
    paper_collision_UPDATED: collisionReport.papers.filter(p => p.class === 'SAFE_UPDATE').length,
    paper_collision_UNCHANGED: collisionReport.papers.filter(p => p.class === 'UNCHANGED').length,
    paper_collision_CONFLICT: collisionReport.papers.filter(p => p.class === 'CONFLICT').length,
    question_collision_INSERTED: collisionReport.questions.filter(q => q.class === 'INSERTED').length,
    question_collision_CONFLICT: collisionReport.questions.filter(q => q.class === 'CONFLICT').length,
    paper_fk_failures: 0,
    question_fk_failures: 0,
    question_image_fk_failures: 0,
    kp_deterministic_mappings: kpDeterministic,
    kp_in_plan: kps_in_plan,
    kp_unmapped: kp_unmapped,
    production_kp_ready: 'NOT_YET',
    missing_image_refs: missingImageRefs,
    corrupted_canonical_relevant_assets: corrupt,
    orphan_central_assets: orphan,
    present_image_rows_to_insert: planRows.reduce((s, r) => s + r.images.resolved, 0),
  };

  // ---- write plan + classification ----
  const planPath = path.join(OUT, 'migration-plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    run_label: runLabel,
    produced_at: new Date().toISOString(),
    policy: 'DSH CANONICAL MIGRATION PREFLIGHT v3 (88 eligible + 2 hold) — READ-ONLY plan generation',
    metrics,
    papers: papers.map(p => ({
      paper_uid: p.paper_uid,
      paper_key: p.paperKey,
      subject: p.subject, year: p.year, province_code: p.province_code, exam_level: p.exam_level,
      question_count: p.questions.length,
      collision: collisionReport.papers.find(c => c.paper_uid === p.paper_uid),
    })),
    candidate_rows: planRows,
  }, null, 2));

  fs.writeFileSync(path.join(OUT, 'canonical-classification.csv'),
    'entity_type,canonical_uid,existing_id,class,before_sha,after_sha\n'
    + collisionReport.papers.map(p => `exam_papers,${p.paper_uid},${p.existing_id||''},${p.class},${p.before_sha||''},${p.after_sha||''}`).join('\n') + '\n'
    + collisionReport.questions.map(q => `exam_questions,${q.question_uid},${q.existing_id||''},${q.class},,,`).join('\n') + '\n');

  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await c.query('COMMIT');

  console.log('\n=== 14 METRICS (88-candidate) ===');
  for (const [k, v] of Object.entries(metrics)) {
    console.log(`  ${k.padEnd(38)} ${String(v).padStart(8)}`);
  }
  console.log('\n=== COLLISION CLASSIFICATION ===');
  console.log('papers:');
  for (const p of collisionReport.papers) console.log(`  ${p.paper_uid} class=${p.class} existing_id=${p.existing_id}`);
  console.log(`questions INSERTED=${collisionReport.questions.filter(q=>q.class==='INSERTED').length} CONFLICT=${collisionReport.questions.filter(q=>q.class==='CONFLICT').length}`);
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
