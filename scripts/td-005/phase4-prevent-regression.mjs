#!/usr/bin/env node
// scripts/td-005/phase4-prevent-regression.mjs
// TD-005 Phase 4: 防再犯 — file_path / 题干质量 / KP 覆盖 健康度检查器
//
// 设计:
//   - 读 DB 当前状态, 检查 5 类问题
//   - 输出人类可读报告 + 写 docs/audits/td-005-phase4-regression-report.json
//   - 退出码 0 = 全部通过, 1 = 发现问题
//   - 适合接入 CI / pre-commit hook
//
// 5 类问题 (D089 经验值):
//   1. file_path 缺失 (DB NULL): 0 是目标 (D089 Phase 2 已实现)
//   2. file_path 格式异常: 0 是目标 (统一前缀)
//   3. file_path 物理文件不存在: < 1% (抽样 200, chinese/2025 已知缺失)
//   4. 题干残缺: < 5% (D089 v1.1 经验值)
//   5. KP 未覆盖: < 70% (即覆盖率 ≥ 30%, D088-11)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'td-005-phase4-prevent-regression';
const TIMESTAMP = new Date().toISOString();

function loadDatabaseUrl() {
  const envPath = path.join(ROOT, '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[phase4] DATABASE_URL missing');
}

const pool = new Pool({ connectionString: loadDatabaseUrl() });

