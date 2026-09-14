#!/usr/bin/env node
// scripts/qb2/stage32-batch02-commit.mjs
// Dispatch 013 · Batch-02 Commit Pipeline
//
// 设计原则：
//   1. 单一数据库事务包裹整个 commit；任何 FK/UK 冲突即全回滚
//   2. 仅在显式 --commit 时才动 public.*；默认 --dry-run
//   3. paper_uid 归一化：batch02_staging 中可能是冗长形式（如 chinese_2026_beijing_sample），
//      public.exam_papers 中要求 16-char hex（与历史 B01 一致）。
//      派生策略：sha256(paper_uid).slice(0,16) — 确定性可复现
//   4. question_uid 派生：D063 规则 {subject}_{year}_{province|xx}_{questionNumber}
//   5. 去重：(paper_id, question_number, stem_hash) 三元组幂等
//   6. Ledger 留痕：run_label='stage32-batch02-commit'
//   7. 状态机：batch02_staging.ingest_status: parsed/validated → committed
//   8. 行数对比报告：commit 前后输出 core table 快照
//   9. --dry-run 不写 public.*，仅打印预期计划
//
// 用法：
//   node scripts/qb2/stage32-batch02-commit.mjs              # 默认 dry-run
//   node scripts/qb2/stage32-batch02-commit.mjs --commit     # 真写入
//   node scripts/qb2/stage32-batch02-commit.mjs --limit 5    # 仅前 5 条 staging

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'stage32-batch02-commit';

const args = process.argv.slice(2);
const FLAGS = {
  commit: args.includes('--commit'),
  limit: (() => {
    const i = args.indexOf('--limit');
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : Infinity;
  })()
};

