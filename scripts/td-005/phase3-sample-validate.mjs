#!/usr/bin/env node
// scripts/td-005/phase3-sample-validate.mjs
// TD-005 Phase 3 Step 1: incoming docx 抽样验证
//
// 目标:
//   从反填成功的题目中随机抽取 50 题, 读取 docx, 评估健康度
//   给出"是否建议启动完整 Phase 3 题干重提取"的结论
//
// 匹配策略 (按优先级):
//   1. paper_uid 解析 (subject, year, province) → 找中文文件名含 province 名 + "原卷"/"解析"
//   2. 用题号 qn 估读文件中位置 (待 Phase 3 完整执行)
//
// 用法:
//   node scripts/td-005/phase3-sample-validate.mjs --dry-run
//   node scripts/td-005/phase3-sample-validate.mjs --commit     # 当前是 READ-ONLY, 实际无写入

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'td-005-phase3-sample-validate';
const TIMESTAMP = new Date().toISOString();
const SAMPLE_SIZE = 50;

// province 拼音 → 中文名 映射 (常见, 简化版)
const PROVINCE_ZH = {
  beijing: '北京', shanghai: '上海', tianjin: '天津', chongqing: '重庆',
  hebei: '河北', shanxi: '山西', liaoning: '辽宁', jilin: '吉林',
  heilongjiang: '黑龙江', jiangsu: '江苏', zhejiang: '浙江', anhui: '安徽',
  fujian: '福建', jiangxi: '江西', shandong: '山东', henan: '河南',
  hubei: '湖北', hunan: '湖南', guangdong: '广东', hainan: '海南',
  sichuan: '四川', guizhou: '贵州', yunnan: '云南', shaanxi: '陕西',
  gansu: '甘肃', qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆',
  neimenggu: '内蒙古', guangxi: '广西', xizang: '西藏',
  national: '全国', national_i: '全国I', national_ii: '全国II', national_iii: '全国III'
};

// province 解析: 从 paper_uid 或 paper.paper_uid
function parseProvince(paperUid) {
  if (!paperUid) return null;
  // 格式: {subject}_{year}_{province}_gaokao 或 {subject}_{year}_{province}
  const m = paperUid.match(/_(\d{4})_([a-z_]+?)(?:_gaokao)?$/);
  if (!m) return null;
  const province = m[2];
  return { year: parseInt(m[1], 10), province, zh: PROVINCE_ZH[province] || province };
}

