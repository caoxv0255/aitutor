#!/usr/bin/env node
/**
 * 迁移: 给 exam_papers 添加 UNIQUE 约束
 * 防止同一省份同一年份同科目同考试级别的试卷重复
 */
import { getDb } from '../api/core/db.js';

const pool = await getDb();

try {
  await pool.query(`
    ALTER TABLE exam_papers
    ADD CONSTRAINT uk_exam_papers
    UNIQUE (province_code, year, subject, exam_level)
  `);
  console.log('✅ exam_papers UNIQUE 约束添加成功');
} catch (err) {
  if (err.message.includes('already exists') || err.message.includes('unique constraint')) {
    console.log('ℹ️  UNIQUE 约束已存在，跳过');
  } else {
    console.error('❌ 添加失败:', err.message);
    process.exit(1);
  }
}

await pool.end();
console.log('🔌 完成');
