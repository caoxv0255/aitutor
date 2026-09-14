import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();

console.log('== A. exam_questions 表原子性检查 (rows=0, 检查 schema 与约束) ==');
const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='exam_questions' AND (column_name IN ('stem','options','answer','analysis','knowledge_points'))`);
for (const c2 of cols.rows) console.log(`  ${c2.column_name} ${c2.data_type}`);

console.log('\n== B. unique 约束 ==');
const uq = await c.query(`SELECT pg_get_indexdef(i.indexrelid) AS d FROM pg_index i WHERE i.indrelid='exam_questions'::regclass AND i.indisunique AND NOT i.indisprimary`);
for (const c2 of uq.rows) console.log(`  ${c2.d}`);

console.log('\n== C. check default for (paper_id, question_number) unique ==');
const r1 = await c.query(`SELECT COUNT(*) AS n FROM pg_indexes WHERE schemaname='public' AND tablename='exam_questions' AND indexdef ILIKE '%paper_id%' AND indexdef ILIKE '%question_number%'`);
console.log(`  (paper_id, question_number) 唯一索引存在? rows=${r1.rows[0].n}`);

console.log('\n== D. source / parsed / DB 流转追溯 ==');
console.log('  表 knowledge_points 已有 426 条 (上轮已审计)');
const kp = await c.query(`SELECT source, COUNT(*)::int AS n FROM knowledge_points GROUP BY source ORDER BY n DESC`);
for (const c2 of kp.rows) console.log(`    knowledge_points source="${c2.source||'(NULL)'}": ${c2.n}`);
console.log('  exam_questions 0 rows → 源数据到 DB 的解析管线当前未产出任何记录 (DB 为空)');
console.log('  exam_papers 0 rows → 整张试卷表为空');

console.log('\n== E. 22 道静态题 (frontend/*.html 内嵌) ==');
const FS = await import('fs');
const grep = (pat, path) => {
  const cp = require('child_process').execSync(`grep -cE '${pat}' '${path}' 2>/dev/null || echo 0`).toString().trim();
  return parseInt(cp);
};
for (const f of ['frontend/chinese-exam.html','frontend/math-exam.html','frontend/english-exam.html','frontend/physics-exam.html','frontend/chemistry-exam.html','frontend/politics-exam.html']) {
  const n = grep('class="question"', f);
  console.log(`  ${f}: 内嵌 .question 数 = ${n}`);
}

console.log('\n== F. wrong_questions 现存 1 条是否对应正式题库 ==');
const wq = await c.query(`SELECT id, content, user_email, question_id, knowledge_point_id, subject_code FROM wrong_questions LIMIT 5`);
for (const c2 of wq.rows) console.log(`  id=${c2.id} email=${c2.user_email} q_id=${c2.question_id} kp_id=${c2.knowledge_point_id} content=${(c2.content||'').toString().slice(0,80)}`);

console.log('\n== G. 已有 wrong_questions.content 是否可能含多题 ==');
const multiq = await c.query(`SELECT id, content, length(content) AS len, (length(content) - length(replace(content, E'\n', ''))) AS newlines FROM wrong_questions WHERE content ~ E'\\d+[.、．]' LIMIT 5`);
for (const c2 of multiq.rows) console.log(`  id=${c2.id} len=${c2.len} newlines=${c2.newlines} content=${(c2.content||'').toString().slice(0,120)}`);

await c.end();
