#!/usr/bin/env node
/**
 * 多模态知识对象验证脚本
 *
 * 验证内容：
 * 1. 数据库表结构验证
 * 2. 四向量检索接口验证
 * 3. 学科专用字段验证
 * 4. 数据完整性验证
 */

import { getDb } from '../api/core/db.js';
import { searchMultiVector, getQuestionVectorsStats } from '../api/routes/rag-search.js';

async function validateTables() {
  const pool = await getDb();
  console.log('🔍 数据库表结构验证');
  console.log('-'.repeat(50));

  const tables = ['exam_questions', 'question_vectors', 'question_images', 'question_formulas'];
  const results = {};

  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    results[table] = parseInt(result.rows[0].count);
    console.log(`  ${table}: ${results[table]} 条记录`);
  }

  const qvDetail = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE q_embedding IS NOT NULL) as q_count,
      COUNT(*) FILTER (WHERE s_embedding IS NOT NULL) as s_count,
      COUNT(*) FILTER (WHERE k_embedding IS NOT NULL) as k_count,
      COUNT(*) FILTER (WHERE a_embedding IS NOT NULL) as a_count,
      COUNT(*) FILTER (WHERE q_embedding IS NOT NULL AND s_embedding IS NOT NULL AND k_embedding IS NOT NULL AND a_embedding IS NOT NULL) as full_count
    FROM question_vectors
  `);
  const detail = qvDetail.rows[0];
  console.log(`  question_vectors 向量覆盖:`);
  console.log(`    Q向量: ${detail.q_count}`);
  console.log(`    S向量: ${detail.s_count}`);
  console.log(`    K向量: ${detail.k_count}`);
  console.log(`    A向量: ${detail.a_count}`);
  console.log(`    四向量完整: ${detail.full_count}`);

  const subjectStats = await pool.query(`
    SELECT subject_code, COUNT(*) as count
    FROM question_vectors
    GROUP BY subject_code
    ORDER BY count DESC
  `);
  console.log(`  学科分布:`);
  subjectStats.rows.forEach(row => {
    console.log(`    ${row.subject_code}: ${row.count} 题`);
  });

  return results;
}

async function validateSearchAPI() {
  console.log('\n🔍 四向量检索接口验证');
  console.log('-'.repeat(50));

  const testCases = [
    { query: '导数 函数单调性', vector_type: 'k', desc: '知识点检索（导数）' },
    { query: '找一道利用导数研究三次函数极值的题', vector_type: 'q+s', desc: '题目+语义检索' },
    { query: '分类讨论 解题方法', vector_type: 'a', desc: '解法检索（分类讨论）' },
    { query: '物理 牛顿第二定律 斜面', vector_type: 'q+s+k', desc: '三向量组合检索' },
    { query: '化学 氧气制备 实验装置', vector_type: 'all', desc: '四向量全检索' },
  ];

  for (const tc of testCases) {
    try {
      const results = await searchMultiVector(tc.query, {
        vector_type: tc.vector_type,
        top_k: 5,
        threshold: 0.5
      });
      console.log(`  ✅ ${tc.desc}`);
      console.log(`     查询: "${tc.query}"`);
      console.log(`     向量类型: ${tc.vector_type}`);
      console.log(`     结果数: ${results.length}`);
      if (results.length > 0) {
        console.log(`     最高相似度: ${results[0].similarity}`);
        console.log(`     示例题目ID: ${results[0].question_id}`);
      }
      console.log();
    } catch (e) {
      console.log(`  ❌ ${tc.desc}: ${e.message}`);
    }
  }
}

async function validateSubjectStructure() {
  const pool = await getDb();
  console.log('\n🔍 学科专用字段验证');
  console.log('-'.repeat(50));

  const subjects = ['math', 'physics', 'chemistry'];
  for (const subject of subjects) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ${subject}_structure IS NOT NULL AND ${subject}_structure != '{}') as has_structure,
        COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') as has_semantic,
        COUNT(*) FILTER (WHERE solution_description IS NOT NULL AND solution_description != '') as has_solution
      FROM exam_questions
      WHERE subject_code = $1
    `, [subject]);

    const stats = result.rows[0];
    const structRate = stats.total > 0 ? ((stats.has_structure / stats.total) * 100).toFixed(1) : '0';
    const semRate = stats.total > 0 ? ((stats.has_semantic / stats.total) * 100).toFixed(1) : '0';
    const solRate = stats.total > 0 ? ((stats.has_solution / stats.total) * 100).toFixed(1) : '0';

    console.log(`  ${subject}:`);
    console.log(`    题目总数: ${stats.total}`);
    console.log(`    结构化字段: ${stats.has_structure} (${structRate}%)`);
    console.log(`    语义描述: ${stats.has_semantic} (${semRate}%)`);
    console.log(`    解法描述: ${stats.has_solution} (${solRate}%)`);

    if (stats.has_structure > 0) {
      const sample = await pool.query(`
        SELECT ${subject}_structure, question_uid
        FROM exam_questions
        WHERE subject_code = $1 AND ${subject}_structure IS NOT NULL AND ${subject}_structure != '{}'
        LIMIT 1
      `, [subject]);
      if (sample.rows.length > 0) {
        const struct = sample.rows[0][`${subject}_structure`];
        const keys = Object.keys(struct || {});
        console.log(`    结构化字段示例 (${sample.rows[0].question_uid}):`);
        console.log(`      字段: ${keys.join(', ')}`);
      }
    }
    console.log();
  }
}

async function validateDataIntegrity() {
  const pool = await getDb();
  console.log('\n🔍 数据完整性验证');
  console.log('-'.repeat(50));

  const checks = [
    {
      name: 'question_vectors 无 question_id',
      query: 'SELECT COUNT(*) as count FROM question_vectors WHERE question_id IS NULL'
    },
    {
      name: 'exam_questions 无 question_uid',
      query: 'SELECT COUNT(*) as count FROM exam_questions WHERE question_uid IS NULL'
    },
    {
      name: 'question_vectors 无任何向量',
      query: 'SELECT COUNT(*) as count FROM question_vectors WHERE q_embedding IS NULL AND s_embedding IS NULL AND k_embedding IS NULL AND a_embedding IS NULL'
    },
    {
      name: 'question_vectors 关联的 exam_questions 不存在',
      query: 'SELECT COUNT(*) as count FROM question_vectors qv LEFT JOIN exam_questions eq ON qv.question_id = eq.id WHERE eq.id IS NULL'
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const result = await pool.query(check.query);
    const count = parseInt(result.rows[0].count);
    if (count > 0) {
      console.log(`  ❌ ${check.name}: ${count} 条`);
      allPassed = false;
    } else {
      console.log(`  ✅ ${check.name}: 0 条`);
    }
  }

  return allPassed;
}

async function main() {
  console.log('📋 多模态知识对象验证');
  console.log('='.repeat(60));

  await validateTables();
  await validateSearchAPI();
  await validateSubjectStructure();
  const integrityPassed = await validateDataIntegrity();

  console.log('\n' + '='.repeat(60));
  if (integrityPassed) {
    console.log('✅ 所有验证通过！');
  } else {
    console.log('⚠️ 部分验证未通过，请检查数据完整性');
  }

  await getDb().then(p => p.end());
  process.exit(integrityPassed ? 0 : 1);
}

main().catch(err => {
  console.error('❌ 验证失败:', err.message);
  process.exit(1);
});