#!/usr/bin/env node
/**
 * 北京地区专项多模态分析脚本
 *
 * 分析维度：
 * 1. 学科分布（各学科题目数、覆盖率）
 * 2. 题型分布（选择/填空/解答）
 * 3. 难度分布（1-5 级）
 * 4. 知识点分布（高频考点）
 * 5. 学科结构化覆盖率（物理/化学/数学专用字段）
 * 6. 多模态字段覆盖率（图片/公式/语义）
 * 7. 四向量覆盖率
 * 8. 年代趋势分析
 */

import { getDb } from '../api/core/db.js';

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const TYPE_CN = {
  choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题'
};

const pool = await getDb();

console.log('🏛️  北京地区多模态知识对象分析报告');
console.log('='.repeat(70));
console.log(`📅 分析时间: ${new Date().toLocaleString('zh-CN')}`);
console.log('');

// ─── 1. 基础数据概览 ───
console.log('📊 1. 基础数据概览');
console.log('-'.repeat(70));

const overviewResult = await pool.query(`
  SELECT
    COUNT(DISTINCT id) AS paper_count,
    COUNT(DISTINCT year) AS year_count,
    MIN(year) AS min_year,
    MAX(year) AS max_year
  FROM exam_papers
  WHERE province_code = 'beijing' AND exam_level = 'gaokao'
`);
const overview = overviewResult.rows[0];
console.log(`   试卷总数: ${overview.paper_count} 套`);
console.log(`   年份跨度: ${overview.min_year} - ${overview.max_year} (${overview.year_count} 年)`);

const totalQuestionsResult = await pool.query(`
  SELECT COUNT(*) as count
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`);
console.log(`   题目总数: ${totalQuestionsResult.rows[0].count} 道`);

const totalVectorsResult = await pool.query(`
  SELECT COUNT(*) as count
  FROM question_vectors qv
  JOIN exam_questions q ON qv.question_id = q.id
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`);
console.log(`   四向量记录: ${totalVectorsResult.rows[0].count} 条\n`);

// ─── 2. 学科分布 ───
console.log('📚 2. 学科分布');
console.log('-'.repeat(70));

const subjectResult = await pool.query(`
  SELECT
    p.subject,
    COUNT(DISTINCT p.id) AS paper_count,
    COUNT(q.id) AS question_count,
    AVG(q.difficulty) AS avg_difficulty
  FROM exam_papers p
  LEFT JOIN exam_questions q ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
  GROUP BY p.subject
  ORDER BY question_count DESC
`);
console.log('   学科         试卷数  题目数  平均难度');
subjectResult.rows.forEach(row => {
  const subj = SUBJECT_CN[row.subject] || row.subject;
  const papers = String(row.paper_count).padStart(4);
  const questions = String(row.question_count).padStart(5);
  const diff = row.avg_difficulty ? parseFloat(row.avg_difficulty).toFixed(2) : 'N/A';
  console.log(`   ${subj.padEnd(8)}   ${papers}   ${questions}    ${diff}`);
});
console.log('');

// ─── 3. 题型分布 ───
console.log('📝 3. 题型分布');
console.log('-'.repeat(70));

const typeResult = await pool.query(`
  SELECT
    q.question_type,
    COUNT(*) AS count,
    AVG(q.difficulty) AS avg_difficulty
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
    AND q.question_type IS NOT NULL
  GROUP BY q.question_type
  ORDER BY count DESC
`);
console.log('   题型         数量    占比    平均难度');
const totalTyped = typeResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
typeResult.rows.forEach(row => {
  const type = TYPE_CN[row.question_type] || row.question_type;
  const count = String(row.count).padStart(5);
  const pct = ((row.count / totalTyped) * 100).toFixed(1) + '%';
  const diff = row.avg_difficulty ? parseFloat(row.avg_difficulty).toFixed(2) : 'N/A';
  console.log(`   ${type.padEnd(8)}   ${count}  ${pct.padStart(5)}    ${diff}`);
});
console.log('');

// ─── 4. 难度分布 ───
console.log('📈 4. 难度分布');
console.log('-'.repeat(70));

