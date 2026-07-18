/**
 * 查看 rag_questions 中有多少唯一的 source_file
 * 并按学科统计
 */
import { getDb } from '../api/core/db.js';

async function main() {
  const pool = await getDb();
  
  try {
    const totalRes = await pool.query('SELECT COUNT(*) FROM rag_questions;');
    console.log('总记录数:', totalRes.rows[0].count);
    
    const fileRes = await pool.query(`
      SELECT COUNT(DISTINCT metadata->>'source_file') as unique_files
      FROM rag_questions;
    `);
    console.log('唯一文件数:', fileRes.rows[0].unique_files);
    
    const subjectRes = await pool.query(`
      SELECT subject_code, 
             COUNT(*) as chunk_count,
             COUNT(DISTINCT metadata->>'source_file') as file_count
      FROM rag_questions
      GROUP BY subject_code
      ORDER BY chunk_count DESC;
    `);
    console.log('\n按学科统计:');
    subjectRes.rows.forEach(r => {
      console.log(`  ${r.subject_code}: ${r.chunk_count} 块 / ${r.file_count} 文件`);
    });
    
    const yearRes = await pool.query(`
      SELECT metadata->>'year' as year, COUNT(*) as cnt
      FROM rag_questions
      WHERE metadata->>'year' IS NOT NULL
      GROUP BY year
      ORDER BY year;
    `);
    console.log('\n按年份统计:');
    yearRes.rows.forEach(r => {
      console.log(`  ${r.year || '未知'}: ${r.cnt} 块`);
    });
    
  } catch (err) {
    console.error('❌ 失败:', err.message);
  }
  
  await pool.end();
}

main();
