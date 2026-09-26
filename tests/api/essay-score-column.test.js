/* ============================================================================
 * tests/api/essay-score-column.test.js — 总分同步进 essay_reports.score 顶层列
 *
 * 背景 (2026-09-26): 总分此前只存在于 meta.scores.total (jsonb), 列表/排序要下钻
 * jsonb。essay_reports 有一列 F3 时代遗留的 score numeric —— 复用它承接总分。
 *
 * 表结构依据 (information_schema.columns, 本机 dev 库):
 *   essay_reports: id / user_email / data / images / title / score numeric /
 *                  confidence / status / created_at / updated_at /
 *                  report_id / essay_title / exam_level / grade /
 *                  transcript jsonb / annotations jsonb / meta jsonb / error_message
 *   —— 没有 total_score / overall_score 之类的其它候选列, 就写 score。
 *
 * 覆盖:
 *   1. insertEssayReport 把 score 写进第 11 个占位符
 *   2. score 缺失/非数字 → 写 null (绝不编造分数)
 *   3. updateEssayReportResult (异步 analyze 的完成路径) 同步写 status + score
 *   4. getEssayReport: numeric 被 node-pg 解析成字符串 → 归一成 number
 *   5. listEssayReports 的 SELECT 带 score (转 double precision, JS 侧是数字)
 *
 * DB 全 mock ( api/core/db.js → getDb ), 不连真库、不写真数据。
 * ============================================================================ */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => ({ query: mocks.query })),
}));

import {
  insertEssayReport,
  updateEssayReportResult,
  getEssayReport,
  listEssayReports,
} from '../../api/handlers/essay/essayStorage.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ rows: [] });
});


// ────────────────────────────────────────────────────────────────────────────
// 2. 顶层 score 列
// ────────────────────────────────────────────────────────────────────────────

describe("essay_reports.score 顶层列", () => {
  it('insertEssayReport 把 score 写进第 11 个占位符', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_s1' }] });
    await insertEssayReport({
      report_id: 'er_s1',
      user_email: 'a@b.c',
      essay_title: '春天',
      meta: { scores: { total: 58 } },
      status: 'completed',
      score: 58,
    });

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toMatch(/score\)\s*VALUES/);
    expect(sql).toMatch(/\$11/);
    expect(params).toHaveLength(11);
    expect(params[10]).toBe(58);
  });

  it('score 缺失/非数字 → 写 null (绝不编造分数)', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_s2' }] });

    for (const bad of [undefined, null, '', Number.NaN, 'not-a-number', {}]) {
      mocks.query.mockClear();
      await insertEssayReport({ report_id: 'er_s2', score: bad });
      expect(mocks.query.mock.calls[0][1][10]).toBeNull();
    }
  });

  it('updateEssayReportResult 同步写 status + score', async () => {
    await updateEssayReportResult('er_s3', {
      transcript: { paragraphs: [] },
      annotations: [],
      meta: { scores: { total: 62 } },
      status: 'completed',
      score: 62,
    });

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE essay_reports/);
    expect(sql).toMatch(/score = \$6/);
    expect(params[0]).toBe('er_s3');
    expect(params[4]).toBe('completed');
    expect(params[5]).toBe(62);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
  });

  it('getEssayReport: numeric 列被 node-pg 解析成字符串 → 归一成 number', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_s5', score: '58.00' }] });
    const row = await getEssayReport('er_s5');
    expect(row.score).toBe(58);
    expect(typeof row.score).toBe('number');
  });

  it('getEssayReport: score 为 NULL/查无此行 → null (不编造 0 分)', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_s6', score: null }] });
    expect((await getEssayReport('er_s6')).score).toBeNull();

    mocks.query.mockResolvedValue({ rows: [] });
    expect(await getEssayReport('er_missing')).toBeNull();
  });

  it('listEssayReports 的 SELECT 带 score (转 double precision, JS 侧是数字)', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_s4', score: 58 }] });
    const rows = await listEssayReports('a@b.c', 20);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toMatch(/score::double precision AS score/);
    expect(params).toEqual(['a@b.c', 20, 0]);
    expect(rows[0].score).toBe(58);
    expect(typeof rows[0].score).toBe('number');
  });
});
