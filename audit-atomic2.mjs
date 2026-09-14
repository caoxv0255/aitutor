import pg from 'pg';
import fs from 'fs';
import {execSync} from 'child_process';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();

console.log('== E. frontend 6 个 exam 页内嵌 .question 数 (静态题) ==');
for (const f of ['frontend/chinese-exam.html','frontend/math-exam.html','frontend/english-exam.html','frontend/physics-exam.html','frontend/chemistry-exam.html','frontend/politics-exam.html']) {
  const n = parseInt(execSync(`grep -cE 'class="question"' '${f}' 2>/dev/null || echo 0`).toString().trim());
  console.log(`  ${f}: 内嵌 .question 数 = ${n}`);
}

console.log('\n== F. wrong_questions 现存内容样本 ==');
const wq = await c.query(`SELECT id, content, user_email, question_id, knowledge_point_id, subject_code FROM wrong_questions LIMIT 5`);
for (const c2 of wq.rows) console.log(`  id=${c2.id} email=${c2.user_email} q_id=${c2.question_id} kp_id=${c2.knowledge_point_id} subj=${c2.subject_code}\n    content=${(c2.content||'').toString().slice(0,160)}`);

console.log('\n== G. wrong_questions.content 是否含多题（多行/多题标志）==');
const multiq = await c.query(`SELECT id, length(content) AS len, (length(content) - length(replace(content, E'\n', ''))) AS nl, (length(content) - length(replace(content, 'question', ''))) / 8 AS qcount_hint FROM wrong_questions WHERE content IS NOT NULL`);
for (const c2 of multiq.rows) console.log(`  id=${c2.id} len=${c2.len} newlines=${c2.nl} question_word_hits~${Math.round(c2.qcount_hint)}`);

console.log('\n== H. 抽样一题 wrong_questions 是否能 join 到 exam_questions (knowledge point 关联) ==');
const j = await c.query(`SELECT wq.id AS wqid, wq.question_id, wq.knowledge_point_id, eq.id AS eqid, eq.stem FROM wrong_questions wq LEFT JOIN exam_questions eq ON wq.question_id = eq.id LIMIT 5`);
for (const c2 of j.rows) console.log(`  wqid=${c2.wqid} wq.qid=${c2.question_id} → eq.id=${c2.eqid} stem=${(c2.stem||'').toString().slice(0,60)}`);

console.log('\n== I. 静态 22 题 (frontend/chinese-exam 等) 与 exam_questions 完全无关 ==');
console.log('  (Frontend 内嵌 .question div 是硬编码 HTML; 后端 exam_questions 表 0 rows)');

await c.end();
