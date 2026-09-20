#!/usr/bin/env node
// scripts/td-005/phase3-rollback-bad.mjs
// 回滚 Phase 3 中误匹配数据值的 6 个 commit
//
// 根因: Phase 3 batch 1 commit 时, qn 正则 `/^\s*(\d{1,2})\s*[.、．]\s*/gm`
//      对 2019 上海数学 春考 docx 错误匹配 "30.14" 为 q=30 等
//
// 用法:
//   node scripts/td-005/phase3-rollback-bad.mjs --dry-run    # 检查
//   node scripts/td-005/phase3-rollback-bad.mjs --commit     # 真实回滚

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'td-005-phase3-rollback-bad';
const TIMESTAMP = new Date().toISOString();
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');

function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[rollback] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

async function main() {
  console.log('='.repeat(78));
  console.log(`  TD-005 Phase 3 · 回滚错误写入 · ${TIMESTAMP}`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  console.log('='.repeat(78));

  // 1) 找到所有"数据值"误匹配的 commit
  const r = await pool.query(`
    SELECT q.id, q.stem, l.detail
    FROM qb_recovery.canonical_migration_ledger l
    JOIN exam_questions q ON q.id = l.canonical_id
    WHERE l.run_label = 'td-005-phase3-reextract'
      AND (q.stem ~ '^[0-9]+\\.[0-9]+' OR LEFT(TRIM(q.stem), 6) ~ '^[0-9]+\\.[0-9]')
    ORDER BY q.id
  `);
  const bad = r.rows;
  console.log(`\n[1] 待回滚: ${bad.length} 题`);
  bad.forEach(row => {
    console.log(`  q${row.id}: 新 stem="${String(row.stem).slice(0, 30).replace(/\s+/g, ' ')}" → 旧 stem="${row.detail.old_stem_preview}"`);
  });

  if (!COMMIT) {
    console.log('\n[DRY-RUN] 不回滚. 加 --commit 真实回滚');
    await pool.end();
    return;
  }

  // 2) 回滚 stem 到原 old_stem_preview
  const client = await pool.connect();
  let rolled = 0;
  try {
    await client.query('BEGIN');
    for (const row of bad) {
      const oldStem = row.detail.old_stem_preview;
      const r2 = await client.query(`
        UPDATE exam_questions SET stem = $1, updated_at = NOW()
        WHERE id = $2 AND stem IS DISTINCT FROM $1
        RETURNING id
      `, [oldStem, row.id]);
      if (r2.rowCount > 0) rolled++;
      // 写回滚 ledger
      await client.query(`
        INSERT INTO qb_recovery.canonical_migration_ledger
          (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        RUN_LABEL,
        'exam_question.stem',
        null,
        row.id,
        'stem_rollback',
        row.detail.after_sha,
        row.detail.before_sha,
        JSON.stringify({
          reason: 'qn_regex_matched_data_value',
          rolled_back_to: oldStem,
          original_phase3_run: 'td-005-phase3-reextract',
          ts: TIMESTAMP
        })
      ]);
    }
    await client.query('COMMIT');
    console.log(`\n[2] 回滚完成: ${rolled} 题`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('  ❌ ROLLBACK:', e.message);
    await pool.end();
    process.exit(1);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
