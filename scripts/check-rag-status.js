import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // 检查已安装扩展
  const r1 = await pool.query("SELECT extname, extversion FROM pg_extension WHERE extname IN ('age','vector')");
  console.log('已安装扩展:');
  if (r1.rows.length === 0) console.log('  (无)');
  for (const row of r1.rows) {
    console.log(`  ${row.extname} v${row.extversion}`);
  }

  // 尝试加载 AGE
  try {
    await pool.query("LOAD 'age'");
    console.log('\nAGE 扩展加载: OK');
  } catch (e) {
    console.log('\nAGE 扩展加载: FAILED -', e.message);
  }

  // 检查 pgvector
  try {
    await pool.query("SELECT '[1,2,3]'::vector");
    console.log('pgvector 可用: OK');
  } catch (e) {
    console.log('pgvector 可用: FAILED -', e.message);
  }

  // 检查表是否存在
  const r2 = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('knowledge_points','rag_questions','student_knowledge_mastery')
    ORDER BY table_name
  `);
  console.log('\n关键表状态:');
  for (const row of r2.rows) {
    console.log(`  ${row.table_name}: EXISTS`);
  }

  // 检查 knowledge_points 数据
  const r3 = await pool.query('SELECT COUNT(*) FROM knowledge_points');
  console.log(`\nknowledge_points 数据量: ${r3.rows[0].count}`);

  // 检查 rag_questions 数据
  const r4 = await pool.query('SELECT COUNT(*) FROM rag_questions');
  console.log(`rag_questions 数据量: ${r4.rows[0].count}`);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
