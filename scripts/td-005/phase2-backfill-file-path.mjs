#!/usr/bin/env node
// scripts/td-005/phase2-backfill-file-path.mjs
// TD-005 Phase 2: file_path 反填 (从 batch02_staging.source_file)
//
// 设计:
//   1. dry-run 验证 JOIN 路径 + fs.accessSync 物理存在
//   2. 单事务 + 幂等
//   3. canonical_migration_ledger 留痕
//   4. 输出 docs/audits/td-005-phase2-backfill-report.json
//
// 用法:
//   node scripts/td-005/phase2-backfill-file-path.mjs --dry-run    # 0 风险验证
//   node scripts/td-005/phase2-backfill-file-path.mjs --commit     # 真实写入

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'td-005-phase2-backfill-fp';
const TIMESTAMP = new Date().toISOString();
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');

// ─── DB ───────────────────────────────────────────────────
function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[phase2] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// 物理文件存在性校验（注意：file_path 是相对工作目录的路径）
function fileExists(fp) {
  if (!fp) return false;
  // 路径可能是相对当前 cwd 或 repo root
  const abs = path.isAbsolute(fp) ? fp : path.join(ROOT, fp);
  try {
    fs.accessSync(abs, fs.constants.R_OK);
    return true;
  } catch {
    // 再尝试直接 cwd 相对
    try {
      fs.accessSync(fp, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

async function main() {
  console.log('='.repeat(78));
  console.log(`  TD-005 Phase 2 · file_path 反填 · ${TIMESTAMP}`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  console.log('='.repeat(78));

  // 1) 评估可恢复量 (目录级: 按 subject_code + year 定位 database/incoming/gaokao/{subject}/{year}/)
  const evalRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE q.file_path IS NULL) AS total_null,
      COUNT(*) FILTER (WHERE q.file_path IS NULL AND q.subject_code IS NOT NULL AND q.paper_id IS NOT NULL) AS recoverable_by_dir
    FROM exam_questions q
  `);
  console.log('\n[1] 评估 (目录级反填):');
  console.log('  总 NULL file_path: ' + evalRes.rows[0].total_null);
  console.log('  可反填 (有 subject_code + paper_id): ' + evalRes.rows[0].recoverable_by_dir);
  const expectedRecover = Number(evalRes.rows[0].recoverable_by_dir);

  // 2) 抽样 100 个 NULL 题, 验证 (subject_code, year) 目录物理存在
  const sampleRes = await pool.query(`
    SELECT q.id, q.question_uid, q.subject_code,
           EXTRACT(YEAR FROM p.created_at)::int AS paper_year,
           p.year AS paper_year_col, p.paper_uid
    FROM exam_questions q
    JOIN exam_papers p ON p.id = q.paper_id
    WHERE q.file_path IS NULL
    ORDER BY RANDOM() LIMIT 100
  `);
  let existsCount = 0;
  let missingCount = 0;
  const missingExamples = [];
  for (const row of sampleRes.rows) {
    // 取年份: paper.year 列优先, 缺则用 paper_uid 第二段
    let yr = row.paper_year_col;
    if (!yr && row.paper_uid) {
      const m = row.paper_uid.match(/_(\d{4})_/);
      if (m) yr = parseInt(m[1], 10);
    }
    if (!yr || !row.subject_code) { missingCount++; continue; }
    const dir = path.join(ROOT, 'database/incoming/gaokao', row.subject_code, String(yr));
    if (fs.existsSync(dir)) existsCount++;
    else {
      missingCount++;
      if (missingExamples.length < 10) missingExamples.push({
        question_id: row.id,
        subject: row.subject_code,
        year: yr,
        dir
      });
    }
  }
  console.log('\n[2] 物理目录存在性校验 (抽样 100):');
  console.log('  目录存在: ' + existsCount + ' (' + (existsCount / sampleRes.rows.length * 100).toFixed(1) + '%)');
  console.log('  目录缺失: ' + missingCount);
  if (missingCount > 0) {
    console.log('  ⚠ 缺失样例 (前 10):');
    for (const m of missingExamples) console.log('    qid=' + m.question_id + ' | ' + m.subject + '/' + m.year);
  }

  // 3) 重复 source_file 检测
  const dupRes = await pool.query(`
    SELECT source_file, COUNT(*) AS n
    FROM qb_recovery.batch02_staging
    WHERE source_file IS NOT NULL
    GROUP BY 1 HAVING COUNT(*) > 1
    ORDER BY 2 DESC LIMIT 10
  `);
  console.log('\n[3] batch02_staging source_file 重复 (前 10):');
  if (dupRes.rows.length === 0) console.log('  无重复');
  for (const row of dupRes.rows) console.log('  ' + row.n + ' 次 | ' + row.source_file);

  if (!COMMIT) {
    console.log('\n[DRY-RUN] 不写入。要 COMMIT 请加 --commit');
    const report = {
      run_label: RUN_LABEL,
      timestamp: TIMESTAMP,
      mode: 'dry-run',
      total_null_fp: Number(evalRes.rows[0].total_null),
      recoverable_by_join: expectedRecover,
      sample_size: sampleRes.rows.length,
      sample_exists: existsCount,
      sample_missing: missingCount,
      sample_missing_pct: Number((missingCount / sampleRes.rows.length * 100).toFixed(2)),
      duplicate_source_files: dupRes.rows.map(r => ({ source_file: r.source_file, count: Number(r.n) })),
      recommendation: missingCount > 10 ? 'STOP — too many missing files, investigate root cause' : 'PROCEED to commit'
    };
    const outDir = path.join(ROOT, 'docs', 'audits');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'td-005-phase2-backfill-report.json'), JSON.stringify(report, null, 2));
    console.log('\n报告 → docs/audits/td-005-phase2-backfill-report.json');
    await pool.end();
    return;
  }

  // 4) COMMIT: 单事务 UPDATE + ledger (目录级反填)
  if (missingCount > 10) {
    console.error('\n❌ STOP: 抽样中缺失目录过多 (' + missingCount + ' / 100)，需先调查根因。');
    await pool.end();
    process.exit(1);
  }

  console.log('\n[4] COMMIT 开始 (目录级反填)...');
  const client = await pool.connect();
  let updated = 0;
  const ledgerOps = [];
  try {
    await client.query('BEGIN');

    // 一次性 UPDATE: 用 subject_code + paper.year 反填目录级 file_path
    const updRes = await client.query(`
      UPDATE exam_questions q
      SET file_path = 'database/incoming/gaokao/' || q.subject_code || '/' || p.year || '/'
      FROM exam_papers p
      WHERE p.id = q.paper_id
        AND q.file_path IS NULL
        AND q.subject_code IS NOT NULL
        AND p.year IS NOT NULL
      RETURNING q.id, q.question_uid, q.subject_code, p.year AS paper_year
    `);
    updated = updRes.rowCount;
    console.log('  UPDATE 影响行数: ' + updated);

    // 写 ledger (批量)
    for (const row of updRes.rows) {
      const filePath = 'database/incoming/gaokao/' + row.subject_code + '/' + row.paper_year + '/';
      const beforeSha = null;
      const afterSha = crypto.createHash('sha256')
        .update(`${row.question_uid}|${filePath}`).digest('hex');
      ledgerOps.push([
        RUN_LABEL, 'question', row.question_uid, row.id, 'FILE_PATH_BACKFILL',
        beforeSha, afterSha,
        JSON.stringify({ file_path: filePath, level: 'directory', from: 'subject_code+paper.year' })
      ]);
    }

    if (ledgerOps.length > 0) {
      const BATCH = 200;
      for (let i = 0; i < ledgerOps.length; i += BATCH) {
        const slice = ledgerOps.slice(i, i + BATCH);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const op of slice) {
          placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++}::jsonb)`);
          values.push(...op);
        }
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
            (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
           VALUES ${placeholders.join(',')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    console.log('  ledger 写入: ' + ledgerOps.length + ' 条');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FATAL]', e.message);
    throw e;
  } finally {
    client.release();
  }

  // 5) 复跑覆盖率 + 写报告
  const cov = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE file_path IS NULL) AS null_after,
      COUNT(*) FILTER (WHERE file_path IS NOT NULL) AS not_null_after,
      COUNT(*) AS total
    FROM exam_questions
  `);
  const nullAfter = Number(cov.rows[0].null_after);
  const notNullAfter = Number(cov.rows[0].not_null_after);
  const total = Number(cov.rows[0].total);
  console.log('\n[5] 覆盖率:');
  console.log('  NULL file_path: ' + nullAfter + ' (' + (nullAfter / total * 100).toFixed(2) + '%)');
  console.log('  NOT NULL: ' + notNullAfter + ' (' + (notNullAfter / total * 100).toFixed(2) + '%)');

  const report = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    mode: 'commit',
    expected_recover: expectedRecover,
    actual_updated: updated,
    before: { null_fp: Number(evalRes.rows[0].total_null) },
    after: {
      null_fp: nullAfter,
      not_null_fp: notNullAfter,
      total_questions: total,
      fp_completeness_pct: Number((notNullAfter / total * 100).toFixed(2))
    },
    sample_validation: {
      sample_size: sampleRes.rows.length,
      exists: existsCount,
      missing: missingCount,
      missing_pct: Number((missingCount / sampleRes.rows.length * 100).toFixed(2))
    },
    duplicate_source_files: dupRes.rows.map(r => ({ source_file: r.source_file, count: Number(r.n) })),
    ledger_writes: ledgerOps.length,
    next_step: 'Phase 3 Step 1 — incoming docx 抽样验证'
  };
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'td-005-phase2-backfill-report.json'), JSON.stringify(report, null, 2));
  console.log('\n报告 → docs/audits/td-005-phase2-backfill-report.json');

  await pool.end();
}

main().catch(async (e) => {
  console.error('[phase2] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
