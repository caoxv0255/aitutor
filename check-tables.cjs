const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/example_db.sqlite');

const tables = ['exam_papers', 'exam_questions', 'knowledge_points', 'province_knowledge_stats'];

console.log('检查各表数据...\n');

let checked = 0;
tables.forEach(table => {
  db.all(`SELECT COUNT(*) as count FROM ${table}`, (err, rows) => {
    if (err) {
      console.log(`${table}: 错误 - ${err.message}`);
    } else {
      console.log(`${table}: ${rows[0].count} 条记录`);
    }
    checked++;
    if (checked === tables.length) {
      console.log('\n--- exam_papers 示例 ---');
      db.all('SELECT * FROM exam_papers LIMIT 2', (err, rows) => {
        if (!err) console.log(JSON.stringify(rows, null, 2));
        
        console.log('\n--- knowledge_points 示例 ---');
        db.all('SELECT * FROM knowledge_points LIMIT 3', (err, rows) => {
          if (!err) console.log(JSON.stringify(rows, null, 2));
          
          console.log('\n--- provinces 示例 ---');
          db.all('SELECT * FROM provinces LIMIT 3', (err, rows) => {
            if (!err) console.log(JSON.stringify(rows, null, 2));
            db.close();
          });
        });
      });
    }
  });
});
