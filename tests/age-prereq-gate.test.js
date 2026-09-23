/**
 * tests/age-prereq-gate.test.js — Apache AGE 防跳跃前置查询闸门
 *
 * 背景 (2026-09-23 实测, 数据库 knowledge_graph)：
 *   1. 边名不匹配：PREREQUISITE=5487 / HAS_KNOWLEDGE_POINT=5493 / HAS_CHAPTER=770 /
 *      HAS_SUBJECT=9，代码查的 DEPENDS_ON = 0。
 *   2. `$1` 写在 `$$...$$` 内部 → PG 解析报
 *      'unexpected character at or near "$"'，异常被 catch 吞掉 → 前置恒空。
 *   3. KnowledgePoint 实际属性是 {name, chapter, subject, seq_in_chapter}，**没有 id**。
 *
 * 本文件只锁 C 步（参数化止血）；第 1、3 条属于 A 步（数据对齐），未做，
 * 因此端到端断言（"已知有前置的知识点击必须返回非空前置"）当前**预期失败**，
 * 用 it.fails 显式钉住。A 步落地后必须把该 it.fails 改回 it —— 到时它会因"意外通过"而报错。
 *
 * 跑: npx vitest run tests/age-prereq-gate.test.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const GRAPH_NAME = 'knowledge_graph';
const AGE_INIT_SQL = `
  CREATE EXTENSION IF NOT EXISTS age;
  LOAD 'age';
  SET search_path = ag_catalog, "$user", public;
`;

/** @type {pg.Client|null} */
let client = null;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置，无法跑 AGE 闸门');
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(AGE_INIT_SQL);
});

afterAll(async () => {
  if (client) await client.end();
});

/** C 步修好后的参数化形状：图名/Cypher 内联，$1 在 $$...$$ 之外承载 agtype map */
async function runCypher(cypher, params = {}, resultDef = 'result agtype') {
  const sql = `SELECT * FROM cypher('${GRAPH_NAME}', $$ ${cypher} $$, $1) AS (${resultDef})`;
  const r = await client.query(sql, [JSON.stringify(params)]);
  return r.rows;
}

/** 修复前的旧形状：$1 写进 $$...$$ 内部 */
async function runCypherLegacy(cypher, params = [], resultDef = 'result agtype') {
  const sql = `SELECT * FROM cypher('${GRAPH_NAME}', $$ ${cypher} $$) AS (${resultDef})`;
  const r = await client.query(sql, params);
  return r.rows;
}

/** 从图中挑一个"确实有前置边"的 KnowledgePoint（按真实边名 PREREQUISITE） */
async function pickKnowledgePointWithPrerequisite() {
  const rows = await runCypher(
    `MATCH (kp:KnowledgePoint)-[:PREREQUISITE]->(pre:KnowledgePoint)
     RETURN kp.name AS name
     LIMIT 1`,
    {},
    'name agtype'
  );
  expect(rows.length, '图里应当存在带 PREREQUISITE 边的知识点').toBeGreaterThan(0);
  return { name: JSON.parse(rows[0].name) };
}

describe('AGE 防跳跃前置查询', () => {
  it('C 步：旧写法把 $1 放进 $$...$$ 会 parse error（根因复现）', async () => {
    await expect(
      runCypherLegacy('MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(pre) RETURN pre.id', ['ANY'])
    ).rejects.toThrow(/\$/);
  });

  it('C 步：新写法把参数放 $$...$$ 之外，不再报 parse error', async () => {
    // 参数化修好后，同一条查询应当正常执行完毕（命中 0 行 ≠ 报错）
    const rows = await runCypher(
      `MATCH (kp:KnowledgePoint {id: $id})-[:DEPENDS_ON]->(pre:KnowledgePoint) RETURN pre.id`,
      { id: 'ANY' },
      'id agtype'
    );
    expect(Array.isArray(rows)).toBe(true);
  });

  it('C 步：命名参数能被 AGE 正确绑定（用真实边名验证绑定链路）', async () => {
    const kp = await pickKnowledgePointWithPrerequisite();
    const rows = await runCypher(
      `MATCH (kp:KnowledgePoint {name: $name})-[:PREREQUISITE]->(pre:KnowledgePoint)
       RETURN pre.name`,
      { name: kp.name },
      'name agtype'
    );
    // 绑定链路本身是通的：能按 name 命中该知识点的真实前置
    expect(rows.length).toBeGreaterThan(0);
  });

  it('A 步阻塞项：图里没有 DEPENDS_ON 边（实际是 PREREQUISITE）', async () => {
    const dep = await runCypher('MATCH ()-[r:DEPENDS_ON]->() RETURN count(r)', {}, 'n agtype');
    const pre = await runCypher('MATCH ()-[r:PREREQUISITE]->() RETURN count(r)', {}, 'n agtype');
    expect(Number(JSON.parse(dep[0].n))).toBe(0);
    expect(Number(JSON.parse(pre[0].n))).toBeGreaterThan(0);
  });

  it('A 步阻塞项：KnowledgePoint 节点没有 id 属性', async () => {
    const rows = await runCypher('MATCH (kp:KnowledgePoint) WHERE kp.id IS NOT NULL RETURN count(kp)', {}, 'n agtype');
    expect(Number(JSON.parse(rows[0].n))).toBe(0);
  });

  // ── 端到端（跨层）断言 ─────────────────────────────────────────────────────
  // 断言本身没有放宽：就是"已知有前置的知识点击必须拿到非空前置"。
  // A 步（边名 + id 对齐）完成前它必然失败，故用 it.fails 钉住现状；
  // A 步落地后请把 it.fails 改回 it。
  it.fails('端到端：已知有前置的知识点，queryPrerequisites 必须返回非空', async () => {
    const { queryPrerequisites } = await import('../api/routes/tutor-agent.js');
    const kp = await pickKnowledgePointWithPrerequisite();

    const prereqs = await queryPrerequisites(client, kp.name);

    console.log(`[AGE] kp=${kp.name}（该节点在图中确实有 PREREQUISITE 出边）`);
    console.log(`[AGE] 修复后 queryPrerequisites 返回=${JSON.stringify(prereqs)}`);
    expect(prereqs.length).toBeGreaterThan(0);
  });
});
