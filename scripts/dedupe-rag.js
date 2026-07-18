/**
 * 清理 rag_questions 表中的重复数据
 * 基于 (source_file, chunk_index) 去重
 */
import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  try {
    console.log('当前总记录数...');
    const countRes = await pool.query('SELECT COUNT(*) FROM rag_questions;');
    console.log('总记录数:', countRes.rows[0].count);
    
    console.log('\n查找重复数据...');
    const dupRes = await pool.query(`
      SELECT metadata->>'source_file' as source_file, COUNT(*) as cnt
      FROM rag_questions
      GROUP BY metadata->>'source_file'
      HAVING COUNT(*) > 20
      ORDER BY cnt DESC
      LIMIT 10;
    `);
    console.log('重复最多的文件:');
    dupRes.rows.forEach(r => console.log(`  ${r.source_file}: ${r.cnt} 块`));
    
    console.log('\n删除重复数据（保留每个文件的第一组记录）...');
    
    await pool.query(`
      DELETE FROM rag_questions
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM rag_questions
        GROUP BY (metadata->>'source_file'), (metadata->>'chunk_index')::text
      );
    `);
    
    const afterCount = await pool.query('SELECT COUNT(*) FROM rag_questions;');
    console.log('去重后记录数:', afterCount.rows[0].count);
    
    console.log('\n✅ 去重完成！');
    
  } catch (err) {
    console.error('❌ 失败:', err.message);
  }
  
  await pool.end();
}

main();
