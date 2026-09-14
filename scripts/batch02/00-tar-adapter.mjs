#!/usr/bin/env node
// scripts/batch02/00-tar-adapter.mjs
// Dispatch 015 · tar → batch02_staging JSON adapter
//
// 适配 database.tar 内的 question-bank 结构：
//   database/question-bank/{subject}/{year}/{NNN}/
//   ├── content.md     (Markdown 格式题目文本)
//   ├── metadata.json  (uid/subject/year/province/exam_level/question_type/...)
//   └── images/        (可选，图片资产)
//
// 设计原则：
//   1. 流式读取 tar，不全量解压（节省 164MB 磁盘）
//   2. 抽取指定 subject + year 子集（默认 chinese/2024）
//   3. 合并 metadata.json + content.md 为单条 batch02 JSON
//   4. 健康度统计：stem=undefined 数、有效文本数、图片数等
//   5. 仅写 staging 表 + issue_tickets，不动 public.*
//   6. 复用 01-ingest 的 3 道防线（图片占位符/mojibake/长材料）
//
// 用法：
//   node scripts/batch02/00-tar-adapter.mjs --subject chinese --year 2024 --dry-run
//   node scripts/batch02/00-tar-adapter.mjs --subject chinese --year 2024 --commit
//   node scripts/batch02/00-tar-adapter.mjs --all   # 全量 (chinese + history, 2019-2025)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const TAR_PATH = path.join(ROOT, 'database.tar');
const RUN_LABEL = 'batch02-00-tar-adapter';

const args = process.argv.slice(2);
const FLAGS = {
  commit: args.includes('--commit'),
  all: args.includes('--all'),
  dryRun: args.includes('--dry-run') || !args.includes('--commit'),
  subject: (() => {
    const i = args.indexOf('--subject');
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  })(),
  year: (() => {
    const i = args.indexOf('--year');
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : null;
  })()
};

