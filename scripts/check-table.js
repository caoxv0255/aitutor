import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  const res = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name='exam_papers_to_retry'`);
  console.log(res.rows.length > 0 ? '存在' : '不存在');
}

run().catch(console.error);