const difficultyResult = await pool.query(`
  SELECT
    q.difficulty,
    COUNT(*) AS count
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
    AND q.difficulty IS NOT NULL
  GROUP BY q.difficulty
  ORDER BY q.difficulty
`);
const diffTotal = difficultyResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
console.log('   难度等级  数量    占比    评价');
const diffLabels = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★', 5: '★★★★★' };
difficultyResult.rows.forEach(row => {
  const label = diffLabels[row.difficulty] || '';
  const count = String(row.count).padStart(5);
  const pct = ((row.count / diffTotal) * 100).toFixed(1) + '%';
  console.log(`   ${String(row.difficulty).padStart(3)} ★      ${count}  ${pct.padStart(5)}   ${label}`);
});
console.log('');

// ─── 5. 知识点分布（Top 20） ───
console.log('🎯 5. 高频知识点（Top 20）');
console.log('-'.repeat(70));

const kpResult = await pool.query(`
  SELECT
    kp.id AS knowledge_point_id,
    kp.name AS knowledge_point_name,
    kp.subject,
    COUNT(*) AS count
  FROM question_knowledge_points qkp
  JOIN knowledge_points kp ON qkp.knowledge_point_id = kp.id
  JOIN exam_questions q ON qkp.question_id = q.id
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
  GROUP BY kp.id, kp.name, kp.subject
  ORDER BY count DESC
  LIMIT 20
`);
if (kpResult.rows.length === 0) {
  // 备选方案：从 exam_questions.knowledge_points 字段直接解析（如果用JSON存储）
  const altResult = await pool.query(`
    SELECT knowledge_points
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
      AND q.knowledge_points IS NOT NULL
    LIMIT 100
  `);
  console.log('   提示: question_knowledge_points 关联表为空，可能是历史数据未生成关联');
  console.log(`   raw knowledge_points 字段样本: ${altResult.rows.length} 条`);
}
console.log('   排名  学科     知识点                       题目数');
kpResult.rows.forEach((row, idx) => {
  const rank = String(idx + 1).padStart(3);
  const subj = (SUBJECT_CN[row.subject] || row.subject).padEnd(4);
  const kpName = (row.knowledge_point_name || '').substring(0, 28).padEnd(28);
  console.log(`   ${rank}   ${subj}  ${kpName}  ${row.count}`);
});
console.log('');

// ─── 6. 学科结构化字段覆盖率 ───
console.log('🧪 6. 学科专用结构化字段覆盖率');
console.log('-'.repeat(70));

