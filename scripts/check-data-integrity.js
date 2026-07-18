#!/usr/bin/env node

import { getDb } from '../api/core/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = await getDb();
  
  console.log('='.repeat(80));
  console.log('🔍 数据完整性全面检查报告');
  console.log('='.repeat(80));
  
  console.log('\n📋 第一部分：数据库表结构完整性检查');
  console.log('-'.repeat(80));
  
  const tables = ['exam_papers', 'exam_questions', 'subjects', 'provinces', 'question_types'];
  for (const table of tables) {
    const res = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`  ${table}: ${res.rows[0].count} 条记录`);
  }
  
  console.log('\n📊 第二部分：题目字段完整性检查');
  console.log('-'.repeat(80));
  
  const fieldCheckRes = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN question_uid IS NULL OR question_uid = '' THEN 1 ELSE 0 END) as missing_uid,
      SUM(CASE WHEN paper_id IS NULL THEN 1 ELSE 0 END) as missing_paper_id,
      SUM(CASE WHEN question_number IS NULL THEN 1 ELSE 0 END) as missing_number,
      SUM(CASE WHEN question_type IS NULL OR question_type = '' THEN 1 ELSE 0 END) as missing_type,
      SUM(CASE WHEN stem IS NULL OR stem = '' THEN 1 ELSE 0 END) as missing_stem,
      SUM(CASE WHEN answer IS NULL OR answer = '' THEN 1 ELSE 0 END) as missing_answer,
      SUM(CASE WHEN analysis IS NULL OR analysis = '' THEN 1 ELSE 0 END) as missing_analysis,
      SUM(CASE WHEN subject_code IS NULL OR subject_code = '' THEN 1 ELSE 0 END) as missing_subject,
      SUM(CASE WHEN province_code IS NULL OR province_code = '' THEN 1 ELSE 0 END) as missing_province,
      SUM(CASE WHEN year IS NULL THEN 1 ELSE 0 END) as missing_year,
      SUM(CASE WHEN difficulty IS NULL THEN 1 ELSE 0 END) as missing_difficulty,
      SUM(CASE WHEN score IS NULL THEN 1 ELSE 0 END) as missing_score,
      SUM(CASE WHEN knowledge_points IS NULL OR knowledge_points = '[]' THEN 1 ELSE 0 END) as missing_kp
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
  `);
  
  const fc = fieldCheckRes.rows[0];
  console.log(`  总题目数: ${fc.total}`);
  console.log(`  缺失字段统计:`);
  console.log(`    question_uid: ${fc.missing_uid} (${((fc.missing_uid / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    paper_id: ${fc.missing_paper_id} (${((fc.missing_paper_id / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    question_number: ${fc.missing_number} (${((fc.missing_number / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    question_type: ${fc.missing_type} (${((fc.missing_type / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    stem(题干): ${fc.missing_stem} (${((fc.missing_stem / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    answer(答案): ${fc.missing_answer} (${((fc.missing_answer / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    analysis(解析): ${fc.missing_analysis} (${((fc.missing_analysis / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    subject_code: ${fc.missing_subject} (${((fc.missing_subject / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    province_code: ${fc.missing_province} (${((fc.missing_province / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    year: ${fc.missing_year} (${((fc.missing_year / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    difficulty: ${fc.missing_difficulty} (${((fc.missing_difficulty / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    score: ${fc.missing_score} (${((fc.missing_score / fc.total) * 100).toFixed(1)}%)`);
  console.log(`    knowledge_points: ${fc.missing_kp} (${((fc.missing_kp / fc.total) * 100).toFixed(1)}%)`);
  
  console.log('\n📏 第三部分：题目内容长度分析（检测截断）');
  console.log('-'.repeat(80));
  
  const lengthRes = await pool.query(`
    SELECT 
      subject_code,
      COUNT(*) as total,
      MIN(LENGTH(stem)) as min_stem_len,
      MAX(LENGTH(stem)) as max_stem_len,
      AVG(LENGTH(stem)) as avg_stem_len,
      SUM(CASE WHEN LENGTH(stem) < 20 THEN 1 ELSE 0 END) as short_stem,
      SUM(CASE WHEN LENGTH(stem) > 2000 THEN 1 ELSE 0 END) as long_stem,
      SUM(CASE WHEN LENGTH(analysis) > 2000 THEN 1 ELSE 0 END) as long_analysis,
      MAX(LENGTH(analysis)) as max_analysis_len,
      AVG(LENGTH(analysis)) as avg_analysis_len
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
    GROUP BY subject_code
    ORDER BY total DESC
  `);
  
  console.log(`  ${'学科'.padEnd(10)} ${'总数'.padEnd(6)} ${'最短题干'.padEnd(8)} ${'最长题干'.padEnd(8)} ${'平均题干'.padEnd(8)} ${'<20字符'.padEnd(10)} ${'>2000字符'.padEnd(12)} ${'最长解析'.padEnd(8)}`);
  console.log(`  ${'-'.repeat(10)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(12)} ${'-'.repeat(8)}`);
  lengthRes.rows.forEach(r => {
    console.log(`  ${r.subject_code.padEnd(10)} ${r.total.toString().padEnd(6)} ${r.min_stem_len.toString().padEnd(8)} ${r.max_stem_len.toString().padEnd(8)} ${Math.round(r.avg_stem_len).toString().padEnd(8)} ${r.short_stem.toString().padEnd(10)} ${r.long_stem.toString().padEnd(12)} ${(r.max_analysis_len || 0).toString().padEnd(8)}`);
  });
  
  console.log('\n🔍 第四部分：题干内容截断检测（长度<30的异常题目）');
  console.log('-'.repeat(80));
  
  const shortStemRes = await pool.query(`
    SELECT id, subject_code, year, question_number, question_type, LENGTH(stem) as len, stem
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 AND LENGTH(stem) < 30 AND stem IS NOT NULL AND stem != ''
    ORDER BY len ASC
    LIMIT 20
  `);
  
  if (shortStemRes.rows.length > 0) {
    console.log(`  发现 ${shortStemRes.rows.length} 道题干过短的题目:`);
    shortStemRes.rows.forEach(r => {
      console.log(`    [${r.subject_code}] ${r.year}年第${r.question_number}题 (${r.len}字符): "${r.stem}"`);
    });
  } else {
    console.log('  ✅ 未发现题干过短的题目');
  }
  
  console.log('\n📝 第五部分：JSON字段有效性检查');
  console.log('-'.repeat(80));
  
  const jsonCheckRes = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN options IS NOT NULL AND options != '' THEN 1 ELSE 0 END) as has_options,
      SUM(CASE WHEN knowledge_points IS NOT NULL AND knowledge_points != '' THEN 1 ELSE 0 END) as has_kp,
      SUM(CASE WHEN latex_formulas IS NOT NULL AND latex_formulas != '' THEN 1 ELSE 0 END) as has_formulas
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
  `);
  
  const jc = jsonCheckRes.rows[0];
  console.log(`  有options字段: ${jc.has_options} (${((jc.has_options / jc.total) * 100).toFixed(1)}%)`);
  console.log(`  有knowledge_points字段: ${jc.has_kp} (${((jc.has_kp / jc.total) * 100).toFixed(1)}%)`);
  console.log(`  有latex_formulas字段: ${jc.has_formulas} (${((jc.has_formulas / jc.total) * 100).toFixed(1)}%)`);
  
  console.log('\n🔧 第六部分：选项解析错误检测');
  console.log('-'.repeat(80));
  
  const optionsErrRes = await pool.query(`
    SELECT id, subject_code, year, question_number, options
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025 
      AND options IS NOT NULL AND options != ''
    LIMIT 50
  `);
  
  let parseErrors = 0;
  let malformedOptions = [];
  optionsErrRes.rows.forEach(r => {
    try {
      const opts = JSON.parse(r.options);
      if (!Array.isArray(opts)) {
        parseErrors++;
        malformedOptions.push(r);
      }
    } catch {
      parseErrors++;
      malformedOptions.push(r);
    }
  });
  
  if (parseErrors > 0) {
    console.log(`  发现 ${parseErrors} 个选项JSON解析错误（抽查50题）:`);
    malformedOptions.slice(0, 10).forEach(r => {
      console.log(`    [${r.subject_code}] ${r.year}年第${r.question_number}题: "${r.options.substring(0, 50)}..."`);
    });
  } else {
    console.log('  ✅ 选项JSON解析正常');
  }
  
  console.log('\n🔗 第七部分：试卷与题目关联检查');
  console.log('-'.repeat(80));
  
  const paperLinkRes = await pool.query(`
    SELECT 
      ep.id as paper_id,
      ep.province_code,
      ep.year,
      ep.subject,
      ep.question_count as expected_count,
      COUNT(eq.id) as actual_count
    FROM exam_papers ep
    LEFT JOIN exam_questions eq ON ep.id = eq.paper_id
    WHERE ep.province_code = 'beijing' AND ep.year BETWEEN 2021 AND 2025
    GROUP BY ep.id, ep.province_code, ep.year, ep.subject, ep.question_count
    ORDER BY ep.year, ep.subject
  `);
  
  let mismatchCount = 0;
  console.log(`  ${'年份'.padEnd(6)} ${'学科'.padEnd(10)} ${'期望题数'.padEnd(10)} ${'实际题数'.padEnd(10)} ${'匹配'.padEnd(6)}`);
  console.log(`  ${'-'.repeat(6)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(6)}`);
  paperLinkRes.rows.forEach(r => {
    const expected = parseInt(r.expected_count) || 0;
    const actual = parseInt(r.actual_count) || 0;
    const match = expected === actual;
    if (!match) mismatchCount++;
    console.log(`  ${r.year.toString().padEnd(6)} ${r.subject.padEnd(10)} ${expected.toString().padEnd(10)} ${actual.toString().padEnd(10)} ${match ? '✅' : '❌'}`);
  });
  
  if (mismatchCount > 0) {
    console.log(`  ⚠️  ${mismatchCount} 份试卷题目数量不匹配`);
  } else {
    console.log('  ✅ 所有试卷题目数量匹配');
  }
  
  console.log('\n🗂️ 第八部分：结构化输出文件完整性检查');
  console.log('-'.repeat(80));
  
  const outputDir = path.join(__dirname, '..', 'database', 'parsed-examples', 'beijing');
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    console.log(`  输出目录: ${outputDir}`);
    console.log(`  文件数量: ${files.length}`);
    
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    console.log(`  JSON文件: ${jsonFiles.join(', ')}`);
    
    for (const jsonFile of jsonFiles) {
      const filePath = path.join(outputDir, jsonFile);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        console.log(`\n  ${jsonFile}:`);
        console.log(`    文件大小: ${content.length} 字符`);
        console.log(`    结构完整性: ✅ JSON解析成功`);
        
        if (data.metadata) {
          console.log(`    metadata: ${JSON.stringify(data.metadata).substring(0, 100)}...`);
        }
        if (data.subjects && Array.isArray(data.subjects)) {
          console.log(`    subjects数量: ${data.subjects.length}`);
          data.subjects.forEach(s => {
            const typeCount = s.question_types ? s.question_types.length : 0;
            const totalExamples = s.question_types ? s.question_types.reduce((sum, t) => sum + (t.examples?.length || 0), 0) : 0;
            console.log(`      - ${s.subject_name}: ${typeCount}种题型, ${totalExamples}个示例`);
          });
        }
        
      } catch (err) {
        console.log(`    ❌ JSON解析失败: ${err.message}`);
      }
    }
  } else {
    console.log(`  ❌ 输出目录不存在: ${outputDir}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 检查完成!');
  console.log('='.repeat(80));
  
  await pool.end();
}

main().catch(err => {
  console.error('检查失败:', err.message);
  process.exit(1);
});