// scripts/qb2/stage10-preflight-simulate.mjs — DSH CANONICAL MIGRATION PREFLIGHT
// Apply the SQL plan to staging simulation tables (sim_papers / sim_questions / sim_question_images / sim_question_knowledge_points)
// Validate: 0 FK failures, 0 duplicates, all 90 questions map to a paper
// NO public.* writes.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT_DIR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
const PLAN = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'migration-plan.json'), 'utf8'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query("SET search_path = qb_recovery, public");
  // truncate
  await c.query('TRUNCATE qb_recovery.sim_question_knowledge_points, qb_recovery.sim_question_images, qb_recovery.sim_questions, qb_recovery.sim_papers RESTART IDENTITY CASCADE');

  // register run
  const { rows: [r] } = await c.query(`
    INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
    VALUES ('QB-TAR-20260904-B01', 'QB-TAR-20260904-B01-' || EXTRACT(EPOCH FROM NOW())::bigint::text || '-STAGE10', 'stage10', 'QB-TAR-BATCH-01', 'RUNNING')
    RETURNING run_label
  `);
  const runLabel = r.run_label;

  // 1) insert papers
  for (const p of PLAN.papers) {
    await c.query(`
      INSERT INTO qb_recovery.sim_papers (paper_uid, province_code, year, subject, exam_level, paper_variant)
      VALUES ($1,$2,$3,$4,$5,'main')
    `, [p.paper_uid, p.province_code, p.year, p.subject, p.exam_level]);
  }

  // build paper_id map
  const { rows: paperRows } = await c.query('SELECT id, paper_uid FROM qb_recovery.sim_papers');
  const paperIdByUid = new Map(paperRows.map(r => [r.paper_uid, r.id]));

  // 2) insert questions
  let qInserted = 0, qDups = 0;
  for (const r of PLAN.candidate_rows) {
    const paperId = paperIdByUid.get(r.paper_uid);
    if (!paperId) {
      console.error(`FK FAIL: question ${r.question_uid} -> paper ${r.paper_uid} not found`);
      continue;
    }
    let imageStatus;
    if (!r.images.expected) imageStatus = 'NOT_EXPECTED';
    else if (r.images.resolved > 0 && r.images.missing === 0) imageStatus = 'PRESENT';
    else if (r.images.resolved > 0) imageStatus = 'PARTIAL';
    else imageStatus = 'MISSING_SOURCE';

    const { rowCount } = await c.query(`
      INSERT INTO qb_recovery.sim_questions
        (question_uid, paper_id, question_number, question_type, stem, image_status, image_expected, image_available)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (paper_id, question_number) DO NOTHING
    `, [r.question_uid, paperId, r.question_number, r.question_type, r.stem || '', imageStatus, r.images.expected, r.images.resolved > 0]);
    if (rowCount === 1) qInserted++; else qDups++;
  }

  // build question_id map
  const { rows: qRows } = await c.query('SELECT id, question_uid FROM qb_recovery.sim_questions');
  const qIdByUid = new Map(qRows.map(r => [r.question_uid, r.id]));

  // 3) insert images (PRESENT only)
  let imgInserted = 0, imgFkFail = 0;
  for (const r of PLAN.candidate_rows) {
    for (const fn of r.images.resolved_filenames) {
      const qid = qIdByUid.get(r.question_uid);
      if (!qid) { imgFkFail++; continue; }
      await c.query(`
        INSERT INTO qb_recovery.sim_question_images (question_id, asset_uri, status)
        VALUES ($1, $2, 'PRESENT')
        ON CONFLICT DO NOTHING
      `, [qid, `database/question-bank/${r.subject}/${r.year}/${fn}`]);
      imgInserted++;
    }
  }

  // 4) insert KP (3 deterministic only)
  const { rows: mapped } = await c.query(`
    SELECT kc.staging_id, kc.matched_kp_id, qs.question_uid
    FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id = kc.staging_id
    WHERE kc.mapping_status='MAPPED'
  `);
  let kpInserted = 0, kpFkFail = 0;
  for (const m of mapped) {
    const qid = qIdByUid.get(m.question_uid);
    if (!qid) { kpFkFail++; continue; }
    await c.query(`
      INSERT INTO qb_recovery.sim_question_knowledge_points (question_id, knowledge_point_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [qid, m.matched_kp_id]);
    kpInserted++;
  }

  // === validation report ===
  const { rows: [{ npaper }] } = await c.query('SELECT count(*)::int npaper FROM qb_recovery.sim_papers');
  const { rows: [{ nq }] } = await c.query('SELECT count(*)::int nq FROM qb_recovery.sim_questions');
  const { rows: [{ nq_distinct }] } = await c.query('SELECT count(DISTINCT question_uid)::int nq_distinct FROM qb_recovery.sim_questions');
  const { rows: [{ nq_dup }] } = await c.query('SELECT count(*)::int nq_dup FROM (SELECT paper_id, question_number FROM qb_recovery.sim_questions GROUP BY 1,2 HAVING count(*)>1) x');
  const { rows: [{ npaper_distinct }] } = await c.query('SELECT count(DISTINCT paper_uid)::int npaper_distinct FROM qb_recovery.sim_papers');
  const { rows: [{ npaper_dup }] } = await c.query('SELECT count(*)::int npaper_dup FROM (SELECT province_code, year, subject, exam_level FROM qb_recovery.sim_papers GROUP BY 1,2,3,4 HAVING count(*)>1) x');
  const { rows: [{ nimg }] } = await c.query('SELECT count(*)::int nimg FROM qb_recovery.sim_question_images');
  const { rows: [{ nkp }] } = await c.query('SELECT count(*)::int nkp FROM qb_recovery.sim_question_knowledge_points');
  const { rows: [{ nimg_fk }] } = await c.query(`
    SELECT count(*)::int nimg_fk FROM qb_recovery.sim_question_images i
    WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.sim_questions q WHERE q.id = i.question_id)
  `);
  const { rows: [{ nkp_fk }] } = await c.query(`
    SELECT count(*)::int nkp_fk FROM qb_recovery.sim_question_knowledge_points k
    WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.sim_questions q WHERE q.id = k.question_id)
  `);
  const { rows: [{ nq_orphan }] } = await c.query(`
    SELECT count(*)::int nq_orphan FROM qb_recovery.sim_questions q
    WHERE NOT EXISTS (SELECT 1 FROM qb_recovery.sim_papers p WHERE p.id = q.paper_id)
  `);

  await c.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLELED' WHERE run_label=$1`, [runLabel]);
  await c.query('COMMIT');

  const sim = {
    run_label: runLabel,
    sim_papers: npaper,
    sim_questions: nq,
    sim_distinct_question_uids: nq_distinct,
    sim_distinct_paper_uids: npaper_distinct,
    duplicate_question_uid: nq_dup,
    duplicate_paper_uid: npaper_dup,
    question_orphan: nq_orphan,
    sim_images_inserted: nimg,
    sim_kp_inserted: nkp,
    image_fk_failures: nimg_fk,
    kp_fk_failures: nkp_fk,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'simulate-result.json'), JSON.stringify(sim, null, 2));

  console.log('=== SIMULATION RESULT ===');
  for (const [k, v] of Object.entries(sim)) {
    console.log(`  ${k.padEnd(34)} ${String(v).padStart(6)}`);
  }
} catch (e) { await c.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); pool.end(); }
