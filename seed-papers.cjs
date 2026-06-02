const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/example_db.sqlite');

const subjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 'politics'];
const provinces = ['beijing', 'shanghai', 'shandong', 'guangdong', 'zhejiang', 'jiangsu', 'national_i', 'national_ii', 'national_a', 'national_b'];

console.log('🌱 开始生成示例试卷数据...');

db.serialize(() => {
  let insertCount = 0;
  
  const stmt = db.prepare(`
    INSERT INTO exam_papers (province_code, year, subject, total_score, question_count, difficulty_avg, exam_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const province of provinces) {
    const examLevel = province.includes('zhongkao') ? 'zhongkao' : 'gaokao';
    
    for (const subject of subjects) {
      for (let year = 2020; year <= 2025; year++) {
        stmt.run(
          province,
          year,
          subject,
          subject === 'math' ? 150 : subject === 'english' ? 150 : 100,
          Math.floor(Math.random() * 10) + 20,
          (Math.random() * 2 + 2).toFixed(2),
          examLevel
        );
        insertCount++;
      }
    }
  }

  stmt.finalize(() => {
    db.all('SELECT COUNT(*) as count FROM exam_papers', (err, rows) => {
      if (err) {
        console.error('❌ 错误:', err.message);
      } else {
        console.log(`✅ 试卷数据生成完成，共 ${rows[0].count} 条记录`);
      }

      db.all('SELECT * FROM exam_papers LIMIT 3', (err, samples) => {
        if (err) {
          console.error('示例数据错误:', err.message);
        } else {
          console.log('\n示例数据:');
          console.log(JSON.stringify(samples, null, 2));
        }
        db.close();
      });
    });
  });
});