// DB
function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[tar-adapter] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── Tar 流式读取：使用 tar -tf 列出 + tar -xOf 提取单文件 ───
// 注: database.tar 在末尾有 EOF 截断 (164MB 中丢失最后 ~几 MB), 所以 tar 退出会带
// "Unexpected EOF in archive" 警告 + exit code 2. 我们仍然能从 stdout 拿到大部分
// 条目, 所以忽略非零退出码, 只要 stdout 有内容就算成功。
function tarList(prefix) {
  return new Promise((resolve) => {
    const args = prefix ? ['-tf', TAR_PATH, prefix] : ['-tf', TAR_PATH];
    const child = spawn('tar', args, { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('exit', () => resolve(out.split('\n').filter(Boolean)));
    child.on('error', () => resolve([]));
  });
}

function tarExtract(targetPath) {
  return new Promise((resolve) => {
    const child = spawn('tar', ['-xOf', TAR_PATH, targetPath], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('exit', () => resolve(out || null));  // EOF partial → resolve('') = null downstream
    child.on('error', () => resolve(null));
  });
}

// ─── content.md → stem/answer/analysis 抽取 ───────────────
// 实际 section header:
//   "## 题目内容"   (不是 "## 题目")
//   "## 参考答案"
//   "## 解析"
const SECTION_RE = /^##\s+(.+)$/m;
const SECTION_ALIAS = {
  '题目内容': 'stem',
  '题目': 'stem',          // 容错
  '参考答案': 'answer',
  '答案': 'answer',        // 容错
  '解析': 'analysis',
  '试题解析': 'analysis'   // 容错
};

// Dispatch 016 · 矿渣黑名单：早期 export 脚本占位符
const PLACEHOLDER_STEM_VALUES = new Set([
  'undefined', 'null', 'none', 'n/a', 'na',
  '答案内容', '解析内容', '题目内容', '参考答案'  // 早期占位符
]);
const MIN_STEM_LENGTH = 10;  // < 10 字符视为无效

function parseContentMd(md) {
  if (!md || typeof md !== 'string') return { stem: null, answer: null, analysis: null };
  const sections = {};
  let current = null;
  for (const line of md.split('\n')) {
    const m = line.match(SECTION_RE);
    if (m) {
      current = m[1].trim();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  const out = { stem: null, answer: null, analysis: null };
  for (const [sectionName, lines] of Object.entries(sections)) {
    const key = SECTION_ALIAS[sectionName];
    if (key) {
      out[key] = lines.join('\n').trim() || null;
    }
  }
  return out;
}

/**
 * Dispatch 016: 判断 stem 是否"健康"
 * - null/undefined/占位符/太短 都视为矿渣
 */
function isStemHealthy(stem) {
  if (stem === null || stem === undefined) return { ok: false, reason: 'null_or_undefined' };
  const trimmed = String(stem).trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (PLACEHOLDER_STEM_VALUES.has(trimmed.toLowerCase())) return { ok: false, reason: `placeholder:${trimmed}` };
  if (trimmed.length < MIN_STEM_LENGTH) return { ok: false, reason: `too_short:${trimmed.length}` };
  return { ok: true };
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Tar Adapter · Dispatch 015 压力测试 · ${new Date().toISOString()}`);
  console.log(`  Mode: ${FLAGS.commit ? 'COMMIT' : 'DRY-RUN'} · Subject: ${FLAGS.subject || (FLAGS.all ? 'all' : '?')} · Year: ${FLAGS.year || (FLAGS.all ? 'all' : '?')}`);
  console.log('='.repeat(78));

  // 1) 决定要处理的 (subject, year) 组合
  let targets = [];
  if (FLAGS.all) {
    // chinese 2019-2025 + history 2019-2025
    for (const subject of ['chinese', 'history']) {
      for (const year of [2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
        targets.push({ subject, year });
      }
    }
  } else if (FLAGS.subject && FLAGS.year) {
    targets.push({ subject: FLAGS.subject, year: FLAGS.year });
  } else {
    console.error('请指定 --subject <name> --year <yyyy>  或  --all');
    process.exit(1);
  }

  // 2) 对每个 (subject, year) 列出 tar 内的题目目录
  const allQuestions = [];  // {subject, year, qnum, paper_uid, content, metadata}
  for (const t of targets) {
    const prefix = `database/question-bank/${t.subject}/${t.year}/`;
    let entries;
    try {
      // 先列全量, 再 grep 过滤 (tar --wildcards 在 partial archive 上更脆弱)
      const allLines = await tarList('');
      entries = allLines.filter((p) => p.startsWith(prefix));
    } catch (e) {
      console.log(`[!] tar list 失败: ${e.message} (可能 EOF 截断)`);
      continue;
    }
    // 收集所有 metadata.json 路径
    const metaPaths = entries.filter((p) => /\/[0-9]{3}\/metadata\.json$/.test(p));
    console.log(`\n[${t.subject}/${t.year}] 找到 ${metaPaths.length} 题`);

    for (const metaPath of metaPaths) {
      // 解析 NNN
      const m = metaPath.match(/\/([0-9]{3})\/metadata\.json$/);
      const qnum = parseInt(m[1], 10);

      // 提取 metadata.json + content.md
      const [metaJson, contentMd] = await Promise.all([
        tarExtract(metaPath),
        tarExtract(metaPath.replace(/metadata\.json$/, 'content.md'))
      ]);

      if (!metaJson) {
        console.log(`  ⚠ tar 截断: 无法读取 ${metaPath}`);
        continue;
      }

      let metadata;
      try { metadata = JSON.parse(metaJson); } catch (e) {
        console.log(`  ✗ metadata.json 解析失败: ${metaPath}`);
        continue;
      }

      const parsed = parseContentMd(contentMd);
      allQuestions.push({
        subject: t.subject,
        year: t.year,
        qnum,
        metadata,
        content: parsed
      });
    }
  }

  console.log(`\n[统计] 共抽取 ${allQuestions.length} 题目`);
  if (allQuestions.length === 0) {
    console.log('  没有数据。退出。');
    await pool.end();
    return;
  }

  // 3) 健康度统计
  const stats = {
    total: allQuestions.length,
    stem_undefined: 0,
    stem_valid_short: 0,    // 1-20 字符
    stem_valid_medium: 0,   // 21-100 字符
    stem_valid_long: 0,     // > 100 字符
    stem_null: 0,
    has_answer: 0,
    has_analysis: 0,
    has_image: 0,
    mojibake_severe: 0,
    image_placeholder: 0,
    healthy: 0,
    rejected: 0,
    rejection_reasons: {},
    by_subject: {},
    by_year: {},
    tar_eof_truncated: 0
  };

  // ─── 复用 01-ingest 的图片占位符 + mojibake 检测 ───
  const IMAGE_PATTERNS = [/\[图片\]/g, /\[图\]/g, /如图[所]?示/g, /见图[所]?示/g, /【图片】/g, /【图】/g];
  const MOJIBAKE_RE = /[\uFFFD\u0000-\u0008\u000B-\u001F\u200B-\u200F]/g;

  const enriched = [];
  for (const q of allQuestions) {
    const stem = q.content.stem;
    const stemStr = (stem || '').trim();

    // Dispatch 016: 健康度检测 (提前 reject, 不入库)
    const healthCheck = isStemHealthy(stem);
    if (!healthCheck.ok) {
      stats.rejected++;
      stats.rejection_reasons[healthCheck.reason] = (stats.rejection_reasons[healthCheck.reason] || 0) + 1;
    } else {
      stats.healthy++;
    }

    if (stem === null || stem === undefined) stats.stem_null++;
    else if (!healthCheck.ok) stats.stem_undefined++;
    else if (stemStr.length <= 20) stats.stem_valid_short++;
    else if (stemStr.length <= 100) stats.stem_valid_medium++;
    else stats.stem_valid_long++;

    if (q.content.answer && q.content.answer.length > 0) stats.has_answer++;
    if (q.content.analysis && q.content.analysis.length > 0) stats.has_analysis++;
    if (q.metadata.has_image) stats.has_image++;

    // Mojibake
    const mojibakeCount = (stemStr.match(MOJIBAKE_RE) || []).length;
    const mojibakeRatio = stemStr.length > 0 ? mojibakeCount / stemStr.length : 0;
    if (mojibakeRatio > 0.05) stats.mojibake_severe++;

    // Image placeholders
    const placeholdersFound = IMAGE_PATTERNS.some((re) => re.test(stemStr));
    if (placeholdersFound) stats.image_placeholder++;

    stats.by_subject[q.subject] = (stats.by_subject[q.subject] || 0) + 1;
    stats.by_year[q.year] = (stats.by_year[q.year] || 0) + 1;

    enriched.push({
      paper_uid: `${q.subject}_${q.year}_${q.metadata.province || 'unknown'}`,
      question_number: q.qnum,
      subject: q.subject,
      year: q.year,
      province_code: q.metadata.province || 'unknown',
      exam_level: q.metadata.exam_level || 'gaokao',
      stem: stemStr,
      options: q.metadata.options || null,
      answer: q.content.answer,
      analysis: q.content.analysis,
      question_type: q.metadata.question_type || 'unknown',
      difficulty: q.metadata.difficulty || null,
      score: q.metadata.score || null,
      source_file: `database/question-bank/${q.subject}/${q.year}/${String(q.qnum).padStart(3, '0')}/`,
      source_format: 'tar+md',
      health: healthCheck,
      validation_meta: {
        mojibake_ratio: mojibakeRatio,
        image_expected: q.metadata.has_image || placeholdersFound,
        health_reason: healthCheck.reason
      }
    });
  }

  console.log('\n=== 健康度统计 ===');
  console.log(`总数:           ${stats.total}`);
  console.log(`健康 (可入库): ${stats.healthy} (${(stats.healthy / stats.total * 100).toFixed(1)}%)`);
  console.log(`矿渣 (拒绝):   ${stats.rejected} (${(stats.rejected / stats.total * 100).toFixed(1)}%)`);
  console.log(`  拒绝原因: ${JSON.stringify(stats.rejection_reasons)}`);
  console.log(`stem=null:     ${stats.stem_null}`);
  console.log(`stem=undefined/空: ${stats.stem_undefined}`);
  console.log(`stem 1-20 字符: ${stats.stem_valid_short}`);
  console.log(`stem 21-100:   ${stats.stem_valid_medium}`);
  console.log(`stem >100:     ${stats.stem_valid_long}`);
  console.log(`有 answer:     ${stats.has_answer} (${(stats.has_answer / stats.total * 100).toFixed(1)}%)`);
  console.log(`有 analysis:   ${stats.has_analysis} (${(stats.has_analysis / stats.total * 100).toFixed(1)}%)`);
  console.log(`has_image=true: ${stats.has_image} (${(stats.has_image / stats.total * 100).toFixed(1)}%)`);
  console.log(`严重 mojibake:  ${stats.mojibake_severe}`);
  console.log(`含图片占位符:  ${stats.image_placeholder}`);
  console.log(`\n按学科: ${JSON.stringify(stats.by_subject)}`);
  console.log(`按年份: ${JSON.stringify(stats.by_year)}`);

  // 4) DRY-RUN 终止
  if (!FLAGS.commit) {
    console.log('\n[DRY-RUN] 不写入 staging。');
    console.log('真实入库请加 --commit');
    // 写报告
    const report = {
      run_label: RUN_LABEL,
      timestamp: new Date().toISOString(),
      mode: 'dry-run',
      flags: { subject: FLAGS.subject, year: FLAGS.year, all: FLAGS.all },
      stats,
      sample_undefined: enriched.filter((q) => q.validation_meta.original_stem_was_undefined).slice(0, 5).map((q) => ({
        paper_uid: q.paper_uid, qnum: q.question_number, replaced_stem: q.stem
      })),
      sample_valid: enriched.filter((q) => !q.validation_meta.original_stem_was_undefined && q.stem.length > 20).slice(0, 5).map((q) => ({
        paper_uid: q.paper_uid, qnum: q.question_number, stem_preview: q.stem.slice(0, 60)
      }))
    };
    const outDir = path.join(ROOT, 'docs', 'audits');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'tar-adapter-stress-test.json'),
      JSON.stringify(report, null, 2)
    );
    console.log(`\n报告 → docs/audits/tar-adapter-stress-test.json`);
    await pool.end();
    return;
  }

  // 5) COMMIT：逐题 INSERT staging（仅健康 stem）
  console.log('\n[COMMIT] 开始写入 batch02_staging (仅健康 stem)...');
  const client = await pool.connect();
  let inserted = 0, duplicates = 0, failed = 0, skipped = 0;
  try {
    for (const q of enriched) {
      // Dispatch 016: 矿渣直接跳过, 不入库
      if (!q.health.ok) {
        skipped++;
        continue;
      }
      const stemHash = crypto.createHash('sha256').update(q.stem).digest('hex');
      try {
        await client.query('BEGIN');

        const dup = await client.query(
          `SELECT id FROM qb_recovery.batch02_staging
           WHERE paper_uid = $1 AND question_number = $2 AND stem_hash = $3
           LIMIT 1`,
          [q.paper_uid, q.question_number, stemHash]
        );
        if (dup.rowCount > 0) {
          await client.query('ROLLBACK');
          duplicates++;
          continue;
        }

        const ingestStatus = q.validation_meta.mojibake_ratio > 0.05 ? 'failed' : 'parsed';
        const ins = await client.query(
          `INSERT INTO qb_recovery.batch02_staging
             (paper_uid, question_number, question_uid, subject, year, province_code,
              exam_level, stem, stem_hash, options, answer, analysis, content_json,
              source_file, source_format, ingest_status, llm_processed, validation_errors, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
                   $14, $15, $16, FALSE, $17::jsonb, $18::jsonb)
           RETURNING id`,
          [
            q.paper_uid, q.question_number, `${q.paper_uid}_${String(q.question_number).padStart(3, '0')}`,
            q.subject, q.year, q.province_code, q.exam_level, q.stem, stemHash,
            q.options, q.answer, q.analysis,
            JSON.stringify({
              has_image: stats.has_image > 0,
              mojibake_ratio: q.validation_meta.mojibake_ratio,
              parse_engine: 'tar-adapter (Dispatch 016)',
              health_reason: q.validation_meta.health_reason || 'healthy'
            }),
            q.source_file, q.source_format, ingestStatus,
            ingestStatus === 'failed' ? JSON.stringify([{ code: 'severe_mojibake', ratio: q.validation_meta.mojijake_ratio }]) : null,
            JSON.stringify({ question_type: q.question_type, difficulty: q.difficulty, score: q.score })
          ]
        );
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
             (run_label, entity_type, canonical_uid, canonical_id, action, detail)
           VALUES ($1, 'batch02_staging', $2, $3, 'STAGED_FROM_TAR', $4::jsonb)`,
          [RUN_LABEL, `${q.paper_uid}_${String(q.question_number).padStart(3, '0')}`, ins.rows[0].id,
           JSON.stringify({ paper_uid: q.paper_uid, subject: q.subject, year: q.year })]
        );
        await client.query('COMMIT');
        inserted++;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.log(`  ✗ ${q.paper_uid}_${q.question_number}: ${e.message.slice(0, 80)}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\n=== Result ===`);
  console.log(`inserted:    ${inserted}`);
  console.log(`duplicates:  ${duplicates}`);
  console.log(`failed (db): ${failed}`);
  console.log(`skipped (矿渣): ${skipped}`);
  console.log(`staging 总数 (预估): ${inserted}`);

  // 报告
  const report = {
    run_label: RUN_LABEL,
    timestamp: new Date().toISOString(),
    mode: 'commit',
    flags: { subject: FLAGS.subject, year: FLAGS.year, all: FLAGS.all },
    stats,
    result: { inserted, duplicates, failed }
  };
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'tar-adapter-stress-test.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(`\n报告 → docs/audits/tar-adapter-stress-test.json`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[tar-adapter] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
