import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const total = await db.query('SELECT COUNT(*) as total FROM exam_questions');
  console.log(`=== 总题目数: ${total.rows[0].total} ===\n`);
  
  const subjectStats = await db.query(`
    SELECT subject_code as subject, COUNT(*) as count 
    FROM exam_questions 
    GROUP BY subject_code 
    ORDER BY count DESC
  `);
  console.log('=== 各学科题目数 ===');
  console.table(subjectStats.rows);
  
  const noStem = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE stem IS NULL OR TRIM(stem) = ''
  `);
  console.log(`\n=== 缺少题干的题目: ${noStem.rows[0].count} ===`);
  
  const noQuestionType = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE question_type IS NULL OR TRIM(question_type) = ''
  `);
  console.log(`=== 缺少题型的题目: ${noQuestionType.rows[0].count} ===`);
  
  const noDifficulty = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE difficulty IS NULL OR difficulty = 0
  `);
  console.log(`=== 缺少难度的题目: ${noDifficulty.rows[0].count} ===`);
  
  const noOptions = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE (question_type = 'choice' OR question_type = 'multi_choice') 
      AND (options IS NULL OR options = '[]' OR options = '')
  `);
  console.log(`=== 选择题但缺少选项: ${noOptions.rows[0].count} ===`);
  
  const noAnswer = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE answer IS NULL OR TRIM(answer) = ''
  `);
  console.log(`=== 缺少答案的题目: ${noAnswer.rows[0].count} ===`);
  
  const noAnalysis = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE analysis IS NULL OR TRIM(analysis) = ''
  `);
  console.log(`=== 缺少解析的题目: ${noAnalysis.rows[0].count} ===`);
  
  const typeStats = await db.query(`
    SELECT question_type, COUNT(*) as count 
    FROM exam_questions 
    GROUP BY question_type 
    ORDER BY count DESC
  `);
  console.log('\n=== 题型分布 ===');
  console.table(typeStats.rows);
  
  const diffStats = await db.query(`
    SELECT difficulty, COUNT(*) as count 
    FROM exam_questions 
    GROUP BY difficulty 
    ORDER BY difficulty
  `);
  console.log('\n=== 难度分布 ===');
  console.table(diffStats.rows);
  
  const hasFormula = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE stem LIKE '%$%$%' 
       OR stem LIKE '%\\\\(%'
       OR stem LIKE '%\\\\[%'
       OR stem LIKE '%$$%'
  `);
  console.log(`\n=== 包含公式的题目: ${hasFormula.rows[0].count} ===`);
  
  const hasImgInStem = await db.query(`
    SELECT COUNT(*) as count 
    FROM exam_questions 
    WHERE stem LIKE '%<img%' 
       OR stem LIKE '%.png%'
       OR stem LIKE '%.jpg%'
       OR stem LIKE '%.jpeg%'
       OR stem LIKE '%.gif%'
  `);
  console.log(`=== 题干含图片引用的题目: ${hasImgInStem.rows[0].count} ===`);
  
  const sampleChoice = await db.query(`
    SELECT id, subject_code, question_type, options, stem 
    FROM exam_questions 
    WHERE question_type IN ('choice', 'multi_choice') 
    LIMIT 2
  `);
  if (sampleChoice.rows.length > 0) {
    console.log('\n=== 选择题样本 ===');
    sampleChoice.rows.forEach((q, i) => {
      console.log(`\n--- 样本${i+1} ---`);
      console.log(`ID: ${q.id}`);
      console.log(`学科: ${q.subject_code}`);
      console.log(`题型: ${q.question_type}`);
      console.log(`选项: ${q.options?.substring(0, 200)}...`);
      console.log(`题干前200字: ${q.stem?.substring(0, 200)}...`);
    });
  }
  
  const sampleFormula = await db.query(`
    SELECT id, subject_code, question_type, stem 
    FROM exam_questions 
    WHERE stem LIKE '%$%$%' OR stem LIKE '%$$%'
    LIMIT 2
  `);
  if (sampleFormula.rows.length > 0) {
    console.log('\n=== 含公式题目样本 ===');
    sampleFormula.rows.forEach((q, i) => {
      console.log(`\n--- 样本${i+1} ---`);
      console.log(`ID: ${q.id}`);
      console.log(`学科: ${q.subject_code}`);
      console.log(`题型: ${q.question_type}`);
      console.log(`题干前300字: ${q.stem?.substring(0, 300)}...`);
    });
  }
  
  const sampleImg = await db.query(`
    SELECT id, subject_code, question_type, stem 
    FROM exam_questions 
    WHERE stem LIKE '%<img%' OR stem LIKE '%.png%'
    LIMIT 2
  `);
  if (sampleImg.rows.length > 0) {
    console.log('\n=== 含图片引用题目样本 ===');
    sampleImg.rows.forEach((q, i) => {
      console.log(`\n--- 样本${i+1} ---`);
      console.log(`ID: ${q.id}`);
      console.log(`学科: ${q.subject_code}`);
      console.log(`题型: ${q.question_type}`);
      console.log(`题干前300字: ${q.stem?.substring(0, 300)}...`);
    });
  }
  
  const sampleNoOptions = await db.query(`
    SELECT id, subject_code, question_type, stem 
    FROM exam_questions 
    WHERE (question_type = 'choice' OR question_type = 'multi_choice') 
      AND (options IS NULL OR options = '[]' OR options = '')
    LIMIT 3
  `);
  if (sampleNoOptions.rows.length > 0) {
    console.log('\n=== 缺少选项的选择题样本 ===');
    sampleNoOptions.rows.forEach((q, i) => {
      console.log(`\n--- 样本${i+1} ---`);
      console.log(`ID: ${q.id}`);
      console.log(`学科: ${q.subject_code}`);
      console.log(`题型: ${q.question_type}`);
      console.log(`题干前200字: ${q.stem?.substring(0, 200)}...`);
    });
  }
  
  await db.end();
}

run().catch(console.error);