async function main() {
  console.log('='.repeat(78));
  console.log(`  TD-005 Phase 4 · 防再犯检查 · ${TIMESTAMP}`);
  console.log('='.repeat(78));

  // 1. 5 个独立简单查询
  const totalRes = await pool.query('SELECT COUNT(*) AS n FROM exam_questions');
  const total = Number(totalRes.rows[0].n);
  const nullFpRes = await pool.query('SELECT COUNT(*) AS n FROM exam_questions WHERE file_path IS NULL');
  const null_fp = Number(nullFpRes.rows[0].n);
  const fpBadRes = await pool.query(`SELECT COUNT(*) AS n FROM exam_questions WHERE file_path IS NOT NULL AND file_path NOT LIKE 'database/incoming/%' AND file_path NOT LIKE 'database/question-bank/%'`);
  const fp_format_bad = Number(fpBadRes.rows[0].n);
  const stemBadRes = await pool.query('SELECT COUNT(*) AS n FROM exam_questions WHERE stem IS NULL OR LENGTH(stem) < 10');
  const stem_bad = Number(stemBadRes.rows[0].n);
  const mojiRes = await pool.query(`SELECT COUNT(*) AS n FROM exam_questions WHERE position(chr(65533) in stem) > 0`);
  const stem_mojibake = Number(mojiRes.rows[0].n);
  const headerRes = await pool.query(`SELECT COUNT(*) AS n FROM exam_questions WHERE stem ~ '^(本试卷|考试结束后|考生注意|答题卡|准考证)'`);
  const stem_header = Number(headerRes.rows[0].n);
  const kpRes = await pool.query('SELECT COUNT(DISTINCT question_id) AS n FROM question_knowledge_points');
  const with_kp = Number(kpRes.rows[0].n);
  const no_kp = total - with_kp;

  // 2. 物理文件存在性抽样
  const sampleRes = await pool.query(`SELECT id, question_uid, file_path FROM exam_questions WHERE file_path IS NOT NULL AND file_path LIKE 'database/incoming/%' ORDER BY RANDOM() LIMIT 200`);
  let exists = 0, missing = 0;
  const missingExamples = [];
  for (const row of sampleRes.rows) {
    const dir = path.join(ROOT, row.file_path);
    if (fs.existsSync(dir)) exists++;
    else {
      missing++;
      if (missingExamples.length < 5) missingExamples.push({ qid: row.id, qu: row.question_uid, fp: row.file_path });
    }
  }

  const CHECKS = [
    { id: 'CHECK-1-NULL-FP', label: 'file_path 缺失数', value: null_fp, threshold: 0, ok: null_fp === 0, desc: 'D089 Phase 2 已实现 100% 反填, 不应回退' },
    { id: 'CHECK-2-FP-FORMAT', label: 'file_path 格式异常数', value: fp_format_bad, threshold: 0, ok: fp_format_bad === 0, desc: '必须用 database/incoming|question-bank 前缀' },
    { id: 'CHECK-3-FP-EXISTS', label: 'file_path 物理目录不存在 (抽样 200)', value: missing, threshold: 2, ok: missing <= 2, desc: '< 1% 缺失 (chinese/2025 已知缺失)' },
    { id: 'CHECK-4-STEM-BAD', label: '题干残缺数 (空/太短/mojibake/卷头)', value: stem_bad + stem_mojibake + stem_header, threshold: Math.ceil(total * 0.05), ok: (stem_bad + stem_mojibake + stem_header) <= Math.ceil(total * 0.05), desc: '< 5% 阈值 (D089 v1.1)' },
    { id: 'CHECK-5-NO-KP', label: '未关联 KP 题目数', value: no_kp, threshold: Math.ceil(total * 0.7), ok: no_kp <= Math.ceil(total * 0.7), desc: 'KP 覆盖率 ≥ 30% (D088-11)' }
  ];

  let allOk = true;
  console.log('\n=== 健康度检查 ===');
  for (const c of CHECKS) {
    const pct = total > 0 ? (c.value / total * 100).toFixed(2) : '0';
    const status = c.ok ? 'OK' : 'FAIL';
    console.log(`  [${status}] ${c.label}: ${c.value} (${pct}%, 阈值 ${c.threshold})`);
    console.log(`         ${c.desc}`);
    if (!c.ok) allOk = false;
  }
  console.log('\n=== 物理文件存在性 (抽样 ' + sampleRes.rows.length + ') ===');
  console.log(`  存在: ${exists} (${(exists / sampleRes.rows.length * 100).toFixed(1)}%)`);
  console.log(`  缺失: ${missing} (${(missing / sampleRes.rows.length * 100).toFixed(1)}%)`);
  if (missingExamples.length > 0) {
    console.log('  缺失样例:');
    for (const m of missingExamples) console.log(`    qid=${m.qid} qu=${m.qu} fp=${m.fp}`);
  }

  const report = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    overall_ok: allOk,
    stats: {
      total_questions: total,
      null_fp, fp_format_bad,
      stem_bad, stem_mojibake, stem_header,
      questions_with_kp: with_kp, no_kp,
      kp_coverage_pct: Number((with_kp / total * 100).toFixed(2))
    },
    checks: CHECKS,
    file_exists_sample: { size: sampleRes.rows.length, exists, missing, missing_pct: Number((missing / sampleRes.rows.length * 100).toFixed(2)), missing_examples: missingExamples },
    recommendation: allOk ? '所有检查通过, 题库健康' : '发现问题需修复',
    next_steps: allOk ? [] : [
      'CHECK-1: 若 null_fp > 0, 跑 scripts/td-005/phase2-backfill-file-path.mjs',
      'CHECK-2: 修正 file_path 写入逻辑, 仅允许 database/incoming|question-bank 前缀',
      'CHECK-3: 修正 file_path (拼音→中文映射) 或重新解压 docx',
      'CHECK-4: 跑 scripts/td-005/phase3-reextract-stems.mjs 修复题干',
      'CHECK-5: 跑 scripts/qb2/stage32-kp-relink-full.mjs 补充 KP 映射'
    ]
  };
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'td-005-phase4-regression-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n报告 -> ${outPath}`);
  console.log(`\n=== 结论: ${allOk ? 'PASS' : 'FAIL'} ===`);

  await pool.end();
  process.exit(allOk ? 0 : 1);
}

main().catch(async e => {
  console.error('[phase4] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
