const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDb() {
  try {
    const tablesResult = await pool.query(
      "SELECT tablename as name FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log('数据库表列表:', tablesResult.rows.map(t => t.name));

    console.log('\n检查 exam_papers 表:');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM exam_papers');
    console.log('exam_papers 记录数:', countResult.rows[0].count);

    if (parseInt(countResult.rows[0].count) > 0) {
      const sampleResult = await pool.query('SELECT * FROM exam_papers LIMIT 1');
      console.log('exam_papers 示例数据:', JSON.stringify(sampleResult.rows, null, 2));
    }
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
