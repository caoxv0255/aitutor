#!/usr/bin/env node
/**
 * 北京地区多模态补全 — 精简执行版
 * 
 * 关键修复：在所有import之前显式加载dotenv
 * 
 * 用法：
 *   node scripts/run-enrich-beijing.js --subject math --phase enhance
 *   node scripts/run-enrich-beijing.js --subject math --phase vectors
 *   node scripts/run-enrich-beijing.js --phase enhance   # 全部学科
 *   node scripts/run-enrich-beijing.js --phase all       # AI增强+向量
 */

// 1. 显式加载dotenv（在所有其他import之前）
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

// 2. 验证环境变量
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY 未加载！请检查 .env 文件');
  process.exit(1);
}
console.log(`🔑 DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY.substring(0, 10)}...`);

// 3. 动态导入业务模块（此时dotenv已加载）
const { getDb } = await import('../api/core/db.js');
const { getEmbedding } = await import('../services/embedding.js');
const {
  buildQText, buildSText, buildKText, buildAText,
  generateSemanticDescription, generateSolutionDescription, generateFormulaSemantics,
  parsePhysicsStructure, parseChemistryStructure, parseMathStructure
} = await import('../services/subject-parser.js');

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

// ── 参数解析 ──
const args = process.argv.slice(2);
const opts = { subject: null, year: null, phase: 'enhance' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--subject') opts.subject = args[++i];
  else if (args[i] === '--year') opts.year = parseInt(args[++i]);
  else if (args[i] === '--phase') opts.phase = args[++i];
}

console.log('🏛️  北京地区多模态补全');
console.log('='.repeat(60));
if (opts.subject) console.log(`📌 学科: ${opts.subject}`);
if (opts.year) console.log(`📌 年份: ${opts.year}`);
console.log(`📌 阶段: ${opts.phase}\n`);

const pool = await getDb();

// ── 查询待处理题目 ──
const conditions = ["p.province_code = 'beijing'", "p.exam_level = 'gaokao'"];
const params = [];
let idx = 1;

if (opts.subject) { conditions.push(`q.subject_code = $${idx}`); params.push(opts.subject); idx++; }
if (opts.year) { conditions.push(`p.year = $${idx}`); params.push(opts.year); idx++; }

let whereExtra = '';
if (opts.phase === 'enhance' || opts.phase === 'all') {
  whereExtra = ` AND (q.semantic_description IS NULL OR q.semantic_description = '')`;
} else if (opts.phase === 'vectors') {
  whereExtra = ` AND qv.id IS NULL`;
}

const joinClause = (opts.phase === 'vectors') ? 'LEFT JOIN question_vectors qv ON qv.question_id = q.id' : '';

const query = `
  SELECT q.id, q.stem, q.options, q.answer, q.analysis,
         q.knowledge_points, q.difficulty, q.question_type, q.subject_code,
         q.has_image, q.has_formula, q.image_descriptions,
         q.latex_formulas, q.formula_semantics,
         q.semantic_description, q.solution_description,
         q.physics_structure, q.chemistry_structure, q.math_structure,
         q.question_uid
  FROM exam_questions q
  JOIN exam_papers p ON q.paper_id = p.id
  ${joinClause}
  WHERE ${conditions.join(' AND ')} ${whereExtra}
  ORDER BY q.subject_code, q.id
  LIMIT 2500
`;

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
questions.forEach(q => { subjectGroups[q.subject_code] = (subjectGroups[q.subject_code] || 0) + 1; });
Object.entries(subjectGroups).forEach(([s, c]) => console.log(`  ${SUBJECT_CN[s] || s}: ${c} 道`));
console.log('');

