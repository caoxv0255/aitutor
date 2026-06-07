import { getDb } from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function seedProvinces() {
  const pool = await getDb();

  try {
    const dataPath = join(__dirname, '../database/seed_provinces.json');
    const provinces = JSON.parse(readFileSync(dataPath, 'utf-8'));

    console.log('🌱 开始导入省份数据...');

    for (const province of provinces) {
      await pool.query(`
        INSERT INTO provinces (code, name, exam_type, paper_type, region)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, exam_type = EXCLUDED.exam_type, paper_type = EXCLUDED.paper_type, region = EXCLUDED.region
      `, [province.code, province.name, province.exam_type, province.paper_type, province.region]);

      console.log(`  ✅ ${province.name} (${province.code})`);
    }

    console.log(`✅ 省份数据导入完成，共 ${provinces.length} 个省份`);
    return { success: true, count: provinces.length };
  } catch (error) {
    console.error('❌ 省份数据导入失败:', error.message);
    throw error;
  }
}

if (process.argv[1] && process.argv[1].includes('seed-provinces')) {
  seedProvinces()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
