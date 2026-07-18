#!/usr/bin/env node
import { getDb } from '../api/core/db.js';

async function reset() {
  const pool = await getDb();
  
  console.log('⚠️ 正在删除所有错误复制的试卷数据...');
  
  await pool.query('DELETE FROM exam_papers');
  
  console.log('✅ 所有试卷数据已删除');
  console.log('');
  console.log('接下来请运行: node scripts/import-papers.js');
}

reset()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 删除失败:', err.message);
    process.exit(1);
  });