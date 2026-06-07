const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const subjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 'politics'];
const provinces = ['beijing', 'shanghai', 'shandong', 'guangdong', 'zhejiang', 'jiangsu', 'national_i', 'national_ii', 'national_a', 'national_b'];

console.log('🌱 开始生成示例试卷数据...');

async function seedPapers() {
  try {
    let insertCount = 0;

    for (const province of provinces) {
      const examLevel = province.includes('zhongkao') ? 'zhongkao' : 'gaokao';

      for (const subject of subjects) {
        for (let year = 2020; year <= 2025; year++) {
          await pool.query(
            `INSERT INTO exam_papers (province_code, year, subject, total_score, question_count, difficulty_avg, exam_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              province,
              year,
              subject,
              subject === 'math' ? 150 : subject === 'english' ? 150 : 100,
              Math.floor(Math.random() * 10) + 20,
              (Math.random() * 2 + 2).toFixed(2),
              examLevel
            ]
          );
          insertCount++;
        }
      }
    }

    const countResult = await pool.query('SELECT COUNT(*) as count FROM exam_papers');
    console.log(`✅ 试卷数据生成完成，共 ${countResult.rows[0].count} 条记录`);

    const samplesResult = await pool.query('SELECT * FROM exam_papers LIMIT 3');
    console.log('\n示例数据:');
    console.log(JSON.stringify(samplesResult.rows, null, 2));
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await pool.end();
  }
}

seedPapers();
