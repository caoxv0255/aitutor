import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

console.log("=== exam_questions 行数 ===");
let r = await c.query("SELECT COUNT(*)::int AS n FROM exam_questions");
console.log(r.rows);

console.log("\n=== question_uid 空/非空统计 ===");
r = await c.query(`
  SELECT
    COUNT(*) FILTER (WHERE question_uid IS NULL OR question_uid = '') AS empty_uid,
    COUNT(*) FILTER (WHERE question_uid IS NOT NULL AND question_uid <> '') AS non_empty_uid,
    COUNT(*) AS total
  FROM exam_questions
`);
console.log(r.rows);

console.log("\n=== question_uid 样例 (前 5 条非空) ===");
r = await c.query(`SELECT id, question_uid, subject_code, year, question_number FROM exam_questions WHERE question_uid IS NOT NULL AND question_uid <> '' LIMIT 5`);
console.log(r.rows);

console.log("\n=== question_types 表枚举 ===");
r = await c.query(`SELECT code, name FROM question_types ORDER BY sort_order`);
console.log(r.rows);

console.log("\n=== exam_questions.question_type 实际值分布 ===");
r = await c.query(`SELECT question_type, COUNT(*)::int AS n FROM exam_questions GROUP BY question_type ORDER BY n DESC`);
console.log(r.rows);

console.log("\n=== exam_questions 是否有 UNIQUE(question_uid) 约束 ===");
r = await c.query(`
  SELECT conname, contype
  FROM pg_constraint
  WHERE conrelid = 'exam_questions'::regclass
`);
console.log(r.rows);

await c.end();