// 在目录内找匹配文件 (按 province 中文名 + 原卷/解析/...)
function findDocxInDir(dir, provinceZh, year) {
  let files;
  try { files = fs.readdirSync(dir); } catch { return null; }
  const candidates = [];
  for (const f of files) {
    if (!/\.(docx?|pdf)$/i.test(f)) continue;
    let score = 0;
    if (provinceZh && f.includes(provinceZh)) score += 10;
    if (String(year) && f.includes(String(year))) score += 2;
    // "原卷" vs "解析": 默认偏好 "解析" (带答案) 用于题干重建
    if (f.includes('解析')) score += 3;
    else if (f.includes('原卷')) score += 1;
    if (score > 0) candidates.push({ file: f, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.file || null;
}

// 健康度评估 (基于 docx 提取的文本)
function assessHealth(text) {
  if (!text || text.trim().length === 0) return { ok: false, reason: 'empty' };
  const trimmed = text.trim();
  if (trimmed.length < 10) return { ok: false, reason: 'too_short', len: trimmed.length };
  if (trimmed === 'undefined' || trimmed === 'null') return { ok: false, reason: 'placeholder' };
  // 卷头说明检测
  const HEADER_PATTERNS = [
    /^本试卷/, /^考试结束后/, /^考生注意/, /^第[IVX]+页/, /答题卡/,
    /^准考证/, /^姓名[：:]/, /^\d+\s*$/
  ];
  for (const re of HEADER_PATTERNS) {
    if (re.test(trimmed)) return { ok: false, reason: 'header_or_page_marker', pattern: re.source };
  }
  // Mojibake 检测
  const MOJIBAKE = /[\uFFFD\u0000-\u0008\u000B-\u001F]/;
  if (MOJIBAKE.test(trimmed)) return { ok: false, reason: 'mojibake' };
  return { ok: true, len: trimmed.length };
}

function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[phase3] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

async function main() {
  console.log('='.repeat(78));
  console.log(`  TD-005 Phase 3 Step 1 · docx 抽样验证 · ${TIMESTAMP}`);
  console.log(`  Sample size: ${SAMPLE_SIZE} 题`);
  console.log('='.repeat(78));

  // 1) 抽样 50 题: 按学科分层抽样 (9 学科)
  const sampleBySubj = {};
  for (const subj of ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'politics', 'history', 'geography']) {
    const r = await pool.query(`
      SELECT q.id, q.question_uid, q.subject_code, q.stem AS db_stem, q.paper_id, q.file_path,
             p.paper_uid, p.year
      FROM exam_questions q
      JOIN exam_papers p ON p.id = q.paper_id
      WHERE q.subject_code = $1 AND q.file_path IS NOT NULL
      ORDER BY RANDOM() LIMIT 6
    `, [subj]);
    sampleBySubj[subj] = r.rows;
  }
  const allSampled = [].concat(...Object.values(sampleBySubj)).slice(0, SAMPLE_SIZE);
  console.log('\n[1] 抽样:');
  for (const subj of Object.keys(sampleBySubj)) console.log(`  ${subj}: ${sampleBySubj[subj].length}`);

  // 2) 对每题解析 docx
  const results = [];
  let nFileFound = 0;
  let nExtractOk = 0;
  let nHealthy = 0;
  const reasonCounts = {};

  for (const q of allSampled) {
    if (!q.file_path) {
      results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                     outcome: 'file_path_null', db_stem_preview: q.db_stem?.slice(0, 60) });
      reasonCounts['file_path_null'] = (reasonCounts['file_path_null'] || 0) + 1;
      continue;
    }
    const dir = path.join(ROOT, q.file_path);
    if (!fs.existsSync(dir)) {
      results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                     outcome: 'dir_missing', file_path: q.file_path });
      reasonCounts['dir_missing'] = (reasonCounts['dir_missing'] || 0) + 1;
      continue;
    }
    const provInfo = parseProvince(q.paper_uid);
    const matchedFile = findDocxInDir(dir, provInfo?.zh, provInfo?.year);
    if (!matchedFile) {
      results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                     outcome: 'no_match_file', file_path: q.file_path,
                     tried_province_zh: provInfo?.zh, year: provInfo?.year });
      reasonCounts['no_match_file'] = (reasonCounts['no_match_file'] || 0) + 1;
      continue;
    }
    nFileFound++;
    if (!matchedFile) {
      results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                     outcome: 'matchedFile_undefined', file_path: q.file_path, dir_listing: fs.readdirSync(dir).slice(0, 5) });
      continue;
    }
    const absFile = path.join(dir, matchedFile);
    let extractText = '';
    try {
      if (/\.docx?$/i.test(matchedFile)) {
        const r = await mammoth.extractRawText({ path: absFile });
        extractText = r.value || '';
      } else {
        // PDF 暂不解析 (Phase 3 全量时再处理)
        results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                       outcome: 'pdf_skip', matched_file: matchedFile });
        reasonCounts['pdf_skip'] = (reasonCounts['pdf_skip'] || 0) + 1;
        continue;
      }
    } catch (e) {
      results.push({ question_id: q.id, subject: q.subject_code, paper_uid: q.paper_uid,
                     outcome: 'extract_error', matched_file: matchedFile, error: e.message.slice(0, 100) });
      reasonCounts['extract_error'] = (reasonCounts['extract_error'] || 0) + 1;
      continue;
    }
    nExtractOk++;
    const health = assessHealth(extractText);
    if (health.ok) nHealthy++;
    else reasonCounts['unhealthy:' + health.reason] = (reasonCounts['unhealthy:' + health.reason] || 0) + 1;
    results.push({
      question_id: q.id,
      subject: q.subject_code,
      paper_uid: q.paper_uid,
      matched_file: matchedFile,
      docx_text_length: extractText.length,
      db_stem_preview: q.db_stem?.slice(0, 60),
      docx_preview: extractText.slice(0, 200).replace(/\s+/g, ' '),
      health
    });
  }

  // 3) 统计汇总
  console.log('\n[2] 验证统计 (50 题抽样):');
  console.log('  总抽样: ' + allSampled.length);
  console.log('  找到 docx 文件: ' + nFileFound + ' (' + (nFileFound / allSampled.length * 100).toFixed(1) + '%)');
  console.log('  文本提取成功: ' + nExtractOk);
  console.log('  健康: ' + nHealthy + ' (' + (nHealthy / allSampled.length * 100).toFixed(1) + '%)');
  console.log('  失败原因: ' + JSON.stringify(reasonCounts));

  // 4) 建议
  const healthyPct = nHealthy / allSampled.length * 100;
  let recommendation;
  if (healthyPct >= 70) recommendation = '✅ 强烈建议启动完整 Phase 3 (题库修复 ROI 高)';
  else if (healthyPct >= 50) recommendation = '⚠️ 建议启动 Phase 3 但预期收益中等';
  else if (healthyPct >= 30) recommendation = '⚠️ 谨慎启动, docx 健康度偏低, 部分题需 LLM 辅助';
  else recommendation = '❌ 不建议启动完整 Phase 3, docx 矿渣过多';
  console.log('\n[3] 建议: ' + recommendation);

  // 5) 详细抽样 (打印前 10 题详情)
  console.log('\n[4] 抽样详情 (前 15 题):');
  let n = 0;
  for (const r of results) {
    if (n >= 15) break;
    n++;
    console.log(`  [${r.subject}] q${r.question_id} ${r.paper_uid?.slice(-12) || ''}`);
    console.log(`    outcome: ${r.outcome}` + (r.matched_file ? ` | file: ${r.matched_file.slice(0,50)}` : ''));
    if (r.docx_preview) {
      console.log(`    docx[0..100]: ${r.docx_preview.slice(0, 100).replace(/\s+/g, ' ')}`);
    }
    if (r.db_stem_preview) {
      console.log(`    db_stem[0..60]: ${r.db_stem_preview}`);
    }
  }

  // 6) 写报告
  const report = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    sample_size: SAMPLE_SIZE,
    sample_by_subject: Object.fromEntries(Object.entries(sampleBySubj).map(([k, v]) => [k, v.length])),
    stats: {
      total_sampled: allSampled.length,
      file_found: nFileFound,
      extract_ok: nExtractOk,
      healthy: nHealthy,
      healthy_pct: Number(healthyPct.toFixed(2)),
      reason_breakdown: reasonCounts
    },
    recommendation,
    next_step_threshold: {
      full_phase3_recommended: healthyPct >= 70,
      partial_recommended: healthyPct >= 50,
      llm_assist_required: healthyPct < 50
    },
    sample_details: results.slice(0, 30)
  };
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'td-005-phase3-sample-validate-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\n报告 → docs/audits/td-005-phase3-sample-validate-report.json');

  await pool.end();
}

main().catch(async (e) => {
  console.error('[phase3] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
