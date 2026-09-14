// scripts/qb2/stage11-preflight-rollback.mjs — DSH CANONICAL MIGRATION PREFLIGHT
// Generate inverse SQL: rollback of migration-plan.sql / question-plan.sql / image-plan.sql / kp-plan.sql
// NO public.* writes; SQL is generated for review only.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT_DIR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
const PLAN = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'migration-plan.json'), 'utf8'));

let sql = `-- ============================================
-- QB-TAR BATCH 01 v3 / CANONICAL MIGRATION PREFLIGHT
-- ROLLBACK PLAN (inverse of migration-plan.sql + question-plan.sql + image-plan.sql + kp-plan.sql)
-- Generated ${new Date().toISOString()}
-- Policy: DSH-STAGING; NO PRODUCTION WRITE
-- ============================================

BEGIN;

-- Rollback: delete only the 90 candidate records and 4 papers
-- Identified by: paper_uid IN (the 4 distinct uids) and question_uid IN (90)

-- 1) Delete KP links first (FK from public.question_knowledge_points -> exam_questions)
DELETE FROM public.question_knowledge_points
WHERE question_id IN (
  SELECT id FROM public.exam_questions
  WHERE question_uid IN (
    'PLACEHOLDER_QUESTION_UIDS'
  )
);

-- 2) Delete question_images (FK -> exam_questions)
DELETE FROM public.question_images
WHERE question_id IN (
  SELECT id FROM public.exam_questions
  WHERE question_uid IN (
    'PLACEHOLDER_QUESTION_UIDS'
  )
);

-- 3) Delete exam_questions
DELETE FROM public.exam_questions
WHERE question_uid IN (
  'PLACEHOLDER_QUESTION_UIDS'
);

-- 4) Delete exam_papers (only if no children remain)
DELETE FROM public.exam_papers
WHERE paper_uid IN (
  'PLACEHOLDER_PAPER_UIDS'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.exam_questions eq
    WHERE eq.paper_id = public.exam_papers.id
  );

COMMIT;
`;

const qUids = PLAN.candidate_rows.map(r => `'${r.question_uid.replace(/'/g, "''")}'`).join(',\n    ');
const pUids = PLAN.papers.map(p => `'${p.paper_uid}'`).join(', ');
sql = sql.replace("    'PLACEHOLDER_QUESTION_UIDS'", `    ${qUids}`);
sql = sql.replace("'PLACEHOLDER_PAPER_UIDS'", pUids);

fs.writeFileSync(path.join(OUT_DIR, 'rollback-plan.sql'), sql);

const sim = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'simulate-result.json'), 'utf8'));
const summary = {
  produced_at: new Date().toISOString(),
  migration_target: {
    papers: PLAN.papers.length,
    questions: PLAN.candidate_rows.length,
    images_PRESENT: sim.sim_images_inserted,
    kp_deterministic: sim.sim_kp_inserted,
  },
  rollback_scope: {
    papers_to_delete: PLAN.papers.length,
    questions_to_delete: PLAN.candidate_rows.length,
    images_to_delete: sim.sim_images_inserted,
    kp_to_delete: sim.sim_kp_inserted,
  },
  rollback_idempotent: 'yes (DELETE WHERE id IN (SELECT) pattern; safe to re-run)',
  verified_safe: sim.image_fk_failures === 0 && sim.kp_fk_failures === 0 && sim.question_orphan === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'rollback-summary.json'), JSON.stringify(summary, null, 2));

console.log('=== ROLLBACK PLAN GENERATED ===');
console.log(JSON.stringify(summary, null, 2));
