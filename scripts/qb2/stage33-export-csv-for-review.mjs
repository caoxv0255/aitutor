#!/usr/bin/env node
// scripts/qb2/stage33-export-csv-for-review.mjs
// D090 follow-up: Stage32 跑完后，仍有 ~2642 题未匹配 KP
// 本脚本纯本地生成 CSV（无 LLM 调用，零成本）供人工抽审
//   - 输出 docs/audits/stage33-candidates-for-review.csv
//   - 字段: question_id, subject_code, stem_60chars, current_kp_count,
//           kp1_id, kp1_name, kp1_sim, kp2_id, kp2_name, kp2_sim, kp3_id, kp3_name, kp3_sim,
//           review_status(空白=待审), review_kp_id(人工填), review_kp_name(人工填), notes
// 后续: stage34-apply-reviewed.mjs 读取人工审校后的 CSV 写入 DB

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDatabaseUrl() {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[stage33] DATABASE_URL missing');
}

const pool = new Pool({ connectionString: loadDatabaseUrl() });

// CSV 字段转义
function csvEscape(s) {
  if (s === null || s === undefined) return '';
  s = String(s);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  console.log('[stage33] 加载仍未匹配 KP 的题目...');
  // 找出所有仍未匹配 KP 的题目
  const qRes = await pool.query(`
    SELECT q.id, q.question_uid, q.subject_code, q.stem
    FROM public.exam_questions q
    LEFT JOIN public.question_knowledge_points kp ON kp.question_id = q.id
    WHERE q.stem IS NOT NULL AND kp.question_id IS NULL
    ORDER BY q.subject_code, q.id
  `);
  const questions = qRes.rows;
  console.log('[stage33] 剩余未匹配题数: ' + questions.length);

  // 对每题用 pg_trgm similarity 取 top 3 KP 候选
  console.log('[stage33] 生成 top-3 KP 候选 (pg_trgm similarity)...');
  const rows = [];
  for (const q of questions) {
    const topic = (q.stem || '').replace(/\s+/g, '').slice(0, 32);
    const cRes = await pool.query(
      `SELECT id, name, similarity(name, $1) AS sim
       FROM public.knowledge_points
       WHERE subject = $2 AND name NOT LIKE '%....%'
       ORDER BY sim DESC LIMIT 3`,
      [topic, q.subject_code]
    );
    const candidates = cRes.rows;
    const k1 = candidates[0] || {};
    const k2 = candidates[1] || {};
    const k3 = candidates[2] || {};
    rows.push({
      question_id: q.id,
      question_uid: q.question_uid,
      subject_code: q.subject_code,
      stem_60chars: (q.stem || '').replace(/\s+/g, ' ').slice(0, 60),
      kp1_id: k1.id || '',
      kp1_name: k1.name || '',
      kp1_sim: k1.sim ? Number(k1.sim).toFixed(3) : '',
      kp2_id: k2.id || '',
      kp2_name: k2.name || '',
      kp2_sim: k2.sim ? Number(k2.sim).toFixed(3) : '',
      kp3_id: k3.id || '',
      kp3_name: k3.name || '',
      kp3_sim: k3.sim ? Number(k3.sim).toFixed(3) : ''
    });
  }

  // 写 CSV
  const outDir = path.resolve(__dirname, '..', '..', 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stage33-candidates-for-review.csv');

  const header = [
    'question_id', 'question_uid', 'subject_code', 'stem_60chars',
    'kp1_id', 'kp1_name', 'kp1_sim',
    'kp2_id', 'kp2_name', 'kp2_sim',
    'kp3_id', 'kp3_name', 'kp3_sim',
    'review_status', 'review_kp_id', 'review_kp_name', 'notes'
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.question_id, r.question_uid, r.subject_code, r.stem_60chars,
      r.kp1_id, r.kp1_name, r.kp1_sim,
      r.kp2_id, r.kp2_name, r.kp2_sim,
      r.kp3_id, r.kp3_name, r.kp3_sim,
      '', '', '', ''  // 4 个待人工填的字段
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('[stage33] CSV 已生成: ' + outPath);
  console.log('[stage33] 共 ' + rows.length + ' 行');
  console.log('[stage33] 人工抽审后，填充 review_kp_id 列，保存为 stage33-candidates-for-review-FILLED.csv');
  console.log('[stage33] 再跑 stage34-apply-reviewed.mjs 写库');

  await pool.end();
}

main().catch(async (e) => {
  console.error('[stage33] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
