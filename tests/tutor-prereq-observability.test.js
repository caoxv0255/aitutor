/**
 * tests/tutor-prereq-observability.test.js — 防跳跃链路可观测性闸门
 *
 * 背景 (2026-09-23)：
 *   queryPrerequisites（AGE 前置查询）的数据与查询已在 0a99cc1 修好，
 *   但 **生产从未执行过**：新旧前端调 POST /api/tutor/ask 都不传 knowledge_point_id，
 *   askTutorAgent 的 Step 2 整条分支静默跳过、什么都不记 —— 于是
 *   "防跳跃没跑" 与 "跑了但没前置" 在日志里完全不可区分。
 *
 * 本轮对策（用户拍板：先看清楚再动功能）—— 只加埋点，不改业务行为：
 *   1. 缺 knowledge_point_id → 同步打 warn（含题目指纹 / 学科 / 相似题条数）。
 *   2. 同一次请求再异步跑一次只读探针 probeKpInference，记录"本来能否推断出 kp"。
 *   3. 走到 queryPrerequisites 时打 info 留痕（前置条数 / hop 分布 / 耗时）。
 *
 * 断言口径（不许写成"没崩就算过"）：
 *   - warn 必须真的打出来，且必须带本次请求的题目指纹；
 *   - 题目原文绝不许出现在任何观测日志里（隐私 + 日志体积）；
 *   - 探针的「能推断 / 不能推断」两种情况各用一组真实数据样本钉死；
 *   - 正常路径必须留下 count / hop 计数，且与 queryPrerequisites 的真实返回一致。
 *
 * 跑: npx vitest run tests/tutor-prereq-observability.test.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';
import { createHash } from 'node:crypto';

dotenv.config();

const GRAPH_NAME = 'knowledge_graph';
const AGE_INIT_SQL = `
  CREATE EXTENSION IF NOT EXISTS age;
  LOAD 'age';
  SET search_path = ag_catalog, "$user", public;
`;

const OBS_SKIP = '[TutorAgent][防跳跃] Step2 跳过';
const OBS_PROBE = '[TutorAgent][防跳跃] kp推断探针';
const OBS_HIT = '[TutorAgent][防跳跃] queryPrerequisites 命中';

/** @type {pg.Client|null} */
let client = null;
let logger;
let questionFingerprint;
let probeKpInference;
let observeMissingKnowledgePointId;
let assembleLearningContext;
let queryPrerequisites;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置，无法跑防跳跃观测闸门');
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(AGE_INIT_SQL);

  const mod = await import('../api/routes/tutor-agent.js');
  const loggerMod = await import('../api/core/logger.js');
  logger = loggerMod.logger;
  ({
    questionFingerprint,
    probeKpInference,
    observeMissingKnowledgePointId,
    assembleLearningContext,
    queryPrerequisites,
  } = mod);
});

