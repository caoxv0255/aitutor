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
 * A 步第一批 (7c4c8be)：查询侧边名 DEPENDS_ON → PREREQUISITE。
 * A 步第二批 (本轮)：id 回写 —— 用 kp_unit_cleaned.unit_graphid join
 *   kp_unit_to_tag_mapping(similarity_score 最大) → tag_id，写入 KnowledgePoint.id，
 *   5493/5493 全覆盖；写入侧 sync-obsidian-to-age.js 边名同步改 PREREQUISITE。
 *   至此上面第 1、2、3 条全部闭合，端到端转绿（it.fails → it）。
 *
 * ⚠️ 保留的历史证据（根因实锤，勿删）：
 *   - 下方"旧写法把 $1 放进 $$...$$ 会 parse error"用例：C 步根因复现，永久红→绿守卫。
 *   - "图里没有 DEPENDS_ON 边"用例：锁死边名事实。
 *   - queryPrerequisites 按 {id: $id} 匹配，传 name 命中不到（修复前传 name 恒 []）——
 *     调用方必须传 A 词表 id（如 CHEM-B1-024），见端到端用例内注释。
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

/**
 * 端到端固定样本：图中确实有 PREREQUISITE 出边的知识点。
 * 原先 pickKnowledgePointWithPrerequisite() 用 LIMIT 1 无 ORDER BY → 每次跑挑中的节点
 * 不一样，端到端结果不可复现；这里显式钉死一个，保证红灯/绿灯可复现。
 */
const E2E_KP_NAME = '一．物质的组成、性质和分类：';

/** 按 name 取回 A 步第二批回写的 id（A 词表，形如 CHEM-B1-024） */
async function getKnowledgePointIdByName(name) {
  const rows = await runCypher(
    `MATCH (kp:KnowledgePoint {name: $name}) RETURN kp.id AS id`,
    { name },
    'id agtype'
  );
  return rows.length ? parseAgtypeLocal(rows[0].id) : null;
}

function parseAgtypeLocal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
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

  // A 步第二批前，这里是 0（节点只有 {name, chapter, subject, seq_in_chapter}），
  // 是 queryPrerequisites 恒返 [] 的根因之一；回写后已全量补齐，断言翻转为锁定修复。
  it('A 步已闭合：KnowledgePoint 节点 id 已全量回写', async () => {
    const total = await runCypher('MATCH (kp:KnowledgePoint) RETURN count(kp)', {}, 'n agtype');
    const withId = await runCypher(
      'MATCH (kp:KnowledgePoint) WHERE kp.id IS NOT NULL RETURN count(kp)',
      {},
      'n agtype'
    );
    const t = Number(JSON.parse(total[0].n));
    const w = Number(JSON.parse(withId[0].n));
    expect(t).toBeGreaterThan(0);
    expect(w, `修复前为 0，回写后应为 ${t}`).toBe(t);
  });

  // ── 端到端（跨层）断言 ─────────────────────────────────────────────────────
  // 断言本身没有放宽：就是"已知有前置的知识点必须拿到非空前置"。
  // A 步完成前它必然失败（先是没有 PREREQUISITE 边名，后是节点没有 id），故曾以 it.fails 钉住；
  // A 步第二批（id 回写 + 边名统一）落地后已转绿，恢复为普通 it。
  //
  // 调用契约：queryPrerequisites 按 {id: $id} 匹配（@param knowledgePointId），
  // 必须传 A 词表 id。修复前/修复后传 name 都命中不到（恒 []）—— 这不是放宽，
  // 而是本用例此前一直传 name 才导致"数据修好了仍为红"。
  it('端到端：已知有前置的知识点，queryPrerequisites 必须返回非空', async () => {
    const { queryPrerequisites } = await import('../api/routes/tutor-agent.js');

    const id = await getKnowledgePointIdByName(E2E_KP_NAME);
    expect(id, `「${E2E_KP_NAME}」应已回写 id`).toBeTruthy();

    const prereqs = await queryPrerequisites(client, id);

    console.log(`[AGE] kp=${E2E_KP_NAME} (id=${id})（该节点在图中确实有 PREREQUISITE 出边）`);
    console.log(`[AGE] 修复后 queryPrerequisites 返回 ${prereqs.length} 条: ${JSON.stringify(prereqs.slice(0, 5))}`);
    expect(prereqs.length).toBeGreaterThan(0);
  });
});
