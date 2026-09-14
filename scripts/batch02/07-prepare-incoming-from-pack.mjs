#!/usr/bin/env node
// scripts/batch02/07-prepare-incoming-from-pack.mjs
// Dispatch 019 · Lost Exam Pack 数据清洗与标准化
//
// 设计原则：
//   1. 仅读取 matched=true 且 docx/ 实际存在的文件
//   2. 强制从 src_path + packed_path + filename 推断真实 (province, exam_level, subject)
//   3. 不信任 manifest 的 province 字段 (已知 schema 错位)
//   4. 去重: 对比 public.exam_papers + batch02_staging 现有数据
//   5. 路径英文化: 严禁中文字符进入 database/incoming/
//   6. 目标结构: database/incoming/{level}/{subject}/{year}/{year}_{province}_{subject}_{level}_{variant}.docx
//   7. 严禁写入 public.*; 仅拷贝 + 报告

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const PKG_DIR = path.join(ROOT, 'lost_exam_pack_2026-09-10');
const MANIFEST = path.join(PKG_DIR, 'manifest.csv');
const DOCX_SRC = path.join(PKG_DIR, 'docx');
const INCOMING = path.join(ROOT, 'database', 'incoming');

const REPORT_PATH = path.join(ROOT, 'docs', 'audits', 'incoming-loaded-report.json');

// ─── DB ──────────────────────────────────────────────────
function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[07] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── 推断真实 province / level / subject ───────────────
// 从 src_path 推断 (因为 manifest 的 province 字段其实是 exam_level)
const PROVINCE_PATTERNS = [
  ['beijing', /北京/],
  ['shanghai', /上海/],
  ['tianjin', /天津/],
  ['chongqing', /重庆/],
  ['jiangsu', /江苏/],
  ['zhejiang', /浙江/],
  ['guangdong', /广东/],
  ['shandong', /山东/],
  ['anhui', /安徽/],
  ['fujian', /福建/],
  ['hunan', /湖南/],
  ['hubei', /湖北/],
  ['hebei', /河北/],
  ['henan', /河南/],
  ['jiangxi', /江西/],
  ['sichuan', /四川/],
  ['shaanxi', /陕西|陕/],
  ['liaoning', /辽宁/],
  ['jilin', /吉林/],
  ['heilongjiang', /黑龙江/],
  ['shanghai', /沪/],
  ['tianjin', /津/],
  ['guangxi', /广西/],
  ['hainan', /海南/],
  ['yunnan', /云南/],
  ['guizhou', /贵州/],
  ['gansu', /甘肃/],
  ['inner_mongolia', /内蒙古/],
  ['xinjiang', /新疆/],
  ['tibet', /西藏/],
  ['ningxia', /宁夏/],
  ['qinghai', /青海/]
];

const SUBJECT_PATTERNS = [
  ['chinese', /语文/],
  ['math', /数学/],
  ['english', /英语|英文/],
  ['physics', /物理/],
  ['chemistry', /化学/],
  ['biology', /生物/],
  ['politics', /政治|思想政治/],
  ['history', /历史/],
  ['geography', /地理/]
];

// exam_level 强制覆盖: 不信任 manifest
function forceLevel(srcPath, packedPath, originalFilename) {
  const text = `${srcPath}\n${packedPath}\n${originalFilename}`;
  if (/中考|zhongkao|junior/i.test(text)) return 'zhongkao';
  if (/高考|gaokao|senior/i.test(text)) return 'gaokao';
  // 兜底: 看 src_path 顶级目录
  if (/北京中考/.test(srcPath)) return 'zhongkao';
  if (/高考真题|高考/.test(srcPath)) return 'gaokao';
  return null; // 需要人工推断
}

function inferProvince(srcPath, packedPath, originalFilename) {
  const text = `${srcPath}\n${packedPath}\n${originalFilename}`;
  for (const [code, re] of PROVINCE_PATTERNS) {
    if (re.test(text)) return code;
  }
  // 兜底: 从 packed_path 的 _xxx 段提取 (2017_beijing_math__...)
  const m = packedPath.match(/^[a-z]+\/(\d{4})_([a-z_]+?)_([a-z]+?)__/);
  if (m) return m[2];
  return 'unknown';
}

