#!/usr/bin/env node
/**
 * backfill-question-uid.js
 *
 * 目标: 给 exam_questions.question_uid 为空的题补全 uid.
 * 规则与 parse-questions-v4.js 中的 generateQuestionUID 一致:
 *   <subject_code>_<year>_<province_code>_<question_number>
 * 兜底: subject/year 缺失时用 paper_id + question_number.
 *
 * 用法:
 *   node scripts/backfill-question-uid.js             # 实际回填
 *   node scripts/backfill-question-uid.js --dry      # 只统计
 */

import 'dotenv/config';
import { getDb, closeDb } from '../api/core/db.js';
import { generateQuestionUid } from '../api/core/questionUid.js'; // P0.7: UID 单一来源

const DRY_RUN = process.argv.includes('--dry');

async function main() {
  const pool = await getDb();

  console.log('[uid] 1. 扫描现状...');
  let r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE question_uid IS NULL OR question_uid = '') AS empty_uid,
      COUNT(*) AS total
    FROM exam_questions
  `);
  console.log('  ' + JSON.stringify(r.rows[0]));

  r = await pool.query(`
    SELECT id, subject_code, year, province_code, paper_id, question_number
      FROM exam_questions
     WHERE question_uid IS NULL OR question_uid = ''
  `);
  console.log(`  待回填: ${r.rows.length} 条`);

  let filled = 0, skippedDup = 0, skippedMissing = 0;
  for (const q of r.rows) {
    // P0.7 (Phase 3): UID 规则统一到 api/core/questionUid.js (Rule A 与 parse 管线 + migration 008 一致)
    const uid = generateQuestionUid({
      subject: q.subject_code,
      year: q.year,
      provinceCode: q.province_code,
      questionNumber: q.question_number,
      paperId: q.paper_id,
      id: q.id,
    });
    if (!uid) {
      skippedMissing += 1;
      continue;
    }

    if (DRY_RUN) { filled += 1; continue; }
    try {
      const upd = await pool.query(
        `UPDATE exam_questions SET question_uid = $1, updated_at = NOW()
          WHERE id = $2 AND (question_uid IS NULL OR question_uid = '')`,
        [uid, q.id]
      );
      if (upd.rowCount > 0) filled += 1;
      else skippedDup += 1;
    } catch (e) {
      if (e.code === '23505') skippedDup += 1;
      else throw e;
    }
  }

  console.log(`[uid] 写入: ${filled}  跳过(重): ${skippedDup}  跳过(缺字段): ${skippedMissing}${DRY_RUN ? ' (DRY)' : ''}`);
  r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE question_uid IS NULL OR question_uid = '') AS still_empty,
      COUNT(*) FILTER (WHERE question_uid IS NOT NULL AND question_uid <> '') AS non_empty,
      COUNT(*) AS total
    FROM exam_questions
  `);
  console.log('  回填后: ' + JSON.stringify(r.rows[0]));

  await closeDb();
}

main().catch((e) => {
  console.error('[uid] failed:', e.message);
  process.exit(1);
});