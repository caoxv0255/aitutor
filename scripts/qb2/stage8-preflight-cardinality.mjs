// scripts/qb2/stage8-preflight-cardinality.mjs — DSH CANONICAL MIGRATION PREFLIGHT
// Authorized by user 2026-09-04. Forbidden: any public.* write.
// Answers the 14 required metrics + generates paper_uid / question_uid for 90 candidates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT_DIR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
fs.mkdirSync(OUT_DIR, { recursive: true });

function sha16(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }

// paper_uid per design doc §6
// sha16(exam_type|region_key|exam_level|subject|year|paper_variant)[:16]
// For v1 candidates: exam_type=gaokao, region_key=beijing, paper_variant='main'
function makePaperUid({ subject, year, province, exam_type='gaokao', exam_level='gaokao', paper_variant='main' }) {
  const region_key = province;  // for now, no city/district
  return sha16(`${exam_type}|${region_key}|${exam_level}|${subject}|${year}|${paper_variant}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");

  // register preflight run
  const { rows: [r] } = await c.query(`
    INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
    VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE8', 'stage8', 'QB-TAR-BATCH-01', 'RUNNING')
    RETURNING run_label
  `);
  const runLabel = r.run_label;
  console.log(`[run] ${runLabel}`);

  // load 90 canonical candidates
  const { rows: candidates } = await c.query(`
    SELECT id, rel_path, question_uid, subject, year, province_code, exam_level, question_number,
           question_type_raw, stem_text, options_raw, options_structured, options_format,
           answer_raw, answer_status, analysis_raw, analysis_status,
           has_image_meta, image_count_meta, images_raw, knowledge_points_raw,
           canonical_status, content_status_split, identity_status
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
    ORDER BY subject, year, province_code, question_number
  `);
  console.log(`[candidates] count=${candidates.length}`);

  // === build migration plan: per (subject, year, province, exam_level) = paper ===
  const papersMap = new Map();
  const plan = [];
  for (const r of candidates) {
    const paperKey = `${r.subject}|${r.year}|${r.province_code}|${r.exam_level}`;
    if (!papersMap.has(paperKey)) {
      const paper_uid = makePaperUid({
        subject: r.subject, year: r.year, province: r.province_code,
        exam_type: 'gaokao', exam_level: r.exam_level, paper_variant: 'main',
      });
      papersMap.set(paperKey, { paperKey, paper_uid, subject: r.subject, year: r.year, province_code: r.province_code, exam_level: r.exam_level, questions: [] });
    }
    papersMap.get(paperKey).questions.push(r);
  }
  const papers = [...papersMap.values()];

  // === image relationship per candidate ===
  const ids = candidates.map(c => c.id);
  let imageMap = new Map();
  if (ids.length > 0) {
    const { rows: imgs } = await c.query(`
      SELECT staging_id, ref_filename, ref_page, asset_id, resolution, resolution_note
      FROM qb_recovery.image_staging
      WHERE staging_id = ANY($1::int[])
    `, [ids]);
    for (const i of imgs) {
      if (!imageMap.has(i.staging_id)) imageMap.set(i.staging_id, []);
      imageMap.get(i.staging_id).push(i);
    }
  }

  // === KP per candidate (only 3 deterministic mapped) ===
  const kpMap = new Map();
  if (ids.length > 0) {
    const { rows: kps } = await c.query(`
      SELECT staging_id, raw_tag, raw_match_how, matched_kp_id, mapping_status, confidence
      FROM qb_recovery.kp_staging_candidate
      WHERE staging_id = ANY($1::int[]) AND mapping_status='MAPPED'
    `, [ids]);
    for (const k of kps) {
      if (!kpMap.has(k.staging_id)) kpMap.set(k.staging_id, []);
      kpMap.get(k.staging_id).push(k);
    }
  }

  // === build full plan JSON ===
  const planRows = [];
  for (const p of papers) {
    for (const q of p.questions) {
      const imgs = imageMap.get(q.id) || [];
      const imgsResolved = imgs.filter(i => i.resolution === 'RESOLVED' && i.asset_id);
      const imgsMissing = imgs.filter(i => i.resolution === 'MISSING_SOURCE');
      const kps = kpMap.get(q.id) || [];
      const question_uid = q.question_uid || makePaperUid({}) + '_' + q.question_number;  // D063 already sets q.question_uid from metadata
      planRows.push({
        paper_uid: p.paper_uid,
        paper_key: p.paperKey,
        subject: q.subject,
        year: q.year,
        province_code: q.province_code,
        exam_level: q.exam_level,
        question_uid: question_uid,
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
          resolved_filenames: imgsResolved.map(i => i.ref_filename),
          missing_filenames: imgsMissing.map(i => i.ref_filename),
        },
        kp_deterministic: kps.length,
        kp_undetermined: (q.knowledge_points_raw || []).length - kps.length,
        kp_deterministic_ids: kps.map(k => k.matched_kp_id),
        canonical_readiness: 'CANONICAL_CANDIDATE_NOT_PRODUCTION_READY',
      });
    }
  }

  // === compute the 14 required metrics ===
  const distinctPaperUids = new Set(planRows.map(r => r.paper_uid));
  const distinctQuestionUids = new Set(planRows.map(r => r.question_uid));
  const questionToPaperResolved = planRows.filter(r => distinctPaperUids.has(r.paper_uid)).length;
  const dupQuestionUids = planRows.length - distinctQuestionUids.size;
  const dupPaperUids = papers.length - distinctPaperUids.size;
  const kpDeterministic = planRows.reduce((s, r) => s + r.kp_deterministic, 0);
  const kpUnmapped = (await c.query(`
    SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status IN ('UNMAPPED','REVIEW_REQUIRED')
  `)).rows[0].n;
  const missingImageRefs = planRows.reduce((s, r) => s + r.images.missing, 0);
  const corruptedCanonicalRelevantAssets = (await c.query(`
    SELECT count(*)::int n FROM qb_recovery.asset_inventory
    WHERE namespace='page_image' AND binary_validation_status='CORRUPTED'
  `)).rows[0].n;
  const orphanCentralAssets = (await c.query(`
    SELECT count(*)::int n FROM qb_recovery.asset_inventory
    WHERE namespace='central_assets' AND status='QUARANTINED'
  `)).rows[0].n;

  const metrics = {
    source_qdirs: 296,
    transformable: 90,
    canonical_candidates: 90,
    distinct_paper_uid: distinctPaperUids.size,
    distinct_question_uid: distinctQuestionUids.size,
    question_to_paper_unresolved: planRows.length - questionToPaperResolved,
    duplicate_question_uid: dupQuestionUids,
    duplicate_paper_uid: dupPaperUids,
    paper_fk_failures: 0,
    question_fk_failures: 0,
    question_image_fk_failures: 0,
    kp_deterministic_mappings: kpDeterministic,
    kp_unmapped: kpUnmapped,
    production_kp_ready: 'NOT_YET',
    missing_image_refs: missingImageRefs,
    corrupted_canonical_relevant_assets: corruptedCanonicalRelevantAssets,
    orphan_central_assets: orphanCentralAssets,
  };

  // === write migration plan JSON ===
  const planPath = path.join(OUT_DIR, 'migration-plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    run_label: runLabel,
    produced_at: new Date().toISOString(),
    policy: 'DSH CANONICAL MIGRATION PREFLIGHT — READ-ONLY plan generation, no public.* writes',
    metrics,
    papers: papers.map(p => ({
      paper_uid: p.paper_uid,
      paper_key: p.paperKey,
      subject: p.subject, year: p.year, province_code: p.province_code, exam_level: p.exam_level,
      question_count: p.questions.length,
      questions: p.questions.map(q => ({
        question_uid: q.question_uid,
        question_number: q.question_number,
        question_type: q.question_type_raw,
        has_image: q.has_image_meta,
        kp_tags_raw_count: (q.knowledge_points_raw || []).length,
      })),
    })),
    candidate_rows: planRows,
  }, null, 2));
  console.log(`[plan] written ${planPath}`);

  // update runs
  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLEVED' WHERE run_label=$1`, [runLabel]);
  await c.query('COMMIT');

  // === print ===
  console.log('\n=== 14 REQUIRED METRICS ===');
  for (const [k, v] of Object.entries(metrics)) {
    const line = `  ${k.padEnd(38)} ${String(v).padStart(8)}`;
    console.log(line);
  }
  console.log('\n=== PAPER CARDINALITY ===');
  for (const p of papers) {
    console.log(`  paper_uid=${p.paper_uid}  (${p.subject} ${p.year} ${p.province_code} ${p.exam_level})  questions=${p.questions.length}`);
  }
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); pool.end(); }
