import { getDb } from '../api/core/db.js';

const pool = await getDb();
await pool.query("DELETE FROM exam_papers WHERE province_code = 'beijing'");
console.log('已清除北京旧数据');
const r = await pool.query("SELECT COUNT(*) as cnt FROM exam_papers WHERE province_code = 'beijing'");
console.log('剩余:', r.rows[0].cnt);
process.exit(0);
