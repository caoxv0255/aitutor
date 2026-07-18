#!/usr/bin/env node
/**
 * 北京地区多模态补全脚本
 *
 * 针对已有的 exam_questions 数据，增量补全：
 *   Phase 1: AI增强 — 语义描述、解法描述、公式语义、学科结构化
 *   Phase 2: 四向量生成 — Q/S/K/A Embedding
 *
 * 用法：
 *   node scripts/enrich-beijing.js                     # 全量补全
 *   node scripts/enrich-beijing.js --subject math       # 仅数学
 *   node scripts/enrich-beijing.js --subject physics --year 2024
 *   node scripts/enrich-beijing.js --phase vectors      # 仅生成向量
 *   node scripts/enrich-beijing.js --phase enhance      # 仅AI增强
 *   node scripts/enrich-beijing.js --batch 20           # 每批处理数
 */

import { getDb } from '../api/core/db.js';
import { getEmbedding } from '../services/embedding.js';
import {
  buildQText, buildSText, buildKText, buildAText,
  generateSemanticDescription, generateSolutionDescription, generateFormulaSemantics,
  parsePhysicsStructure, parseChemistryStructure, parseMathStructure
} from '../services/subject-parser.js';

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { subject: null, year: null, phase: 'all', batch: 20 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subject') opts.subject = args[++i];
    else if (args[i] === '--year') opts.year = parseInt(args[++i]);
    else if (args[i] === '--phase') opts.phase = args[++i];
    else if (args[i] === '--batch') opts.batch = parseInt(args[++i]);
  }
  return opts;
}

const opts = parseArgs();
const pool = await getDb();

console.log('🏛️  北京地区多模态补全');
console.log('='.repeat(60));
if (opts.subject) console.log(`📌 学科: ${opts.subject}`);
if (opts.year) console.log(`📌 年份: ${opts.year}`);
console.log(`📌 阶段: ${opts.phase}`);
console.log(`📌 批次大小: ${opts.batch}`);
console.log('');

// ── 查询需要补全的北京题目 ──
const conditions = [
  "p.province_code = 'beijing'",
  "p.exam_level = 'gaokao'"
];
const params = [];
let idx = 1;

if (opts.subject) {
  conditions.push(`q.subject_code = $${idx}`);
  params.push(opts.subject);
  idx++;
}
if (opts.year) {
  conditions.push(`p.year = $${idx}`);
  params.push(opts.year);
  idx++;
}

// Phase 1: 找缺AI增强的题目
// Phase 2: 找缺向量的题目
let enhanceWhere = '';
let vectorWhere = '';

if (opts.phase === 'enhance' || opts.phase === 'all') {
  enhanceWhere = `(q.semantic_description IS NULL OR q.semantic_description = '')`;
}
if (opts.phase === 'vectors' || opts.phase === 'all') {
  vectorWhere = `qv.id IS NULL`;
}

let whereClause = conditions.join(' AND ');
if (opts.phase === 'enhance' || opts.phase === 'all') {
  whereClause += ` AND ${enhanceWhere}`;
} else if (opts.phase === 'vectors') {
  whereClause += ` AND ${vectorWhere}`;
}

let query;
if (opts.phase === 'vectors') {
  query = `
    SELECT q.id, q.stem, q.options, q.answer, q.analysis,
           q.knowledge_points, q.difficulty, q.question_type, q.subject_code,
           q.has_image, q.has_formula, q.image_descriptions,
           q.latex_formulas, q.formula_semantics,
           q.semantic_description, q.solution_description,
           q.physics_structure, q.chemistry_structure, q.math_structure
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    LEFT JOIN question_vectors qv ON qv.question_id = q.id
    WHERE ${whereClause}
    ORDER BY q.subject_code, q.id
    LIMIT 2000
  `;
} else {
  query = `
    SELECT q.id, q.stem, q.options, q.answer, q.analysis,
           q.knowledge_points, q.difficulty, q.question_type, q.subject_code,
           q.has_image, q.has_formula, q.image_descriptions,
           q.latex_formulas, q.formula_semantics,
           q.semantic_description, q.solution_description,
           q.physics_structure, q.chemistry_structure, q.math_structure
    FROM exam_questions q
    JOIN exam_papers p ON q.paper_id = p.id
    WHERE ${whereClause}
    ORDER BY q.subject_code, q.id
    LIMIT 2000
  `;
}

