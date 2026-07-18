#!/usr/bin/env node
/**
 * 迁移: 给 province_knowledge_stats 添加 UNIQUE 约束
 */
import { getDb } from '../api/core/db.js';

const pool = await getDb();

try {
  await pool.query(`
    ALTER TABLE province_knowledge_stats
    ADD CONSTRAINT uk_province_knowledge_stats
    UNIQUE (province_code, year, subject, knowledge_point_id)
  `);
  console.log('✅ province_knowledge_stats UNIQUE 约束添加成功');
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
