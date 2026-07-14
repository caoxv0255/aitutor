import { getDb } from '../api/core/db.js';

const pool = await getDb();
const r = await pool.query(
  "SELECT id, year, subject, math_type, exam_level, paper_file_path, question_count FROM exam_papers WHERE province_code = 'beijing' ORDER BY subject, year, math_type"
);
console.log('北京地区试卷数:', r.rows.length);
r.rows.forEach(row => console.log(JSON.stringify(row)));
await pool.end();