const result = await pool.query(query, params);
const questions = result.rows;
console.log(`📊 待处理题目: ${questions.length} 道\n`);

if (questions.length === 0) {
  console.log('✅ 无需处理！');
  await pool.end();
  process.exit(0);
}

// 统计
const subjectGroups = {};
questions.forEach(q => {
  if (!subjectGroups[q.subject_code]) subjectGroups[q.subject_code] = 0;
  subjectGroups[q.subject_code]++;
});
console.log('📁 学科分布:');
Object.entries(subjectGroups).forEach(([s, c]) => {
  console.log(`   ${SUBJECT_CN[s] || s}: ${c} 道`);
});
console.log('');

// ── Phase 1: AI增强 ──
if (opts.phase === 'enhance' || opts.phase === 'all') {
  console.log('🧠 Phase 1: AI增强处理');
  console.log('-'.repeat(60));

  let enhanced = 0, failed = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `${SUBJECT_CN[q.subject_code] || q.subject_code} #${q.id}`;

    try {
      // 解析已有JSON字段
      let parsedOptions = null, parsedKP = null, parsedLatex = null;
      try { parsedOptions = JSON.parse(q.options); } catch {}
      try { parsedKP = JSON.parse(q.knowledge_points); } catch {}
      try { parsedLatex = JSON.parse(q.latex_formulas); } catch {}

      const questionText = q.stem + (parsedOptions ? '\n' + parsedOptions.join('\n') : '');

      // 生成语义描述
      let semantic = q.semantic_description;
      if (!semantic && questionText.length >= 10) {
        try {
          semantic = await generateSemanticDescription(questionText, q.subject_code);
        } catch (e) {
          console.log(`  ⚠️ 语义失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      }

      // 生成解法描述
      let solution = q.solution_description;
      if (!solution && questionText.length >= 10) {
        try {
          solution = await generateSolutionDescription(questionText, q.answer, q.analysis, q.subject_code);
        } catch (e) {
          console.log(`  ⚠️ 解法失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      }

      // 生成公式语义
      let formulaSem = q.formula_semantics;
      if (!formulaSem && parsedLatex && parsedLatex.length > 0) {
        try {
          formulaSem = await generateFormulaSemantics(parsedLatex.join('\n'));
        } catch (e) {
          console.log(`  ⚠️ 公式语义失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      }

      // 学科结构化
      let physStruct = q.physics_structure;
      let chemStruct = q.chemistry_structure;
      let mathStruct = q.math_structure;

      if (q.subject_code === 'physics' && (!physStruct || physStruct === '{}')) {
        try {
          physStruct = await parsePhysicsStructure(questionText);
        } catch (e) {
          console.log(`  ⚠️ 物理结构失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      } else if (q.subject_code === 'chemistry' && (!chemStruct || chemStruct === '{}')) {
        try {
          chemStruct = await parseChemistryStructure(questionText);
        } catch (e) {
          console.log(`  ⚠️ 化学结构失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      } else if (q.subject_code === 'math' && (!mathStruct || mathStruct === '{}')) {
        try {
          mathStruct = await parseMathStructure(questionText);
        } catch (e) {
          console.log(`  ⚠️ 数学结构失败 #${q.id}: ${e.message.substring(0, 60)}`);
        }
      }

      // 更新数据库
      await pool.query(`
        UPDATE exam_questions SET
          semantic_description = COALESCE($1, semantic_description),
          solution_description = COALESCE($2, solution_description),
          formula_semantics = COALESCE($3, formula_semantics),
          physics_structure = CASE WHEN $4::jsonb IS NOT NULL THEN $4 ELSE physics_structure END,
          chemistry_structure = CASE WHEN $5::jsonb IS NOT NULL THEN $5 ELSE chemistry_structure END,
          math_structure = CASE WHEN $6::jsonb IS NOT NULL THEN $6 ELSE math_structure END,
          has_image = CASE WHEN $7 THEN TRUE ELSE has_image END,
          has_formula = CASE WHEN $8 THEN TRUE ELSE has_formula END,
          updated_at = NOW()
        WHERE id = $9
      `, [
        semantic || null,
        solution || null,
        formulaSem || null,
        (physStruct && physStruct !== '{}') ? JSON.stringify(physStruct) : null,
        (chemStruct && chemStruct !== '{}') ? JSON.stringify(chemStruct) : null,
        (mathStruct && mathStruct !== '{}') ? JSON.stringify(mathStruct) : null,
        !!(q.image_descriptions && q.image_descriptions.trim()),
        !!(parsedLatex && parsedLatex.length > 0),
        q.id
      ]);

      // 回写以便后续向量生成
      q.semantic_description = semantic || q.semantic_description;
      q.solution_description = solution || q.solution_description;
      q.formula_semantics = formulaSem || q.formula_semantics;
      if (physStruct && physStruct !== '{}') q.physics_structure = physStruct;
      if (chemStruct && chemStruct !== '{}') q.chemistry_structure = chemStruct;
      if (mathStruct && mathStruct !== '{}') q.math_structure = mathStruct;

      enhanced++;
      if ((i + 1) % 10 === 0 || i === questions.length - 1) {
        console.log(`  📈 进度: ${i + 1}/${questions.length} (增强: ${enhanced}, 失败: ${failed})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ❌ #${q.id}: ${err.message.substring(0, 80)}`);
    }

    // 限流
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ AI增强完成: ${enhanced} 成功, ${failed} 失败\n`);
}

// ── Phase 2: 四向量生成 ──
if (opts.phase === 'vectors' || opts.phase === 'all') {
  console.log('🔢 Phase 2: 四向量生成');
  console.log('-'.repeat(60));

  // 如果是all模式，需要重新查询（因为AI增强可能新增了字段）
  let vectorQuestions;
  if (opts.phase === 'all') {
    const vr = await pool.query(`
      SELECT q.id, q.stem, q.options, q.answer, q.analysis,
             q.knowledge_points, q.difficulty, q.question_type, q.subject_code,
             q.has_image, q.has_formula, q.image_descriptions,
             q.latex_formulas, q.formula_semantics,
             q.semantic_description, q.solution_description
      FROM exam_questions q
      JOIN exam_papers p ON q.paper_id = p.id
      LEFT JOIN question_vectors qv ON qv.question_id = q.id
      WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
        AND qv.id IS NULL
      ORDER BY q.subject_code, q.id
      LIMIT 2000
    `);
    vectorQuestions = vr.rows;
  } else {
    vectorQuestions = questions;
  }

  console.log(`待生成向量: ${vectorQuestions.length} 道\n`);

  let vecSuccess = 0, vecFailed = 0;

  for (let i = 0; i < vectorQuestions.length; i++) {
    const q = vectorQuestions[i];

    try {
      // 构建题目对象（供buildXText使用）
      let parsedOptions = null, parsedKP = null, parsedLatex = null;
      try { parsedOptions = JSON.parse(q.options); } catch {}
      try { parsedKP = JSON.parse(q.knowledge_points); } catch {}
      try { parsedLatex = JSON.parse(q.latex_formulas); } catch {}

      const question = {
        stem: q.stem,
        options: parsedOptions,
        answer: q.answer,
        analysis: q.analysis,
        knowledge_points: parsedKP,
        difficulty: q.difficulty,
        question_type: q.question_type,
        subject_code: q.subject_code,
        has_image: q.has_image,
        has_formula: q.has_formula,
        image_descriptions: q.image_descriptions,
        latex_formulas: parsedLatex,
        formula_semantics: q.formula_semantics,
        semantic_description: q.semantic_description,
        solution_description: q.solution_description,
      };

      const qText = buildQText(question);
      const sText = buildSText(question);
      const kText = buildKText(question);
      const aText = buildAText(question);

      let qEmb = null, sEmb = null, kEmb = null, aEmb = null;

      try { if (qText.length >= 10) qEmb = await getEmbedding(qText); } catch (e) { /* skip */ }
      try { if (sText.length >= 10) sEmb = await getEmbedding(sText); } catch (e) { /* skip */ }
      try { if (kText.length >= 10) kEmb = await getEmbedding(kText); } catch (e) { /* skip */ }
      try { if (aText.length >= 10) aEmb = await getEmbedding(aText); } catch (e) { /* skip */ }

      // 生成 question_uid
      const uidResult = await pool.query(
        'SELECT question_uid FROM exam_questions WHERE id = $1', [q.id]
      );
      const questionUid = uidResult.rows[0]?.question_uid || `beijing_${q.subject_code}_${q.id}`;

      await pool.query(`
        INSERT INTO question_vectors (
          question_id, question_uid, subject_code, question_type, difficulty,
          q_embedding, s_embedding, k_embedding, a_embedding,
          q_text, s_text, k_text, a_text
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (question_id) DO UPDATE SET
          q_embedding = COALESCE(EXCLUDED.q_embedding, question_vectors.q_embedding),
          s_embedding = COALESCE(EXCLUDED.s_embedding, question_vectors.s_embedding),
          k_embedding = COALESCE(EXCLUDED.k_embedding, question_vectors.k_embedding),
          a_embedding = COALESCE(EXCLUDED.a_embedding, question_vectors.a_embedding),
          q_text = COALESCE(EXCLUDED.q_text, question_vectors.q_text),
          s_text = COALESCE(EXCLUDED.s_text, question_vectors.s_text),
          k_text = COALESCE(EXCLUDED.k_text, question_vectors.k_text),
          a_text = COALESCE(EXCLUDED.a_text, question_vectors.a_text),
          updated_at = NOW()
      `, [
        q.id, questionUid, q.subject_code, q.question_type, q.difficulty,
        qEmb ? `[${qEmb.join(',')}]` : null,
        sEmb ? `[${sEmb.join(',')}]` : null,
        kEmb ? `[${kEmb.join(',')}]` : null,
        aEmb ? `[${aEmb.join(',')}]` : null,
        qText || null, sText || null, kText || null, aText || null
      ]);

      vecSuccess++;
      if ((i + 1) % 10 === 0 || i === vectorQuestions.length - 1) {
        console.log(`  📈 进度: ${i + 1}/${vectorQuestions.length} (成功: ${vecSuccess}, 失败: ${vecFailed})`);
      }
    } catch (err) {
      vecFailed++;
      console.log(`  ❌ 向量失败 #${q.id}: ${err.message.substring(0, 80)}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ 四向量生成完成: ${vecSuccess} 成功, ${vecFailed} 失败\n`);
}

// ── 最终统计 ──
console.log('='.repeat(60));
console.log('📊 北京地区多模态补全统计');

const finalStats = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') AS has_semantic,
    COUNT(*) FILTER (WHERE solution_description IS NOT NULL AND solution_description != '') AS has_solution,
    COUNT(*) FILTER (WHERE formula_semantics IS NOT NULL AND formula_semantics != '') AS has_formula_sem
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`);
const fs = finalStats.rows[0];
console.log(`  题目总数: ${fs.total}`);
console.log(`  语义描述: ${fs.has_semantic} (${((fs.has_semantic / fs.total) * 100).toFixed(1)}%)`);
console.log(`  解法描述: ${fs.has_solution} (${((fs.has_solution / fs.total) * 100).toFixed(1)}%)`);
console.log(`  公式语义: ${fs.has_formula_sem} (${((fs.has_formula_sem / fs.total) * 100).toFixed(1)}%)`);

const vecStats = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE qv.q_embedding IS NOT NULL) AS q_count,
    COUNT(*) FILTER (WHERE qv.s_embedding IS NOT NULL) AS s_count,
    COUNT(*) FILTER (WHERE qv.k_embedding IS NOT NULL) AS k_count,
    COUNT(*) FILTER (WHERE qv.a_embedding IS NOT NULL) AS a_count
  FROM question_vectors qv
  JOIN exam_questions q ON qv.question_id = q.id
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`);
const vs = vecStats.rows[0];
const vt = parseInt(vs.total) || 1;
console.log(`  四向量记录: ${vs.total}`);
console.log(`  Q向量: ${vs.q_count} (${((vs.q_count / vt) * 100).toFixed(1)}%)`);
console.log(`  S向量: ${vs.s_count} (${((vs.s_count / vt) * 100).toFixed(1)}%)`);
console.log(`  K向量: ${vs.k_count} (${((vs.k_count / vt) * 100).toFixed(1)}%)`);
console.log(`  A向量: ${vs.a_count} (${((vs.a_count / vt) * 100).toFixed(1)}%)`);

console.log('\n✅ 补全完成！');
await pool.end();
process.exit(0);