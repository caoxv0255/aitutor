#!/usr/bin/env node
import { getDb } from '../api/core/db.js';

async function check() {
  const pool = await getDb();
  
  const sources = ['beijing', 'shandong', 'chongqing', 'sichuan', 'henan'];
  
  console.log('=== 源省份数据完整性 ===');
  console.log('省份 | 语文 | 数学 | 英语 | 物理 | 化学 | 生物 | 历史 | 政治 | 地理');
  console.log('-----|------|------|------|------|------|------|------|------|------');
  
  for (const source of sources) {
    const r = await pool.query(`
      SELECT subject, COUNT(*) as cnt
      FROM exam_papers
      WHERE province_code = $1
      GROUP BY subject
    `, [source]);
    
    const data = {};
    for (const row of r.rows) {
      data[row.subject] = row.cnt;
    }
    
    console.log(`${source.padEnd(6)}| ${(data.chinese||0).toString().padStart(4)} | ${(data.math||0).toString().padStart(4)} | ${(data.english||0).toString().padStart(4)} | ${(data.physics||0).toString().padStart(4)} | ${(data.chemistry||0).toString().padStart(4)} | ${(data.biology||0).toString().padStart(4)} | ${(data.history||0).toString().padStart(4)} | ${(data.politics||0).toString().padStart(4)} | ${(data.geography||0).toString().padStart(4)}`);
  }
  
  console.log('\n=== 数学和政治总数 ===');
  const math = await pool.query('SELECT COUNT(*) as cnt FROM exam_papers WHERE subject = $1', ['math']);
  const politics = await pool.query('SELECT COUNT(*) as cnt FROM exam_papers WHERE subject = $1', ['politics']);
  console.log(`math: ${math.rows[0].cnt}份`);
  console.log(`politics: ${politics.rows[0].cnt}份`);
}

check()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });