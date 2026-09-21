#!/usr/bin/env node
/**
 * scripts/check-schema-drift.mjs — 仓库 schema 与线上 schema 比对
 *
 * 起因 (2026-09-21, SPEC-DATA G6-c): `api/core/db.js:452` 声明
 * `CHECK (mastery_score BETWEEN 0 AND 100)`，而线上实际是 `CHECK (0 <= x <= 1)`。
 * 这层 drift 让同一个概念的标度分裂长期无人发现 —— 仓库 schema 说一套，线上跑另一套，
 * 任何按 db.js 新建的库都会得到与线上不同的约束。
 *
 * 比对射程（刻意收窄，宁可少报也不要噪声——噪声会让门禁失去信任）:
 *   1. db.js 声明的表在线上必须存在           → 缺失即 drift
 *   2. 双方都有的表: 列的类型精度(numeric precision/scale) 必须一致
 *   3. 双方都有的表: CHECK 约束定义(规范化后) 必须一致
 *   INFO: 线上有而 db.js 未声明的表 —— 由 migrations 创建, 属正常, 只打印不计失败
 *
 * 不覆盖（写在这里避免误以为有保障）:
 *   - 列的存在性/默认值/NOT NULL/FK/UNIQUE/索引
 *   - 表级 DATA 一致性、枚举取值
 *
 * 连接: 取 DATABASE_URL（.env）。连不上时默认 **跳过**（CI 无 DB 场景），
 * 置 REQUIRE_SCHEMA_DRIFT=1 可改为失败。显式跳过: SKIP_SCHEMA_DRIFT=1。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

if (process.env.SKIP_SCHEMA_DRIFT === '1') {
  console.log('  (跳过: SKIP_SCHEMA_DRIFT=1)');
  process.exit(0);
}

/**
 * 显式例外：{ table, kind: 'check'|'column', name, reason }
 * 每条都必须说明为什么这个差异是**有意的**。
 */
const ALLOW = [];

// ── 1. 解析 db.js 的 CREATE TABLE 声明 ────────────────────────────────────
const SRC = fs.readFileSync(path.resolve('api/core/db.js'), 'utf8');

/** 取出 `CREATE TABLE IF NOT EXISTS x ( ... );` 的平衡括号体 */
function extractBlocks(src) {
  const blocks = [];
  const re = /CREATE TABLE IF NOT EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi;
  let m;
  while ((m = re.exec(src))) {
    const start = re.lastIndex;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    blocks.push({ table: m[1].toLowerCase(), body: src.slice(start, i - 1) });
  }
  return blocks;
}

/** 去注释（-- 到行尾） */
const stripComments = (s) => s.replace(/--[^\n]*/g, '');

/**
 * 规范化 CHECK 定义，消除三类**写法差异**造成的假阳性：
 *   1. 空白 / 大小写
 *   2. 显式 cast（`(0)::numeric`）
 *   3. `BETWEEN a AND b` 与 `x >= a AND x <= b` 的等价写法
 *      —— 线上约束由 PG 重写成后者，而 db.js 里写的是前者，
 *         不做这层归一化会得到 6 条假阳性（2026-09-21 实测）
 */
function normalizeCheck(def) {
  let s = String(def)
    .toLowerCase()
    .replace(/::[a-z_ ]+/g, '')
    .replace(/\s+/g, '');
  s = s.replace(/^check/, '');
  // BETWEEN a AND b → >=a且<=b（与 PG 的规范化输出对齐）
  s = s.replace(/([a-z_][a-z0-9_.]*)between(-?\d+(?:\.\d+)?)and(-?\d+(?:\.\d+)?)/g, '$1>=$2and$1<=$3');
  // 去括号：以下比较的只是"该语义形态是否存在"，括号不承载语义
  s = s.replace(/[()]/g, '');
  return s;
}

