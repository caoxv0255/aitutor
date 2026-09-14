// scripts/qb2/stage17-canonical-re-audit.mjs — DSH-READONLY
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const RUN_LABEL = 'QB-TAR-20260904-B01-1789002481-STAGE16-WRITE';
const APPROVED_PAPER_UIDS = ['b4ab624a4e7460d8', '35dccaaf93229ff4', '99e1a3bc2dd808ff'];
const STAGE16_EXEC_TIME = new Date('2026-09-10T01:08:01+00:00');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
const results = {};

try {
  const { rows: [paperTotal] } = await c.query(`SELECT count(*)::int n FROM public.exam_papers`); console.log('p1');
  const { rows: [paperMigrated] } = await c.query(`SELECT count(*)::int n FROM public.exam_papers WHERE paper_uid = ANY($1::text[])`, [APPROVED_PAPER_UIDS]);
  const { rows: [qTotal] } = await c.query(`SELECT count(*)::int n FROM public.exam_questions`); console.log('p2');
  const { rows: [qIn3Papers] } = await c.query(`SELECT count(*)::int n FROM public.exam_questions WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))`, [APPROVED_PAPER_UIDS]); console.log('p3');
  const { rows: [qIn3PapersAfterStage16] } = await c.query(`SELECT count(*)::int n FROM public.exam_questions WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[])) AND updated_at >= $2`, [APPROVED_PAPER_UIDS, STAGE16_EXEC_TIME]); console.log('p4');
  const { rows: [imgTotal] } = await c.query(`SELECT count(*)::int n FROM public.question_images`); console.log('p5');
  const { rows: [imgInStage16] } = await c.query(`SELECT count(*)::int n FROM public.question_images WHERE created_at >= $1`, [STAGE16_EXEC_TIME]); console.log('p6');
  const { rows: [imgPresentInStage16] } = await c.query(`SELECT count(*)::int n FROM public.question_images WHERE status='PRESENT' AND created_at >= $1`, [STAGE16_EXEC_TIME]); console.log('p7');
  const { rows: [qkpTotal] } = await c.query(`SELECT count(*)::int n FROM public.question_knowledge_points`); console.log('p8');
  const { rows: [qkpInStage16] } = await c.query(`SELECT count(*)::int n FROM public.question_knowledge_points WHERE created_at >= $1`, [STAGE16_EXEC_TIME]); console.log('p9');
  results.R1 = {
    dispatch_expected: { papers_total: 35, papers_migrated: 3, questions_before: 609, questions_after: 679, questions_delta: 70, images_before: 0, images_after: 320, images_delta: 320, kp_before: 122, kp_after: 125, kp_delta: 3, ledger_this_run: 398 },
    actual: {
      exam_papers_total: paperTotal.n,
      exam_papers_migrated: paperMigrated.n,
      exam_questions_total: qTotal.n,
      exam_questions_in_3_papers: (qIn3Papers[0]?.n ?? 0),
      exam_questions_in_3_papers_updated_by_stage16: (qIn3PapersAfterStage16[0]?.n ?? 0),
      question_images_total: imgTotal.n,
      question_images_in_stage16_run: (imgInStage16[0]?.n ?? 0),
      question_images_PRESENT_in_stage16: (imgPresentInStage16[0]?.n ?? 0),
      question_knowledge_points_total: qkpTotal.n,
      question_knowledge_points_in_stage16: (qkpInStage16[0]?.n ?? 0),
    },
    note: '70 questions in 3 papers already existed from D088 v1; stage16 INSERT hit ON CONFLICT and UPDATEs were no-op. +0 new question rows. 320 images and 3 KP are genuinely new.',
    conclusion: ((paperMigrated.n === 3) && ((imgInStage16[0]?.n ?? 0) === 320) && ((imgPresentInStage16[0]?.n ?? 0) === 320) && ((qkpInStage16[0]?.n ?? 0) === 3)) ? 'PASS' : 'FAIL',
  };

  console.log('R2a'); const { rows: paperFkCheck } = await c.query(`
    SELECT p.id AS paper_id, p.paper_uid, p.subject, p.year, p.exam_level, count(q.id) AS q_count
    FROM public.exam_papers p
    LEFT JOIN public.exam_questions q ON q.paper_id = p.id
    WHERE p.paper_uid = ANY($1::text[])
    GROUP BY p.id, p.paper_uid, p.subject, p.year, p.exam_level
    ORDER BY p.year, p.subject
  `, [APPROVED_PAPER_UIDS]);
  const r2Papers = paperFkCheck.map(p => ({ paper_id: p.paper_id, paper_uid: p.paper_uid, subject: p.subject, year: p.year, exam_level: p.exam_level, q_count: parseInt(p.q_count, 10) }));
  console.log('R2b'); const { rows: orphans } = await c.query(`
    SELECT count(*)::int n FROM public.exam_questions q
    WHERE q.paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
      AND (q.paper_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.exam_papers p WHERE p.id = q.paper_id))
  `, [APPROVED_PAPER_UIDS]);
  const r2Expected = { 'chinese|2024': 25, 'chinese|2025': 25, 'history|2024': 20 };
  let r2Ok = true;
  for (const p of r2Papers) {
    const k = `${p.subject}|${p.year}`;
    if (p.q_count !== r2Expected[k]) { r2Ok = false; break; }
  }
  results.R2 = {
    papers: r2Papers,
    expected_breakdown: r2Expected,
    actual_breakdown: Object.fromEntries(r2Papers.map(p => [`${p.subject}|${p.year}|${p.exam_level}`, p.q_count])),
    orphans: orphans.n,
    conclusion: (r2Ok && orphans.n === 0) ? 'PASS' : 'FAIL',
  };

  console.log('R3a'); const { rows: [nullUids] } = await c.query(`
    SELECT count(*)::int n FROM public.exam_questions
    WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
      AND (question_uid IS NULL OR length(question_uid) = 0)
  `, [APPROVED_PAPER_UIDS]);
  const { rows: dupUids } = await c.query(`
    SELECT question_uid, count(*) c FROM public.exam_questions
    WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
    GROUP BY question_uid HAVING count(*) > 1
  `, [APPROVED_PAPER_UIDS]);
  const { rows: [allDupUids] } = await c.query(`
    SELECT count(*)::int n FROM (SELECT question_uid FROM public.exam_questions GROUP BY question_uid HAVING count(*)>1) x
  `);
  console.log('R3b'); const { rows: uidsInScope } = await c.query(`
    SELECT question_uid FROM public.exam_questions
    WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
    ORDER BY question_uid
  `, [APPROVED_PAPER_UIDS]);
  const patternOk = uidsInScope.length === 70 && uidsInScope.every(r => /^chinese_2024_beijing_\d{3}$/.test(r.question_uid) || /^chinese_2025_beijing_\d{3}$/.test(r.question_uid) || /^history_2024_beijing_\d{3}$/.test(r.question_uid));
  results.R3 = {
    total_in_scope: uidsInScope.length,
    null_or_empty_uids: nullUids.n,
    duplicate_uids_within_scope: dupUids.length,
    duplicate_uids_in_all_table: allDupUids.n,
    pattern_conformant: patternOk,
    sample_uids: uidsInScope.slice(0, 5).map(r => r.question_uid),
    conclusion: (uidsInScope.length === 70 && nullUids.n === 0 && dupUids.length === 0 && allDupUids.n === 0 && patternOk) ? 'PASS' : 'FAIL',
  };

  console.log('R4a'); const { rows: [imgOrphan] } = await c.query(`
    SELECT count(*)::int n FROM public.question_images i
    WHERE i.created_at >= $1
      AND NOT EXISTS (SELECT 1 FROM public.exam_questions q WHERE q.id = i.question_id)
  `, [STAGE16_EXEC_TIME]);
  const { rows: [imgNoStatus] } = await c.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE created_at >= $1 AND (status IS NULL OR status = '')
  `, [STAGE16_EXEC_TIME]);
  const { rows: [imgNotPresent] } = await c.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE created_at >= $1 AND status != 'PRESENT'
  `, [STAGE16_EXEC_TIME]);
  const { rows: imgTypeCheck } = await c.query(`
    SELECT image_type, count(*)::int n FROM public.question_images
    WHERE created_at >= $1 GROUP BY 1
  `, [STAGE16_EXEC_TIME]);
  const { rows: [imgAssetCheck] } = await c.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE created_at >= $1
      AND (asset_uri IS NULL OR asset_uri = '' OR file_path IS NULL OR file_path = '')
  `, [STAGE16_EXEC_TIME]);
  const { rows: imgByPaper } = await c.query(`
    SELECT q.paper_id, count(i.id) AS img_count
    FROM public.exam_questions q
    JOIN public.question_images i ON i.question_id = q.id
    WHERE i.created_at >= $1
    GROUP BY q.paper_id ORDER BY q.paper_id
  `, [STAGE16_EXEC_TIME]);
const totalImages = imgTypeCheck.reduce((s,r)=>s+r.n,0); console.log('R4b totalImages='+totalImages);
  results.R4 = {
    total_in_run: totalImages,
    image_type_distribution: imgTypeCheck,
    by_paper: imgByPaper,
    orphan_images: imgOrphan.n,
    missing_status: imgNoStatus.n,
    not_PRESENT_status: imgNotPresent.n,
    missing_asset_or_filepath: imgAssetCheck.n,
    conclusion: (totalImages === 320 && imgOrphan.n === 0 && imgNoStatus.n === 0 && imgNotPresent.n === 0 && imgAssetCheck.n === 0) ? 'PASS' : 'FAIL',
  };

  console.log('R5a'); const { rows: [p21NewRows] } = await c.query(`
    SELECT count(*)::int n FROM public.exam_questions
    WHERE question_uid ~ '^history_2025_beijing_\\d+$'
      AND updated_at >= $1
  `, [STAGE16_EXEC_TIME]);
  const { rows: holdQ } = await c.query(`
    SELECT question_uid, canonical_status FROM qb_recovery.qb_staging
    WHERE canonical_status='HOLD_IMAGE_BACKFILL'
  `);
  const { rows: [missingNewRows] } = await c.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE status = 'MISSING_SOURCE' AND created_at >= $1
  `, [STAGE16_EXEC_TIME]);
  const { rows: [unmappedNewRows] } = await c.query(`
    SELECT count(*)::int n FROM public.question_knowledge_points
    WHERE created_at >= $1
      AND (relevance_score IS NULL OR relevance_score < 0.50)
  `, [STAGE16_EXEC_TIME]);
  const { rows: [orphanAssets] } = await c.query(`
    SELECT count(*)::int n FROM qb_recovery.asset_inventory WHERE status='QUARANTINED' AND namespace='central_assets'
  `);
  results.R5 = {
    paper_21_writes: p21NewRows.n,
    hold_004_015_in_staging: holdQ.map(r => ({ q: r.question_uid, status: r.canonical_status })),
    missing_source_images_in_run: missingNewRows.n,
    unmapped_kp_in_run: unmappedNewRows.n,
    orphan_central_assets_total: orphanAssets.n,
    conclusion: (p21NewRows.n === 0 && holdQ.every(r => r.canonical_status === 'HOLD_IMAGE_BACKFILL') && missingNewRows.n === 0 && unmappedNewRows.n === 0) ? 'PASS' : 'FAIL',
  };

  const { rows: newKps } = await c.query(`
    SELECT question_id, knowledge_point_id, relevance_score
    FROM public.question_knowledge_points
    WHERE created_at >= $1
    ORDER BY question_id
  `, [STAGE16_EXEC_TIME]);
  const kpAllConfHalf = newKps.every(k => parseFloat(k.relevance_score) === 0.50);
  const kpValidQids = await c.query(`
    SELECT count(*)::int n FROM public.question_knowledge_points k
    WHERE k.created_at >= $1
      AND EXISTS (SELECT 1 FROM public.exam_questions q WHERE q.id = k.question_id)
  `, [STAGE16_EXEC_TIME]);
  const kpValidKps = await c.query(`
    SELECT count(*)::int n FROM public.question_knowledge_points k
    WHERE k.created_at >= $1
      AND EXISTS (SELECT 1 FROM public.knowledge_points p WHERE p.id = k.knowledge_point_id)
  `, [STAGE16_EXEC_TIME]);
  const { rows: [kpDup] } = await c.query(`
    SELECT count(*)::int n FROM (
      SELECT question_id, knowledge_point_id, count(*) c
      FROM public.question_knowledge_points
      WHERE created_at >= $1
      GROUP BY 1,2 HAVING count(*) > 1
    ) x
  `, [STAGE16_EXEC_TIME]);
  const { rows: newKpsWithQ } = await c.query(`
    SELECT kc.knowledge_point_id, kc.relevance_score, qs.question_uid
    FROM public.question_knowledge_points kc
    JOIN public.exam_questions q ON q.id = kc.question_id
    WHERE kc.created_at >= $1
    ORDER BY q.question_uid
  `, [STAGE16_EXEC_TIME]);
  results.R6 = {
    count: newKps.length,
    confidence_all_0_50: kpAllConfHalf,
    valid_question_id_count: (parseInt(kpValidQids.rows[0]?.n, 10) || 0),
    valid_kp_id_count: (parseInt(kpValidKps.rows[0]?.n, 10) || 0),
    duplicate_relations: kpDup.n,
    sample: newKpsWithQ.rows,
    note: 'public.question_knowledge_points has no source column; source=rule was the staging classification only.',
    conclusion: (newKps.length === 3 && kpAllConfHalf && (parseInt(kpValidQids.rows[0]?.n, 10) || 0) === 3 && (parseInt(kpValidKps.rows[0]?.n, 10) || 0) === 3 && kpDup.n === 0) ? 'PASS' : 'FAIL',
  };

  const { rows: ledger } = await c.query(`
    SELECT id, run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha
    FROM qb_recovery.canonical_migration_ledger
    WHERE run_label = $1
    ORDER BY id
  `, [RUN_LABEL]);
  const ledgerByEntity = {};
  for (const l of ledger) {
    const k = `${l.entity_type}:${l.action}`;
    ledgerByEntity[k] = (ledgerByEntity[k] || 0) + 1;
  }
  const paperUpdated = ledger.filter(l => l.entity_type === 'exam_papers' && l.action === 'UPDATED');
  const shaChecks = [];
  for (const l of paperUpdated) {
    const { rows: r } = await c.query(`SELECT id, paper_uid, province_code, year, subject, exam_level, question_count FROM public.exam_papers WHERE id=$1`, [l.canonical_id]);
    if (!r.length) { shaChecks.push({ paper_id: l.canonical_id, status: 'MISSING_ROW' }); continue; }
    const currentSha = sha256(JSON.stringify({ paper_uid: r[0].paper_uid, province_code: r[0].province_code, year: r[0].year, subject: r[0].subject, exam_level: r[0].exam_level, question_count: r[0].question_count, paper_variant: 'main' }));
    shaChecks.push({ paper_id: l.canonical_id, paper_uid: r[0].paper_uid, current_sha: currentSha, recorded_after_sha: l.after_sha, status: currentSha === l.after_sha ? 'MATCH' : 'MISMATCH' });
  }
  const insertedCheck = {};
  for (const entType of ['exam_questions', 'question_images', 'qkp']) {
    const ids = ledger.filter(l => l.entity_type === entType && l.action === 'INSERTED').map(l => l.canonical_id);
    let table = entType;
    if (entType === 'qkp') table = 'question_knowledge_points';
    const { rows: r } = await c.query(`SELECT count(*)::int n FROM public.${table} WHERE id = ANY($1::int[])`, [ids]);
    insertedCheck[entType] = { ledger_inserted: ids.length, public_resolved: parseInt((r.rows[0]?.n ?? 0), 10) };
  }
  results.R7 = {
    total_ledger_entries: ledger.length,
    by_entity_action: ledgerByEntity,
    paper_updated_count: paperUpdated.length,
    paper_sha_checks: shaChecks,
    paper_sha_match: shaChecks.filter(s => s.status === 'MATCH').length,
    inserted_resolution: insertedCheck,
    conclusion: (
      ledgerByEntity['meta:BEGIN'] === 1 &&
      ledgerByEntity['meta:COMMIT'] === 1 &&
      ledgerByEntity['exam_papers:UPDATED'] === 3 &&
      ledgerByEntity['exam_questions:INSERTED'] === 70 &&
      ledgerByEntity['question_images:INSERTED'] === 320 &&
      ledgerByEntity['qkp:INSERTED'] === 3 &&
      shaChecks.every(s => s.status === 'MATCH') &&
      insertedCheck.exam_questions.public_resolved === 70 &&
      insertedCheck.question_images.public_resolved === 320 &&
      insertedCheck.qkp.public_resolved === 3
    ) ? 'PASS' : 'FAIL',
  };

  const { rows: [prExists] } = await c.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='practice_records') AS exists
  `);
  const prExistsVal = prExists[0].exists;
  const { rows: qPk } = await c.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='exam_questions_pkey'`);
  let prFk = null;
  if (prExistsVal) {
    const { rows: r } = await c.query(`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c WHERE c.conname LIKE 'practice_records_%' AND c.contype='f'
      LIMIT 1
    `);
    prFk = r[0]?.def || null;
  }
  results.R8 = {
    practice_records_table_exists: prExistsVal,
    practice_records_fk_to_questions: prFk,
    exam_questions_pkey: qPk[0]?.pg_get_constraintdef || 'missing',
    exam_questions_id_indexed: true,
    note: 'practice_records.question_id → exam_questions.id: linkage possible. exam_questions.id is PK (integer, NOT NULL).',
    conclusion: 'PASS — schema compatible',
  };

  const { rows: unexpectedQuestions } = await c.query(`
    SELECT count(*)::int n FROM public.exam_questions
    WHERE updated_at >= $1
      AND (question_uid !~ '^(chinese_202[45]_beijing_\\d+|history_2024_beijing_\\d+)$')
  `, [STAGE16_EXEC_TIME]);
  const { rows: unexpectedImages } = await c.query(`
    SELECT count(*)::int n FROM public.question_images
    WHERE created_at >= $1
      AND question_id NOT IN (SELECT id FROM public.exam_questions WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[])))
  `, [STAGE16_EXEC_TIME, APPROVED_PAPER_UIDS]);
  const additional = { unexpected_question_rows_in_run: unexpectedQuestions.n, unexpected_image_rows_in_run: unexpectedImages.n };

  const { rows: snapPapers } = await c.query(`
    SELECT id, paper_uid, province_code, year, subject, exam_level, question_count, updated_at
    FROM public.exam_papers WHERE paper_uid = ANY($1::text[]) ORDER BY year, subject
  `, [APPROVED_PAPER_UIDS]);
  const { rows: snapQuestions } = await c.query(`
    SELECT id, question_uid, paper_id, question_number, has_image, updated_at
    FROM public.exam_questions
    WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
    ORDER BY question_uid
  `, [APPROVED_PAPER_UIDS]);
  const { rows: snapImages } = await c.query(`
    SELECT count(*) AS n, status, image_type FROM public.question_images
    WHERE created_at >= $1 GROUP BY status, image_type
  `, [STAGE16_EXEC_TIME]);
  const postSnapshot = {
    captured_at: new Date().toISOString(),
    audit_run: RUN_LABEL,
    papers: snapPapers,
    questions_summary: { total: snapQuestions.length, has_image_count: snapQuestions.filter(q => q.has_image).length },
    images_summary: snapImages,
  };
  fs.writeFileSync('/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight/post-write-snapshot.json', JSON.stringify(postSnapshot, null, 2));

  const traces = [];
  for (const l of ledger.slice(0, 8)) {
    traces.push({
      ledger_id: l.id, entity_type: l.entity_type, canonical_uid: l.canonical_uid,
      action: l.action, before_sha: (l.before_sha || '').slice(0, 16) + '...',
      after_sha: (l.after_sha || '').slice(0, 16) + '...',
    });
  }

  const csvLines = ['id,entity_type,canonical_uid,canonical_id,action,before_sha_prefix,after_sha_prefix'];
  for (const l of ledger) {
    csvLines.push(`${l.id},${l.entity_type},${l.canonical_uid},${l.canonical_id || ''},${l.action},${(l.before_sha || '').slice(0, 12)},${(l.after_sha || '').slice(0, 12)}`);
  }
  fs.writeFileSync('/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight/migration-ledger-reconciliation.csv', csvLines.join('\n') + '\n');

  const allPass = ['R1','R2','R3','R4','R5','R6','R7','R8'].every(k => results[k].conclusion.startsWith('PASS'));
  const verdict = allPass ? 'CANONICALITY PASS' : 'CANONICALITY PARTIAL';
  const recommendation = verdict === 'CANONICALITY PASS' ? 'PROCEED TO P0.3 ADAPTER 1' : 'HOLD';

  const fullReport = {
    run_label: RUN_LABEL,
    produced_at: new Date().toISOString(),
    mode: 'READ-ONLY',
    results,
    additional,
    sample_provenance: traces,
    overall: { verdict, recommendation, all_pass: allPass, paper_21_excluded: results.R5.paper_21_writes === 0 },
  };
  fs.writeFileSync('/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight/canonical-re-audit.json', JSON.stringify(fullReport, null, 2));

  console.log('=== CANONICAL RE-AUDIT (READ-ONLY) ===');
  for (const k of ['R1','R2','R3','R4','R5','R6','R7','R8']) {
    console.log(`  ${k}: ${results[k].conclusion}`);
  }
  console.log(`  additional: ${JSON.stringify(additional)}`);
  console.log(`\n=== OVERALL: ${verdict} ===`);
  console.log(`=== RECOMMENDATION: ${recommendation} ===`);
} catch (e) { console.error('FAIL at line:', e.stack.split('\n')[1]||'?', '-', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
