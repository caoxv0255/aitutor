// scripts/qb2/stage14-paper21-reconciliation.mjs — DSH RECONCILIATION-ONLY
// paper_uid = 299a49bf489ab027 (history 2025 Beijing Gaokao)
// All work: READ-ONLY. No DELETE/UPDATE/INSERT on public.*.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
const c = await (async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return await p.connect();
})();

try {
  // --- R1+R2: enumerate ---
  const { rows: pubRows } = await c.query(`
    SELECT id, question_uid, question_number, question_type, length(stem) stem_len,
           has_image, image_status, image_expected, image_available,
           encode(sha256(convert_to(stem,'UTF8')),'hex') AS stem_sha,
           encode(sha256(convert_to(COALESCE(answer,''),'UTF8')),'hex') AS ans_sha,
           encode(sha256(convert_to(COALESCE(options,''),'UTF8')),'hex') AS opt_sha
    FROM public.exam_questions
    WHERE paper_id = 21
    ORDER BY question_number
  `);
  const { rows: stgRows } = await c.query(`
    SELECT id, question_uid, question_number, canonical_status, canonical_ready_step,
           has_image_meta, length(stem_text) stem_len,
           encode(sha256(convert_to(stem_text,'UTF8')),'hex') AS stem_sha,
           encode(sha256(convert_to(COALESCE(answer_raw,''),'UTF8')),'hex') AS ans_sha,
           encode(sha256(convert_to(COALESCE(options_raw::text,''),'UTF8')),'hex') AS opt_sha,
           jsonb_array_length(images_raw) AS img_refs
    FROM qb_recovery.qb_staging
    WHERE subject='history' AND year=2025
    ORDER BY question_number
  `);

  console.log('R1: public.exam_questions paper_id=21 →', pubRows.length);
  console.log('R2: staging history/2025 →', stgRows.length);

  // --- R3+R5: build per-qn pair + classification ---
  const pubByQn = new Map(pubRows.map(r => [r.question_number, r]));
  const stgByQn = new Map(stgRows.map(r => [r.question_number, r]));
  const pairs = [];
  for (const [qn, pub] of pubByQn) {
    const stg = stgByQn.get(qn);
    let cls;
    let notes = [];
    if (!stg) {
      cls = 'LEGACY_ONLY';
      notes.push('no staging source for this question_number');
    } else {
      // canonical_uid equivalence (zero-pad normalized)
      const pubUidCanon = pub.question_uid.replace(/_beijing_(\d+)$/, (_, n) => `_beijing_${n.padStart(3,'0')}`);
      const stem_match = pub.stem_sha === stg.stem_sha;
      const ans_match = pub.ans_sha === stg.ans_sha;
      const opt_match = pub.opt_sha === stg.opt_sha;
      const uid_match = pubUidCanon === stg.question_uid;
      const image_match = (pub.has_image === false) && (stg.has_image_meta === true);
      if (uid_match && stem_match && ans_match && opt_match) {
        cls = 'EXACT_MATCH';
      } else if (uid_match && stem_match) {
        cls = 'SAFE_UPDATE';  // minor answer/option difference
      } else if (uid_match) {
        cls = 'CONFLICT';  // same qn, different content
        notes.push(`stem_diff=${!stem_match} ans_diff=${!ans_match} opt_diff=${!opt_match}`);
      } else {
        cls = 'CONFLICT';
        notes.push(`uid_literal_diff pub=${pub.question_uid} stg=${stg.question_uid}`);
      }
    }
    pairs.push({
      question_number: qn,
      public: pub ? {
        id: pub.id,
        question_uid: pub.question_uid,
        has_image: pub.has_image,
        image_status: pub.image_status,
        stem_sha: pub.stem_sha,
        ans_sha: pub.ans_sha,
        opt_sha: pub.opt_sha,
      } : null,
      staging: stg ? {
        id: stg.id,
        question_uid: stg.question_uid,
        canonical_status: stg.canonical_status,
        canonical_ready_step: stg.canonical_ready_step,
        has_image_meta: stg.has_image_meta,
        img_refs: stg.img_refs,
        stem_sha: stg.stem_sha,
        ans_sha: stg.ans_sha,
        opt_sha: stg.opt_sha,
      } : null,
      classification: cls,
      notes: notes.join('; '),
    });
  }
  // staging-only qn (rare but check)
  for (const [qn, stg] of stgByQn) {
    if (!pubByQn.has(qn)) {
      pairs.push({ question_number: qn, public: null, staging: stg, classification: 'STAGING_ONLY', notes: 'no existing public row' });
    }
  }
  pairs.sort((a, b) => a.question_number - b.question_number);

  // --- R4: check if 004/015 HELD already exist in public ---
  const heldInPublic = pairs.filter(p => p.staging && p.staging.canonical_status === 'HOLD_IMAGE_BACKFILL')
    .map(p => ({ qn: p.question_number, public_id: p.public ? p.public.id : null, public_uid: p.public ? p.public.question_uid : null }));

  // --- R6: image state per pair ---
  function imageState(pair) {
    if (!pair.staging) return 'NOT_EXPECTED';
    if (pair.staging.canonical_status === 'HOLD_IMAGE_BACKFILL') return 'IMAGE_BLOCKED';
    if (!pair.staging.has_image_meta) return 'NOT_EXPECTED';
    if (pair.staging.img_refs === 0) return 'IMAGE_BLOCKED_NO_REFS';
    return 'IMAGE_BACKFILLABLE';
  }
  const imageStates = pairs.map(p => ({
    question_number: p.question_number,
    public_uid: p.public ? p.public.question_uid : null,
    staging_uid: p.staging ? p.staging.question_uid : null,
    classification: p.classification,
    image_state: imageState(p),
  }));

  // --- R7: declared vs existing vs staging ---
  const { rows: dr } = await c.query(`SELECT question_count::int AS declared FROM public.exam_papers WHERE id=21`);
  const declared = dr[0]?.declared ?? null;
  const r7 = {
    declared_question_count: declared,
    existing_child_count: pubRows.length,
    staging_identity_count: stgRows.length,
    eligible_count: stgRows.filter(r => r.canonical_status === 'ACCEPTED' && r.canonical_ready_step === 'canonical_candidate').length,
    held_count: stgRows.filter(r => r.canonical_status === 'HOLD_IMAGE_BACKFILL').length,
  };
  r7.diff = {
    declared_vs_existing: declared - pubRows.length,
    declared_vs_staging: declared - stgRows.length,
    declared_vs_eligible: declared - r7.eligible_count,
    existing_vs_staging: pubRows.length - stgRows.length,
  };

  // --- R5 tallies ---
  const r5 = pairs.reduce((acc, p) => { acc[p.classification] = (acc[p.classification] || 0) + 1; return acc; }, {});
  const r6 = imageStates.reduce((acc, p) => { acc[p.image_state] = (acc[p.image_state] || 0) + 1; return acc; }, {});

  // --- recommendation per pair ---
  const recs = pairs.map(p => {
    if (p.classification === 'EXACT_MATCH') return { qn: p.question_number, rec: 'KEEP' };
    if (p.classification === 'SAFE_UPDATE') return { qn: p.question_number, rec: 'SAFE_UPDATE' };
    if (p.classification === 'LEGACY_ONLY') return { qn: p.question_number, rec: 'CONFLICT' };
    if (p.classification === 'STAGING_ONLY') return { qn: p.question_number, rec: 'CONFLICT' };
    if (p.classification === 'CONFLICT') {
      if (p.staging && p.staging.canonical_status === 'HOLD_IMAGE_BACKFILL') {
        return { qn: p.question_number, rec: 'HOLD' };
      }
      return { qn: p.question_number, rec: 'CONFLICT' };
    }
    return { qn: p.question_number, rec: 'CONFLICT' };
  });
  const recTallies = recs.reduce((a, r) => { a[r.rec] = (a[r.rec] || 0) + 1; return a; }, {});

  const report = {
    produced_at: new Date().toISOString(),
    paper_uid: '299a49bf489ab027',
    paper_key: 'history|2025|beijing|gaokao',
    r1_public_count: pubRows.length,
    r2_staging_count: stgRows.length,
    r4_held_in_public: heldInPublic,
    r5_classification: r5,
    r6_image_state: r6,
    r7_reconciliation: r7,
    recommendations: recTallies,
    pairs,
    image_states: imageStates,
  };
  fs.writeFileSync(path.join(OUT, 'p21-reconciliation.json'), JSON.stringify(report, null, 2));

  // CSV: public vs staging map
  const csvLines = ['question_number,public_id,public_uid,public_stem_sha,public_ans_sha,public_opt_sha,public_has_image,staging_id,staging_uid,staging_canonical_status,staging_stem_sha,staging_ans_sha,staging_opt_sha,staging_has_image_meta,staging_img_refs,classification,image_state,recommendation,notes'];
  for (const p of pairs) {
    const rec = recs.find(r => r.qn === p.question_number);
    csvLines.push([
      p.question_number,
      p.public ? p.public.id : '',
      p.public ? p.public.question_uid : '',
      p.public ? p.public.stem_sha : '',
      p.public ? p.public.ans_sha : '',
      p.public ? p.public.opt_sha : '',
      p.public ? p.public.has_image : '',
      p.staging ? p.staging.id : '',
      p.staging ? p.staging.question_uid : '',
      p.staging ? p.staging.canonical_status : '',
      p.staging ? p.staging.stem_sha : '',
      p.staging ? p.staging.ans_sha : '',
      p.staging ? p.staging.opt_sha : '',
      p.staging ? p.staging.has_image_meta : '',
      p.staging ? p.staging.img_refs : '',
      p.classification,
      imageState(p),
      rec ? rec.rec : '',
      (p.notes || '').replace(/,/g, ';'),
    ].map(v => String(v)).join(','));
  }
  fs.writeFileSync(path.join(OUT, 'p21-public-vs-staging-map.csv'), csvLines.join('\n') + '\n');

  // also write a run record (for provenance)
  const { rows: [r] } = await c.query(`
    INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
    VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE14', 'stage14', 'QB-TAR-BATCH-01', 'RUNNING')
    RETURNING run_label
  `);
  const runLabel = r.run_label;
  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);

  // console summary
  console.log('R5 classification:', r5);
  console.log('R6 image state  :', r6);
  console.log('R7 reconcile    :', r7);
  console.log('Recommendations :', recTallies);
  console.log('HELD in public  :', JSON.stringify(heldInPublic));
  console.log(`run_label: ${runLabel}`);
} catch (e) { console.error('FAIL:', e); process.exit(1); }
finally { (await c).release?.(); }
