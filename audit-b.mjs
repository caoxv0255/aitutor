import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();

// === E.1: practice_records — columns, FK, current sample ===
console.log('\n=== E.1 practice_records ===');
const cols = await c.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name='practice_records' ORDER BY ordinal_position");
for (const r of cols.rows) console.log('  col', r.column_name, r.data_type, r.is_nullable==='NO'?'NOT NULL':'NULL');
const fk = await c.query(`SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS rt, ccu.column_name AS rc FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.table_name='practice_records' AND tc.constraint_type='FOREIGN KEY'`);
for (const r of fk.rows) console.log('  FK', r.column_name, '->', r.rt+'.'+r.rc);
const samp = await c.query("SELECT * FROM practice_records LIMIT 3");
console.log('  sample rows:', samp.rows.length);
if (samp.rows.length) for (const r of samp.rows) console.log('   ',JSON.stringify(r));

// === E.2: wrong_questions — sample existing row + FK/columns + write sites ===
console.log('\n=== E.2 wrong_questions ===');
const wcols = await c.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name='wrong_questions' ORDER BY ordinal_position");
for (const r of wcols.rows) console.log('  col', r.column_name, r.data_type, r.is_nullable==='NO'?'NOT NULL':'NULL');
const wfk = await c.query(`SELECT COUNT(*)::int AS n FROM information_schema.table_constraints WHERE table_name='wrong_questions' AND constraint_type='FOREIGN KEY'`);
console.log('  total FK count:', wfk.rows[0].n, '(should be 0 per audit C)');
const wsamp = await c.query("SELECT * FROM wrong_questions");
for (const r of wsamp.rows) console.log('  row',JSON.stringify(r));

// === E.3: rag_questions columns + per-row content_hash + user identity? ===
console.log('\n=== E.3 rag_questions ===');
const rcols = await c.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name='rag_questions' ORDER BY ordinal_position");
for (const r of rcols.rows) console.log('  col', r.column_name, r.data_type, r.is_nullable==='NO'?'NOT NULL':'NULL');
const rrfk = await c.query(`SELECT COUNT(*)::int AS n FROM information_schema.table_constraints WHERE table_name='rag_questions' AND constraint_type='FOREIGN KEY'`);
console.log('  total FK count:', rrfk.rows[0].n, '(rag_questions is a SHARED content index)');
const rsamp = await c.query("SELECT id, content_hash, knowledge_point_id, subject_code, source_paper_id, created_at FROM rag_questions");
for (const r of rsamp.rows) console.log('  row',JSON.stringify(r));

// === E.4: /api/weak-points actual SQL — what does it read? ===
console.log('\n=== E.4 /api/weak-points reads FROM: ===');
const wfpr = await c.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='practice_records' AND column_name IN ('knowledge_point_id','question_id','is_correct','subject_code','user_email','session_id')");
for (const r of wfpr.rows) console.log('  practice_records.'+r.column_name, r.data_type);

// === E.5: exam_questions + exam_sessions columns + FK ===
console.log('\n=== E.5 exam_questions (potential canonical question identity) ===');
const eqcols = await c.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name='exam_questions' ORDER BY ordinal_position LIMIT 20");
for (const r of eqcols.rows) console.log('  col', r.column_name, r.data_type, r.is_nullable==='NO'?'NOT NULL':'NULL');
const eqfk = await c.query(`SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS rt, ccu.column_name AS rc FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.table_name='exam_questions' AND tc.constraint_type='FOREIGN KEY'`);
for (const r of eqfk.rows) console.log('  FK', r.column_name, '->', r.rt+'.'+r.rc);
const escs = await c.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='exam_sessions'");
for (const r of escs.rows) console.log('  exam_sessions.'+r.column_name, r.data_type);

await c.end();
