#!/usr/bin/env node
/**
 * Phase 6 B2 · CH-4 写库 (去重版)
 * 读所有 database/b2_results_*_*.jsonl, 按 question_id 去重 (后跑覆盖前跑)
 * 写 question_kp_v2
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const pool = new Pool({ connectionString: fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim() });

const resultFiles = fs.readdirSync(ROOT + '/database').filter(f => /^b2_results_\d+_\d+\.jsonl$/.test(f)).sort();
console.log(`找到 ${resultFiles.length} 个分片结果文件`);

const byQid = new Map();
let total = 0, errors = 0;
for (const f of resultFiles) {
  const lines = fs.readFileSync(path.join(ROOT, 'database', f), 'utf8').trim().split('\n').filter(Boolean);
  for (const l of lines) {
    try {
      const r = JSON.parse(l);
      if (r.question_id) byQid.set(r.question_id, r);
      total++;
    } catch (e) { errors++; }
  }
}
console.log(`合并 ${total} 行, 去重后 ${byQid.size} 题 (errors: ${errors})`);

const c = await pool.connect();
let inserted = 0, skippedDup = 0, noMatch = 0;
let costSum = 0, tokSum = 0;
try {
  await c.query('BEGIN');
  for (const r of byQid.values()) {
    if (r.cost) costSum += r.cost;
    if (r.usage?.total_tokens) tokSum += r.usage.total_tokens;
    if (r.no_match === true || !r.picks || r.picks.length === 0) {
      noMatch++;
      continue;
    }
    for (const pick of r.picks) {
      if (!pick.kp_id) continue;
      try {
        const ins = await c.query(
          `INSERT INTO question_kp_v2 (question_id, kp_id, source, confidence, reasoning)
           VALUES ($1, $2, 'llm_b2', $3, $4)
           ON CONFLICT (question_id, kp_id, source) DO NOTHING
           RETURNING id`,
          [r.question_id, pick.kp_id, pick.confidence || 0.5, pick.reason || null]
        );
        if (ins.rowCount > 0) inserted++;
        else skippedDup++;
      } catch (e) {
        errors++;
        if (errors < 5) console.log('  [ERROR] ' + r.question_uid + ' kp=' + pick.kp_id + ': ' + e.message.slice(0, 100));
      }
    }
  }
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('[FATAL]', e.message);
  process.exit(1);
} finally {
  c.release();
}

console.log(`\n  === 写库统计 ===`);
console.log(`  插入: ${inserted}`);
console.log(`  跳过 (重复): ${skippedDup}`);
console.log(`  no_match / 无 picks: ${noMatch}`);
console.log(`  错误: ${errors}`);
console.log(`  总成本: ¥${costSum.toFixed(4)}`);
console.log(`  总 token: ${tokSum.toLocaleString()}`);

const cov = await pool.query(`
  SELECT
    (SELECT COUNT(*) FROM question_kp_v2) AS total_links,
    (SELECT COUNT(DISTINCT question_id) FROM question_kp_v2) AS questions_with_kp_v2,
    (SELECT COUNT(DISTINCT kp_id) FROM question_kp_v2) AS kps_used
`);
const r = cov.rows[0];
console.log(`\n  === question_kp_v2 现状 ===`);
console.log(`  total links: ${r.total_links}`);
console.log(`  distinct questions: ${r.questions_with_kp_v2}`);
console.log(`  distinct kps used: ${r.kps_used}`);

// 覆盖率: question_kp_v2 覆盖的题目数 / exam_questions 总数
const totalQ = await pool.query('SELECT COUNT(*) FROM exam_questions');
const v2Cov = (Number(r.questions_with_kp_v2) / Number(totalQ.rows[0].count) * 100).toFixed(2);
console.log(`  v2 KP 覆盖率: ${v2Cov}% (${r.questions_with_kp_v2}/${totalQ.rows[0].count})`);

await pool.end();
process.exit(0);
