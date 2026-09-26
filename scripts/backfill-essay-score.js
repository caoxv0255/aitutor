#!/usr/bin/env node
/**
 * backfill-essay-score.js
 *
 * 目标: 把 essay_reports.score IS NULL 的行, 用**真实存在**的 meta.scores.total 回填。
 *
 * 口径:
 *   - 只作用于 essay_reports, 且仅当 meta->'scores'->>'total' 是真数值才回填;
 *   - 来源缺失 (status=failed / meta.scores 为空对象 / 无 total / total 非数值)
 *     一律**保持 NULL** —— 不填 0, 不猜;
 *   - 不改 V0 代码路径 (essayService.js 不动), 不碰其它表;
 *   - 不修改 updated_at: 回填是数据订正, 不代表报告被重新处理。
 *
 * 用法:
 *   node scripts/backfill-essay-score.js          # dry-run: 只打印将改的行数与样例
 *   node scripts/backfill-essay-score.js --apply  # 实际执行回填
 */

import 'dotenv/config';
import { getDb, closeDb } from '../api/core/db.js';

const APPLY = process.argv.includes('--apply');

/** 数值判据: 仅接受纯数字/小数, 杜绝把坏字符串塞进 numeric 列 */
const NUMERIC = /^-?\d+(\.\d+)?$/;

async function counts(pool) {
  const r = await pool.query(
    `SELECT count(*) FILTER (WHERE score IS NULL)     AS null_score,
            count(*) FILTER (WHERE score IS NOT NULL) AS not_null_score,
            count(*)                                  AS total
       FROM essay_reports`
  );
  return r.rows[0];
}

async function main() {
  const pool = await getDb();

  const before = await counts(pool);
  console.log('[essay-score] 回填前:', JSON.stringify(before));

  const nullRows = await pool.query(
    `SELECT id, report_id, status, meta->'scores'->>'total' AS total
       FROM essay_reports
      WHERE score IS NULL
      ORDER BY id`
  );
  const target = nullRows.rows.filter((r) => typeof r.total === 'string' && NUMERIC.test(r.total));
  console.log(`[essay-score] 命中 (score IS NULL 且 meta.scores.total 为真数值): ${target.length} 行`);
  target.forEach((r) => console.log(`  - id=${r.id} report_id=${r.report_id} total=${r.total}`));

  if (!target.length) {
    console.log('[essay-score] 无可回填行。');
  } else if (!APPLY) {
    console.log('[essay-score] dry-run: 未写入。加 --apply 执行回填。');
  } else {
    const res = await pool.query(
      `UPDATE essay_reports
          SET score = (meta->'scores'->>'total')::numeric
        WHERE score IS NULL
          AND meta->'scores'->>'total' ~ '^-?[0-9]+(\\.[0-9]+)?$'`
    );
    console.log(`[essay-score] 已回填 ${res.rowCount} 行。`);
  }

  const after = await counts(pool);
  console.log('[essay-score] 回填后:', JSON.stringify(after));

  // 残留 NULL 的原因分布
  const remaining = await pool.query(
    `SELECT id, report_id, status, meta->'scores'->>'total' AS total
       FROM essay_reports
      WHERE score IS NULL
      ORDER BY id`
  );
  const reasons = new Map();
  remaining.rows.forEach((r) => {
    let reason;
    if (r.status === 'failed') reason = 'status=failed（报告未产出分数）';
    else if (r.total === null || r.total === undefined || r.total === '') reason = 'meta.scores.total 缺失';
    else if (!NUMERIC.test(String(r.total))) reason = 'meta.scores.total 非数值';
    else reason = '其它（未被回填）';
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  });
  console.log(`[essay-score] 残留 score IS NULL: ${remaining.rows.length} 行`);
  reasons.forEach((v, k) => console.log(`  - ${k}: ${v}`));
  remaining.rows.forEach((r) =>
    console.log(`    · id=${r.id} report_id=${r.report_id} status=${r.status} total=${r.total ?? '(空)'}`)
  );

  await closeDb();
}

main().catch((e) => {
  console.error('[essay-score] 失败:', e && e.message);
  process.exit(1);
});