// ── Phase: AI增强 ──
if (opts.phase === 'enhance' || opts.phase === 'all') {
  console.log('🧠 Phase: AI增强处理');
  console.log('-'.repeat(60));

  let ok = 0, fail = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      let parsedOptions = null, parsedKP = null, parsedLatex = null;
      try { parsedOptions = JSON.parse(q.options); } catch {}
      try { parsedKP = JSON.parse(q.knowledge_points); } catch {}
      try { parsedLatex = JSON.parse(q.latex_formulas); } catch {}

      const text = q.stem + (parsedOptions ? '\n' + parsedOptions.join('\n') : '');

      // 语义描述
      let semantic = q.semantic_description;
      if (!semantic && text.length >= 5) {
        semantic = await generateSemanticDescription(text, q.subject_code);
      }

      // 解法描述
      let solution = q.solution_description;
      if (!solution && text.length >= 5) {
        solution = await generateSolutionDescription(text, q.answer, q.analysis, q.subject_code);
      }

      // 公式语义
      let formulaSem = q.formula_semantics;
      if (!formulaSem && parsedLatex && parsedLatex.length > 0) {
        formulaSem = await generateFormulaSemantics(parsedLatex.join('\n'));
      }

      // 学科结构化
      let mathStruct = q.math_structure;
      let physStruct = q.physics_structure;
      let chemStruct = q.chemistry_structure;

      if (q.subject_code === 'math' && (!mathStruct || mathStruct === '{}' || (typeof mathStruct === 'object' && Object.keys(mathStruct).length === 0))) {
        mathStruct = await parseMathStructure(text);
      } else if (q.subject_code === 'physics' && (!physStruct || physStruct === '{}')) {
        physStruct = await parsePhysicsStructure(text);
      } else if (q.subject_code === 'chemistry' && (!chemStruct || chemStruct === '{}')) {
        chemStruct = await parseChemistryStructure(text);
      }

      // 写入数据库
      await pool.query(`
        UPDATE exam_questions SET
          semantic_description = CASE WHEN $1::text IS NOT NULL AND $1 != '' THEN $1 ELSE semantic_description END,
          solution_description = CASE WHEN $2::text IS NOT NULL AND $2 != '' THEN $2 ELSE solution_description END,
          formula_semantics = CASE WHEN $3::text IS NOT NULL AND $3 != '' THEN $3 ELSE formula_semantics END,
          math_structure = CASE WHEN $4::jsonb IS NOT NULL THEN $4 ELSE math_structure END,
          physics_structure = CASE WHEN $5::jsonb IS NOT NULL THEN $5 ELSE physics_structure END,
          chemistry_structure = CASE WHEN $6::jsonb IS NOT NULL THEN $6 ELSE chemistry_structure END,
          has_image = CASE WHEN $7 THEN TRUE ELSE has_image END,
          has_formula = CASE WHEN $8 THEN TRUE ELSE has_formula END,
          updated_at = NOW()
        WHERE id = $9
      `, [
        semantic || null,
        solution || null,
        formulaSem || null,
        (mathStruct && typeof mathStruct === 'object' && Object.keys(mathStruct).length > 0) ? JSON.stringify(mathStruct) : null,
        (physStruct && typeof physStruct === 'object' && Object.keys(physStruct).length > 0) ? JSON.stringify(physStruct) : null,
        (chemStruct && typeof chemStruct === 'object' && Object.keys(chemStruct).length > 0) ? JSON.stringify(chemStruct) : null,
        !!(q.image_descriptions && String(q.image_descriptions).trim()),
        !!(parsedLatex && parsedLatex.length > 0),
        q.id
      ]);

      // 回写
      q.semantic_description = semantic || q.semantic_description;
      q.solution_description = solution || q.solution_description;

      ok++;
      if ((i + 1) % 5 === 0 || i === questions.length - 1) {
        console.log(`  📈 ${i + 1}/${questions.length} (✅${ok} ❌${fail})`);
      }
    } catch (err) {
      fail++;
      console.log(`  ❌ #${q.id}: ${err.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\n✅ AI增强完成: ${ok} 成功, ${fail} 失败\n`);
}

