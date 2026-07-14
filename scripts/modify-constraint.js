import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const res = await db.query(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'exam_papers'
  `);
  
  console.table(res.rows);
  
  await db.query(`
    ALTER TABLE exam_papers 
    DROP CONSTRAINT IF EXISTS uk_exam_papers
  `);
  
  await db.query(`
    ALTER TABLE exam_papers 
    ADD CONSTRAINT uk_exam_papers UNIQUE (province_code, year, subject, exam_level, math_type)
  `);
  
  console.log('Updated unique constraint to include math_type');
}

run().catch(console.error);