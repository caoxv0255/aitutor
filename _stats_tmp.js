import { getDb } from './api/core/db.js';

async function main() {
  const pool = await getDb();
  const papers = await pool.query('SELECT COUNT(*) as count FROM exam_papers');
  const questions = await pool.query('SELECT COUNT(*) as count FROM exam_questions');
  const provinces = await pool.query('SELECT COUNT(*) as count FROM provinces');
  const kps = await pool.query('SELECT COUNT(*) as count FROM knowledge_points');
  const subjectStats = await pool.query(`SELECT subject, COUNT(*) as count FROM exam_questions GROUP BY subject ORDER BY count DESC`);
  console.log('试卷总数:', papers.rows[0].count);
  console.log('题目总数:', questions.rows[0].count);
  console.log('省份数:', provinces.rows[0].count);
  console.log('知识点数:', kps.rows[0].count);
  console.log('各学科题目分布:');
  subjectStats.rows.forEach(r => console.log('  ' + r.subject + ':', r.count));
  await pool.end();
}

main().catch(console.error);
