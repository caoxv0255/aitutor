import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();

// ===orphan checks (FK is enforced? schema declares but is implementation ready?)==
console.log('=== Does production enforce FK? (current state) ===');
const fkEnforce = await c.query(`SELECT conname, conrelid::regclass AS tbl, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype='f' AND conrelid IN ('wrong_questions'::regclass, 'practice_records'::regclass, 'rag_questions'::regclass)`);
for (const r of fkEnforce.rows) console.log('  ',JSON.stringify(r));

// === real orphan check: any practice_records.question_id points to non-existent exam_questions? ===
console.log('\n===Orphan check: practice_records.question_id (no FK declared, so trivially OK) ===');
// FK NOT declared on practice_records.question_id, so no DB-enforced integrity
// But we can manually check: any value > 0 not in exam_questions.id ?
const orphans = await c.query(`
  SELECT pr.id, pr.user_email, pr.question_id
  FROM practice_records pr
  LEFT JOIN exam_questions eq ON pr.question_id = eq.id
  WHERE pr.question_id IS NOT NULL AND eq.id IS NULL
  LIMIT 5`);
console.log('  orphan rows:', orphans.rows.length, '(expect 0 since pr empty)');
if (orphans.rows.length) for (const r of orphans.rows) console.log('   ',JSON.stringify(r));

// === real orphan check: wrong_questions.knowledge_point_id vs knowledge_points.id ===
console.log('\n===Orphan KP: wrong_questions.knowledge_point_id vs knowledge_points.id ===');
const kpOrphans = await c.query(`
  SELECT wq.id, wq.user_email, wq.knowledge_point_id, wq.knowledge_point_name, wq.subject_code
  FROM wrong_questions wq
  LEFT JOIN knowledge_points kp ON wq.knowledge_point_id = kp.id
  WHERE wq.knowledge_point_id IS NOT NULL AND kp.id IS NULL
  LIMIT 5`);
console.log('  rows with non-existent KP id:', kpOrphans.rows.length, '(0 if FK concept is loose)');
if (kpOrphans.rows.length) for (const r of kpOrphans.rows) console.log('   ',JSON.stringify(r));

// === real orphan check: wrong_questions.question_id vs exam_questions.id (both empty here) ===
console.log('\n===Orphan Q: wrong_questions.question_id vs exam_questions.id ===');
const qOrphans = await c.query(`
  SELECT wq.id, wq.user_email, wq.question_id
  FROM wrong_questions wq
  LEFT JOIN exam_questions eq ON wq.question_id = eq.id
  WHERE wq.question_id IS NOT NULL AND eq.id IS NULL
  LIMIT 5`);
console.log('  rows with non-existent question_id:', qOrphans.rows.length);
if (qOrphans.rows.length) for (const r of qOrphans.rows) console.log('   ',JSON.stringify(r));

await c.end();