// ── Phase: 四向量生成 ──
if (opts.phase === 'vectors' || opts.phase === 'all') {
  console.log('🔢 Phase: 四向量生成');
  console.log('-'.repeat(60));

  let vecQs;
  if (opts.phase === 'all') {
    const vr = await pool.query(`
      SELECT q.id, q.stem, q.options, q.answer, q.analysis,
             q.knowledge_points, q.difficulty, q.question_type, q.subject_code,
             q.has_image, q.has_formula, q.image_descriptions,
             q.latex_formulas, q.formula_semantics,
             q.semantic_description, q.solution_description, q.question_uid
      FROM exam_questions q
      JOIN exam_papers p ON q.paper_id = p.id
      LEFT JOIN question_vectors qv ON qv.question_id = q.id
      WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao' AND qv.id IS NULL
      ORDER BY q.id
      LIMIT 2500
    `);
    vecQs = vr.rows;
  } else {
    vecQs = questions;
  }

  console.log(`待生成向量: ${vecQs.length} 道\n`);
  let vOk = 0, vFail = 0;

  for (let i = 0; i < vecQs.length; i++) {
    const q = vecQs[i];
    try {
      let parsedOptions = null, parsedKP = null, parsedLatex = null;
      try { parsedOptions = JSON.parse(q.options); } catch {}
      try { parsedKP = JSON.parse(q.knowledge_points); } catch {}
      try { parsedLatex = JSON.parse(q.latex_formulas); } catch {}

      const question = {
        stem: q.stem, options: parsedOptions, answer: q.answer, analysis: q.analysis,
        knowledge_points: parsedKP, difficulty: q.difficulty, question_type: q.question_type,
        subject_code: q.subject_code, has_image: q.has_image, has_formula: q.has_formula,
        image_descriptions: q.image_descriptions, latex_formulas: parsedLatex,
        formula_semantics: q.formula_semantics, semantic_description: q.semantic_description,
        solution_description: q.solution_description,
      };

      const qText = buildQText(question);
      const sText = buildSText(question);
      const kText = buildKText(question);
      const aText = buildAText(question);

      let qEmb = null, sEmb = null, kEmb = null, aEmb = null;
      try { if (qText.length >= 10) qEmb = await getEmbedding(qText); } catch {}
      try { if (sText.length >= 10) sEmb = await getEmbedding(sText); } catch {}
      try { if (kText.length >= 10) kEmb = await getEmbedding(kText); } catch {}
      try { if (aText.length >= 10) aEmb = await getEmbedding(aText); } catch {}

      const questionUid = q.question_uid || `beijing_${q.subject_code}_${q.id}`;

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

      vOk++;
      if ((i + 1) % 5 === 0 || i === vecQs.length - 1) {
        console.log(`  📈 ${i + 1}/${vecQs.length} (✅${vOk} ❌${vFail})`);
      }
    } catch (err) {
      vFail++;
      console.log(`  ❌ 向量 #${q.id}: ${err.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`\n✅ 四向量完成: ${vOk} 成功, ${vFail} 失败\n`);
}

// ── 最终统计 ──
console.log('='.repeat(60));
const fs = (await pool.query(`
  SELECT COUNT(*) AS total,
    COUNT(*) FILTER (WHERE semantic_description IS NOT NULL AND semantic_description != '') AS has_sem,
    COUNT(*) FILTER (WHERE solution_description IS NOT NULL AND solution_description != '') AS has_sol,
    COUNT(*) FILTER (WHERE math_structure IS NOT NULL AND math_structure != '{}') AS has_math
  FROM exam_questions q JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`)).rows[0];
console.log(`📊 语义描述: ${fs.has_sem}/${fs.total} (${((fs.has_sem/fs.total)*100).toFixed(1)}%)`);
console.log(`📊 解法描述: ${fs.has_sol}/${fs.total} (${((fs.has_sol/fs.total)*100).toFixed(1)}%)`);
console.log(`📊 数学结构: ${fs.has_math}/${fs.total}`);

const vs = (await pool.query(`
  SELECT COUNT(*) AS total,
    COUNT(*) FILTER (WHERE qv.q_embedding IS NOT NULL) AS q,
    COUNT(*) FILTER (WHERE qv.s_embedding IS NOT NULL) AS s,
    COUNT(*) FILTER (WHERE qv.k_embedding IS NOT NULL) AS k,
    COUNT(*) FILTER (WHERE qv.a_embedding IS NOT NULL) AS a
  FROM question_vectors qv JOIN exam_questions q ON qv.question_id = q.id
  JOIN exam_papers p ON q.paper_id = p.id
  WHERE p.province_code = 'beijing' AND p.exam_level = 'gaokao'
`)).rows[0];
const vt = parseInt(vs.total) || 1;
console.log(`📊 Q向量: ${vs.q}/${vt}  S向量: ${vs.s}/${vt}  K向量: ${vs.k}/${vt}  A向量: ${vs.a}/${vt}`);

await pool.end();
console.log('\n✅ 补全完成！');
process.exit(0);
