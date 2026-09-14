import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const TABLES = ['users','exam_questions','exam_papers','practice_records','wrong_questions','rag_questions','knowledge_points','personalized_papers','reports','similar_questions','question_vectors','essay_reports','exam_sessions'];
for (const t of TABLES) {
  const e = await c.query("SELECT to_regclass($1) AS c", [t]);
  if (!e.rows[0].c) { console.log(`  ${t}: TABLE NOT FOUND`); continue; }
  const r = await c.query("SELECT COUNT(*)::int AS n FROM "+t);
  console.log(`  ${t}: ${r.rows[0].n} rows`);
}
await c.end();