const structureSubjects = ['math', 'physics', 'chemistry'];
for (const subject of structureSubjects) {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ${subject}_structure IS NOT NULL AND ${subject}_structure != '{}') AS has_struct,
      COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') AS has_semantic,
      COUNT(*) FILTER (WHERE solution_description IS NOT NULL AND solution_description != '') AS has_solution,
      COUNT(*) FILTER (WHERE has_image = true) AS has_image,
      COUNT(*) FILTER (WHERE has_formula = true) AS has_formula,
      COUNT(*) FILTER (WHERE image_descriptions IS NOT NULL AND image_descriptions != '') AS has_img_desc,
      COUNT(*) FILTER (WHERE latex_formulas IS NOT NULL AND latex_formulas != '[]') AS has_latex
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
      AND q.subject_code = $1
  `, [subject]);

  const stats = result.rows[0];
  if (parseInt(stats.total) === 0) {
    console.log(`   ${SUBJECT_CN[subject]}: 无数据`);
    continue;
  }

  const total = parseInt(stats.total);
  console.log(`\n   【${SUBJECT_CN[subject]}】 总计: ${total} 题`);
  console.log(`   ${'结构化字段'.padEnd(20)}: ${String(stats.has_struct).padStart(4)} (${((stats.has_struct / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'语义描述'.padEnd(20)}: ${String(stats.has_semantic).padStart(4)} (${((stats.has_semantic / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'解法描述'.padEnd(20)}: ${String(stats.has_solution).padStart(4)} (${((stats.has_solution / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'含图片题'.padEnd(20)}: ${String(stats.has_image).padStart(4)} (${((stats.has_image / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'含公式题'.padEnd(20)}: ${String(stats.has_formula).padStart(4)} (${((stats.has_formula / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'图片描述'.padEnd(20)}: ${String(stats.has_img_desc).padStart(4)} (${((stats.has_img_desc / total) * 100).toFixed(1)}%)`);
  console.log(`   ${'LaTeX公式'.padEnd(20)}: ${String(stats.has_latex).padStart(4)} (${((stats.has_latex / total) * 100).toFixed(1)}%)`);
}
console.log('');

// ─── 7. 四向量覆盖率 ───
console.log('🔢 7. 四向量覆盖率');
console.log('-'.repeat(70));

const vectorResult = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE qv.q_embedding IS NOT NULL) AS q_count,
    COUNT(*) FILTER (WHERE qv.s_embedding IS NOT NULL) AS s_count,
    COUNT(*) FILTER (WHERE qv.k_embedding IS NOT NULL) AS k_count,
    COUNT(*) FILTER (WHERE qv.a_embedding IS NOT NULL) AS a_count,
    COUNT(*) FILTER (WHERE qv.q_embedding IS NOT NULL AND qv.s_embedding IS NOT NULL AND qv.k_embedding IS NOT NULL AND qv.a_embedding IS NOT NULL) AS full_count
  FROM question_vectors qv
  JOIN exam_questions q ON qv.question_id = q.id
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`);
const vStats = vectorResult.rows[0];
const vTotal = parseInt(vStats.total);
console.log(`   总计: ${vTotal} 条记录`);
console.log(`   Q向量（题目）: ${String(vStats.q_count).padStart(4)} (${((vStats.q_count / vTotal) * 100).toFixed(1)}%)`);
console.log(`   S向量（语义）: ${String(vStats.s_count).padStart(4)} (${((vStats.s_count / vTotal) * 100).toFixed(1)}%)`);
console.log(`   K向量（知识点）: ${String(vStats.k_count).padStart(4)} (${((vStats.k_count / vTotal) * 100).toFixed(1)}%)`);
console.log(`   A向量（解法）: ${String(vStats.a_count).padStart(4)} (${((vStats.a_count / vTotal) * 100).toFixed(1)}%)`);
console.log(`   四向量完整: ${String(vStats.full_count).padStart(4)} (${((vStats.full_count / vTotal) * 100).toFixed(1)}%)\n`);

// ─── 8. 年代趋势 ───
console.log('📅 8. 题目数量年代趋势');
console.log('-'.repeat(70));

const yearResult = await pool.query(`
  SELECT
    p.year,
    COUNT(DISTINCT p.id) AS paper_count,
    COUNT(q.id) AS question_count
  FROM exam_papers p
  LEFT JOIN exam_questions q ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
  GROUP BY p.year
  ORDER BY p.year
`);
console.log('   年份     试卷数   题目数');
yearResult.rows.forEach(row => {
  const year = String(row.year).padStart(4);
  console.log(`   ${year}     ${String(row.paper_count).padStart(4)}    ${String(row.question_count).padStart(5)}`);
});
console.log('');

// ─── 9. 数学分卷专项统计 ───
console.log('➗ 9. 北京数学分卷专项统计');
console.log('-'.repeat(70));

const mathResult = await pool.query(`
  SELECT
    p.math_type,
    COUNT(DISTINCT p.id) AS paper_count,
    COUNT(q.id) AS question_count
  FROM exam_papers p
  LEFT JOIN exam_questions q ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
    AND p.subject = 'math'
  GROUP BY p.math_type
  ORDER BY p.math_type
`);
console.log('   数学类型     试卷数   题目数');
mathResult.rows.forEach(row => {
  const typeLabel = {
    arts: '文科数学', science: '理科数学', unified: '统一数学', null: '未指定'
  }[row.math_type] || row.math_type || '未指定';
  console.log(`   ${typeLabel.padEnd(10)}   ${String(row.paper_count).padStart(4)}    ${String(row.question_count).padStart(5)}`);
});
console.log('');

console.log('='.repeat(70));
console.log('✅ 北京地区多模态分析报告生成完成！');

await pool.end();
process.exit(0);