afterAll(async () => {
  if (client) await client.end();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

/** 把 logger 的 warn/info 换成 spy，避免观测日志真的落盘 + 便于断言 */
function spyOnLogger() {
  return {
    warn: vi.spyOn(logger, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(logger, 'info').mockImplementation(() => {}),
  };
}

/** 打了哪几行日志（只取 message 部分） */
function loggedLines(spies) {
  return [...spies.warn.mock.calls, ...spies.info.mock.calls].map((c) => String(c[0]));
}

/** AGE 参数化形状必须与 api/routes/tutor-agent.js 的 runCypher 保持一致 */
async function runCypher(cypher, params = {}, resultDef = 'result agtype') {
  const r = await client.query(`SELECT * FROM cypher('${GRAPH_NAME}', $$ ${cypher} $$, $1) AS (${resultDef})`, [
    JSON.stringify(params),
  ]);
  return r.rows;
}

/** 取一条真实存在、且映射到 id 格式知识点（A 词表）的题干 */
async function pickKnownStem() {
  const { rows } = await client.query(
    `SELECT q.id, q.stem, kp.knowledge_point_id
       FROM question_knowledge_points kp
       JOIN exam_questions q ON q.id = kp.question_id
      WHERE kp.knowledge_point_id ~ '^[A-Z]+-[A-Z0-9]+-[0-9]+$'
      ORDER BY kp.id
      LIMIT 1`
  );
  return rows[0] || null;
}

describe('防跳跃链路可观测性', () => {
  describe('题目指纹（脱敏）', () => {
    it('同题同指纹、不同题不同指纹，长度如实，两侧空白被 trim', () => {
      const q = '已知函数 f(x)=x^2-2x，求最小值。';
      const fp = questionFingerprint(q);
      expect(fp.q_len).toBe(q.length);
      expect(fp.q_sha256_12).toHaveLength(12);
      expect(fp.q_sha256_12).toBe(createHash('sha256').update(q.trim()).digest('hex').slice(0, 12));
      expect(questionFingerprint(`${q}  `).q_sha256_12).toBe(fp.q_sha256_12);
      expect(questionFingerprint(`${q}x`).q_sha256_12).not.toBe(fp.q_sha256_12);
    });

    it('非字符串入参不抛错（异常输入也要能继续打指纹）', () => {
      const emptyHash = createHash('sha256').update('').digest('hex').slice(0, 12);
      expect(questionFingerprint(undefined)).toEqual({ q_len: 0, q_sha256_12: emptyHash });
      expect(questionFingerprint(null)).toEqual({ q_len: 0, q_sha256_12: emptyHash });
      expect(questionFingerprint({ toString: () => 'x' })).toEqual({ q_len: 0, q_sha256_12: emptyHash });
    });
  });

  describe('probeKpInference — 能推断出 kp', () => {
    it('题库里真实存在的题干 → inferred=true，并给出 question_id 与 A 词表 kp id', async () => {
      const sample = await pickKnownStem();
      expect(sample, '前置事实：题库里应有 id 格式的题目→知识点映射').toBeTruthy();

      const r = await probeKpInference(client, sample.stem);

      console.log(`[obs] 命中样本 question_id=${sample.id} → ${JSON.stringify(r)}`);
      expect(r.source).toBe('stem_exact');
      expect(r.inferred).toBe(true);
      expect(r.question_id).toBe(sample.id);
      expect(r.match_count).toBeGreaterThanOrEqual(1);
      expect(r.kp_ids).toContain(sample.knowledge_point_id);
      expect(r.error).toBeNull();
      expect(r.q_len).toBe(sample.stem.length);
      expect(typeof r.elapsed_ms).toBe('number');
    });

    it('指纹稳定：同一题干两次调用指纹一致，可把「跳过行」与「探针行」join 起来', async () => {
      const sample = await pickKnownStem();
      const a = await probeKpInference(client, sample.stem);
      const b = await probeKpInference(client, sample.stem);
      expect(a.q_sha256_12).toBe(b.q_sha256_12);
      expect(a.q_sha256_12).toBe(questionFingerprint(sample.stem).q_sha256_12);
    });
  });

  describe('probeKpInference — 推断不出 kp', () => {
    it('题库里没有的自由提问 → inferred=false, match_count=0, kp_ids=[]', async () => {
      const question = `这道题不可能在题库里出现，用于负样本校验 ${Math.random()}`;

      const r = await probeKpInference(client, question);

      expect(r.inferred).toBe(false);
      expect(r.match_count).toBe(0);
      expect(r.kp_ids).toEqual([]);
      expect(r.question_id).toBeNull();
      expect(r.source).toBe('stem_exact');
      expect(r.error).toBeNull();
      // 即便未命中，指纹也要留下，便于在日志里统计"未命中占比"
      expect(r.q_sha256_12).toBe(questionFingerprint(question).q_sha256_12);
    });

    it('空白提问直接短路不查库，elapsed_ms 仍要是数字', async () => {
      const r = await probeKpInference(client, '   ');
      expect(r.inferred).toBe(false);
      expect(r.match_count).toBe(0);
      expect(r.q_len).toBe(3);
      expect(typeof r.elapsed_ms).toBe('number');
    });

    it('查询失败不抛错、不拖垮主链路，降级为 source=error', async () => {
      const broken = { query: () => Promise.reject(new Error('boom')) };
      const r = await probeKpInference(broken, '任意题干');
      expect(r.source).toBe('error');
      expect(r.error).toBe('boom');
      expect(r.inferred).toBe(false);
    });
  });

  describe('缺 knowledge_point_id 时必须打 warn（把静默跳过变成可见）', () => {
    it('跳过行含前缀 + 题目指纹 + 学科 + 相似题条数，且绝不出现题目原文', async () => {
      const spies = spyOnLogger();
      const secretQuestion = '这是一道含学生姓名张三的私密提问，禁止出现在日志里';

      await observeMissingKnowledgePointId({
        pool: client,
        question: secretQuestion,
        subject: 'biology',
        requestId: 'req-abc123',
        userEmail: 'student@example.com',
        similarCount: 2,
      });

      const skipCall = spies.warn.mock.calls.find((c) => String(c[0]).startsWith(OBS_SKIP));
      expect(skipCall, `应打出以「${OBS_SKIP}」开头的 warn`).toBeTruthy();

      const skipLine = String(skipCall[0]);
      expect(skipLine).toContain('未传 knowledge_point_id');
      expect(skipLine).toContain(`q_sha256_12=${questionFingerprint(secretQuestion).q_sha256_12}`);
      expect(skipLine).toContain(`q_len=${secretQuestion.length}`);
      expect(skipLine).toContain('subject=biology');
      expect(skipLine).toContain('similar_count=2');
      // meta 里带 user / requestId，方便与 logger.request 的请求行 join
      expect(skipCall[1]).toEqual({ user: 'student@example.com', requestId: 'req-abc123' });

      for (const line of loggedLines(spies)) {
        expect(line, `观测日志泄漏了题目原文: ${line}`).not.toContain(secretQuestion);
        expect(line, `观测日志泄漏了题内姓名: ${line}`).not.toContain('张三');
      }
    });

    it('跳过之后异步补一行探针结论（能推断 / 不能推断各一行）', async () => {
      const spies = spyOnLogger();
      const sample = await pickKnownStem();
      const knownStem = sample.stem;
      const unknownStem = `负样本${Math.random()}绝不在题库`;

      await observeMissingKnowledgePointId({
        pool: client,
        question: knownStem,
        requestId: 'r1',
        userEmail: 'a@b.c',
        similarCount: 0,
      });
      await observeMissingKnowledgePointId({
        pool: client,
        question: unknownStem,
        requestId: 'r2',
        userEmail: 'a@b.c',
        similarCount: 0,
      });

      const probeLines = spies.info.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith(OBS_PROBE));
      expect(probeLines).toHaveLength(2);

      const hitLine = probeLines.find((l) => l.includes(`q_sha256_12=${questionFingerprint(knownStem).q_sha256_12}`));
      expect(hitLine, `应有一行对应已知题干，实际: ${JSON.stringify(probeLines)}`).toBeTruthy();
      expect(hitLine).toContain('inferred=true');
      expect(hitLine).toContain('source=stem_exact');
      expect(hitLine).toMatch(/match_count=[1-9]/);
      expect(hitLine).toMatch(/question_id=\d+/);
      expect(hitLine).toMatch(/elapsed_ms=\d+/);

      const missLine = probeLines.find((l) =>
        l.includes(`q_sha256_12=${questionFingerprint(unknownStem).q_sha256_12}`)
      );
      expect(missLine, '应有一行对应未知题干').toBeTruthy();
      expect(missLine).toContain('inferred=false');
      expect(missLine).toContain('match_count=0');
      expect(missLine).toContain('question_id=-');
    });

    it('主链路不等探针：同步阶段 warn 已落地，探针结果之后才补', async () => {
      const spies = spyOnLogger();
      const p = observeMissingKnowledgePointId({
        pool: client,
        question: '任意提问',
        requestId: 'r3',
        userEmail: 'a@b.c',
        similarCount: 0,
      });
      // 同步阶段就该有 warn —— 主链路不等探针
      expect(spies.warn.mock.calls.filter((c) => String(c[0]).startsWith(OBS_SKIP))).toHaveLength(1);
      expect(spies.info.mock.calls).toHaveLength(0);
      expect(p).toBeInstanceOf(Promise);
      await p;
      expect(spies.info.mock.calls.filter((c) => String(c[0]).startsWith(OBS_PROBE))).toHaveLength(1);
    });
  });

  describe('正常路径留痕（真的走了 queryPrerequisites）', () => {
    it('命中行记录 count / hop1 / hop2 / ids，且与真实返回一致', async () => {
      const spies = spyOnLogger();

      // 固定样本：图中确实有 PREREQUISITE 出边的知识点（与 age-prereq-gate 同源）
      const name = '一．物质的组成、性质和分类：';
      const idRows = await runCypher(
        `MATCH (kp:KnowledgePoint {name: $name}) RETURN kp.id AS id`,
        { name },
        'id agtype'
      );
      expect(idRows.length, `知识点「${name}」应存在`).toBe(1);
      const kpId = idRows[0].id === null ? null : JSON.parse(idRows[0].id);
      expect(kpId, `「${name}」应已回写 id`).toBeTruthy();

      const direct = await queryPrerequisites(client, kpId);
      expect(direct.length, '前置事实：该知识点应有非空前置').toBeGreaterThan(0);

      spies.info.mockClear();
      await assembleLearningContext(client, client, 'obs-test@example.com', kpId);

      const lines = loggedLines(spies).filter((l) => l.startsWith(OBS_HIT));
      expect(lines, `应打出「${OBS_HIT}」`).toHaveLength(1);

      const line = lines[0];
      console.log(`[obs] ${line}`);
      expect(line).toContain(`knowledge_point_id=${kpId}`);
      expect(line).toContain(`count=${direct.length}`);
      expect(line).toContain(`hop1=${direct.filter((p) => p.hop === 1).length}`);
      expect(line).toContain(`hop2=${direct.filter((p) => p.hop === 2).length}`);
      expect(line).toContain(
        `ids=${direct
          .slice(0, 5)
          .map((p) => p.id)
          .join('|')}`
      );
      expect(line).toMatch(/elapsed_ms=\d+/);
    });

    it('查不到前置同样要留痕（0 条 ≠ 没执行，此前两者不可区分）', async () => {
      const spies = spyOnLogger();
      await assembleLearningContext(client, client, 'obs-test@example.com', 'NOT-A-REAL-KP-ID');

      const lines = loggedLines(spies).filter((l) => l.startsWith(OBS_HIT));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('knowledge_point_id=NOT-A-REAL-KP-ID');
      expect(lines[0]).toContain('count=0');
    });
  });
});
