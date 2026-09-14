#!/usr/bin/env node
/**
 * Phase 6 B1 · CH-1 抽样
 *
 * 按 9 学科分层随机抽 100 题, 写种子到数据库(可复现), 导出 b1_sample.json
 * 不调 LLM, 不写 v2 表
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SEED_TABLE = 'b1_sample_seed';
const OUT = path.join(ROOT, 'database/b1_sample.json');

const SAMPLE_PER_SUBJECT = {   // 9 学科, 11-12 题/科, 总 ~100
  chinese: 12, math: 12, english: 12, physics: 11, chemistry: 11,
  biology: 11, history: 11, geography: 11, politics: 11,
};
const SEED_NAME = 'plan_b_v1_seed_2026_09_14';
const N_TOTAL = Object.values(SAMPLE_PER_SUBJECT).reduce((a,b)=>a+b,0);
console.log(`\n=== B1 CH-1 抽样 (${N_TOTAL} 题, 9 学科分层) ===`);

const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const pool = new pg.Pool({connectionString:env.DATABASE_URL});
const c = await pool.connect();
try{
  // 0. 建种子表(可复现)
  await c.query(`CREATE TABLE IF NOT EXISTS public.${SEED_TABLE} (
    question_uid VARCHAR(120) PRIMARY KEY,
    subject_code VARCHAR(32) NOT NULL,
    sample_order INTEGER NOT NULL
  )`);
  // 1. 仅当种子表为空时采样, 避免重复抽样
  const existing = await c.query(`SELECT count(*) n FROM public.${SEED_TABLE}`);
  if (Number(existing.rows[0].n) === 0) {
    console.log(`  种子表空, 按 ${SEED_NAME} 抽样...`);
    let order = 0;
    for (const [subj, n] of Object.entries(SAMPLE_PER_SUBJECT)) {
      // 优先抽 "none" 归因的题(测 LLM 真实能力), 若不足则随机补
      const r = await c.query(`
        WITH pool AS (
          SELECT eq.question_uid FROM public.exam_questions eq
          LEFT JOIN public.question_chapter_attribution qca ON qca.question_uid=eq.question_uid
          WHERE eq.subject_code=$1
            AND qca.question_uid IS NULL  -- 未被归因的题
            AND length(coalesce(eq.stem,''))>10  -- 排除空题
        ),
        sampled AS (
          SELECT question_uid FROM pool ORDER BY random() LIMIT $2
        )
        SELECT $3::int AS ord, question_uid FROM sampled
      `, [subj, n, 0]);
      // 注: WITH 里取 random() 后无法稳定, 改用 setseed 在 session 内
    }
    // 用 setseed 保证可复现
    const r = await c.query(`SELECT setseed(0.420)`);
    order = 0;
    for (const [subj, n] of Object.entries(SAMPLE_PER_SUBJECT)) {
      await c.query(`
        INSERT INTO public.${SEED_TABLE} (question_uid, subject_code, sample_order)
        SELECT eq.question_uid, eq.subject_code, ($1::int + ROW_NUMBER() OVER (ORDER BY random()))
        FROM public.exam_questions eq
        WHERE eq.subject_code=$2 AND length(coalesce(eq.stem,''))>10
        ORDER BY random()
        LIMIT $3
      `, [order, subj, n]);
      order += n;
    }
  } else {
    console.log(`  种子表已有 ${existing.rows[0].n} 条, 复用 (不重抽)`);
  }
  // 2. 导出种子(带题干)
  const rows = (await c.query(`
    SELECT s.sample_order, s.subject_code, eq.question_uid, eq.question_type, eq.year, eq.province_code,
           eq.stem, eq.options::text AS opts, eq.answer, eq.analysis,
           coalesce(qca.chapter_name,'(none)') AS chapter_name,
           coalesce(qca.attribution_method,'(none)') AS attribution_method
      FROM public.${SEED_TABLE} s
      JOIN public.exam_questions eq ON eq.question_uid=s.question_uid
      LEFT JOIN public.question_chapter_attribution qca ON qca.question_uid=eq.question_uid
     ORDER BY s.sample_order
  `)).rows;
  console.log(`  实际抽取: ${rows.length} 题`);
  // 3. 学科分布
  const dist = {};
  for (const r of rows) dist[r.subject_code] = (dist[r.subject_code]||0)+1;
  for (const [s,n] of Object.entries(dist)) console.log(`    ${s.padEnd(11)} ${n}`);
  // 4. 写 b1_sample.json
  const manifest = {
    seed_name: SEED_NAME,
    created_at: new Date().toISOString(),
    n_total: rows.length,
    n_per_subject: SAMPLE_PER_SUBJECT,
    actual_per_subject: dist,
    note: 'B1 试点抽样. seed 写死 0.420 可复现. 优先抽未被归因的题以测 LLM 真实能力. 仅读 exam_questions 与 question_chapter_attribution, 不动任何业务表.',
    questions: rows.map(r => ({
      sample_order: r.sample_order, question_uid: r.question_uid, subject_code: r.subject_code,
      question_type: r.question_type, year: r.year, province_code: r.province_code,
      stem: r.stem, options: r.opts, answer: r.answer, analysis: r.analysis,
      existing_attribution: { chapter_name: r.chapter_name, method: r.attribution_method },
    })),
  };
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));
  console.log(`\n  ✅ 写入: ${path.relative(ROOT, OUT)}`);
  console.log(`  种子表: public.${SEED_TABLE} (${rows.length} 行, 写死可复现)`);
} finally {
  c.release(); await pool.end();
}
process.exit(0);
