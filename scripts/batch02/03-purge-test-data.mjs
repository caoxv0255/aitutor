#!/usr/bin/env node
// scripts/batch02/03-purge-test-data.mjs
// Dispatch 014 Action 1 · 环境净化
//
// 目标：清空 batch02_staging 中由 DSH 自己生成的测试 fixture，
//       为真实数据接入腾出干净空间。
//
// 设计原则：
//   1. 默认 DRY-RUN（仅显示将被删除的行，不真删）
//   2. --commit 才真删
//   3. 仅删除 source_file 匹配 fixture / 自生成 docx 的行（白名单 SQL 模式）
//   4. 事务包裹 DELETE + Ledger 留痕 + 验证
//   5. 失败时 ROLLBACK 完整恢复
//
// 用法：
//   node scripts/batch02/03-purge-test-data.mjs            # dry-run
//   node scripts/batch02/03-purge-test-data.mjs --commit   # 真删

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'batch02-03-purge-test-data';
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');

function loadDatabaseUrl() {
  const envPath = path.join(ROOT, '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[purge] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// 匹配模式：DSH 自生成的 fixture 文件
const PATTERNS = [
  '%fixture-sample.json%',
  '%beijing_2026_chinese_gaokao.docx%'
];

async function main() {
  console.log('='.repeat(78));
  console.log(`  Batch-02 · Purge Test Fixtures · ${new Date().toISOString()}`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (真删)' : 'DRY-RUN (预览)'}`);
  console.log('='.repeat(78));

  // 1) 找出匹配行
  const matchRes = await pool.query(
    `SELECT id, paper_uid, question_uid, source_file, ingest_status
     FROM qb_recovery.batch02_staging
     WHERE source_file ILIKE ANY($1::text[])
     ORDER BY id`,
    [PATTERNS]
  );
  const matched = matchRes.rows;

  console.log(`\n[1] 匹配行数: ${matched.length}`);
  if (matched.length === 0) {
    console.log('  没有需要清理的 fixture 数据。');
    await pool.end();
    return;
  }
  for (const r of matched) {
    console.log(`  - id=${r.id} ${r.question_uid} status=${r.ingest_status} source=${r.source_file}`);
  }

  // 2) DRY-RUN
  if (!COMMIT) {
    console.log(`\n[2] DRY-RUN: 将删除 ${matched.length} 行 + 写 1 条 ledger 记录`);
    console.log('  真实删除请加 --commit');
    await pool.end();
    return;
  }

  // 3) COMMIT: 事务包裹
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3.1) 记录每个被删行的 sha256 用于审计可复现
    const delRes = await client.query(
      `DELETE FROM qb_recovery.batch02_staging
       WHERE source_file ILIKE ANY($1::text[])
       RETURNING id, paper_uid, question_uid, source_file, stem_hash, ingest_status`,
      [PATTERNS]
    );
    const deleted = delRes.rows;
    console.log(`\n[3.1] DELETE 完成: ${deleted.length} 行`);

    // 3.2) Ledger 留痕 (单条 PURGED 记录 + JSONB detail 包含所有 deleted 行 ID)
    const allIds = deleted.map((r) => r.id);
    const detailPayload = {
      run_label: RUN_LABEL,
      patterns: PATTERNS,
      deleted_count: deleted.length,
      deleted_ids: allIds,
      deleted_uids: deleted.map((r) => r.question_uid),
      deleted_sources: [...new Set(deleted.map((r) => r.source_file))],
      before_total: matched.length,
      executed_at: new Date().toISOString()
    };
    const afterSha = crypto.createHash('sha256')
      .update(JSON.stringify(allIds)).digest('hex');

    await client.query(
      `INSERT INTO qb_recovery.canonical_migration_ledger
         (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
       VALUES ($1, 'batch02_staging', 'PURGE_BATCH', 0, 'PURGED_FIXTURES', NULL, $2, $3::jsonb)`,
      [RUN_LABEL, afterSha, detailPayload]
    );
    console.log(`[3.2] Ledger 写入: 1 条 PURGED_FIXTURES`);

    await client.query('COMMIT');
    console.log(`\n✅ PURGE 成功`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ PURGE 失败，已完全回滚:`, e.message);
    throw e;
  } finally {
    client.release();
  }

  // 4) 验证
  const after = await pool.query(`SELECT count(*)::int AS n FROM qb_recovery.batch02_staging`);
  console.log(`\n[4] 验证: batch02_staging 当前 ${after.rows[0].n} 行（应为 0）`);

  // 5) 写报告
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'batch02-purge-report.json'),
    JSON.stringify({
      run_label: RUN_LABEL,
      timestamp: new Date().toISOString(),
      mode: 'commit',
      deleted_count: matched.length,
      after_count: after.rows[0].n
    }, null, 2)
  );

  await pool.end();
}

main().catch(async (e) => {
  console.error('[purge] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
