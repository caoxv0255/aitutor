#!/usr/bin/env node

import { getDb } from '../api/core/db.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function main() {
  const pool = await getDb();
  
  console.log('北京近五年语文高考题入库流程分析');
  console.log('='.repeat(60));
  
  console.log('\n1. 数据库中北京语文高考试卷记录:');
  const papersRes = await pool.query(`
    SELECT id, province_code, year, subject, exam_level, paper_type, 
           question_count, total_score, paper_file_path
    FROM exam_papers
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
      AND subject = 'chinese' AND exam_level = 'gaokao'
    ORDER BY year DESC
  `);
  
  console.log(`   发现 ${papersRes.rows.length} 条记录:`);
  papersRes.rows.forEach(p => {
    const fileExists = p.paper_file_path ? existsSync(p.paper_file_path) : false;
    console.log(`   - ${p.year}年: id=${p.id}, question_count=${p.question_count || 0}, file=${p.paper_file_path ? (fileExists ? '✅' : '❌') : '未设置'}`);
    if (p.paper_file_path && !fileExists) {
      console.log(`     文件路径: ${p.paper_file_path}`);
      const candidates = [
        join(ROOT, 'database', '高考真题', '北京高考', p.paper_file_path),
        join(ROOT, 'database', '高考真题', p.paper_file_path),
      ];
      candidates.forEach(c => {
        if (existsSync(c)) {
          console.log(`     备选路径存在: ${c}`);
        }
      });
    }
  });
  
  console.log('\n2. 北京语文高考题目统计:');
  const questionsRes = await pool.query(`
    SELECT year, COUNT(*) as cnt, question_type,
           SUM(CASE WHEN answer IS NULL OR answer = '' THEN 1 ELSE 0 END) as missing_answer,
           SUM(CASE WHEN analysis IS NULL OR analysis = '' THEN 1 ELSE 0 END) as missing_analysis
    FROM exam_questions
    WHERE province_code = 'beijing' AND year BETWEEN 2021 AND 2025
      AND subject_code = 'chinese'
    GROUP BY year, question_type
    ORDER BY year DESC, question_type
  `);
  
  console.log(`   ${'年份'.padEnd(6)} ${'题型'.padEnd(10)} ${'数量'.padEnd(6)} ${'缺答案'.padEnd(8)} ${'缺解析'.padEnd(8)}`);
  console.log(`   ${'-'.repeat(6)} ${'-'.repeat(10)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(8)}`);
  questionsRes.rows.forEach(r => {
    console.log(`   ${r.year.toString().padEnd(6)} ${r.question_type.padEnd(10)} ${r.cnt.toString().padEnd(6)} ${r.missing_answer.toString().padEnd(8)} ${r.missing_analysis.toString().padEnd(8)}`);
  });
  
  console.log('\n3. 试卷文件目录检查:');
  const databaseDir = join(ROOT, 'database', '高考真题');
  console.log(`   数据库目录: ${databaseDir}`);
  console.log(`   目录存在: ${existsSync(databaseDir) ? '✅' : '❌'}`);
  
  if (existsSync(databaseDir)) {
    const fs = await import('fs');
    const dirs = fs.readdirSync(databaseDir);
    const beijingDirs = dirs.filter(d => d.includes('北京'));
    console.log(`   北京相关目录: ${beijingDirs.join(', ')}`);
    
    beijingDirs.forEach(dir => {
      const fullPath = join(databaseDir, dir);
      if (fs.statSync(fullPath).isDirectory()) {
        const files = fs.readdirSync(fullPath).filter(f => f.includes('语文'));
        console.log(`   ${dir} 下的语文文件: ${files.length} 个`);
        files.slice(0, 5).forEach(f => console.log(`     - ${f}`));
      }
    });
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('检查失败:', err.message);
  process.exit(1);
});