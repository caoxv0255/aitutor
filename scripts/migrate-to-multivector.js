#!/usr/bin/env node
/**
 * 数据迁移脚本 — 将 rag_questions 数据迁移到 question_vectors 表
 *
 * 迁移流程：
 * 1. 查询 rag_questions 表中尚未迁移的数据
 * 2. 关联 exam_questions 获取完整题目信息
 * 3. 生成四向量文本（Q/S/K/A）
 * 4. 生成四向量 Embedding
 * 5. 写入 question_vectors 表
 */

import { getDb } from '../api/core/db.js';
import { getEmbedding } from '../services/embedding.js';
import {
  buildQText,
  buildSText,
  buildKText,
  buildAText,
  generateSemanticDescription,
  generateSolutionDescription,
  generateFormulaSemantics,
  parsePhysicsStructure,
  parseChemistryStructure,
  parseMathStructure
} from '../services/subject-parser.js';

const BATCH_SIZE = 10;
const DELAY_MS = 200;

async function runMigration() {
  const pool = await getDb();
  console.log('📋 数据迁移 — rag_questions → question_vectors');
  console.log('='.repeat(60));

  const existingResult = await pool.query(`
    SELECT DISTINCT question_id FROM question_vectors
  `);
  const existingIds = new Set(existingResult.rows.map(r => r.question_id));
  console.log(`已存在四向量记录: ${existingIds.size}`);

  const pendingResult = await pool.query(`
    SELECT
      r.id AS rag_id,
      r.content,
      r.knowledge_point_id,
      r.subject_code,
      r.difficulty,
      r.question_type,
      r.source_paper_id,
      r.metadata,
      q.id AS question_id,
      q.stem,
      q.options,
      q.answer,
      q.analysis,
      q.knowledge_points,
      q.has_image,
      q.has_formula,
      q.image_descriptions,
      q.latex_formulas,
      q.formula_semantics,
      q.semantic_description,
      q.solution_description,
      q.physics_structure,
      q.chemistry_structure,
      q.math_structure
    FROM rag_questions r
    LEFT JOIN exam_questions q ON r.source_paper_id = q.paper_id AND r.content LIKE ('%' || q.stem || '%')
    WHERE q.id IS NOT NULL AND q.id != ALL ($1::int[])
    LIMIT 1000
  `, [Array.from(existingIds)]);

  const questions = pendingResult.rows;
  console.log(`待迁移题目数: ${questions.length}\n`);

  if (questions.length === 0) {
    console.log('✅ 所有数据已迁移完毕！');
    await pool.end();
    process.exit(0);
  }

  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (${batch.length}题)`);

    const tasks = batch.map(async (row) => {
      const {
        question_id,
        stem,
        options,
        answer,
        analysis,
        knowledge_points,
        difficulty,
        question_type,
        subject_code,
        has_image,
        has_formula,
        image_descriptions,
        latex_formulas,
        formula_semantics,
        semantic_description,
        solution_description,
        physics_structure,
        chemistry_structure,
        math_structure
      } = row;

      try {
        let parsedOptions = null;
        if (options) {
          try {
            parsedOptions = JSON.parse(options);
          } catch {}
        }

        let parsedKnowledgePoints = null;
        if (knowledge_points) {
          try {
            parsedKnowledgePoints = JSON.parse(knowledge_points);
          } catch {}
        }

        let parsedLatexFormulas = null;
        if (latex_formulas) {
          try {
            parsedLatexFormulas = JSON.parse(latex_formulas);
          } catch {}
        }

        const question = {
          stem,
          options: parsedOptions,
          answer,
          analysis,
          knowledge_points: parsedKnowledgePoints,
          difficulty,
          question_type,
          subject_code,
          has_image,
          has_formula,
          image_descriptions,
          latex_formulas: parsedLatexFormulas,
          formula_semantics,
          semantic_description,
          solution_description,
          physics_structure: physics_structure || {},
          chemistry_structure: chemistry_structure || {},
          math_structure: math_structure || {}
        };

        let enhancedSemantic = semantic_description;
        let enhancedSolution = solution_description;
        let enhancedFormulaSemantics = formula_semantics;

        if (!enhancedSemantic && stem) {
          try {
            enhancedSemantic = await generateSemanticDescription(stem, subject_code);
          } catch (e) {
            console.log(`    ⚠️  语义描述生成失败: ${e.message}`);
          }
        }

        if (!enhancedSolution && stem && (answer || analysis)) {
          try {
            enhancedSolution = await generateSolutionDescription(stem, answer, analysis, subject_code);
          } catch (e) {
            console.log(`    ⚠️  解法描述生成失败: ${e.message}`);
          }
        }

        if (!enhancedFormulaSemantics && parsedLatexFormulas && parsedLatexFormulas.length > 0) {
          try {
            enhancedFormulaSemantics = await generateFormulaSemantics(parsedLatexFormulas.join('\n'));
          } catch (e) {
            console.log(`    ⚠️  公式语义生成失败: ${e.message}`);
          }
        }

        const enhancedQuestion = {
          ...question,
          semantic_description: enhancedSemantic,
          solution_description: enhancedSolution,
          formula_semantics: enhancedFormulaSemantics
        };

        const qText = buildQText(enhancedQuestion);
        const sText = buildSText(enhancedQuestion);
        const kText = buildKText(enhancedQuestion);
        const aText = buildAText(enhancedQuestion);

        let qEmbedding = null;
        let sEmbedding = null;
        let kEmbedding = null;
        let aEmbedding = null;

        try {
          if (qText.length >= 10) qEmbedding = await getEmbedding(qText);
        } catch (e) {
          console.log(`    ⚠️  Q向量生成失败: ${e.message}`);
        }

        try {
          if (sText.length >= 10) sEmbedding = await getEmbedding(sText);
        } catch (e) {
          console.log(`    ⚠️  S向量生成失败: ${e.message}`);
        }

        try {
          if (kText.length >= 10) kEmbedding = await getEmbedding(kText);
        } catch (e) {
          console.log(`    ⚠️  K向量生成失败: ${e.message}`);
        }

        try {
          if (aText.length >= 10) aEmbedding = await getEmbedding(aText);
        } catch (e) {
          console.log(`    ⚠️  A向量生成失败: ${e.message}`);
        }

        await pool.query(`
          INSERT INTO question_vectors (
            question_id, subject_code, question_type, difficulty,
            q_embedding, s_embedding, k_embedding, a_embedding,
            q_text, s_text, k_text, a_text
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          question_id,
          subject_code || null,
          question_type || null,
          difficulty || null,
          qEmbedding ? `[${qEmbedding.join(',')}]` : null,
          sEmbedding ? `[${sEmbedding.join(',')}]` : null,
          kEmbedding ? `[${kEmbedding.join(',')}]` : null,
          aEmbedding ? `[${aEmbedding.join(',')}]` : null,
          qText || null,
          sText || null,
          kText || null,
          aText || null
        ]);

        if (enhancedSemantic || enhancedSolution || enhancedFormulaSemantics) {
          await pool.query(`
            UPDATE exam_questions SET
              semantic_description = COALESCE($1, semantic_description),
              solution_description = COALESCE($2, solution_description),
              formula_semantics = COALESCE($3, formula_semantics)
            WHERE id = $4
          `, [enhancedSemantic || null, enhancedSolution || null, enhancedFormulaSemantics || null, question_id]);
        }

        console.log(`    ✅ 题目 ${question_id} 迁移成功`);
        return true;
      } catch (err) {
        console.log(`    ❌ 题目 ${question_id} 迁移失败: ${err.message}`);
        return false;
      }
    });

    const results = await Promise.all(tasks);
    migrated += results.filter(r => r).length;
    failed += results.filter(r => !r).length;

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 迁移完成！`);
  console.log(`  成功迁移: ${migrated} 道题目`);
  console.log(`  失败: ${failed} 道题目`);

  await pool.end();
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ 迁移失败:', err.message);
  process.exit(1);
});