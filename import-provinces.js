import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';

const dbPath = './database/example_db.sqlite';
const db = new sqlite3.Database(dbPath);

const provinces = JSON.parse(readFileSync('./database/seed_provinces.json', 'utf-8'));

console.log('🌱 开始导入省份数据...');

db.serialize(() => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO provinces (code, name, exam_type, paper_type, region)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const province of provinces) {
    stmt.run(
      province.code,
      province.name,
      province.exam_type,
      province.paper_type,
      province.region
    );
    console.log(`  ✅ ${province.name} (${province.code})`);
  }

  stmt.finalize(() => {
    db.all('SELECT COUNT(*) as count FROM provinces', (err, rows) => {
      if (err) {
        console.error('❌ 错误:', err.message);
      } else {
        console.log(`✅ 省份数据导入完成，共 ${rows[0].count} 个省份`);
      }
      db.close();
    });
  });
});