function inferSubject(srcPath, packedPath, originalFilename, manifestSubject) {
  const text = `${srcPath}\n${packedPath}\n${originalFilename}`;
  for (const [code, re] of SUBJECT_PATTERNS) {
    if (re.test(text)) return code;
  }
  // 兜底: packed_path 第三段
  const m = packedPath.match(/^[a-z]+\/\d{4}_[a-z_]+?_([a-z]+?)__/);
  if (m && SUBJECT_PATTERNS.find((s) => s[0] === m[1])) return m[1];
  return manifestSubject || 'unknown';
}

function inferVariant(originalFilename) {
  if (/（空白卷）|\(空白卷\)/.test(originalFilename)) return 'blank';
  if (/（解析卷）|\(解析卷\)/.test(originalFilename)) return 'analysis';
  if (/（参考答案）|\(参考答案\)/.test(originalFilename)) return 'answer_only';
  return null;
}

// ─── CSV parser (simple; manifest may have quoted commas) ───
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// ─── 去重检查 ──────────────────────────────────────────
async function loadExistingKeys() {
  // public.exam_papers 中所有 (year, subject, province, exam_level) 组合
  const papers = await pool.query(
    `SELECT year, subject, province_code, exam_level FROM public.exam_papers`
  );
  const staging = await pool.query(
    `SELECT paper_uid, year, subject, province_code, exam_level
     FROM qb_recovery.batch02_staging
     WHERE ingest_status IN ('parsed','validated')`
  );
  const set = new Set();
  for (const r of papers.rows) {
    set.add(`${r.year}|${r.subject}|${r.province_code}|${r.exam_level}`);
  }
  for (const r of staging.rows) {
    // batch02_staging.paper_uid = `${subject}_${year}_${provinceCode}_${paperVariant}`
    const m = String(r.paper_uid || '').match(/^([a-z]+)_(\d{4})_([a-z_]+)_/);
    if (m) set.add(`${m[2]}|${m[1]}|${m[3]}|${r.exam_level}`);
  }
  return set;
}

