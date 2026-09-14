import fs from 'node:fs';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const APPROVED_PAPER_UIDS = ['b4ab624a4e7460d8', '35dccaaf93229ff4', '99e1a3bc2dd808ff'];
const APPROVED_KEYS = [['chinese', 2024, 'b4ab624a4e7460d8'], ['chinese', 2025, '35dccaaf93229ff4'], ['history', 2024, '99e1a3bc2dd808ff']];

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
const report = {};

try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");
  const runLabel = `QB-TAR-B01-S19-${Date.now().toString().slice(-10)}`;
  console.log(`[run] ${runLabel}`);

  const { rows: pre70 } = await c.query(`
    SELECT image_status, image_expected, image_available, count(*) c
    FROM public.exam_questions q
    WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[]))
    GROUP BY 1,2,3 ORDER BY 1,2,3
  `, [APPROVED_PAPER_UIDS]);
  console.log('[pre] image flags on 70 questions:');
  for (const r of pre70) console.log(`  ${r.image_status} / exp=${r.image_expected} / avail=${r.image_available} : ${r.c}`);

  await c.query(`INSERT INTO qb_recovery.canonical_migration_ledger (run_label, entity_type, action, detail) VALUES ($1, 'meta', 'BEGIN', $2)`,
    [runLabel, JSON.stringify({ policy: 'STAGE19 REPAIR: image_flags' })]);

  const { rows: cands } = await c.query(`
    SELECT id, question_uid, subject, year, question_number, has_image_meta
    FROM qb_recovery.qb_staging
    WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
      AND ((subject='chinese' AND year IN (2024,2025)) OR (subject='history' AND year=2024))
  `);
  console.log('[debug] cands count =', cands.length);

  let qUpdated = 0, qUnchanged = 0, qFailed = 0;
  for (const r of cands) {
    const lookup = APPROVED_KEYS.find(k => k[0] === r.subject && k[1] === r.year);
    if (!lookup) continue;
    const { rows: paperRes } = await c.query(`SELECT id FROM public.exam_papers WHERE paper_uid=$1`, [lookup[2]]);
    const paperId = paperRes[0]?.id;
    if (!paperId) continue;
    const { rows: existing } = await c.query(`SELECT id, image_status, image_expected, image_available FROM public.exam_questions WHERE paper_id=$1 AND question_number=$2`, [paperId, r.question_number]);
    const ex = existing[0];
    if (!ex) continue;

    const hasImage = r.has_image_meta === true;
    const imageStatus = hasImage ? 'BACKFILL_PENDING' : 'NOT_EXPECTED';
    const expected = hasImage;
    const available = hasImage;
    const beforeSha = sha256(JSON.stringify({ image_status: ex.image_status, image_expected: ex.image_expected, image_available: ex.image_available }));
    let updRows;
    try {
      const result = await c.query(`UPDATE public.exam_questions SET image_status = $1, image_expected = $2, image_available = $3 WHERE id = $4 RETURNING (xmax = 0) AS no_op`, [imageStatus, expected, available, ex.id]);
      updRows = result.rows;
    } catch (e) {
      console.error(`FAIL q=${r.question_uid} ex.image_status=${ex.image_status} new.image_status=${imageStatus} subj=${r.subject} year=${r.year} qn=${r.question_number} ex_id=${ex.id} - ${e.message}`);
      qFailed++;
      throw e;
    }
    const afterSha = sha256(JSON.stringify({ image_status: imageStatus, image_expected: expected, image_available: available }));
    const action = (updRows[0]?.no_op === true || beforeSha === afterSha) ? 'UNCHANGED' : 'UPDATED';
    if (action === 'UPDATED') qUpdated++; else qUnchanged++;
    await c.query(`INSERT INTO qb_recovery.canonical_migration_ledger (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail) VALUES ($1, 'q_image_flags', $2, $3, $4, $5, $6, $7)`,
      [runLabel, r.question_uid, ex.id, action, beforeSha, afterSha, JSON.stringify({ repair: 'image_flags from 018' })]);
  }
  console.log(`[step questions] updated=${qUpdated} unchanged=${qUnchanged} failed=${qFailed}`);

  const { rows: post70 } = await c.query(`SELECT image_status, count(*) c FROM public.exam_questions q WHERE paper_id IN (SELECT id FROM public.exam_papers WHERE paper_uid = ANY($1::text[])) GROUP BY 1`, [APPROVED_PAPER_UIDS]);
  console.log('[post] image_status on 70 questions:');
  for (const r of post70) console.log(`  ${r.image_status} : ${r.c}`);

  await c.query(`INSERT INTO qb_recovery.canonical_migration_ledger (run_label, entity_type, action, detail) VALUES ($1, 'meta', 'COMMIT', $2)`,
    [runLabel, JSON.stringify({ committed_at: new Date().toISOString() })]);
  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await c.query('COMMIT');

  report.run_label = runLabel;
  report.q_updated = qUpdated;
  report.q_unchanged = qUnchanged;
  report.q_failed = qFailed;
  report.pre_70 = pre70;
  report.post_70 = post70;
  fs.writeFileSync('/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight/stage19-repair-result.json', JSON.stringify(report, null, 2));
  console.log('=== REPAIR DONE ===');
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
