import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const targets = ['exam_papers','exam_questions','wrong_questions','knowledge_points','personalized_papers','reports'];
for (const t of targets) {
  const cnt = await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`).catch(e=>({rows:[{n:'(NOT FOUND)'}],err:e.message.slice(0,60)}));
  console.log(`\n========== ${t} (rows=${cnt.rows[0].n}) ==========`);
  if (cnt.err) { console.log('  ERROR:',cnt.err); continue; }
  const cols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
  for (const c2 of cols.rows) console.log(`  col ${c2.column_name}  ${c2.data_type}  ${c2.is_nullable==='NO'?'NOT NULL':'NULL'}`);
  const pks = await c.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary", [t]);
  console.log(`  PK: ${pks.rows.map(r=>r.attname).join(',')}`);
  const fks = await c.query("SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS rt, ccu.column_name AS rc FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.table_name=$1 AND tc.constraint_type='FOREIGN KEY'", [t]);
  for (const c2 of fks.rows) console.log(`  FK: ${c2.column_name} -> ${c2.rt}.${c2.rc}`);
  const uks = await c.query("SELECT pg_get_indexdef(i.indexrelid) AS d FROM pg_index i WHERE i.indrelid=$1::regclass AND i.indisunique AND NOT i.indisprimary", [t]);
  for (const c2 of uks.rows) console.log(`  UQ: ${c2.d}`);
}
await c.end();
