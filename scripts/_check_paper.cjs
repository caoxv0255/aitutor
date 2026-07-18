const { getDb } = require('../api/core/db.js');

async function checkPaper() {
  const pool = await getDb();
  
  const result = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [842]);
  const paper = result.rows[0];
  
  console.log('试卷信息:');
  console.log(JSON.stringify(paper, null, 2));
  
  const questionsResult = await pool.query('SELECT COUNT(*) FROM exam_questions WHERE paper_id = $1', [842]);
  console.log('题目数量:', questionsResult.rows[0].count);
}

checkPaper().catch(e => console.error(e));