import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();
  const r = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='exam_questions' 
    ORDER BY ordinal_position
  `);
  console.log(r.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}
main().catch(console.error);