// scripts/qb2/stage5-kp-candidate.mjs — DSH STAGING ONLY (REPAIR v2)
// P1-D: explicit lineage metric: source_questions_with_kp + total_candidates + ratio
// confidence 0.50 only, source='rule', never 'official'
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const TAR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database.tar';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-recovery-'));
execSync(`tar -xf "${TAR}" -C "${work}" 2>/dev/null || true`);

function norm(s) {
  return String(s ?? '').replace(/\s+/g, '').replace(/第/g,'').replace(/章/g,'').replace(/节/g,'').toLowerCase();
}
function flattenSubtopic(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(flattenSubtopic).join(' ');
  if (typeof x === 'object') return [x.name, x.title, x.subtopic, x.label].filter(Boolean).join(' ');
  return '';
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");
  const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE5';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage5', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;

  await client.query('TRUNCATE qb_recovery.kp_staging_candidate RESTART IDENTITY');

  // Build gaokao knowledge_points index (READ ONLY public table)
  const { rows: nodes } = await client.query(`
    SELECT id, subject, name, COALESCE(subtopics, '[]') AS subtopics
    FROM public.knowledge_points WHERE level='gaokao'
  `);
  const idx = new Map();
  for (const n of nodes) {
    if (!idx.has(n.subject)) idx.set(n.subject, []);
    let subs = [];
    try { subs = JSON.parse(n.subtopics); if (!Array.isArray(subs)) subs=[]; } catch {}
    idx.get(n.subject).push({ id: n.id, name: n.name, subs });
  }
  for (const list of idx.values()) list.sort((a,b) => a.id.localeCompare(b.id));

  function matchTag(subject, tag) {
    const ns = idx.get(subject) || []; if (!tag) return null;
    const t = String(tag).trim(); if (!t) return null;
    const tn = norm(t);
    for (const n of ns) if (n.name === t) return { id: n.id, how: 'exact' };
    for (const n of ns) if (tn && norm(n.name) === tn) return { id: n.id, how: 'norm' };
    for (const n of ns) {
      const blob = norm(`${n.name} ${n.subs.map(flattenSubtopic).join(' ')}`);
      const kws = [n.name, ...n.subs.map(flattenSubtopic)].map(norm).filter(k => k.length >= 2);
      if (tn && (blob.includes(tn) || kws.some(k => tn.includes(k)))) return { id: n.id, how: 'substring' };
    }
    return null;
  }

  // P1-D lineage metric: count source questions with at least 1 KP tag (before expansion)
  const { rows: sourceRows } = await client.query(`
    SELECT id, subject, knowledge_points_raw
    FROM qb_recovery.qb_staging
    WHERE knowledge_points_raw IS NOT NULL AND jsonb_array_length(knowledge_points_raw) > 0
  `);
  const sourceQuestionsWithKp = sourceRows.length;
  const { rows: noKp } = await client.query(`
    SELECT count(*)::int n FROM qb_recovery.qb_staging
    WHERE knowledge_points_raw IS NULL OR jsonb_array_length(knowledge_points_raw) = 0
  `);

  let totalCandidates = 0, mapped = 0, unmapped = 0;
  for (const s of sourceRows) {
    for (const tag of s.knowledge_points_raw) {
      totalCandidates++;
      const hit = matchTag(s.subject, tag);
      if (hit) {
        mapped++;
        await client.query(`
          INSERT INTO qb_recovery.kp_staging_candidate
            (staging_id, raw_tag, raw_match_how, matched_kp_id, mapping_status, confidence, source, reason)
          VALUES ($1,$2,$3,$4,'MAPPED',0.50,'rule','deterministic exact/norm/substring match; awaiting acceptance criteria')
        `, [s.id, tag, hit.how, hit.id]);
      } else {
        unmapped++;
        await client.query(`
          INSERT INTO qb_recovery.kp_staging_candidate
            (staging_id, raw_tag, mapping_status, source, reason)
          VALUES ($1,$2,'UNMAPPED','rule','no deterministic match in gaokao knowledge_points taxonomy')
        `, [s.id, tag]);
      }
    }
  }
  // Demote multi-target collisions
  await client.query(`
    UPDATE qb_recovery.kp_staging_candidate k
    SET mapping_status='REVIEW_REQUIRED',
        reason = k.reason || '; multi-target collision (same tag maps to >1 kp_id)'
    WHERE k.mapping_status='MAPPED' AND k.raw_tag IN (
      SELECT raw_tag FROM qb_recovery.kp_staging_candidate
      WHERE mapping_status='MAPPED' GROUP BY raw_tag HAVING COUNT(DISTINCT matched_kp_id) > 1
    )
  `);
  const { rows: review } = await client.query(`SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='REVIEW_REQUIRED'`);
  const { rows: mappedAfter } = await client.query(`SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='MAPPED'`);
  const { rows: unmappedAfter } = await client.query(`SELECT count(*)::int n FROM qb_recovery.kp_staging_candidate WHERE mapping_status='UNMAPPED'`);
  mapped = mappedAfter[0].n; unmapped = unmappedAfter[0].n;
  const reviewCount = review[0].n;

  console.log(`[kp_lineage]`);
  console.log(`  source_questions_with_kp: ${sourceQuestionsWithKp}  (each row expands to 1..N candidates)`);
  console.log(`  no_kp_questions:           ${noKp[0].n}`);
  console.log(`  expansion_ratio:           ${totalCandidates}/${sourceQuestionsWithKp} = ${(totalCandidates/Math.max(sourceQuestionsWithKp,1)).toFixed(2)} candidates per source`);
  console.log(`[kp_status] mapped=${mapped} unmapped=${unmapped} review_required=${reviewCount} total=${totalCandidates}`);

  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await client.query('COMMIT');
} catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { client.release(); pool.end(); }
