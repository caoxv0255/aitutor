import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const r1 = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE content IS NOT NULL AND content != '') as with_content,
      COUNT(*) FILTER (WHERE module IS NOT NULL AND module != '') as with_module,
      COUNT(*) FILTER (WHERE textbook IS NOT NULL AND textbook != '') as with_textbook
    FROM knowledge_points
  `);
  console.log('=== 数据库验证 ===');
  console.log(`  总知识点: ${r1.rows[0].total}`);
  console.log(`  含教材内容: ${r1.rows[0].with_content}`);
  console.log(`  含模块信息: ${r1.rows[0].with_module}`);
  console.log(`  含教材名称: ${r1.rows[0].with_textbook}`);

  const r2 = await pool.query('SELECT subject, COUNT(*) as count FROM knowledge_points GROUP BY subject ORDER BY count DESC');
  console.log('\n学科分布:');
  for (const row of r2.rows) {
    console.log(`  ${row.subject}: ${row.count}`);
  }

  // 测试新字段查询
  const r3 = await pool.query(`SELECT id, name, module, textbook, volume, content FROM knowledge_points WHERE id = 'CHEM-B1-023'`);
  if (r3.rows.length > 0) {
    const kp = r3.rows[0];
    console.log(`\n=== 示例知识点 (CHEM-B1-023) ===`);
    console.log(`  名称: ${kp.name}`);
    console.log(`  模块: ${kp.module}`);
    console.log(`  教材: ${kp.textbook}`);
    console.log(`  册次: ${kp.volume}`);
    console.log(`  内容长度: ${kp.content?.length || 0} 字`);
  }
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
