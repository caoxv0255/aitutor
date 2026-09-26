/* ============================================================================
 * tests/api/essay-async-orphan.test.js — 异步 analyze 的孤儿恢复
 *
 * 背景 (2026-09-26): analyze 改成「建 pending 行 → 后台跑」。新风险: 进程被重启
 * 或崩溃后, 上一进程遗留的 pending 行会永远停在 pending —— 前端轮询永不见结果。
 * 因此必须有回收机制, 不留悬空状态。
 *
 * 覆盖:
 *   1. reclaimStalePending(): SQL 只打 pending 且按创建时间判定陈旧; 参数即阈值
 *   2. 默认阈值 180s (> qwen-plus 实测 41.5s + 一次重试的 60s 内层超时)
 *   3. startPendingReclaimer(): 挂载即扫一次, 之后按间隔扫; 抛错不影响进程
 *
 * (score 顶层列的测试见 tests/api/essay-score-column.test.js)
 *
 * DB 全 mock ( api/core/db.js → getDb ), 不连真库、不写真数据。
 * ============================================================================ */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn(async () => ({ query: mocks.query })),
}));

vi.mock('../../api/core/logger.js', () => ({ logger: mocks.logger }));

import { reclaimStalePending, PENDING_TIMEOUT_MS } from '../../api/handlers/essay/essayStorage.js';
import { startPendingReclaimer } from '../../api/handlers/essay/analyzeService.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.query.mockResolvedValue({ rows: [] });
});

// ────────────────────────────────────────────────────────────────────────────
// 1. 孤儿回收
// ────────────────────────────────────────────────────────────────────────────

describe('reclaimStalePending() — 孤儿/陈旧 pending 回收', () => {
  it('SQL 只打 status=pending, 且按 created_at 判定陈旧', async () => {
    await reclaimStalePending(1000);

    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE essay_reports/);
    expect(sql).toMatch(/status = 'pending'/);
    expect(sql).toMatch(/created_at < NOW\(\)/);
    expect(sql).toMatch(/SET status = 'failed'/);
    expect(sql).toMatch(/error_message = 'pending_timeout'/);
    expect(params).toEqual([1000]);
  });

  it('返回被回收的 report_id 列表 (真空转时为空数组)', async () => {
    mocks.query.mockResolvedValue({ rows: [{ report_id: 'er_a' }, { report_id: 'er_b' }] });
    expect(await reclaimStalePending(1000)).toEqual(['er_a', 'er_b']);

    mocks.query.mockResolvedValue({ rows: [] });
    expect(await reclaimStalePending(1000)).toEqual([]);
  });

  it('rows 缺失 → [] (不抛)', async () => {
    mocks.query.mockResolvedValue({});
    expect(await reclaimStalePending()).toEqual([]);
  });

  it('默认阈值 180s: 远大于 qwen-plus 实测耗时与一次重试的内层 60s', async () => {
    await reclaimStalePending();
    expect(mocks.query.mock.calls[0][1]).toEqual([PENDING_TIMEOUT_MS]);
    expect(PENDING_TIMEOUT_MS).toBe(180000);
  });

  it('非法阈值回落到默认 (不把 NaN/负数传进 SQL)', async () => {
    await reclaimStalePending(Number.NaN);
    expect(mocks.query.mock.calls[0][1]).toEqual([180000]);
    await reclaimStalePending(-1);
    expect(mocks.query.mock.calls[1][1]).toEqual([180000]);
  });
});

describe('startPendingReclaimer() — 进程内定时回收', () => {
  it('挂载即扫一次, 之后按间隔重复扫 (可停)', async () => {
    const reclaim = vi.fn().mockResolvedValue([]);
    const stop = startPendingReclaimer({ intervalMs: 10, timeoutMs: 5000, reclaim });

    expect(reclaim).toHaveBeenCalledTimes(1);
    expect(reclaim).toHaveBeenCalledWith(5000);

    await new Promise((r) => setTimeout(r, 35));
    expect(reclaim.mock.calls.length).toBeGreaterThan(1);

    stop();
    const seen = reclaim.mock.calls.length;
    await new Promise((r) => setTimeout(r, 35));
    expect(reclaim.mock.calls.length).toBe(seen);
  });

  it('回收到行 → 记 warn (带 report_ids 与 timeout_ms, logger 传对象)', async () => {
    const reclaim = vi.fn().mockResolvedValue(['er_orphan_1']);
    const stop = startPendingReclaimer({ intervalMs: 60_000, timeoutMs: 1234, reclaim });
    await new Promise((r) => setTimeout(r, 5));

    expect(mocks.logger.warn).toHaveBeenCalled();
    const [msg, meta] = mocks.logger.warn.mock.calls[0];
    expect(msg).toMatch(/pending/);
    // 条数并进 message: logger.js 不透传白名单外的 meta 键, 只靠 meta 会看不到
    expect(msg).toMatch(/1 条/);
    expect(meta).toEqual({ count: 1, report_ids: ['er_orphan_1'], timeout_ms: 1234 });
    stop();
  });

  it('单次扫描抛错不影响进程 (错误进日志, 不冒泡)', async () => {
    const boom = new Error('db down');
    const reclaim = vi.fn().mockRejectedValue(boom);
    const stop = startPendingReclaimer({ intervalMs: 60_000, reclaim });
    await new Promise((r) => setTimeout(r, 5));

    expect(mocks.logger.error).toHaveBeenCalled();
    const [msg, meta] = mocks.logger.error.mock.calls[0];
    expect(msg).toMatch(/pending/);
    expect(meta).toEqual({ error: boom }); // 第 12 段: logger meta 传对象
    stop();
  });
});
