import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const provinces = JSON.parse(readFileSync('./database/seed_provinces.json', 'utf-8'));

console.log('🌱 开始导入省份数据...');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  for (const province of provinces) {
    await pool.query(
      `INSERT INTO provinces (code, name, exam_type, paper_type, region)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, exam_type = EXCLUDED.exam_type, paper_type = EXCLUDED.paper_type, region = EXCLUDED.region`,
      [province.code, province.name, province.exam_type, province.paper_type, province.region]
    );
    console.log(`  ✅ ${province.name} (${province.code})`);
  }

  const countResult = await pool.query('SELECT COUNT(*) as count FROM provinces');
  console.log(`✅ 省份数据导入完成，共 ${countResult.rows[0].count} 个省份`);
} catch (err) {
  console.error('❌ 错误:', err.message);
} finally {
  await pool.end();
}