// ─── DB ────────────────────────────────────────────────────
function loadDatabaseUrl() {
  const envPath = path.join(ROOT, '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[stage32] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── 工具 ──────────────────────────────────────────────────
function derivePaperUidHex(paperUid) {
  return crypto.createHash('sha256').update(String(paperUid)).digest('hex').slice(0, 16);
}

function deriveQuestionUid(subject, year, provinceCode, questionNumber) {
  return `${subject}_${year}_${provinceCode}_${String(questionNumber).padStart(3, '0')}`;
}

function sha(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

// ─── 核心表基线快照 ─────────────────────────────────────
const CORE_TABLES = [
  ['public', 'exam_papers'],
  ['public', 'exam_questions'],
  ['public', 'question_knowledge_points'],
  ['public', 'question_images']
];

async function snapshot() {
  const snap = {};
  for (const [s, t] of CORE_TABLES) {
    const r = await pool.query(`SELECT count(*)::bigint AS cnt FROM ${s}.${t}`);
    snap[`${s}.${t}`] = Number(r.rows[0].cnt);
  }
  return snap;
}

// ─── 预检：候选 staging 记录 ────────────────────────────
async function loadCandidates(limit) {
  const r = await pool.query(
    `SELECT id, paper_uid, question_number, question_uid, subject, year,
            province_code, exam_level, stem, stem_hash, options, answer,
            analysis, source_file, source_format, content_json, metadata
     FROM qb_recovery.batch02_staging
     WHERE ingest_status IN ('parsed', 'validated')
     ORDER BY id
     LIMIT $1`,
    [Number.isFinite(limit) ? limit : 1000000]
  );
  return r.rows;
}

// ─── 模拟：dry-run 下的预计影响 ──────────────────────────
async function previewImpact(rows) {
  const plan = {
    new_papers: [],
    existing_papers: [],
    new_questions: [],
    duplicates: []
  };

  // 按 paper_uid 分组
  const paperGroups = new Map();
  for (const r of rows) {
    if (!paperGroups.has(r.paper_uid)) paperGroups.set(r.paper_uid, []);
    paperGroups.get(r.paper_uid).push(r);
  }

  for (const [paperUid, qs] of paperGroups.entries()) {
    const paperUidHex = derivePaperUidHex(paperUid);
    const sample = qs[0];
    const paperExists = await pool.query(
      `SELECT id, paper_uid, subject, year, province_code, exam_level
       FROM public.exam_papers
       WHERE paper_uid = $1 OR (subject=$2 AND year=$3 AND province_code=$4 AND exam_level=$5)
       LIMIT 1`,
      [paperUidHex, sample.subject, sample.year, sample.province_code, sample.exam_level]
    );

    let paperId;
    let isNewPaper = false;
    if (paperExists.rowCount === 0) {
      isNewPaper = true;
      plan.new_papers.push({
        paper_uid_input: paperUid,
        paper_uid_hex: paperUidHex,
        subject: sample.subject,
        year: sample.year,
        province_code: sample.province_code,
        exam_level: sample.exam_level,
        expected_paper_id: '(auto-assigned by nextval)'
      });
    } else {
      paperId = paperExists.rows[0].id;
      plan.existing_papers.push({
        paper_id: paperId,
        paper_uid_hex: paperExists.rows[0].paper_uid,
        subject: sample.subject,
        year: sample.year,
        province_code: sample.province_code,
        exam_level: sample.exam_level
      });
    }

    // 处理 questions
    for (const q of qs) {
      const targetPaperId = isNewPaper ? '(newly created)' : paperId;
      let qExistsRowCount = 0;
      let qExistsRow = null;
      if (!isNewPaper) {
        const qExists = await pool.query(
          `SELECT q.id, q.question_uid FROM public.exam_questions q
           WHERE q.paper_id = $1 AND q.question_number = $2 AND q.stem = $3
           LIMIT 1`,
          [paperId, q.question_number, q.stem]
        );
        qExistsRowCount = qExists.rowCount;
        qExistsRow = qExists.rows[0] || null;
      }
      if (qExistsRowCount > 0) {
        plan.duplicates.push({
          staging_id: q.id,
          existing_question_id: qExistsRow.id,
          existing_question_uid: qExistsRow.question_uid,
          paper_id: targetPaperId
        });
      } else {
        plan.new_questions.push({
          staging_id: q.id,
          target_paper_id: targetPaperId,
          question_number: q.question_number,
          question_uid: deriveQuestionUid(q.subject, q.year, q.province_code, q.question_number),
          stem_preview: (q.stem || '').slice(0, 50)
        });
      }
    }
  }
  return plan;
}

// ─── 执行 commit ─────────────────────────────────────────
async function commitOne(client, q, paperId, paperUidHex) {
  // 检查 question 是否已存在（防御性 — preview 阶段已查过，但事务内再确认）
  const dup = await client.query(
    `SELECT id FROM public.exam_questions
     WHERE paper_id = $1 AND question_number = $2 AND stem = $3
     LIMIT 1`,
    [paperId, q.question_number, q.stem]
  );
  if (dup.rowCount > 0) {
    return { status: 'duplicate', question_id: dup.rows[0].id };
  }

  const newQuestionUid = deriveQuestionUid(q.subject, q.year, q.province_code, q.question_number);
  const ins = await client.query(
    `INSERT INTO public.exam_questions
       (question_uid, paper_id, question_number, question_type, stem,
        options, answer, analysis, knowledge_points,
        difficulty, score, subject_code, province_code, year, archive_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10, $11, $12, $13, 'active')
     RETURNING id`,
    [
      newQuestionUid,
      paperId,
      q.question_number,
      q.metadata?.question_type || 'unknown',
      q.stem,
      q.options || null,
      q.answer || null,
      q.analysis || null,
      q.metadata?.difficulty ?? null,
      q.metadata?.score ?? null,
      q.subject,
      q.province_code,
      q.year
    ]
  );
  return { status: 'inserted', question_id: ins.rows[0].id, question_uid: newQuestionUid };
}

async function upsertPaper(client, q, paperUidHex) {
  // 1) 查是否已存在
  const exists = await client.query(
    `SELECT id, paper_uid FROM public.exam_papers
     WHERE paper_uid = $1 OR (subject=$2 AND year=$3 AND province_code=$4 AND exam_level=$5)
     LIMIT 1`,
    [paperUidHex, q.subject, q.year, q.province_code, q.exam_level]
  );
  if (exists.rowCount > 0) {
    // 兼容：如果现有 row 的 paper_uid 是 NULL，补齐为 hex
    if (!exists.rows[0].paper_uid) {
      await client.query(
        `UPDATE public.exam_papers SET paper_uid = $1 WHERE id = $2`,
        [paperUidHex, exists.rows[0].id]
      );
    }
    return { paper_id: exists.rows[0].id, is_new: false };
  }

  // 2) INSERT 新试卷
  const ins = await client.query(
    `INSERT INTO public.exam_papers
       (province_code, year, subject, exam_level, paper_uid, paper_variant,
        question_count, total_score, difficulty_avg, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'main', 0, NULL, NULL, now(), now())
     RETURNING id`,
    [q.province_code, q.year, q.subject, q.exam_level, paperUidHex]
  );

  // 3) 联动 exam_regions (若 region_code 已存在)
  await client.query(
    `UPDATE public.exam_papers p
     SET paper_uid = $1
     WHERE id = $2`,
    [paperUidHex, ins.rows[0].id]
  );

  return { paper_id: ins.rows[0].id, is_new: true };
}

async function writeLedgerForCommit(client, planItem) {
  const afterSha = sha(`${planItem.action}:${planItem.target_id}:${planItem.question_uid || ''}`);
  await client.query(
    `INSERT INTO qb_recovery.canonical_migration_ledger
       (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      RUN_LABEL,
      planItem.entity_type,
      planItem.uid || `${planItem.entity_type}:${planItem.target_id}`,
      planItem.target_id,
      planItem.action,
      planItem.before_sha || null,
      afterSha,
      JSON.stringify(planItem.detail || {})
    ]
  );
}

async function updateStagingStatus(client, stagingIds, status) {
  if (stagingIds.length === 0) return;
  await client.query(
    `UPDATE qb_recovery.batch02_staging
     SET ingest_status = $1, last_processed_at = now()
     WHERE id = ANY($2::bigint[])`,
    [status, stagingIds]
  );
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Stage 32 · Batch-02 Commit Pipeline · ${new Date().toISOString()}`);
  console.log(`  Mode: ${FLAGS.commit ? 'COMMIT (写 public.*)' : 'DRY-RUN (仅预览)'}`);
  console.log('='.repeat(78));

  // 1) 加载候选 staging
  const candidates = await loadCandidates(FLAGS.limit);
  console.log(`\n[1] 候选 staging 记录 (status IN parsed/validated): ${candidates.length}`);
  if (candidates.length === 0) {
    console.log('  没有待 commit 的数据。退出。');
    await pool.end();
    return;
  }

  // 2) 基线快照
  const before = await snapshot();
  console.log('\n[2] 核心表基线快照 (commit 前):');
  for (const [k, v] of Object.entries(before)) console.log(`    ${k}: ${v}`);

  // 3) Dry-run 预览
  console.log('\n[3] 预览计划:');
  const plan = await previewImpact(candidates);
  console.log(`    新试卷: ${plan.new_papers.length} 张`);
  for (const p of plan.new_papers) {
    console.log(`      - ${p.paper_uid_input} → paper_uid=${p.paper_uid_hex} (${p.subject}/${p.year}/${p.province_code}/${p.exam_level})`);
  }
  console.log(`    已存在试卷: ${plan.existing_papers.length} 张`);
  for (const p of plan.existing_papers) {
    console.log(`      - paper_id=${p.paper_id} paper_uid=${p.paper_uid_hex}`);
  }
  console.log(`    新题目: ${plan.new_questions.length} 条`);
  for (const q of plan.new_questions.slice(0, 8)) {
    console.log(`      - staging_id=${q.staging_id} → paper_id=${q.target_paper_id} question_uid=${q.question_uid} "${q.stem_preview}..."`);
  }
  if (plan.new_questions.length > 8) console.log(`      ... +${plan.new_questions.length - 8} more`);
  console.log(`    重复 (skip): ${plan.duplicates.length} 条`);

  // 4) Dry-run 终止条件
  if (!FLAGS.commit) {
    console.log('\n[4] DRY-RUN 完成。真实写入请加 --commit。');
    console.log('\n预期核心表增量:');
    console.log(`    public.exam_papers:     +${plan.new_papers.length} (新)`);
    console.log(`    public.exam_questions:  +${plan.new_questions.length} (新)`);
    console.log(`    public.exam_questions:   ${plan.duplicates.length} (跳过)`);

    const report = {
      run_label: RUN_LABEL,
      timestamp: new Date().toISOString(),
      mode: 'dry-run',
      before,
      plan: {
        new_papers: plan.new_papers.length,
        existing_papers: plan.existing_papers.length,
        new_questions: plan.new_questions.length,
        duplicates: plan.duplicates.length
      }
    };
    const outDir = path.join(ROOT, 'docs', 'audits');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'stage32-batch02-commit-preview.json'),
      JSON.stringify(report, null, 2)
    );
    console.log(`\n预览报告 → docs/audits/stage32-batch02-commit-preview.json`);
    await pool.end();
    return;
  }

  // 5) 真实 commit
  console.log('\n[5] 开始 COMMIT 模式 (单事务包裹)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 按 paper_uid 分组处理
    const paperGroups = new Map();
    for (const r of candidates) {
      if (!paperGroups.has(r.paper_uid)) paperGroups.set(r.paper_uid, []);
      paperGroups.get(r.paper_uid).push(r);
    }

    const committedStagingIds = [];
    const skippedStagingIds = [];
    const ops = [];

    for (const [paperUid, qs] of paperGroups.entries()) {
      const paperUidHex = derivePaperUidHex(paperUid);
      const firstQ = qs[0];

      // 5.1) Upsert paper
      const paperResult = await upsertPaper(client, firstQ, paperUidHex);
      ops.push({
        entity_type: 'exam_papers',
        target_id: paperResult.paper_id,
        action: paperResult.is_new ? 'COMMITTED_NEW_PAPER' : 'COMMITTED_EXISTING_PAPER',
        uid: paperUidHex,
        detail: {
          input_paper_uid: paperUid,
          subject: firstQ.subject,
          year: firstQ.year,
          province_code: firstQ.province_code,
          exam_level: firstQ.exam_level,
          question_count: qs.length
        }
      });
      console.log(`  ✓ paper: ${paperUid} → paper_id=${paperResult.paper_id} (${paperResult.is_new ? 'NEW' : 'EXISTING'})`);

      // 5.2) Insert questions
      for (const q of qs) {
        const result = await commitOne(client, q, paperResult.paper_id, paperUidHex);
        if (result.status === 'inserted') {
          committedStagingIds.push(q.id);
          ops.push({
            entity_type: 'exam_questions',
            target_id: result.question_id,
            action: 'COMMITTED_NEW_QUESTION',
            uid: result.question_uid,
            detail: {
              staging_id: q.id,
              paper_id: paperResult.paper_id,
              question_number: q.question_number,
              stem_hash: q.stem_hash
            }
          });
          console.log(`    ✓ question: staging_id=${q.id} → question_id=${result.question_id} (${result.question_uid})`);
        } else {
          skippedStagingIds.push(q.id);
          console.log(`    ⊘ question: staging_id=${q.id} 已存在 → question_id=${result.question_id}`);
        }
      }

      // 5.3) 更新 paper.question_count
      await client.query(
        `UPDATE public.exam_papers SET question_count = (
           SELECT count(*) FROM public.exam_questions WHERE paper_id = $1
         ), updated_at = now() WHERE id = $1`,
        [paperResult.paper_id]
      );
    }

    // 5.4) 更新 staging 状态
    if (committedStagingIds.length > 0) {
      await updateStagingStatus(client, committedStagingIds, 'committed');
    }
    if (skippedStagingIds.length > 0) {
      await updateStagingStatus(client, skippedStagingIds, 'committed'); // 也标记为 committed（视为已处理）
    }

    // 5.5) Ledger 留痕
    for (const op of ops) {
      await writeLedgerForCommit(client, op);
    }

    await client.query('COMMIT');
    console.log('\n✅ COMMIT 成功');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ COMMIT 失败，已完全回滚:', e.message);
    throw e;
  } finally {
    client.release();
  }

  // 6) 提交后基线
  const after = await snapshot();
  console.log('\n[6] 核心表基线快照 (commit 后):');
  for (const [k, v] of Object.entries(after)) console.log(`    ${k}: ${v}`);

  console.log('\n=== 增量对比 ===');
  for (const k of Object.keys(before)) {
    const delta = after[k] - before[k];
    console.log(`    ${k}: ${before[k]} → ${after[k]} (Δ=${delta >= 0 ? '+' : ''}${delta})`);
  }

  // 7) 写报告
  const report = {
    run_label: RUN_LABEL,
    timestamp: new Date().toISOString(),
    mode: 'commit',
    before,
    after,
    delta: Object.fromEntries(Object.keys(before).map((k) => [k, after[k] - before[k]]))
  };
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'stage32-batch02-commit-report.json'),
    JSON.stringify(report, null, 2)
  );

  await pool.end();
}

main().catch(async (e) => {
  console.error('[stage32] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
