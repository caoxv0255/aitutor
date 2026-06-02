const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/example_db.sqlite');

db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('错误:', err.message);
    db.close();
    return;
  }
  console.log('数据库表列表:', tables.map(t => t.name));

  console.log('\n检查 exam_papers 表:');
  db.all('SELECT COUNT(*) as count FROM exam_papers', (err, rows) => {
    if (err) {
      console.error('exam_papers 错误:', err.message);
    } else {
      console.log('exam_papers 记录数:', rows[0].count);
    }

    if (rows && rows[0].count > 0) {
      db.all('SELECT * FROM exam_papers LIMIT 1', (err, sample) => {
        if (err) {
          console.error('示例错误:', err.message);
        } else {
          console.log('exam_papers 示例数据:', JSON.stringify(sample, null, 2));
        }
        db.close();
      });
    } else {
      db.close();
    }
  });
});