/** 解析声明体 → { checks: [], numerics: [{col, p, s}] } */
function parseBody(body) {
  const clean = stripComments(body);
  const checks = [];
  const numerics = [];

  // 表级 / 列级 CHECK
  for (const cm of clean.matchAll(/CHECK\s*\(/gi)) {
    let depth = 0;
    let i = cm.index + cm[0].length - 1;
    const start = i + 1;
    for (; i < clean.length; i++) {
      if (clean[i] === '(') depth++;
      else if (clean[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    checks.push(normalizeCheck(clean.slice(start, i)));
  }

  // 数值列精度：col NUMERIC(p,s)
  for (const nm of clean.matchAll(/([a-z_][a-z0-9_]*)\s+numeric\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi)) {
    numerics.push({ col: nm[1].toLowerCase(), p: Number(nm[2]), s: Number(nm[3]) });
  }
  return { checks, numerics };
}

// ── 2. 读线上 schema ─────────────────────────────────────────────────────
const url = process.env.DATABASE_URL;
if (!url) {
  console.log('  (跳过: 无 DATABASE_URL)');
  process.exit(process.env.REQUIRE_SCHEMA_DRIFT === '1' ? 1 : 0);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 4000 });

let liveTables;
let liveCols;
let liveChecks;
try {
  liveTables = new Set(
    (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map((r) => r.tablename)
  );
  liveCols = (await pool.query(
    `SELECT table_name, column_name, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema='public' AND data_type='numeric'`
  )).rows;
  liveChecks = (await pool.query(
    `SELECT c.relname AS table_name, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      WHERE con.contype='c' AND c.relnamespace='public'::regnamespace`
  )).rows;
} catch (err) {
  console.log(`  (跳过: 连不上数据库 —— ${err.message})`);
  if (process.env.REQUIRE_SCHEMA_DRIFT === '1') process.exit(1);
  process.exit(0);
} finally {
  await pool.end().catch(() => {});
}

const liveNumeric = new Map(); // `${table}.${col}` → {p,s}
for (const r of liveCols) liveNumeric.set(`${r.table_name}.${r.column_name}`, { p: r.numeric_precision, s: r.numeric_scale });

const liveCheckByTable = new Map(); // table → Set(normalized def)
for (const r of liveChecks) {
  if (!liveCheckByTable.has(r.table_name)) liveCheckByTable.set(r.table_name, new Set());
  liveCheckByTable.get(r.table_name).add(normalizeCheck(r.def));
}

// ── 3. 比对 ──────────────────────────────────────────────────────────────
const drift = [];
const blocks = extractBlocks(SRC);

for (const { table, body } of blocks) {
  if (!liveTables.has(table)) {
    drift.push({ kind: 'table', table, detail: 'db.js 声明了该表，线上不存在' });
    continue;
  }
  const { checks, numerics } = parseBody(body);

  for (const n of numerics) {
    const live = liveNumeric.get(`${table}.${n.col}`);
    if (!live) continue; // 列不存在等情况不在本门禁射程
    if (live.p !== n.p || live.s !== n.s) {
      drift.push({
        kind: 'column',
        table,
        name: n.col,
        detail: `精度不一致: db.js NUMERIC(${n.p},${n.s}) vs 线上 NUMERIC(${live.p},${live.s})`,
      });
    }
  }

  const liveSet = liveCheckByTable.get(table) || new Set();
  for (const c of checks) {
    if (liveSet.has(c)) continue;
    drift.push({ kind: 'check', table, detail: `CHECK 定义不一致: db.js 有 ${c}` });
  }
}

const allowed = (d) => ALLOW.some((a) => a.table === d.table && a.kind === d.kind && (!a.name || a.name === d.name));

const real = drift.filter((d) => !allowed(d));
const suppressed = drift.length - real.length;

const liveOnly = [...liveTables].filter((t) => !blocks.some((b) => b.table === t));

if (real.length) {
  console.error('❌ 仓库 schema 与线上不一致（schema drift）:');
  for (const d of real) console.error(`   [${d.kind}] ${d.table}${d.name ? '.' + d.name : ''} — ${d.detail}`);
  console.error('\n若确为有意差异，请在 scripts/check-schema-drift.mjs 的 ALLOW 里登记并注明理由。');
  process.exit(1);
}

console.log(
  `✓ 仓库 schema 与线上一致（比对 ${blocks.length} 个声明表: 数值精度 + CHECK 约束）` +
    (suppressed ? `，已登记例外 ${suppressed} 条` : '') +
    `；线上另有 ${liveOnly.length} 张由迁移创建的表（不在比对范围）`
);
process.exit(0);
