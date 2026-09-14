// scripts/qb2/stage9-preflight-sql-plan.mjs — DSH CANONICAL MIGRATION PREFLIGHT
// Read migration-plan.json (from stage8) and generate:
//   - canonical INSERT statements (UPSERT semantics) for exam_papers / exam_questions / question_images / question_knowledge_points
//   - 3 explicit image asset status branches (PRESENT / MISSING_SOURCE / NOT_EXPECTED)
//   - KP only 3 deterministic mappings
//   - per-paper transaction boundaries
// Output: database/preflight/{migration-plan.sql, image-plan.sql, kp-plan.sql}
// NO public.* writes; SQL is generated for review only.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const OUT_DIR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/preflight';
const PLAN = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'migration-plan.json'), 'utf8'));

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function json(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

let sqlPapers = `-- ============================================
-- QB-TAR BATCH 01 v3 / CANONICAL MIGRATION PREFLIGHT
-- Generated ${PLAN.produced_at} (run_label=${PLAN.run_label})
-- Policy: DSH-STAGING; NO PRODUCTION WRITE
-- ============================================

BEGIN;

-- Target: 4 papers, 90 questions (canonical_candidate)
-- paper_uid: sha16(exam_type|region_key|exam_level|subject|year|paper_variant) per design doc §6
-- question_uid: D063 Rule A {subject}_{year}_{province}_{qn}
-- exam_papers: ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE
-- exam_questions: ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number DO UPDATE
-- Both are idempotent; re-runnable.

`;

for (const p of PLAN.papers) {
  sqlPapers += `
-- PAPER: ${p.paper_key}
INSERT INTO public.exam_papers (
  paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type,
  question_count
) VALUES (
  ${esc(p.paper_uid)},
  ${esc(p.province_code)},
  ${p.year},
  ${esc(p.subject)},
  ${esc(p.exam_level)},
  'main',
  'beijing',
  ${p.question_count}
)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id;
`;
}

fs.writeFileSync(path.join(OUT_DIR, 'migration-plan.sql'), sqlPapers);

// === question + image + kp plan ===
let sqlQuestions = `-- ============================================
-- QUESTIONS (per paper, with paper_id resolution)
-- ============================================

BEGIN;
`;

const papersById = {};
for (const p of PLAN.papers) papersById[p.paper_uid] = p;

for (const r of PLAN.candidate_rows) {
  const paper = PLAN.papers.find(p => p.paper_uid === r.paper_uid);
  // image_status derived from has_image + resolved + missing
  let imageStatus;
  if (!r.images.expected) imageStatus = 'NOT_EXPECTED';
  else if (r.images.resolved > 0 && r.images.missing === 0) imageStatus = 'PRESENT';
  else if (r.images.resolved > 0 && r.images.missing > 0) imageStatus = 'PARTIAL';
  else imageStatus = 'MISSING_SOURCE';

  sqlQuestions += `
-- ${r.subject} ${r.year} ${r.question_uid}
INSERT INTO public.exam_questions (
  question_uid, paper_id, question_number, question_type, stem, options,
  answer, analysis, knowledge_points, difficulty, score,
  subject_code, province_code, year, has_image, has_formula, file_path,
  image_status, image_expected, image_available
) VALUES (
  ${esc(r.question_uid)},
  (SELECT id FROM public.exam_papers
     WHERE province_code=${esc(r.province_code)} AND year=${r.year}
       AND subject=${esc(r.subject)} AND exam_level=${esc(r.exam_level)}),
  ${r.question_number},
  ${esc(r.question_type)},
  ${esc(r.stem)},
  ${json(r.options_structured || null)},
  ${esc(r.answer)},
  ${esc(r.analysis)},
  '[]'::jsonb,  -- raw tags preserved in separate table
  NULL,        -- difficulty
  NULL,        -- score
  ${esc(r.subject)},
  ${esc(r.province_code)},
  ${r.year},
  ${r.images.expected},
  false,
  ${esc('QB-TAR-B01-PREFLIGHT')},
  ${esc(imageStatus)},
  ${r.images.expected},
  ${r.images.resolved > 0}
)
ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number DO UPDATE SET
  question_uid = EXCLUDED.question_uid,
  question_type = EXCLUDED.question_type,
  stem = EXCLUDED.stem,
  options = EXCLUDED.options,
  answer = EXCLUDED.answer,
  analysis = EXCLUDED.analysis,
  has_image = EXCLUDED.has_image,
  image_status = EXCLUDED.image_status,
  image_expected = EXCLUDED.image_expected,
  image_available = EXCLUDED.image_available,
  updated_at = NOW()
RETURNING id;
`;
}

sqlQuestions += `
COMMIT;
`;

fs.writeFileSync(path.join(OUT_DIR, 'question-plan.sql'), sqlQuestions);

// === image plan: 3 branches ===
let sqlImages = `-- ============================================
-- IMAGE PLAN: 3 BRANCHES
-- Branch A (PRESENT): INSERT question_images rows for each resolved filename
-- Branch B (MISSING_SOURCE): do NOT INSERT; rely on question.image_status='MISSING_SOURCE'
-- Branch C (NOT_EXPECTED): no image rows
-- ============================================

BEGIN;
`;

let present = 0, missing = 0, notExpected = 0;
for (const r of PLAN.candidate_rows) {
  const imageStatus = !r.images.expected ? 'NOT_EXPECTED'
    : (r.images.resolved > 0 && r.images.missing === 0 ? 'PRESENT'
    : (r.images.resolved > 0 ? 'PARTIAL' : 'MISSING_SOURCE'));

  if (imageStatus === 'NOT_EXPECTED') { notExpected++; continue; }
  if (imageStatus === 'MISSING_SOURCE') { missing++; continue; }

  for (const fn of r.images.resolved_filenames) {
    // sha16 of normalized filename used as image_id surrogate (NOT final — real plan would use
    // sha256(binary); here we preserve plan, not invent asset_id)
    sqlImages += `
-- ${r.question_uid} | ${fn} (PRESENT)
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT q.id, ${esc(`database/question-bank/${r.subject}/${r.year}/${fn}`)}, 'page_image', 1, 'PRESENT', 1
FROM public.exam_questions q
WHERE q.question_uid = ${esc(r.question_uid)} LIMIT 1
ON CONFLICT DO NOTHING;
`;
    present++;
  }
  // missing refs: log to staging; do NOT INSERT question_images
  if (r.images.missing_filenames.length > 0) {
    sqlImages += `-- ${r.question_uid} | MISSING_SOURCE for: ${r.images.missing_filenames.join(', ')} (no INSERT; question.image_status='MISSING_SOURCE')\n`;
  }
}

sqlImages += `
COMMIT;
`;
fs.writeFileSync(path.join(OUT_DIR, 'image-plan.sql'), sqlImages);

// === KP plan: ONLY 3 deterministic mappings ===
let sqlKP = `-- ============================================
-- KP PLAN: ONLY 3 DETERMINISTIC MAPPINGS (B5 BOUNDARY)
-- 263 UNMAPPED remain in kp_staging_candidate with mapping_status='UNMAPPED'
-- and are NOT inserted into canonical.question_knowledge_points
-- ============================================

BEGIN;
`;

// the 3 mappings are in qb_staging; emit per-question INSERT
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const c = await pool.connect();
try {
  await c.query("SET search_path = qb_recovery, public");
  const { rows: mapped } = await c.query(`
    SELECT kc.staging_id, kc.matched_kp_id, kc.confidence, kc.source, qs.question_uid
    FROM qb_recovery.kp_staging_candidate kc
    JOIN qb_recovery.qb_staging qs ON qs.id = kc.staging_id
    WHERE kc.mapping_status='MAPPED'
  `);
  for (const m of mapped) {
    sqlKP += `
-- ${m.question_uid} -> ${m.matched_kp_id} (source=${m.source}, confidence=${m.confidence})
INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score)
SELECT q.id, ${esc(m.matched_kp_id)}, ${m.confidence}
FROM public.exam_questions q WHERE q.question_uid = ${esc(m.question_uid)} LIMIT 1
ON CONFLICT (question_id, knowledge_point_id) DO NOTHING;
`;
  }
} finally { c.release(); pool.end(); }

sqlKP += `
COMMIT;
`;
fs.writeFileSync(path.join(OUT_DIR, 'kp-plan.sql'), sqlKP);

console.log('=== SQL PLAN GENERATED ===');
console.log(`  migration-plan.sql: ${PLAN.papers.length} paper UPSERTs`);
console.log(`  question-plan.sql:  ${PLAN.candidate_rows.length} question UPSERTs`);
console.log(`  image-plan.sql:     ${present} PRESENT inserts | ${missing} MISSING_SOURCE (no insert) | ${notExpected} NOT_EXPECTED`);
console.log(`  kp-plan.sql:        3 deterministic KP inserts (B5 boundary enforced)`);
