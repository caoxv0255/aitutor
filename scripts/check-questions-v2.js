import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const hasImgTag = await db.query(`
    SELECT subject_code, COUNT(*) as count 
    FROM exam_questions 
    WHERE stem LIKE '%[图片%' 
       OR options LIKE '%[图片%'
    GROUP BY subject_code 
    ORDER BY count DESC
  `);
  console.log('=== 含[图片]标记的题目（按学科） ===');
  console.table(hasImgTag.rows);
  
  const totalWithImg = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE stem LIKE '%[图片%' OR options LIKE '%[图片%'
  `);
  console.log(`\n总含图片题目数: ${totalWithImg.rows[0].count}\n`);
  
  const mathWithFormula = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE subject_code = 'math' 
      AND (stem LIKE '%=%' OR stem LIKE '%+%' OR stem LIKE '%-%' OR stem LIKE '%×%' OR stem LIKE '%÷%'
           OR stem LIKE '%^%' OR stem LIKE '%√%' OR stem LIKE '%π%' OR stem LIKE '%sin%'
           OR stem LIKE '%cos%' OR stem LIKE '%tan%' OR stem LIKE '%log%' OR stem LIKE '%/\\%')
  `);
  console.log(`数学含公式特征的题目: ${mathWithFormula.rows[0].count}\n`);
  
  const mathSample = await db.query(`
    SELECT id, stem, options 
    FROM exam_questions 
    WHERE subject_code = 'math' AND question_type = 'choice' 
    LIMIT 3
  `);
  console.log('=== 数学选择题样本 ===');
  mathSample.rows.forEach((q, i) => {
    console.log(`\n--- 样本${i+1} ID: ${q.id} ---`);
    console.log(`题干: ${q.stem?.substring(0, 300)}`);
    console.log(`选项: ${q.options?.substring(0, 300)}`);
  });
  
  const physicsSample = await db.query(`
    SELECT id, stem, options 
    FROM exam_questions 
    WHERE subject_code = 'physics' AND question_type = 'choice' 
    LIMIT 3
  `);
  console.log('\n=== 物理选择题样本 ===');
  physicsSample.rows.forEach((q, i) => {
    console.log(`\n--- 样本${i+1} ID: ${q.id} ---`);
    console.log(`题干: ${q.stem?.substring(0, 300)}`);
    console.log(`选项: ${q.options?.substring(0, 300)}`);
  });
  
  const englishNoOptions = await db.query(`
    SELECT subject_code, COUNT(*) as count 
    FROM exam_questions 
    WHERE (question_type = 'choice' OR question_type = 'multi_choice') 
      AND (options IS NULL OR options = '[]' OR options = '')
    GROUP BY subject_code 
    ORDER BY count DESC
  `);
  console.log('\n=== 选择题缺选项（按学科） ===');
  console.table(englishNoOptions.rows);
  
  const englishCloze = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE subject_code = 'english' AND question_type = 'choice' 
      AND stem LIKE '...%' OR stem LIKE '%...'
  `);
  console.log(`\n英语完形/阅读类（带...的题目）: ${englishCloze.rows[0].count}\n`);
  
  const imgSample = await db.query(`
    SELECT id, subject_code, stem, options 
    FROM exam_questions 
    WHERE stem LIKE '%[图片%' OR options LIKE '%[图片%'
    LIMIT 3
  `);
  console.log('=== 含图片标记题目样本 ===');
  imgSample.rows.forEach((q, i) => {
    console.log(`\n--- 样本${i+1} ID: ${q.id} 学科: ${q.subject_code} ---`);
    console.log(`题干: ${q.stem?.substring(0, 200)}`);
    console.log(`选项: ${q.options?.substring(0, 200)}`);
  });
  
  await db.end();
}

run().catch(console.error);