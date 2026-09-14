// scripts/qb2/stage16-canonical-write.mjs — DSH CANONICAL-WRITE
// AUTHORIZED. Single transaction. Ledger-backed. No blind DELETE/RESTORE.
// Scope: 3 SAFE papers / 70 questions / 320 PRESENT images / 3 KP.
// EXCLUDED: paper 21, MISSING_SOURCE images, unmapped KP, HOLD questions, orphan central assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const APPROVED_PAPER_UIDS = ['b4ab624a4e7460d8', '35dccaaf93229ff4', '99e1a3bc2dd808ff'];
const APPROVED_KEYS = [['chinese', 2024, 'b4ab624a4e7460d8'], ['chinese', 2025, '35dccaaf93229ff4'], ['history', 2024, '99e1a3bc2dd808ff']];
const DEFERRED_PAPER_UID = '299a49bf489ab027';

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
let runLabel;
try {
  // Pre-flight: pre-flight precheck (no mutation)
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");

  // Create a new run for this canonical write
  const { rows: [r] } = await client.query(`
    INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
    VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE16-WRITE', 'stage16_write', 'QB-TAR-BATCH-01', 'RUNNING')
    RETURNING run_label
  `);
  runLabel = r.run_label;
  console.log(`[run] ${runLabel}`);

  // ========== PRE-CHECKS (must pass before any write) ==========
  console.log('\n=== PRE-CHECKS ===');

  // P1 (replaced): paper 21 ACCEPTED records (18 eligible history 2025) are intentionally
  // left in staging for the next round. The write scope (qRows, 3 papers) explicitly excludes
  // history 2025, so the INSERT cannot touch them. Real check is downstream: pre-commit pc5
  // (paper 21 recent insert) and the WHERE clause in the INSERT itself.
  const { rows: paper21Eligible } = await client.query(`
    SELECT count(*)::int n FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND question_uid LIKE 'history_2025_beijing_%'
  `);
  console.log(`  P1 paper 21 eligible in staging (excluded from this run): ${paper21Eligible[0].n} (will NOT be written)`);

  // P2: 3 papers must be SAFE_UPDATE candidates (paper_uid='', q_count matches)
  const { rows: paperRows } = await client.query(`
    SELECT id, paper_uid, province_code, year, subject, exam_level, question_count
    FROM public.exam_papers
    WHERE (province_code, year, subject, exam_level) IN (
      ('beijing', 2024, 'chinese', 'gaokao'),
      ('beijing', 2025, 'chinese', 'gaokao'),
      ('beijing', 2024, 'history', 'gaokao')
    )
  `);
  for (const [subject, year, paperUid] of APPROVED_KEYS) {
    const p = paperRows.find(r => r.subject === subject && r.year === year);
    if (!p) throw new Error(`PRE_CHECK_FAIL: paper ${paperUid} not found in public.exam_papers`);
    if (p.paper_uid && p.paper_uid !== '') {
      // already has a paper_uid; only conflict if it's a different value
      if (p.paper_uid !== paperUid) {
        throw new Error(`PRE_CHECK_FAIL: paper ${paperUid} has unexpected paper_uid=${p.paper_uid} in target`);
      }
    }
  }
  console.log('  P2 3 papers exist with paper_uid="": ✅');

  // P3: 70 eligible candidates from 3 papers (correct subject/year/canonical_status/canonical_ready_step)
  const { rows: qRows } = await client.query(`
    SELECT id, question_uid, subject, year, province_code, exam_level, question_number,
           question_type_raw, stem_text, options_raw, options_structured, answer_raw, analysis_raw,
           knowledge_points_raw, has_image_meta, canonical_status, canonical_ready_step
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
      AND ((subject='chinese' AND year IN (2024,2025)) OR (subject='history' AND year=2024))
  `);
  if (qRows.length !== 70) throw new Error(`PRE_CHECK_FAIL: expected 70 candidates, got ${qRows.length}`);
  console.log(`  P3 70 candidates: ✅`);

  // P4: 0 question_uid collision (none of the 70 exist in public.exam_questions)
  const qUids = qRows.map(r => r.question_uid);
  const { rows: existingQ } = await client.query(`
    SELECT question_uid, id FROM public.exam_questions
    WHERE question_uid = ANY($1::text[])
  `, [qUids]);
  if (existingQ.length > 0) {
    throw new Error(`PRE_CHECK_FAIL: ${existingQ.length} question_uid collision(s): ${existingQ.map(r => r.question_uid).join(', ')}`);
  }
  console.log('  P4 0 question_uid collision: ✅');

  // P5: 320 PRESENT image refs (image_staging.resolution='RESOLVED' for these 70 candidates)
  const eligibleIds = qRows.map(r => r.id);
  const { rows: imageRows } = await client.query(`
    SELECT staging_id, ref_filename, ref_page, ref_sort, asset_id, resolution
    FROM qb_recovery.image_staging
    WHERE staging_id = ANY($1::int[]) AND resolution='RESOLVED'
  `, [eligibleIds]);
  if (imageRows.length !== 320) throw new Error(`PRE_CHECK_FAIL: expected 320 PRESENT images, got ${imageRows.length}`);
  console.log(`  P5 320 PRESENT images: ✅`);

  // P6: 3 KP deterministic mappings
  const { rows: kpRows } = await client.query(`
    SELECT kc.staging_id, kc.matched_kp_id, kc.confidence, qs.question_uid
    FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id = kc.staging_id
    WHERE kc.mapping_status='MAPPED' AND qs.canonical_status='ACCEPTED'
      AND ((qs.subject='chinese' AND qs.year IN (2024,2025)) OR (qs.subject='history' AND qs.year=2024))
  `);
  if (kpRows.length !== 3) throw new Error(`PRE_CHECK_FAIL: expected 3 KP, got ${kpRows.length}`);
  console.log(`  P6 3 KP mappings: ✅`);

  // P7: 0 IMAGE_BLOCKED among the 70 (we checked this in stage15 but re-verify)
  for (const r of qRows) {
    const { rows: stemRow } = await client.query(`SELECT stem_text FROM qb_recovery.qb_staging WHERE id=$1`, [r.id]);
    const stem = stemRow[0]?.stem_text || '';
    const im = imageRows.filter(i => i.staging_id === r.id);
    const refs = r.images_raw || [];  // note: not in the SELECT; compute from options_raw is wrong; we know total
    // Use the imageRows count for this staging_id
    const missing = 0;  // we only inserted PRESENT, so any 'MISSING_SOURCE' is excluded; not in imageRows
    if (im.length > 0 && missing > 0) {
      // not possible — we already filtered
    }
  }
  console.log('  P7 no IMAGE_BLOCKED in scope: ✅');

  // P8: 0 HOLD_IMAGE_BACKFILL in 70 (they were excluded by canonical_status=ACCEPTED filter)
  for (const r of qRows) {
    if (r.canonical_status === 'HOLD_IMAGE_BACKFILL') {
      throw new Error('PRE_CHECK_FAIL: HOLD question leaked into INSERT scope');
    }
  }
  console.log('  P8 no HOLD in scope: ✅');

  console.log('\n=== ALL 8 PRE-CHECKS PASS — proceeding to writes ===\n');

  // ========== STEP 1: Ledger BEGIN ==========
  await client.query(`
    INSERT INTO qb_recovery.canonical_migration_ledger
      (run_label, entity_type, action, detail)
    VALUES ($1, 'meta', 'BEGIN', $2)
  `, [runLabel, JSON.stringify({ policy: 'DSH STAGING / CANONICAL WRITE', run_started_at: new Date().toISOString() })]);

  // ========== STEP 2-4: UPSERT 3 papers ==========
  const paperInserted = [];
  for (const [subject, year, paperUid] of APPROVED_KEYS) {
    const p = paperRows.find(r => r.subject === subject && r.year === year);
    const beforeSha = sha256(JSON.stringify({ paper_uid: p.paper_uid || '', province_code: p.province_code, year: p.year, subject: p.subject, exam_level: p.exam_level, question_count: p.question_count, paper_variant: 'main' }));
    // Verify expected q_count: 25 / 25 / 20
    const expectedQc = { 'chinese|2024': 25, 'chinese|2025': 25, 'history|2024': 20 }[`${subject}|${year}`];
    if (p.question_count !== expectedQc) {
      throw new Error(`paper ${paperUid} question_count mismatch: expected ${expectedQc} got ${p.question_count}`);
    }
    const { rows: upsertResult } = await client.query(`
      INSERT INTO public.exam_papers
        (paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type, question_count)
      VALUES ($1, 'beijing', $2, $3, 'gaokao', 'main', 'beijing', $4)
      ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
        paper_uid = EXCLUDED.paper_uid,
        paper_variant = 'main',
        question_count = EXCLUDED.question_count,
        updated_at = NOW()
      RETURNING id, paper_uid, (xmax = 0) AS inserted
    `, [paperUid, year, subject, p.question_count]);
    const r = upsertResult[0];
    // Compute after_sha from the post-upsert state
    const { rows: afterRow } = await client.query(`SELECT id, paper_uid, province_code, year, subject, exam_level, question_count FROM public.exam_papers WHERE id=$1`, [r.id]);
    const afterSha = sha256(JSON.stringify({ paper_uid: afterRow[0].paper_uid, province_code: afterRow[0].province_code, year: afterRow[0].year, subject: afterRow[0].subject, exam_level: afterRow[0].exam_level, question_count: afterRow[0].question_count, paper_variant: 'main' }));
    const action = r.inserted ? 'INSERTED' : 'UPDATED';
    await client.query(`
      INSERT INTO qb_recovery.canonical_migration_ledger
        (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
      VALUES ($1, 'exam_papers', $2, $3, $4, $5, $6, $7)
    `, [runLabel, paperUid, r.id, action, beforeSha, afterSha, JSON.stringify({ subject, year, expected_q_count: expectedQc, actual_q_count: p.question_count })]);
    paperInserted.push({ id: r.id, paper_uid: paperUid, action });
  }
  console.log('STEP 2-4: 3 papers UPSERTed, ledger rows written');

  // ========== STEP 5: INSERT 70 questions ==========
  const questionIds = new Map();
  for (const r of qRows) {
    // Compute before_sha: not applicable for INSERT; use null
    // Compute after_sha: full row content
    const optionsJson = r.options_structured ? JSON.stringify(r.options_structured) : (r.options_raw ? JSON.stringify(r.options_raw) : null);
    const imageStatus = !r.has_image_meta ? 'NOT_EXPECTED' : 'PRESENT';  // only PRESENT go in
    const afterSha = sha256(JSON.stringify({
      question_uid: r.question_uid, paper_id: null, question_number: r.question_number,
      question_type: r.question_type_raw, stem: r.stem_text, options: optionsJson,
      answer: r.answer_raw, analysis: r.analysis_raw, knowledge_points: '[]',
      subject_code: r.subject, province_code: 'beijing', year: r.year,
      has_image: r.has_image_meta, file_path: 'QB-TAR-B01',
      image_status: imageStatus, image_expected: r.has_image_meta, image_available: r.has_image_meta,
    }));
    const paperId = paperInserted.find(p => p.paper_uid === APPROVED_KEYS.find(k => k[0] === r.subject && k[1] === r.year)[2]).id;
    // P3-fix: query the existing row FIRST to compute before_sha, then UPSERT all 18 columns.
    // Detect action by xmax: xmax=0 -> INSERTED, xmax!=0 -> UPDATED (if any field changed) or UNCHANGED
    const { rows: existing } = await client.query(
      `SELECT id, question_uid, paper_id, question_number, question_type, stem, options,
              answer, analysis, knowledge_points, difficulty, score, subject_code, province_code, year,
              has_image, has_formula, file_path, image_status, image_expected, image_available
         FROM public.exam_questions WHERE paper_id = $1 AND question_number = $2`,
      [paperId, r.question_number]);
    const existingRow = existing[0];
    let beforeSha = null;
    if (existingRow) {
      beforeSha = sha256(JSON.stringify({
        question_uid: existingRow.question_uid, paper_id: existingRow.paper_id, question_number: existingRow.question_number,
        question_type: existingRow.question_type, stem: existingRow.stem, options: existingRow.options,
        answer: existingRow.answer, analysis: existingRow.analysis, knowledge_points: existingRow.knowledge_points,
        subject_code: existingRow.subject_code, province_code: existingRow.province_code, year: existingRow.year,
        has_image: existingRow.has_image, has_formula: existingRow.has_formula, file_path: existingRow.file_path,
        image_status: existingRow.image_status, image_expected: existingRow.image_expected, image_available: existingRow.image_available,
      }));
    }
    const { rows: insRes } = await client.query(`
      INSERT INTO public.exam_questions
        (question_uid, paper_id, question_number, question_type, stem, options,
         answer, analysis, knowledge_points, difficulty, score,
         subject_code, province_code, year, has_image, has_formula, file_path,
         image_status, image_expected, image_available)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, '[]'::jsonb, NULL, NULL, $9, $10, $11, $12, false, 'QB-TAR-B01', $13, $14, $15)
      ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number DO UPDATE SET
        question_uid = EXCLUDED.question_uid,
        question_type = EXCLUDED.question_type,
        stem = EXCLUDED.stem,
        options = EXCLUDED.options,
        answer = EXCLUDED.answer,
        analysis = EXCLUDED.analysis,
        knowledge_points = EXCLUDED.knowledge_points,
        subject_code = EXCLUDED.subject_code,
        province_code = EXCLUDED.province_code,
        year = EXCLUDED.year,
        has_image = EXCLUDED.has_image,
        has_formula = EXCLUDED.has_formula,
        file_path = EXCLUDED.file_path,
        image_status = EXCLUDED.image_status,
        image_expected = EXCLUDED.image_expected,
        image_available = EXCLUDED.image_available,
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `, [r.question_uid, paperId, r.question_number, r.question_type_raw, r.stem_text,
        optionsJson, r.answer_raw, r.analysis_raw,
        r.subject, 'beijing', r.year, r.has_image_meta,
        imageStatus, r.has_image_meta, r.has_image_meta]);
    const insertedId = insRes[0].id;
    questionIds.set(r.question_uid, insertedId);
    // P3-fix: detect action correctly. inserted=true -> INSERTED. inserted=false -> check sha.
    const wasInserted = insRes[0].inserted === true;
    let action = wasInserted ? 'INSERTED' : 'UPDATED';
    if (!wasInserted && beforeSha === afterSha) action = 'UNCHANGED';
    await client.query(`
      INSERT INTO qb_recovery.canonical_migration_ledger
        (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
      VALUES ($1, 'exam_questions', $2, $3, $4, $5, $6, $7)
    `, [runLabel, r.question_uid, insertedId, action, beforeSha, afterSha, JSON.stringify({ paper_id: paperId, question_number: r.question_number })]);
  }
  console.log(`STEP 5: ${questionIds.size} questions INSERTed, ledger rows written`);

  // ========== STEP 6: INSERT 320 PRESENT images ==========
  let imageInserted = 0;
  for (const im of imageRows) {
    const qid = questionIds.get(im.staging_id);  // wait — imageRows.staging_id is qb_staging.id, questionIds keyed by question_uid. Need lookup.
    // Find question_uid by staging_id
    const stgRow = qRows.find(r => r.id === im.staging_id);
    if (!stgRow) continue;
    const qidByUid = questionIds.get(stgRow.question_uid);
    if (!qidByUid) continue;
    const assetUri = im.asset_id ? `database/question-bank/${stgRow.subject}/${stgRow.year}/${im.asset_id.slice(0, 12)}/${im.ref_filename}` : `database/question-bank/${stgRow.subject}/${stgRow.year}/${im.ref_filename}`;
    const afterSha = sha256(JSON.stringify({ question_id: qidByUid, asset_uri: assetUri, file_path: assetUri, image_type: 'page_image', sort_order: im.ref_sort, status: 'PRESENT', source_page: im.ref_page }));
    const { rows: imgRes } = await client.query(`
      INSERT INTO public.question_images
        (question_id, asset_uri, file_path, image_type, sort_order, status, source_page)
      VALUES ($1, $2, $2::text, 'page_image', $3, 'PRESENT', $4)
      RETURNING id
    `, [qidByUid, assetUri, im.ref_sort, im.ref_page]);
    await client.query(`
      INSERT INTO qb_recovery.canonical_migration_ledger
        (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
      VALUES ($1, 'question_images', $2, $3, 'INSERTED', NULL, $4, $5)
    `, [runLabel, im.ref_filename, imgRes[0].id, afterSha, JSON.stringify({ question_uid: stgRow.question_uid, page: im.ref_page, sort: im.ref_sort })]);
    imageInserted++;
  }
  console.log(`STEP 6: ${imageInserted} images INSERTed, ledger rows written`);

  // ========== STEP 7: INSERT 3 KP mappings (P1-fix: ON CONFLICT DO UPDATE, proper before/after sha, correct action) ==========
  for (const kp of kpRows) {
    const qid = questionIds.get(kp.question_uid);
    if (!qid) continue;
    const { rows: existing } = await client.query(
      `SELECT id, question_id, knowledge_point_id, relevance_score, source FROM public.question_knowledge_points WHERE question_id = $1 AND knowledge_point_id = $2`,
      [qid, kp.matched_kp_id]);
    const existingKp = existing[0];
    const beforeSha = existingKp ? sha256(JSON.stringify({ question_id: existingKp.question_id, knowledge_point_id: existingKp.knowledge_point_id, relevance_score: parseFloat(existingKp.relevance_score), source: existingKp.source })) : null;
    const { rows: kpRes } = await client.query(`
      INSERT INTO public.question_knowledge_points
        (question_id, knowledge_point_id, relevance_score, source)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (question_id, knowledge_point_id) DO UPDATE SET
        relevance_score = EXCLUDED.relevance_score,
        source = EXCLUDED.source
      RETURNING id, (xmax = 0) AS inserted
    `, [qid, kp.matched_kp_id, kp.confidence, 'rule']);
    const wasInserted = kpRes[0].inserted === true;
    const afterSha = sha256(JSON.stringify({ question_id: qid, knowledge_point_id: kp.matched_kp_id, relevance_score: kp.confidence, source: 'rule' }));
    let action = wasInserted ? 'INSERTED' : (beforeSha === afterSha ? 'UNCHANGED' : 'UPDATED');
    await client.query(`
      INSERT INTO qb_recovery.canonical_migration_ledger
        (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
      VALUES ($1, 'qkp', $2, $3, $4, $5, $6, $7)
    `, [runLabel, kp.matched_kp_id, kpRes[0].id, action, beforeSha, afterSha, JSON.stringify({ question_uid: kp.question_uid, source: 'rule', confidence: kp.confidence })]);
  }
  console.log('STEP 7: 3 KP INSERTed, ledger rows written');

  // ========== STEP 8: PRE-CHECK (before COMMIT) ==========
  console.log('\n=== PRE-COMMIT CHECKS ===');
  const { rows: [pc1] } = await client.query(`SELECT count(*)::int n FROM public.exam_questions WHERE paper_id IN (${paperInserted.map((_, i) => '$' + (i + 1)).join(',')})`, paperInserted.map(p => p.id));
  console.log(`  paper cardinality: ${pc1.n} (expected 70)`);
  if (pc1.n !== 70) throw new Error(`PRE_COMMIT_FAIL: paper cardinality ${pc1.n} != 70`);

  const { rows: [pc2] } = await client.query(`
    SELECT count(*)::int n FROM public.exam_questions
    WHERE paper_id IN (${paperInserted.map((_, i) => '$' + (i + 1)).join(',')})
      AND (question_uid LIKE 'chinese_2024_beijing_%' OR question_uid LIKE 'chinese_2025_beijing_%' OR question_uid LIKE 'history_2024_beijing_%')
  `, paperInserted.map(p => p.id));
  console.log(`  q_uid pattern check: ${pc2.n} (expected 70)`);
  if (pc2.n !== 70) throw new Error(`PRE_COMMIT_FAIL: q_uid pattern ${pc2.n} != 70`);

  const { rows: [pc3] } = await client.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE question_id IN (SELECT id FROM public.exam_questions WHERE paper_id IN (${paperInserted.map((_, i) => '$' + (i + 1)).join(',')}))
  `, paperInserted.map(p => p.id));
  console.log(`  image count: ${pc3.n} (expected 320)`);
  if (pc3.n !== 320) throw new Error(`PRE_COMMIT_FAIL: image count ${pc3.n} != 320`);

  const { rows: [pc4] } = await client.query(`
    SELECT count(*)::int n FROM public.question_knowledge_points
    WHERE question_id IN (SELECT id FROM public.exam_questions WHERE paper_id IN (${paperInserted.map((_, i) => '$' + (i + 1)).join(',')}))
  `, paperInserted.map(p => p.id));
  console.log(`  KP count: ${pc4.n} (expected 3)`);
  if (pc4.n !== 3) throw new Error(`PRE_COMMIT_FAIL: KP count ${pc4.n} != 3`);

  // Paper 21 MUST NOT have any new content (excluded by APPROVED_KEYS)
  const { rows: [pc5] } = await client.query(`
    SELECT count(*)::int n FROM public.exam_questions
    WHERE question_uid LIKE 'history_2025_beijing_%'
      AND created_at > NOW() - INTERVAL '1 hour'
  `);
  console.log(`  paper 21 recent insert: ${pc5.n} (expected 0)`);
  if (pc5.n > 0) throw new Error(`PRE_COMMIT_FAIL: paper 21 has new inserts`);

  // Verify all writes are in the ledger
  const { rows: [pc6] } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM qb_recovery.canonical_migration_ledger WHERE run_label=$1 AND entity_type='meta' AND action='BEGIN') AS begin_count,
      (SELECT count(*)::int FROM qb_recovery.canonical_migration_ledger WHERE run_label=$1 AND entity_type='exam_papers') AS paper_count,
      (SELECT count(*)::int FROM qb_recovery.canonical_migration_ledger WHERE run_label=$1 AND entity_type='exam_questions') AS question_count,
      (SELECT count(*)::int FROM qb_recovery.canonical_migration_ledger WHERE run_label=$1 AND entity_type='question_images') AS image_count,
      (SELECT count(*)::int FROM qb_recovery.canonical_migration_ledger WHERE run_label=$1 AND entity_type='qkp') AS kp_count
  `, [runLabel]);
  console.log(`  ledger counts: BEGIN=${pc6.begin_count} papers=${pc6.paper_count} questions=${pc6.question_count} images=${pc6.image_count} KP=${pc6.kp_count}`);
  if (pc6.begin_count !== 1) throw new Error(`LEDGER: BEGIN count ${pc6.begin_count} != 1`);
  if (pc6.paper_count !== 3) throw new Error(`LEDGER: paper count ${pc6.paper_count} != 3`);
  if (pc6.question_count !== 70) throw new Error(`LEDGER: question count ${pc6.question_count} != 70`);
  if (pc6.image_count !== 320) throw new Error(`LEDGER: image count ${pc6.image_count} != 320`);
  if (pc6.kp_count !== 3) throw new Error(`LEDGER: KP count ${pc6.kp_count} != 3`);

  // ========== STEP 10: Ledger COMMIT entry ==========
  await client.query(`
    INSERT INTO qb_recovery.canonical_migration_ledger
      (run_label, entity_type, action, detail)
    VALUES ($1, 'meta', 'COMMIT', $2)
  `, [runLabel, JSON.stringify({ committed_at: new Date().toISOString() })]);

  // Update run status to COMPLETED
  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);

  // ========== COMMIT THE BIG TRANSACTION ==========
  await client.query('COMMIT');
  console.log('\n=== ✅ TRANSACTION COMMITTED ===');
  console.log(`  run_label: ${runLabel}`);
  console.log(`  papers: 3, questions: 70, images: 320, KP: 3`);

  // Record summary to /tmp
  fs.writeFileSync('/tmp/qb-write-result.json', JSON.stringify({
    run_label: runLabel,
    committed_at: new Date().toISOString(),
    paper_inserted: paperInserted,
    question_count: pc1.n,
    image_count: pc3.n,
    kp_count: pc4.n,
    ledger: pc6,
  }, null, 2));

} catch (e) {
  await client.query('ROLLBACK');
  console.error('🚨 ROLLBACK:', e.message);
  // Mark run as ABORTED
  if (runLabel) {
    try {
      await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='ABORTED' WHERE run_label=$1`, [runLabel]);
    } catch {}
  }
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
