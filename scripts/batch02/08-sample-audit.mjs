#!/usr/bin/env node
// scripts/batch02/08-sample-audit.mjs
// Dispatch 021 · 快速抽样审核 (high-signal sampling)
//
// 设计原则：
//   1. 按 {level, subject, province} 分组, 每组抽 2 题 (1 choice + 1 non-choice)
//   2. 总样本 ≤ 60 题
//   3. 输出 stem_preview + options_count + content_json.image_expected
//   4. 检测 stem 中是否含 "undefined" / "[图片]" 字面裸露
//   5. 计算每组 stem 平均长度
//   6. 0 DB 写入, 纯 SELECT

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'audits', 'ingest-sample-audit.json');

function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[08] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

async function main() {
  console.log('='.repeat(78));
  console.log(`  Dispatch 021 · 抽样审核 · ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  // 1) 加载 staging 所有 (level, subject, province) 组
  const groupsRes = await pool.query(`
    SELECT exam_level, subject, province_code,
           count(*) AS n,
           count(*) FILTER (WHERE content_json->>'image_expected' = 'true') AS n_img,
           avg(length(stem)) AS avg_len
    FROM qb_recovery.batch02_staging
    WHERE ingest_status = 'parsed'
    GROUP BY exam_level, subject, province_code
    ORDER BY exam_level, subject, province_code
  `);
  const groups = groupsRes.rows;
  console.log(`\n[1] 总分组数: ${groups.length}`);

  // 2) 每组抽 2 题: 1 选择题 (有 options) + 1 非选择题/材料题
  const samples = [];  // {level, subject, province, qnum, stem_preview, options_count, image_expected}
  for (const g of groups) {
    const choiceRes = await pool.query(
      `SELECT question_number, LEFT(stem, 80) AS stem_preview,
              (options IS NOT NULL AND length(options) > 0) AS has_options,
              content_json->>'image_expected' AS image_expected
       FROM qb_recovery.batch02_staging
       WHERE exam_level = $1 AND subject = $2 AND province_code = $3
         AND ingest_status = 'parsed'
         AND options IS NOT NULL AND length(options) > 0
       ORDER BY question_number
       LIMIT 1`,
      [g.exam_level, g.subject, g.province_code]
    );
    const nonChoiceRes = await pool.query(
      `SELECT question_number, LEFT(stem, 80) AS stem_preview,
              (options IS NOT NULL AND length(options) > 0) AS has_options,
              content_json->>'image_expected' AS image_expected
       FROM qb_recovery.batch02_staging
       WHERE exam_level = $1 AND subject = $2 AND province_code = $3
         AND ingest_status = 'parsed'
         AND (options IS NULL OR length(options) = 0)
       ORDER BY question_number
       LIMIT 1`,
      [g.exam_level, g.subject, g.province_code]
    );

    if (choiceRes.rowCount > 0) {
      const r = choiceRes.rows[0];
      samples.push({
        level: g.exam_level, subject: g.subject, province: g.province_code,
        type: 'choice', qnum: r.question_number,
        stem_preview: r.stem_preview,
        has_options: r.has_options,
        image_expected: r.image_expected === 'true'
      });
    }
    if (nonChoiceRes.rowCount > 0) {
      const r = nonChoiceRes.rows[0];
      samples.push({
        level: g.exam_level, subject: g.subject, province: g.province_code,
        type: 'non_choice', qnum: r.question_number,
        stem_preview: r.stem_preview,
        has_options: r.has_options,
        image_expected: r.image_expected === 'true'
      });
    }
  }

  console.log(`[2] 总样本数: ${samples.length} (按 ${groups.length} 组 x 平均 ${(samples.length / groups.length).toFixed(1)} 题/组)`);
  if (samples.length > 60) {
    console.log(`    ⚠ 样本 > 60, 仅展示前 60`);
  }

  // 3) 检查字面污染
  const pollutedRes = await pool.query(`
    SELECT exam_level, subject, province_code, question_number,
           LEFT(stem, 80) AS stem_preview
    FROM qb_recovery.batch02_staging
    WHERE ingest_status = 'parsed'
      AND (stem ILIKE '%undefined%' OR stem ILIKE '%答案内容%' OR stem ILIKE '%解析内容%'
           OR stem ~ '\\[图片\\]' OR stem ~ '\\[图\\]' OR stem ~ '如图所示')
    LIMIT 30
  `);
  const polluted = pollutedRes.rows;
  console.log(`[3] stem 含 "undefined" / 占位符 / 图片标记: ${polluted.length} 题`);

  // 4) 图片工单与题目分布匹配性
  const ticketRes = await pool.query(`
    SELECT count(*) FROM public.issue_tickets WHERE issue_type = 'IMAGE_MISSING'
  `);
  const ticketsTotal = Number(ticketRes.rows[0].count);

  const imgExpectedRes = await pool.query(`
    SELECT count(*) FROM qb_recovery.batch02_staging
    WHERE ingest_status = 'parsed' AND content_json->>'image_expected' = 'true'
  `);
  const imgExpected = Number(imgExpectedRes.rows[0].count);

  // 5) 终端表格 (限 60 题)
  const display = samples.slice(0, 60);
  console.log(`\n=== 抽样表 (前 ${display.length} 题) ===`);
  console.log('┌─────────┬─────────┬──────────┬─────┬──────────────────────────────────────────┬────────┐');
  console.log('│ Level   │ Subject │ Province │ No. │ Stem Preview (60 chars)                   │ Opts   │');
  console.log('├─────────┼─────────┼──────────┼─────┼──────────────────────────────────────────┼────────┤');
  for (const s of display) {
    const stem = (s.stem_preview || '').slice(0, 60).padEnd(60);
    const opts = (s.has_options ? '✓' : '—');
    console.log(`│ ${s.level.padEnd(7)} │ ${s.subject.padEnd(7)} │ ${s.province.padEnd(8)} │ ${String(s.qnum).padEnd(3)} │ ${stem} │ ${opts.padEnd(6)} │`);
  }
  console.log('└─────────┴─────────┴──────────┴─────┴──────────────────────────────────────────┴────────┘');

  // 6) 每组统计
  console.log(`\n=== 分组统计 ===`);
  console.log('┌─────────┬─────────┬──────────┬─────┬─────────┬────────────┐');
  console.log('│ Level   │ Subject │ Province │  N  │ AvgLen  │ ImgExp     │');
  console.log('├─────────┼─────────┼──────────┼─────┼─────────┼────────────┤');
  for (const g of groups) {
    const imgPct = g.n > 0 ? ((Number(g.n_img) / Number(g.n)) * 100).toFixed(1) + '%' : '0%';
    console.log(`│ ${g.exam_level.padEnd(7)} │ ${g.subject.padEnd(7)} │ ${g.province_code.padEnd(8)} │ ${String(g.n).padEnd(3)} │ ${String(Math.round(Number(g.avg_len))).padEnd(7)} │ ${imgPct.padEnd(10)} │`);
  }
  console.log('└─────────┴─────────┴──────────┴─────┴─────────┴────────────┘');

  // 7) 字面污染清单
  if (polluted.length > 0) {
    console.log(`\n[3.1] ⚠ 含字面污染的题目 (${polluted.length}):`);
    for (const p of polluted.slice(0, 10)) {
      console.log(`  ${p.exam_level}/${p.subject}/${p.province_code}/Q${p.question_number}: "${p.stem_preview}"`);
    }
  }

  // 8) 工单匹配性
  console.log(`\n[4] 图片相关数据:`);
  console.log(`    staging 中 image_expected=true: ${imgExpected} 题`);
  console.log(`    issue_tickets IMAGE_MISSING: ${ticketsTotal} 个`);
  console.log(`    覆盖率: ${ticketsTotal > 0 ? ((imgExpected / ticketsTotal) * 100).toFixed(1) + '%' : 'N/A'}`);

  // 9) 写 JSON 报告
  const report = {
    run_label: 'batch02-08-sample-audit',
    timestamp: new Date().toISOString(),
    total_groups: groups.length,
    total_samples: samples.length,
    sample_limit: 60,
    groups: groups.map((g) => ({
      level: g.exam_level, subject: g.subject, province: g.province_code,
      n: Number(g.n), avg_stem_length: Math.round(Number(g.avg_len)),
      image_expected_count: Number(g.n_img),
      image_expected_pct: Number(((Number(g.n_img) / Number(g.n)) * 100).toFixed(2))
    })),
    samples: display,
    polluted_count: polluted.length,
    polluted_examples: polluted.slice(0, 10).map((p) => ({
      level: p.exam_level, subject: p.subject, province: p.province_code,
      qnum: p.question_number, stem: p.stem_preview
    })),
    ticket_match: {
      image_expected_in_staging: imgExpected,
      image_missing_tickets: ticketsTotal,
      coverage_ratio: ticketsTotal > 0 ? Number((imgExpected / ticketsTotal).toFixed(4)) : null
    }
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n报告 → ${REPORT_PATH}`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[08] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