// ─── Main ───────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Dispatch 019 · Lost Exam Pack 清洗与标准化 · ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  // 1) 读 manifest
  const csvText = fs.readFileSync(MANIFEST, 'utf8');
  const lines = csvText.split('\n').filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  console.log(`\n[1] manifest header: ${header.join(' | ')}`);
  console.log(`    total rows: ${lines.length - 1}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cols[j];
    row._idx = i;
    row._matched = row.matched === 'true';
    row._file_bytes = parseInt(row.file_bytes || '0', 10);
    rows.push(row);
  }

  // 2) 过滤 matched=true
  const matched = rows.filter((r) => r._matched);
  console.log(`\n[2] matched=true rows: ${matched.length}`);

  // 3) 加载现有去重键
  const existingKeys = await loadExistingKeys();
  console.log(`[3] 现有去重键: ${existingKeys.size}`);

  // 4) 逐行处理
  const result = {
    run_label: 'batch02-07-prepare-incoming',
    timestamp: new Date().toISOString(),
    total_manifest_rows: rows.length,
    matched_rows: matched.length,
    stats: {
      copied: 0,
      skipped_duplicate: 0,
      skipped_file_missing: 0,
      skipped_unparseable_level: 0,
      level_corrected: 0,
      level_inferred: 0,
      province_inferred: 0
    },
    files: [],
    anomalies: []
  };

  for (const r of matched) {
    const packedPath = r.packed_path || '';
    const srcPath = r.src_path || '';
    const originalFilename = packedPath.split('/').pop() || '';

    // 文件存在性检查
    const srcFile = path.join(DOCX_SRC, originalFilename);
    if (!fs.existsSync(srcFile)) {
      result.stats.skipped_file_missing++;
      result.anomalies.push({ idx: r._idx, reason: 'file_missing', packed_path: packedPath });
      continue;
    }

    // 强制推断元数据
    const trueLevel = forceLevel(srcPath, packedPath, originalFilename);
    if (!trueLevel) {
      result.stats.skipped_unparseable_level++;
      result.anomalies.push({ idx: r._idx, reason: 'cannot_parse_level', src_path: srcPath });
      continue;
    }
    const manifestLevel = r.level;
    if (manifestLevel !== trueLevel) {
      result.stats.level_corrected++;
    } else {
      result.stats.level_inferred++;
    }

    const trueProvince = inferProvince(srcPath, packedPath, originalFilename);
    const trueSubject = inferSubject(srcPath, packedPath, originalFilename, r.subject);
    const variant = inferVariant(originalFilename);

    // 去重检查
    const dedupKey = `${r.year}|${trueSubject}|${trueProvince}|${trueLevel}`;
    if (existingKeys.has(dedupKey)) {
      // 注意: 同一 (year, subject, province, level) 可能有多份 (空白卷/解析卷) → 不应全 skip
      // 但我们之前 dispatch 17 已经识别 chinese/2024 与 MVP 重叠, 这种情况下只 skip
      result.stats.skipped_duplicate++;
      result.files.push({
        idx: r._idx,
        action: 'SKIPPED_DUPLICATE',
        reason: `(year,subject,province,level) already exists in public.exam_papers or batch02_staging`,
        original_filename: originalFilename,
        year: Number(r.year),
        level: trueLevel,
        province: trueProvince,
        subject: trueSubject,
        variant,
        manifest_level_was: manifestLevel
      });
      continue;
    }

    // 构造目标路径
    const variantPart = variant ? `_${variant}` : '';
    const safeFilename = `${r.year}_${trueProvince}_${trueSubject}_${trueLevel}${variantPart}_${r._idx}.docx`;
    const targetDir = path.join(INCOMING, trueLevel, trueSubject, String(r.year));
    const targetPath = path.join(targetDir, safeFilename);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(srcFile, targetPath);
    result.stats.copied++;
    result.files.push({
      idx: r._idx,
      action: 'COPIED',
      src_file: srcFile,
      target_path: targetPath,
      original_filename: originalFilename,
      year: Number(r.year),
      level: trueLevel,
      province: trueProvince,
      subject: trueSubject,
      variant,
      manifest_level_was: manifestLevel,
      manifest_province_was: r.province,
      manifest_subject_was: r.subject,
      priority: Number(r.priority),
      tier: r.tier,
      file_bytes: r._file_bytes
    });

    // 把 dedupKey 加入 set (防止本批次内重复)
    existingKeys.add(dedupKey);
  }

  // 5) 写报告
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));

  // 6) 终端摘要
  console.log('\n=== 结果 ===');
  console.log(`拷贝成功:           ${result.stats.copied}`);
  console.log(`跳过 (重复):        ${result.stats.skipped_duplicate}`);
  console.log(`跳过 (文件缺失):    ${result.stats.skipped_file_missing}`);
  console.log(`跳过 (无法判 level): ${result.stats.skipped_unparseable_level}`);
  console.log(`Level 修正:         ${result.stats.level_corrected}`);
  console.log(`Level 与 manifest 一致: ${result.stats.level_inferred}`);
  console.log(`Province 推断修正:   ${result.stats.province_inferred}`);
  console.log(`异常总数:           ${result.anomalies.length}`);
  console.log(`报告 → ${REPORT_PATH}`);

  // 列出被 Level 修正的样例
  const corrected = result.files.filter((f) => f.manifest_level_was && f.manifest_level_was !== f.level).slice(0, 10);
  if (corrected.length > 0) {
    console.log(`\n=== Level 修正样例 (前 10) ===`);
    for (const c of corrected) {
      console.log(`  ${c.original_filename}  manifest=${c.manifest_level_was} → ${c.level}`);
    }
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('[07] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
