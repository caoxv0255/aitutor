#!/usr/bin/env node
/**
 * backfill-derivative-knowledge.js
 *
 * 目标: 不重跑 LLM, 直接用规则给已入库的 exam_questions 补全导数相关 knowledge_points.
 *
 * 触发问题:
 *   parse-questions-v4.js 强制 LLM 从 knowledge_points 表选标签,
 *   但表中只有 "函数与导数" 一个上层标签, LLM 几乎不选它,
 *   导致 90%+ 导数题的 knowledge_points 字段不含 "导数" 任何字眼,
 *   RAG 的 k_text/k_embedding 与查询 "导数" 距离过远.
 *
 * 修复:
 *   对每条数学题 (subject_code='math') 的 stem + analysis 文本做正则匹配,
 *   若命中"导数/切线/求导/单调性/极值/含参/零点/不等式证明"等关键词,
 *   则把对应细粒度标签 (MATH-D0X) 与 "函数与导数" 加入 knowledge_points.
 *
 * 用法:
 *   node scripts/backfill-derivative-knowledge.js           # 回填
 *   node scripts/backfill-derivative-knowledge.js --dry    # 仅统计, 不写库
 *   node scripts/backfill-derivative-knowledge.js --ids=123,456  # 仅指定 id
 *
 * 依赖: 数据库连接见 api/core/db.js (getDb)
 */

import 'dotenv/config';
import { getDb, closeDb } from '../api/core/db.js';

const DRY_RUN = process.argv.includes('--dry');
const ARGS = process.argv.filter((a) => a.startsWith('--ids='))[0];
const ONLY_IDS = ARGS ? ARGS.split('=')[1].split(',').map(Number) : null;

// 关键词 → 标签 映射表 (与 database/migrations/007 中的 id 对应)
const RULES = [
  {
    id: 'MATH-D01',
    name: '导数的概念与几何意义',
    patterns: [
      /切线方程/, /切线斜率/, /导数的几何意义/, /瞬时变化率/,
      /求曲线.*切线/, /在点.*处的切线/,
    ],
  },
  {
    id: 'MATH-D02',
    name: '导数的运算',
    patterns: [
      /求导/, /求 f'\(x\)/, /求 y'\b/, /二阶导/, /f''\(.+\)/,
      /复合函数求导/, /隐函数求导/, /参数方程求导/,
    ],
  },
  {
    id: 'MATH-D03',
    name: '导数与单调性',
    patterns: [
      /单调递增/, /单调递减/, /单调区间/, /单调性/,
    ],
  },
  {
    id: 'MATH-D04',
    name: '导数与极值最值',
    patterns: [
      /极值/, /极大值/, /极小值/, /最大值/, /最小值/, /最值/,
    ],
  },
  {
    id: 'MATH-D05',
    name: '导数与不等式证明',
    patterns: [
      /证明.*不等式/, /不等式.*证明/,
      /构造函数法/, /切线法.*证明/, /放缩/,
      /证.*≥/, /证.*≤/,
    ],
  },
  {
    id: 'MATH-D06',
    name: '导数与函数零点',
    patterns: [
      /零点.*个数/, /零点个数/, /含参.*零点/,
      /零点存在/, /函数.*零点/,
      /有.*零点/, /无.*零点/,
    ],
  },
];

// 父标签 (兜底)
const PARENT_KP = '函数与导数';
// 兜底: 题面只要含这些关键词, 一定挂"函数与导数"父标签
// (空题/章节题的"第三章 函数的应用"被替换掉, 也不会漏掉导数题)
const SAFE_PARENT_KW = /导数|求导|切线|单调性|极值|最值|零点|含参/;

function classify(text) {
  if (!text) return new Set();
  const hits = new Set();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) hits.add(rule.name);
  }
  if (SAFE_PARENT_KW.test(text)) hits.add(PARENT_KP);
  return hits;
}

function parseKpColumn(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  try {
    const j = JSON.parse(v);
    return Array.isArray(j) ? j.filter(Boolean) : [];
  } catch {
    return [String(v)];
  }
}

async function main() {
  const pool = await getDb();

  const where = ['subject_code = $1'];
  const params = ['math'];
  if (ONLY_IDS) {
    where.push(`id = ANY($${params.length + 1}::int[])`);
    params.push(ONLY_IDS);
  }
  const sql = `
    SELECT id, stem, analysis, knowledge_points
      FROM exam_questions
     WHERE ${where.join(' AND ')}
     ORDER BY id
  `;
  const { rows } = await pool.query(sql, params);
  console.log(`[backfill] 扫描 ${rows.length} 条数学题`);

  let updated = 0;
  let already = 0;
  const stats = {};
  for (const r of rows) {
    const original = parseKpColumn(r.knowledge_points);
    const text = `${r.stem || ''}\n${r.analysis || ''}`;
    const detected = classify(text);
    if (detected.size === 0) continue;

    const merged = [...original];
    for (const k of detected) {
      if (!merged.includes(k)) merged.push(k);
    }
    if (merged.length === original.length) {
      already += 1;
      continue;
    }
    stats[merged.length - original.length] =
      (stats[merged.length - original.length] || 0) + 1;

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE exam_questions SET knowledge_points = $1::text, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(merged), r.id]
      );
    }
    updated += 1;
  }

  console.log(`[backfill] 命中关键词: ${updated + already} 条`);
  console.log(`[backfill] 已含导数标签无需更新: ${already} 条`);
  console.log(`[backfill] 新增标签后写入: ${updated} 条${DRY_RUN ? ' (DRY)' : ''}`);
  console.log(`[backfill] 每条新增标签数分布:`, stats);

  if (!DRY_RUN && updated > 0) {
    console.log('[backfill] 同步 question_knowledge_points 多对多表 ...');
    const kpIds = await pool.query(
      `SELECT id FROM knowledge_points
        WHERE subject = 'math' AND (name = $1 OR id LIKE 'MATH-D0%')`,
      [PARENT_KP]
    );
    const idList = kpIds.rows.map((x) => x.id);
    if (idList.length > 0) {
      const { rows: affected } = await pool.query(
        `SELECT id, knowledge_points FROM exam_questions
          WHERE subject_code = 'math'
            AND knowledge_points ~* '函数与导数|导数的概念与几何意义|导数的运算|导数与单调性|导数与极值最值|导数与不等式证明|导数与函数零点'`
      );
      let linkCount = 0;
      for (const q of affected) {
        const arr = parseKpColumn(q.knowledge_points);
        for (const name of arr) {
          if (name === PARENT_KP) {
            await pool.query(
              `INSERT INTO question_knowledge_points (question_id, knowledge_point_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [q.id, 'MATH-001']
            );
            linkCount++;
          } else {
            const r2 = RULES.find((x) => x.name === name);
            if (r2) {
              await pool.query(
                `INSERT INTO question_knowledge_points (question_id, knowledge_point_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [q.id, r2.id]
              );
              linkCount++;
            }
          }
        }
      }
      console.log(`[backfill] question_knowledge_points 新增关联: ${linkCount}`);
    }
  }

  await closeDb();
}

main().catch((e) => {
  console.error('[backfill] failed:', e);
  process.exit(1);
});