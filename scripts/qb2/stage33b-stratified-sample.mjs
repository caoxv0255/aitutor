#!/usr/bin/env node
// scripts/qb2/stage33b-stratified-sample.mjs
// D090 follow-up: 按 9 学科分层抽样，每科随机抽 5 题（共 45 题）
// 输出 docs/audits/stage33b-stratified-sample-45.json
// 用户用于快速评估 pg_trgm 兜底质量，决定是否放弃剩余题

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.resolve(__dirname, '..', '..', 'docs', 'audits', 'stage33-candidates-for-review.csv');
const OUT_JSON = path.resolve(__dirname, '..', '..', 'docs', 'audits', 'stage33b-stratified-sample-45.json');
const OUT_MD   = path.resolve(__dirname, '..', '..', 'docs', 'audits', 'stage33b-stratified-sample-45.md');

const SAMPLE_PER_SUBJECT = 5;
const SEED = 'D090-sample-2026-09-14';

// 简单 CSV 解析
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => row[h] = fields[idx] || '');
    rows.push(row);
  }
  return { header, rows };
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === ',') { fields.push(cur); cur = ''; }
      else if (c === '"') inQuote = true;
      else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

// 确定性随机 (用 SEED 哈希 + row id)，保证可复现
function seededShuffle(arr, seed) {
  const seedHash = crypto.createHash('sha256').update(seed).digest();
  let counter = 0;
  const scored = arr.map(row => ({
    row,
    score: parseInt(crypto.createHash('sha256').update(seedHash).update(String(counter++)).digest('hex').slice(0, 8), 16)
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored.map(s => s.row);
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('[stage33b] 找不到 ' + CSV_PATH);
    process.exit(1);
  }
  const { rows } = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log('[stage33b] 加载未审校题目: ' + rows.length);

  // 按学科分组
  const bySubj = {};
  for (const r of rows) {
    const s = r.subject_code || '(NULL)';
    if (!bySubj[s]) bySubj[s] = [];
    bySubj[s].push(r);
  }

  // 抽样 (每科 5 题, 若 <5 则全抽)
  const sample = [];
  for (const subj of Object.keys(bySubj).sort()) {
    const arr = bySubj[subj];
    const shuffled = seededShuffle(arr, SEED + ':' + subj);
    const picked = shuffled.slice(0, Math.min(SAMPLE_PER_SUBJECT, arr.length));
    for (const r of picked) sample.push({ subject: subj, ...r });
  }

  console.log('[stage33b] 抽样总数: ' + sample.length);
  const subjCount = {};
  for (const r of sample) subjCount[r.subject] = (subjCount[r.subject] || 0) + 1;
  console.log('[stage33b] 各科抽样数: ' + JSON.stringify(subjCount));

  // 写 JSON
  const result = {
    seed: SEED,
    sample_size_per_subject: SAMPLE_PER_SUBJECT,
    total_sampled: sample.length,
    sampling_breakdown: subjCount,
    sampled: sample.map(r => ({
      question_id: r.question_id,
      subject_code: r.subject_code,
      stem_60chars: r.stem_60chars,
      kp1_name: r.kp1_name,
      kp1_sim: r.kp1_sim,
      kp2_name: r.kp2_name,
      kp2_sim: r.kp2_sim,
      kp3_name: r.kp3_name,
      kp3_sim: r.kp3_sim
    }))
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2), 'utf8');
  console.log('[stage33b] JSON → ' + OUT_JSON);

  // 写 Markdown 摘要 (用户审阅格式)
  let md = '# Stage33b 分层抽样摘要 (45 题)\n\n';
  md += '**Seed:** `' + SEED + '`  ';
  md += '**Sample size:** 5 / 学科 (共 9 学科 = 45 题)  \n';
  md += '**Source:** `docs/audits/stage33-candidates-for-review.csv` (2642 行)  \n';
  md += '**Generated:** ' + new Date().toISOString() + '\n\n';
  md += '---\n\n';
  for (const r of result.sampled) {
    md += '### [' + r.subject_code + '] Q' + r.question_id + '\n';
    md += '- **Stem**: ' + r.stem_60chars + '\n';
    md += '- **KP1**: ' + r.kp1_name + ' (sim=' + r.kp1_sim + ')\n';
    md += '- **KP2**: ' + r.kp2_name + ' (sim=' + r.kp2_sim + ')\n';
    md += '- **KP3**: ' + r.kp3_name + ' (sim=' + r.kp3_sim + ')\n\n';
  }
  md += '---\n\n';
  md += '## 评估指引\n\n';
  md += '1. **Stem 关键词 vs KP 名称**：关键词是否真的"指向"该 KP？\n';
  md += '2. **sim 分数**：top-1 候选的 sim 是否 ≥ 0.4 (可接受门槛)？\n';
  md += '3. **若 ≥ 80% (36/45) 可接受**：放弃剩余题，接受 57.52% 覆盖率\n';
  md += '4. **若 ≥ 60% (27/45) 尚可**：仍接受 57.52%，剩余题走 Stage34 (人审)\n';
  md += '5. **若 < 60%**：trgm 兜底质量差，必须走 Stage34 + 增量 LLM\n';
  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log('[stage33b] MD  → ' + OUT_MD);
}

main().catch(e => {
  console.error('[stage33b] FATAL', e);
  process.exit(2);
});
