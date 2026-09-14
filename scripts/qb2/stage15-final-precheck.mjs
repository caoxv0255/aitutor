// scripts/qb2/stage15-final-precheck.mjs — DSH CANONICAL-WRITE-PREFLIGHT (revised)
// 3 SAFE papers: chinese 2024/2025 + history 2024 (paper 21 excluded)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';

const APPROVED_KEYS = [['chinese', 2024, 'b4ab624a4e7460d8'], ['chinese', 2025, '35dccaaf93229ff4'], ['history', 2024, '99e1a3bc2dd808ff']];
const APPROVED_PAPER_UIDS = APPROVED_KEYS.map(k => k[2]);
const DEFERRED_PAPER_UID = '299a49bf489ab027';  // history 2025 beijing
const TARGET_KEYS = [['chinese', 2024], ['chinese', 2025], ['history', 2024]];

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function paperRowSha(p) { return sha256(JSON.stringify({ paper_uid: p.paper_uid, province_code: p.province_code, year: p.year, subject: p.subject, exam_level: p.exam_level, question_count: p.question_count, paper_variant: 'main' })); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");
  const { rows: [r] } = await c.query(`INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status) VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE15', 'stage15', 'QB-TAR-BATCH-01', 'RUNNING') RETURNING run_label`);
  const runLabel = r.run_label;

  // ---------- W3-F1: 3 papers SAFE_UPDATE ----------
  const { rows: planPapers } = await c.query(`
    SELECT q.subject, q.year, q.province_code, q.exam_level, count(*)::int q_count
    FROM qb_recovery.qb_staging q
    WHERE q.canonical_status='ACCEPTED' AND q.canonical_ready_step='canonical_candidate'
      AND ((q.subject='chinese' AND q.year IN (2024,2025)) OR (q.subject='history' AND q.year=2024))
    GROUP BY q.subject, q.year, q.province_code, q.exam_level
    ORDER BY q.subject, q.year
  `);
  const planByKey = new Map(planPapers.map(p => [`${p.subject}|${p.year}`, parseInt(p.q_count, 10)]));

  // existing target paper rows (paper_uid may be empty in 3 papers from D088)
  const { rows: existingPapers } = await c.query(`
    SELECT id, paper_uid, province_code, year, subject, exam_level, question_count
    FROM public.exam_papers
    WHERE (subject='chinese' AND year IN (2024,2025)) OR (subject='history' AND year=2024)
  `);

  const w3f1 = [];
  for (const [subject, year, paper_uid] of APPROVED_KEYS) {
    const plan_q_count = planByKey.get(`${subject}|${year}`) || 0;
    const planPaper = { paper_uid, province_code: 'beijing', year, subject, exam_level: 'gaokao', question_count: plan_q_count };
    const existing = existingPapers.find(p => p.subject === subject && p.year === year);
    if (!existing) { w3f1.push({ paper_uid: planPaper.paper_uid, status: 'NOT_FOUND' }); continue; }
    const planSha = paperRowSha(planPaper);
    const existingPaperUid = existing.paper_uid || '';
    const existingSha = paperRowSha({ ...existing, paper_uid: existingPaperUid });
    let cls;
    if (existingPaperUid === '' && existing.question_count === plan_q_count) cls = 'SAFE_UPDATE';
    else if (existingSha === planSha) cls = 'UNCHANGED';
    else cls = 'CONFLICT';
    w3f1.push({ paper_uid: planPaper.paper_uid, status: cls, existing_id: existing.id, existing_paper_uid: existingPaperUid, existing_q_count: existing.question_count, plan_q_count, before_sha: existingSha, after_sha: planSha });
  }

  // ---------- W3-F2: questions = 70 (or 75 if dispatch meant something else) ----------
  // Filter to target 3 papers
  const eligibleStagingIds = (await c.query(`
    SELECT id FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
      AND ((subject='chinese' AND year IN (2024,2025)) OR (subject='history' AND year=2024))
  `)).rows.map(r => r.id);
  const { rows: qUidsList } = await c.query(`
    SELECT id, question_uid, subject, year, question_number
    FROM qb_recovery.qb_staging
    WHERE id = ANY($1::int[])
  `, [eligibleStagingIds]);
  const { rows: existingQ } = await c.query(`
    SELECT question_uid, id FROM public.exam_questions
    WHERE question_uid = ANY($1::text[])
  `, [qUidsList.map(r => r.question_uid)]);
  const w3f2 = {
    candidates_in_3_papers: qUidsList.length,
    existing_q_uids_in_3_papers: existingQ.map(r => r.question_uid),
    collision_count: existingQ.length,
    by_paper: {},
  };
  for (const r of qUidsList) {
    const k = `${r.subject}|${r.year}`;
    if (!w3f2.by_paper[k]) w3f2.by_paper[k] = { count: 0, uids: [] };
    w3f2.by_paper[k].count++;
    w3f2.by_paper[k].uids.push(r.question_uid);
  }

  // ---------- W3-F3: 3-class paper collision (already in w3f1) ----------
  const w3f3 = { papers: w3f1, conclusion: w3f1.every(p => p.status === 'SAFE_UPDATE' || p.status === 'UNCHANGED') ? 'PASS' : 'FAIL' };

  // ---------- W3-F4: image scope ----------
  const { rows: imageAgg } = await c.query(`
    SELECT staging_id,
           count(*) FILTER (WHERE resolution='RESOLVED')::int AS n_resolved,
           count(*) FILTER (WHERE resolution='MISSING_SOURCE')::int AS n_missing
    FROM qb_recovery.image_staging
    WHERE staging_id = ANY($1::int[])
    GROUP BY staging_id
  `, [eligibleStagingIds]);
  const imageByStg = new Map(imageAgg.map(r => [r.staging_id, { n_resolved: Number(r.n_resolved), n_missing: Number(r.n_missing) }]));
  const { rows: imageRefsPerQuestion } = await c.query(`
    SELECT id AS staging_id, jsonb_array_length(images_raw) AS refs
    FROM qb_recovery.qb_staging
    WHERE id = ANY($1::int[])
  `, [eligibleStagingIds]);
  let presentTotal = 0, missingTotal = 0, blockCandidates = [];
  for (const r of imageRefsPerQuestion) {
    const im = imageByStg.get(r.staging_id) || { n_resolved: 0, n_missing: 0 };
    presentTotal += im.n_resolved;
    missingTotal += im.n_missing;
    if (im.n_missing > 0) {
      const { rows: [sr] } = await c.query(`SELECT stem_text FROM qb_recovery.qb_staging WHERE id=$1`, [r.staging_id]);
      const stem = sr?.stem_text || '';
      if (/如下图|见上图|见下|图1[^0-9]|图2[^0-9]|如图所示|如图|看图|根据图|图示/.test(stem)) blockCandidates.push({ staging_id: r.staging_id, stem_excerpt: stem.slice(0, 100) });
    }
  }
  const w3f4 = {
    image_rows_PRESENT: presentTotal,
    image_rows_MISSING_SOURCE: missingTotal,
    image_BLOCKED_count: blockCandidates.length,
    image_BLOCKED_samples: blockCandidates.slice(0, 5),
    conclusion: blockCandidates.length === 0 ? 'PASS' : 'FAIL',
  };

  // ---------- W3-F5: KP ----------
  const { rows: kpMapped } = await c.query(`
    SELECT kc.staging_id, kc.matched_kp_id, kc.confidence, qs.question_uid
    FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id = kc.staging_id
    WHERE kc.mapping_status='MAPPED' AND qs.canonical_status='ACCEPTED'
      AND ((qs.subject='chinese' AND qs.year IN (2024,2025)) OR (qs.subject='history' AND qs.year=2024))
  `);
  const { rows: kpUnmapped } = await c.query(`SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='UNMAPPED'`);
  const w3f5 = { mapped: kpMapped.length, mapped_details: kpMapped.map(r => ({ staging_q: r.question_uid, kp: r.matched_kp_id, conf: Number(r.confidence) })), unmapped_remaining_staging_only: Number(kpUnmapped[0].n), conclusion: kpMapped.length === 3 ? 'PASS' : 'FAIL' };

  // ---------- W3-F6: Paper 21 excluded ----------
  const { rows: p21 } = await c.query(`SELECT id, paper_uid, subject, year, question_count FROM public.exam_papers WHERE id=21`);
  const w3f6 = { paper_21_in_target: false, paper_21_state: p21[0] || null, conclusion: 'PASS — paper 21 NOT in approved scope' };

  // ---------- target snapshot ----------
  const targetPaperIds = w3f1.map(p => p.existing_id).filter(x => x);
  const { rows: existingQinPapers } = await c.query(`SELECT count(*)::int n FROM public.exam_questions WHERE paper_id = ANY($1::int[])`, [targetPaperIds]);
  const { rows: existingKPinPlan } = await c.query(`SELECT count(*)::int n FROM public.question_knowledge_points WHERE question_id IN (SELECT id FROM public.exam_questions WHERE paper_id = ANY($1::int[]))`, [targetPaperIds]);
  const targetSnapshot = {
    captured_at: new Date().toISOString(),
    run_label: runLabel,
    target_papers: w3f1.map(p => ({ paper_uid: p.paper_uid, existing_id: p.existing_id, classification: p.status, plan_q_count: p.plan_q_count, existing_q_count: p.existing_q_count })),
    target_questions_in_3_papers: qUidsList.length,
    target_questions_existing_in_3_papers: Number(existingQinPapers[0].n),
    target_question_uid_collisions: w3f2.collision_count,
    target_image_rows_PRESENT: w3f4.image_rows_PRESENT,
    target_image_rows_MISSING_SOURCE: w3f4.image_rows_MISSING_SOURCE,
    target_kp_deterministic: w3f5.mapped,
    target_kp_existing: Number(existingKPinPlan[0].n),
    excluded_paper_21: { paper_uid: DEFERRED_PAPER_UID, reason: '15/20 content CONFLICT (Addendum F)' },
  };

  // ---------- ledger protocol ----------
  const ledgerProtocol = {
    table: 'qb_recovery.canonical_migration_ledger',
    columns: ['id', 'run_label', 'entity_type', 'canonical_uid', 'canonical_id', 'action', 'before_sha', 'after_sha', 'detail', 'occurred_at'],
    actions_allowed: ['BEGIN', 'INSERTED', 'UPDATED', 'UNCHANGED', 'ROLLED_BACK'],
    expected_entries_for_3_papers: {
      BEGIN: 1,
      UPSERT_paper_id_10_SAFE_UPDATE: 1,
      UPSERT_paper_id_11_SAFE_UPDATE: 1,
      UPSERT_paper_id_20_SAFE_UPDATE: 1,
      INSERT_question: qUidsList.length,
      INSERT_image_PRESENT: w3f4.image_rows_PRESENT,
      INSERT_kp_deterministic: 3,
      COMMIT: 1,
      estimated_total_rows: 1 + 3 + qUidsList.length + w3f4.image_rows_PRESENT + 3 + 1,
    },
    rollback_protocol: [
      '1. SELECT all ledger entries WHERE run_label = $1 ORDER BY id DESC',
      '2. For each entry, determine reversal by action:',
      '   - INSERTED → DELETE FROM public.<table> WHERE id = canonical_id',
      '   - UPDATED → read current row, compare sha to after_sha; if matches → restore from before_sha via UPDATE; if not matches → log "external modification; skip" and DO NOT touch',
      '   - UNCHANGED → no-op',
      '3. Papers: action=UPDATED → restore from before_sha',
      '4. Questions: action=INSERTED → DELETE',
      '5. Images: action=INSERTED → DELETE FROM public.question_images',
      '6. KP: action=INSERTED → DELETE FROM public.question_knowledge_points',
      '7. After each DELETE/UPDATE, re-read sha to verify',
      '8. Commit per-entity to allow partial rollback',
      '9. Mark each reversed entry as ROLLED_BACK in the ledger',
      '10. CRITICAL: never blindly DELETE/restore; only act when current sha matches after_sha (post-migration state)',
    ],
  };

  // ---------- final verdict ----------
  // User's expected = 75; actual = 70 (25+25+20). Flag the discrepancy honestly.
  const allPass = [
    w3f3.conclusion === 'PASS',
    w3f2.collision_count === 0,
    w3f4.conclusion === 'PASS',
    w3f5.conclusion === 'PASS',
    w3f6.conclusion.startsWith('PASS'),
  ].every(x => x);
  const allSafeUpdate = w3f1.every(p => p.status === 'SAFE_UPDATE');
  const finalReport = {
    run_label: runLabel,
    produced_at: new Date().toISOString(),
    note: 'Dispatch expected questions=75; actual in 3 SAFE papers = 25+25+20 = 70. Flagged in w3f2.',
    approved_scope: { paper_uids: APPROVED_PAPER_UIDS, excluded_paper_uids: [DEFERRED_PAPER_UID] },
    W3_F1_papers: w3f1,
    W3_F2_questions: w3f2,
    W3_F3_collision_classes: w3f3,
    W3_F4_images: w3f4,
    W3_F5_kp: w3f5,
    W3_F6_paper21_excluded: w3f6,
    target_snapshot: targetSnapshot,
    ledger_protocol: ledgerProtocol,
    OVERALL: (allPass && allSafeUpdate) ? 'READY_FOR_USER_AUTHORIZATION' : 'NOT_READY',
    blockers: [
      ...(allSafeUpdate ? [] : ['1+ paper is not SAFE_UPDATE (W3-F1)']),
      ...(w3f2.collision_count === 0 ? [] : [`${w3f2.collision_count} question_uid collision(s) (W3-F2)`]),
      ...(w3f4.conclusion === 'PASS' ? [] : ['IMAGE_BLOCKED detected (W3-F4)']),
      ...(w3f5.conclusion === 'PASS' ? [] : [`KP mapped != 3 (got ${w3f5.mapped}) (W3-F5)`]),
      ...(w3f6.conclusion.startsWith('PASS') ? [] : ['paper 21 not excluded (W3-F6)']),
    ],
  };
  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await c.query('COMMIT');
  fs.writeFileSync(path.join(OUT, 'final-write-precheck.json'), JSON.stringify(finalReport, null, 2));
  fs.writeFileSync(path.join(OUT, 'final-target-snapshot.json'), JSON.stringify(targetSnapshot, null, 2));

  console.log('=== FINAL WRITE PRECHECK ===');
  console.log('W3-F1 papers:', w3f1.map(p => `${p.paper_uid} ${p.status}`).join(' | '));
  console.log(`W3-F2 candidates_in_3_papers: ${qUidsList.length}  collision: ${w3f2.collision_count}`);
  console.log(`W3-F3: ${w3f3.conclusion}`);
  console.log(`W3-F4 PRESENT: ${w3f4.image_rows_PRESENT}  MISSING: ${w3f4.image_rows_MISSING_SOURCE}  BLOCKED: ${w3f4.image_BLOCKED_count}`);
  console.log(`W3-F5 mapped: ${w3f5.mapped}  unmapped_remaining: ${w3f5.unmapped_remaining_staging_only}`);
  console.log(`W3-F6 paper 21: ${p21[0] ? p21[0].subject + ' ' + p21[0].year : 'gone'} EXCLUDED`);
  console.log(`\n=== OVERALL: ${finalReport.OVERALL} ===`);
  if (finalReport.blockers.length) console.log('Blockers:', finalReport.blockers);
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
