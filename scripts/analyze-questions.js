#!/usr/bin/env node

import { getDb } from '../api/core/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = await getDb();
  
  console.log('='.repeat(70));
  console.log('📊 题目数据全面分析报告');
  console.log('='.repeat(70));
  
  console.log('\n1️⃣ 学科列表:');
  const subjectsRes = await pool.query('SELECT code, name, category, is_active FROM subjects ORDER BY sort_order');
  subjectsRes.rows.forEach(r => console.log(`  ${r.code}: ${r.name} (${r.category}, ${r.is_active ? '启用' : '禁用'})`));
  
  console.log('\n2️⃣ 北京近5年(2021-2025)各学科题目统计:');
  const statsRes = await pool.query(`
    SELECT 
      eq.subject_code, 
      s.name as subject_name,
      COUNT(*) as total_questions,
      SUM(CASE WHEN eq.analysis IS NULL OR eq.analysis = '' THEN 1 ELSE 0 END) as missing_analysis,
      SUM(CASE WHEN eq.answer IS NULL OR eq.answer = '' THEN 1 ELSE 0 END) as missing_answer,
      SUM(CASE WHEN eq.knowledge_points IS NULL OR eq.knowledge_points = '[]' THEN 1 ELSE 0 END) as missing_kp,
      AVG(eq.difficulty) as avg_difficulty,
      SUM(eq.score) as total_score
    FROM exam_questions eq 
    LEFT JOIN subjects s ON eq.subject_code = s.code 
    WHERE eq.province_code = 'beijing' 
      AND eq.year BETWEEN 2021 AND 2025 
    GROUP BY eq.subject_code, s.name 
    ORDER BY total_questions DESC
  `);
  statsRes.rows.forEach(r => {
    const analysisRate = ((r.total_questions - r.missing_analysis) / r.total_questions * 100).toFixed(1);
    const answerRate = ((r.total_questions - r.missing_answer) / r.total_questions * 100).toFixed(1);
    const kpRate = ((r.total_questions - r.missing_kp) / r.total_questions * 100).toFixed(1);
    console.log(`  ${r.subject_code}(${r.subject_name}):`);
    console.log(`    题目数: ${r.total_questions}, 总分: ${r.total_score}`);
    console.log(`    平均难度: ${r.avg_difficulty !== null && typeof r.avg_difficulty.toFixed === 'function' ? r.avg_difficulty.toFixed(2) : 'N/A'}`);
    console.log(`    解析完整率: ${analysisRate}% (${r.total_questions - r.missing_analysis}/${r.total_questions})`);
    console.log(`    答案完整率: ${answerRate}% (${r.total_questions - r.missing_answer}/${r.total_questions})`);
    console.log(`    知识点完整率: ${kpRate}% (${r.total_questions - r.missing_kp}/${r.total_questions})`);
  });
  
  console.log('\n3️⃣ 北京近5年各学科各题型统计:');
  const typeStatsRes = await pool.query(`
    SELECT 
      eq.subject_code,
      s.name as subject_name,
      eq.question_type,
      COUNT(*) as count
    FROM exam_questions eq 
    LEFT JOIN subjects s ON eq.subject_code = s.code 
    WHERE eq.province_code = 'beijing' 
      AND eq.year BETWEEN 2021 AND 2025 
    GROUP BY eq.subject_code, s.name, eq.question_type 
    ORDER BY eq.subject_code, count DESC
  `);
  const subjectTypeMap = {};
  typeStatsRes.rows.forEach(r => {
    if (!subjectTypeMap[r.subject_code]) subjectTypeMap[r.subject_code] = [];
    subjectTypeMap[r.subject_code].push({ type: r.question_type, count: r.count });
  });
  for (const [code, types] of Object.entries(subjectTypeMap)) {
    const subjectName = types[0]?.subject_name || code;
    console.log(`  ${code}(${subjectName}): ${types.map(t => `${t.type}:${t.count}`).join(', ')}`);
  }
  
  console.log('\n4️⃣ 北京近5年各年份题目统计:');
  const yearRes = await pool.query(`
    SELECT year, COUNT(*) as count 
    FROM exam_questions 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 
    GROUP BY year 
    ORDER BY year
  `);
  yearRes.rows.forEach(r => console.log(`  ${r.year}年: ${r.count}题`));
  
  console.log('\n5️⃣ 缺失的学科检查:');
  const missingSubjectsRes = await pool.query(`
    SELECT DISTINCT eq.subject_code 
    FROM exam_questions eq 
    LEFT JOIN subjects s ON eq.subject_code = s.code 
    WHERE s.id IS NULL AND eq.province_code = 'beijing'
  `);
  if (missingSubjectsRes.rows.length > 0) {
    console.log('  存在未在subjects表中注册的学科代码:');
    missingSubjectsRes.rows.forEach(r => console.log(`    - ${r.subject_code}`));
  } else {
    console.log('  所有学科代码均已在subjects表中注册');
  }
  
  console.log('\n6️⃣ 试卷文件检查:');
  const papersRes = await pool.query(`
    SELECT province_code, year, subject, paper_file_path 
    FROM exam_papers 
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 
    ORDER BY year, subject
  `);
  console.log(`  北京近5年试卷总数: ${papersRes.rows.length}`);
  
  const missingFiles = [];
  papersRes.rows.forEach(p => {
    if (p.paper_file_path) {
      const fullPath = path.join(__dirname, '..', p.paper_file_path);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(p);
      }
    }
  });
  if (missingFiles.length > 0) {
    console.log(`  缺失试卷文件: ${missingFiles.length}份`);
    missingFiles.slice(0, 10).forEach(p => console.log(`    ${p.year}年${p.subject}: ${p.paper_file_path}`));
  } else {
    console.log('  所有试卷文件均存在');
  }
  
  console.log('\n7️⃣ 解析内容质量抽查(每学科前3题):');
  const allSubjects = subjectsRes.rows.map(r => r.code);
  for (const subject of allSubjects) {
    const sampleRes = await pool.query(`
      SELECT question_number, year, question_type, 
             (analysis IS NULL OR analysis = '') as has_no_analysis,
             (answer IS NULL OR answer = '') as has_no_answer,
             (knowledge_points IS NULL OR knowledge_points = '[]') as has_no_kp,
             LENGTH(analysis) as analysis_length
      FROM exam_questions 
      WHERE subject_code = $1 AND province_code = 'beijing' 
      ORDER BY year DESC, question_number ASC 
      LIMIT 3
    `, [subject]);
    
    const subjectName = subjectsRes.rows.find(s => s.code === subject)?.name || subject;
    const total = sampleRes.rows.length;
    const noAnalysis = sampleRes.rows.filter(r => r.has_no_analysis).length;
    const noAnswer = sampleRes.rows.filter(r => r.has_no_answer).length;
    const noKp = sampleRes.rows.filter(r => r.has_no_kp).length;
    
    if (total > 0) {
      console.log(`  ${subject}(${subjectName}):`);
      console.log(`    抽查${total}题 - 缺解析:${noAnalysis}, 缺答案:${noAnswer}, 缺知识点:${noKp}`);
      if (sampleRes.rows.some(r => r.analysis_length > 0 && r.analysis_length < 50)) {
        const short = sampleRes.rows.filter(r => r.analysis_length > 0 && r.analysis_length < 50);
        console.log(`    警告: ${short.length}题解析过短(<50字符)`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('分析完成!');
  console.log('='.repeat(70));
  
  await pool.end();
}

main().catch(err => {
  console.error('分析失败:', err.message);
  process.exit(1);
});