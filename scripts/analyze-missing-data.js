import { getDb } from '../api/core/db.js';

async function run() {
  const db = await getDb();
  
  const papersWithoutAnswers = await db.query(`
    SELECT p.id as paper_id, p.province_code, p.year, p.subject, p.paper_file_path,
           COUNT(q.id) as total_questions,
           SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) as no_answer_count,
           SUM(CASE WHEN q.analysis IS NULL OR TRIM(q.analysis) = '' THEN 1 ELSE 0 END) as no_analysis_count
    FROM exam_papers p
    LEFT JOIN exam_questions q ON p.id = q.paper_id
    WHERE p.exam_level = 'gaokao'
    GROUP BY p.id, p.province_code, p.year, p.subject, p.paper_file_path
    HAVING SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) > 0
      AND COUNT(q.id) > 0
    ORDER BY no_answer_count DESC
    LIMIT 20
  `);
  
  console.log('=== 需要重新解析答案/解析的试卷（前20名） ===');
  console.table(papersWithoutAnswers.rows.map(r => ({
    paper_id: r.paper_id,
    province: r.province_code,
    year: r.year,
    subject: r.subject,
    total: r.total_questions,
    no_answer: r.no_answer_count,
    no_analysis: r.no_analysis_count
  })));
  
  const subjectStats = await db.query(`
    SELECT q.subject_code, 
           COUNT(q.id) as total_questions,
           SUM(CASE WHEN q.answer IS NULL OR TRIM(q.answer) = '' THEN 1 ELSE 0 END) as no_answer_count,
           SUM(CASE WHEN q.analysis IS NULL OR TRIM(q.analysis) = '' THEN 1 ELSE 0 END) as no_analysis_count
    FROM exam_questions q
    GROUP BY q.subject_code
    ORDER BY total_questions DESC
  `);
  
  console.log('\n=== 各学科答案/解析缺失统计 ===');
  console.table(subjectStats.rows.map(r => ({
    subject: r.subject_code,
    total: r.total_questions,
    no_answer: r.no_answer_count,
    no_answer_pct: ((r.no_answer_count / r.total_questions) * 100).toFixed(1) + '%',
    no_analysis: r.no_analysis_count,
    no_analysis_pct: ((r.no_analysis_count / r.total_questions) * 100).toFixed(1) + '%'
  })));
  
  const pureImageQuestions = await db.query(`
    SELECT q.id, q.paper_id, q.subject_code, q.stem, q.options
    FROM exam_questions q
    WHERE q.stem REGEXP '^\\[图片\\d+_\\d+\\]$'
    LIMIT 10
  `);
  
  console.log('\n=== 纯图片题样本（题干只有[图片X_X]） ===');
  pureImageQuestions.rows.forEach((q, i) => {
    console.log(`\n--- 样本${i+1} ID: ${q.id} 学科: ${q.subject_code} ---`);
    console.log(`题干: "${q.stem}"`);
    console.log(`选项: ${q.options}`);
  });
  
  const pureImageCount = await db.query(`
    SELECT COUNT(*) as count, subject_code
    FROM exam_questions q
    WHERE q.stem REGEXP '^\\[图片\\d+_\\d+\\]$'
    GROUP BY subject_code
    ORDER BY count DESC
  `);
  
  console.log('\n=== 纯图片题数量（按学科） ===');
  console.table(pureImageCount.rows);
  
  await db.end();
}

run().catch(console.error);