#!/usr/bin/env node
/**
 * verify-question-types.js
 *
 * 目标:
 *   1. 扫描 exam_questions.question_type, 找出不在 question_types 字典里的值
 *   2. 把无效值 fallback 到 'other' (或别名映射), 同时写入 question_type_audit
 *   3. 输出枚举分布报告
 *
 * 用法:
 *   node scripts/verify-question-types.js             # 实际修正 + 写 audit
 *   node scripts/verify-question-types.js --dry      # 只统计
 *   node scripts/verify-question-types.js --report   # 只打印分布, 不写库
 */

import 'dotenv/config';
import { getDb, closeDb } from '../api/core/db.js';

const DRY = process.argv.includes('--dry');
const REPORT_ONLY = process.argv.includes('--report');

const ALIAS = {
  'multi_choice': 'choice',
  'solve': 'comprehensive',
  'calculation': 'solve',
  'proof': 'solve',
  'short_answer': 'solve',
};

async function main() {
  const pool = await getDb();

  const dict = await pool.query('SELECT code FROM question_types');
  const dictCodes = new Set(dict.rows.map((r) => r.code));
  console.log(`[verify-types] question_types 字典大小: ${dictCodes.size}`);
  console.log(`  字典: ${[...dictCodes].join(', ')}\n`);

  const dist = await pool.query(`
    SELECT question_type, COUNT(*)::int AS n
      FROM exam_questions
     GROUP BY question_type
     ORDER BY n DESC
  `);
  console.log('[verify-types] 当前 exam_questions.question_type 分布:');
  for (const r of dist.rows) {
    const valid = r.question_type && dictCodes.has(r.question_type);
    const aliased = r.question_type && ALIAS[r.question_type] && dictCodes.has(ALIAS[r.question_type]);
    const tag = valid ? 'OK' : (aliased ? `-> ${ALIAS[r.question_type]}` : 'INVALID');
    console.log(`  ${(r.question_type ?? '<null>').toString().padEnd(18)} ${String(r.n).padStart(6)}   [${tag}]`);
  }

  if (REPORT_ONLY) {
    await closeDb();
    return;
  }

  const invalid = dist.rows.filter((r) => !dictCodes.has(r.question_type));
  if (invalid.length === 0) {
    console.log('\n[verify-types] 所有值都在字典里, 无需修正.');
    await closeDb();
    return;
  }

  console.log(`\n[verify-types] 发现 ${invalid.length} 种不在字典里的值, 准备 fallback:`);
  let totalUpdated = 0;
  let totalAudited = 0;
  for (const r of invalid) {
    const raw = r.question_type;
    const mapped = (ALIAS[raw] && dictCodes.has(ALIAS[raw])) ? ALIAS[raw] : 'other';
    console.log(`  ${raw ?? '<null>'} -> ${mapped} (${r.n} 条)`);
    if (DRY) continue;
    const upd = await pool.query(
      `UPDATE exam_questions SET question_type = $1, updated_at = NOW()
        WHERE question_type = $2
        RETURNING id`,
      [mapped, raw]
    );
    totalUpdated += upd.rows.length;
    for (const row of upd.rows) {
      await pool.query(
        `INSERT INTO question_type_audit (question_id, raw_value, mapped_value, reason)
         VALUES ($1, $2, $3, $4)`,
        [row.id, raw, mapped, 'fallback-by-verify-question-types']
      );
      totalAudited += 1;
    }
  }
  console.log(`\n[verify-types] 写入 exam_questions: ${totalUpdated} 条`);
  console.log(`[verify-types] 写入 question_type_audit: ${totalAudited} 条${DRY ? ' (DRY)' : ''}`);

  await closeDb();
}

main().catch(async (e) => {
  console.error('[verify-types] failed:', e.message);
  try { await closeDb(); } catch {}
  process.exit(1);
});
