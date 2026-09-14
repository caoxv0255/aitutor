import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const TABLES = ['practice_records','wrong_questions','rag_questions','questions','exam_questions','knowledge_points','similar_questions','question_vectors','personalized_papers','reports'];
for (const t of TABLES) {
  const e = await c.query("SELECT to_regclass($1) AS c", [t]);
  if (!e.rows[0].c) { console.log(`---\n${t}: TABLE NOT FOUND`); continue; }
  const c2 = await c.query("SELECT COUNT(*)::int AS n FROM "+t);
  console.log(`\n=== ${t}  (rows=${c2.rows[0].n}) ===`);
  const cols = await c.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
  for (const c3 of cols.rows) console.log('  col', c3.column_name, c3.data_type, c3.is_nullable==='NO'?'NOT NULL':'NULL');
  const fk = await c.query(`SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS rt, ccu.column_name AS rc FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.table_name=$1 AND tc.constraint_type='FOREIGN KEY'`, [t]);
  for (const c3 of fk.rows) console.log('  FK:', c3.column_name, '->', c3.rt+'.'+c3.rc);
  const uq = await c.query("SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i WHERE i.indrelid=$1::regclass AND i.indisunique", [t]);
  for (const c3 of uq.rows) console.log('  UQ:', c3.pg_get_indexdef);
  const nFK = await c.query(`SELECT COUNT(*)::int AS n FROM information_schema.table_constraints WHERE table_name=$1 AND constraint_type='FOREIGN KEY'`, [t]);
  console.log('  total FK count:', nFK.rows[0].n);
}
await c.end();
