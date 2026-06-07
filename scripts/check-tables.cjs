const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tables = ['exam_papers', 'exam_questions', 'knowledge_points', 'province_knowledge_stats'];

console.log('检查各表数据...\n');

async function checkTables() {
  try {
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${result.rows[0].count} 条记录`);
      } catch (err) {
        console.log(`${table}: 错误 - ${err.message}`);
      }
    }

    console.log('\n--- exam_papers 示例 ---');
    try {
      const papersResult = await pool.query('SELECT * FROM exam_papers LIMIT 2');
      console.log(JSON.stringify(papersResult.rows, null, 2));
    } catch (e) { /* ignore */ }

    console.log('\n--- knowledge_points 示例 ---');
    try {
      const kpResult = await pool.query('SELECT * FROM knowledge_points LIMIT 3');
      console.log(JSON.stringify(kpResult.rows, null, 2));
    } catch (e) { /* ignore */ }

    console.log('\n--- provinces 示例 ---');
    try {
      const provResult = await pool.query('SELECT * FROM provinces LIMIT 3');
      console.log(JSON.stringify(provResult.rows, null, 2));
    } catch (e) { /* ignore */ }
  } finally {
    await pool.end();
  }
}

checkTables();
