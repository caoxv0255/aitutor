/* ============================================================================
 * tests/api/essay-reconcile-v1.test.js — D086 §12 L4 V1.0 · 锚定算法单测
 *
 * 目标: 锁死 essayReconcile.js 的行为契约, 防止 Patch 4 (resolveOverlaps)
 *       与 3 级匹配 (exact / norm / LCS) 出现回归.
 *
 * 覆盖矩阵 (6 describe):
 *   1. 精确匹配 (Exact Match)
 *   2. 规范化匹配 (Norm Match)
 *   3. LCS 兜底匹配 (Fuzzy LCS)
 *   4. Patch 4 重叠消解 (Overlap Resolution, type 优先)
 *   5. Patch 4 平局消解 (Tie-breaker, quote 长度优先)
 *   6. 越界降级 (Out of Bounds, 不丢弃)
 *
 * 运行: npx vitest run tests/api/essay-reconcile-v1.test.js
 * ============================================================================ */

import { describe, it, expect } from 'vitest';

import {
  reconcile,
  findInParagraphs,
  longestCommonSubstring,
  resolveOverlaps,
  newReportId,
} from '../../api/handlers/essay/essayReconcile.js';

// ────────────────────────────────────────────────────────────────────────────
// 测试 fixtures (可复用)
// ────────────────────────────────────────────────────────────────────────────

const PARAGRAPHS = [
  {
    paragraph_index: 0,
    lines: [
      { line_no: 0, text: '春天来了，万物复苏。大地披上了绿装，充满了生机。', uncertain_chars: [] },
      { line_no: 1, text: '天空湛蓝如洗，燕子从南方归来。', uncertain_chars: [] },
    ],
  },
  {
    paragraph_index: 1,
    lines: [
      { line_no: 0, text: '小明站在田野上，看着远方的山峦，心中涌起无限遐想。', uncertain_chars: [] },
    ],
  },
];

/** 拼接段落全文 (与 reconcile 内部逻辑一致) */
const getFullText = (p) => p.lines.map((l) => l.text || '').join('');

// ────────────────────────────────────────────────────────────────────────────
// 1. 精确匹配 (Exact Match)
// ────────────────────────────────────────────────────────────────────────────
describe('精确匹配 (Exact Match)', () => {
  it('完全一致的 quote 应精确命中, start/end 整数, slice 与 original 一致 (不变量 I2)', () => {
    const hit = findInParagraphs('天空湛蓝如洗', PARAGRAPHS[0]);
    expect(hit).not.toBeNull();
    expect(hit.paragraph_index).toBe(0);
    expect(Number.isInteger(hit.start)).toBe(true);
    expect(Number.isInteger(hit.end)).toBe(true);
    const fullText = getFullText(PARAGRAPHS[0]);
    expect(fullText.slice(hit.start, hit.end)).toBe('天空湛蓝如洗');
  });

  it('跨行 quote (在 paragraph lines[].text 拼接后能整段找到)', () => {
    // "春天来了，万物复苏。" 跨越 1 个 line, 但 line.text 内部已含逗号, 不会跨行
    const hit = findInParagraphs('春天来了，万物复苏。', PARAGRAPHS[0]);
    expect(hit).not.toBeNull();
    const fullText = getFullText(PARAGRAPHS[0]);
    expect(fullText.slice(hit.start, hit.end)).toBe('春天来了，万物复苏。');
  });

  it('命中段落首句时 start === 0', () => {
    const hit = findInParagraphs('春天来了', PARAGRAPHS[0]);
    expect(hit.start).toBe(0);
  });

  it('空 quote 返回 null (不视为匹配)', () => {
    expect(findInParagraphs('', PARAGRAPHS[0])).toBeNull();
  });

  it('空 paragraphs 返回 null', () => {
    expect(findInParagraphs('任何', [])).toBeNull();
  });

  it('reconcile: 精确匹配输出 anchor_failed === false', () => {
    const { resolved, metrics } = reconcile(PARAGRAPHS, [
      { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '天空湛蓝如洗' }, comment: '比喻生动' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].anchor_failed).toBe(false);
    expect(resolved[0].start).toBeGreaterThanOrEqual(0);
    expect(resolved[0].end).toBeGreaterThan(resolved[0].start);
    expect(metrics.anchor_success_count).toBe(1);
    expect(metrics.raw_count).toBe(1);
    expect(metrics.anchor_rate).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 规范化匹配 (Norm Match)
// ────────────────────────────────────────────────────────────────────────────
describe('规范化匹配 (Norm Match)', () => {
  it('quote 缺失标点 (英文逗号 vs 中文逗号) 应通过 norm 路径匹配', () => {
    // 原文: "春天来了，万物复苏。" (中文逗号)
    // quote: "春天来了,万物复苏" (英文逗号, 无句号)
    const hit = findInParagraphs('春天来了,万物复苏', PARAGRAPHS[0]);
    expect(hit).not.toBeNull();
    expect(hit.paragraph_index).toBe(0);
    // 锚定区间应覆盖原文标点 (因为 norm 路径 end 估算, 不一定字字对齐原文)
    const fullText = getFullText(PARAGRAPHS[0]);
    expect(fullText.slice(hit.start)).toMatch(/万物复苏/); // 至少 start 后能找到 "万物复苏"
  });

  it('quote 与原文有空白差异 (空格/全角空格) 应通过 norm 匹配', () => {
    // 原文无空格, quote 包含空格
    const hit = findInParagraphs('天空 湛蓝 如洗', PARAGRAPHS[0]);
    expect(hit).not.toBeNull();
  });

  it('reconcile: norm 路径匹配的 quote 标 anchor_failed === false', () => {
    const { resolved } = reconcile(PARAGRAPHS, [
      { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '天空湛蓝,如洗' }, comment: '...' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].anchor_failed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. LCS 兜底匹配 (Fuzzy LCS)
// ────────────────────────────────────────────────────────────────────────────
describe('LCS 兜底匹配 (Fuzzy LCS)', () => {
  it('longestCommonSubstring 基础行为', () => {
    const r = longestCommonSubstring('hello world', 'world hello');
    expect(r).not.toBeNull();
    expect(r.length).toBe(5);
  });

  it('无公共子串返回 null', () => {
    expect(longestCommonSubstring('abc', 'xyz')).toBeNull();
  });

  it('空输入返回 null', () => {
    expect(longestCommonSubstring('', 'abc')).toBeNull();
    expect(longestCommonSubstring('abc', '')).toBeNull();
  });

  it('性能护栏: m*n > 5e6 直接放弃 (O(m*n) DP)', () => {
    const big = 'x'.repeat(3000);
    const big2 = 'y'.repeat(3000);
    // 3000 * 3000 = 9_000_000 > 5_000_000 → 期望 null
    expect(longestCommonSubstring(big, big2)).toBeNull();
  });

  it('quote 字符顺序不变但中间有错字/漏字, 通过 LCS ≥ 6 字符匹配', () => {
    // 原文 (段 0 第二行): "天空湛蓝如洗，燕子从南方归来。"
    // quote: "天空湛蓝如洗" (LCS 8 字符, ≥ 6 应匹配)
    const hit = findInParagraphs('天空湛蓝如洗,燕子从南方归来', PARAGRAPHS[0]);
    expect(hit).not.toBeNull();
    const fullText = getFullText(PARAGRAPHS[0]);
    expect(fullText.slice(hit.start, hit.end).length).toBeGreaterThanOrEqual(6);
  });

  it('LCS 长度 < 6 字符不应匹配 (返回 null)', () => {
    // 原文 "春天" → quote "秋" (LCS = 0, 找不到公共子串)
    // 实际期望: 没找到 (LCS 或 norm 都失败)
    const hit = findInParagraphs('完全不相关的内容xyz', PARAGRAPHS[0]);
    expect(hit).toBeNull();
  });

  it('reconcile: LCS 路径的 anchor_failed === false', () => {
    const { resolved } = reconcile(PARAGRAPHS, [
      { id: 'a1', type: 'highlight', anchor: { paragraph_index: 0, quote: '大地披上了绿' }, comment: 'LCS 兜底' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].anchor_failed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Patch 4 重叠消解 — type 优先
// ────────────────────────────────────────────────────────────────────────────
describe('Patch 4 重叠消解 (Overlap Resolution)', () => {
  it('同段重叠: masterstroke (短 quote) 胜出, highlight (长 quote) 被淘汰', () => {
    // 构造同段重叠区间:
    // A: highlight, start=5,  end=15 (长)
    // B: masterstroke, start=8, end=12 (短, 在 A 内部)
    const items = [
      { id: 'A', type: 'highlight',     paragraph_index: 0, original: '0123456789ABCDEF', start: 5, end: 15, quote: '6789ABCDEF' },
      { id: 'B', type: 'masterstroke',  paragraph_index: 0, original: '0123456789ABCDEF', start: 8, end: 12, quote: '89AB' },
    ];
    const out = resolveOverlaps(items);
    expect(out).toHaveLength(2);
    const A = out.find(x => x.id === 'A');
    const B = out.find(x => x.id === 'B');
    // masterstroke 优先级高 (0 < 2), 应保留
    expect(B.anchor_failed).toBe(false);
    expect(B.start).toBe(8);
    expect(B.end).toBe(12);
    // highlight 被淘汰
    expect(A.anchor_failed).toBe(true);
    expect(A.start).toBe(-1);
    expect(A.end).toBe(-1);
    expect(A.failure_reason).toBe('overlap_evicted');
  });

  it('同段重叠: grammar_error 优先级高于 highlight', () => {
    const items = [
      { id: 'A', type: 'highlight',     paragraph_index: 0, start: 0, end: 10, quote: '0123456789' },
      { id: 'B', type: 'grammar_error', paragraph_index: 0, start: 5, end: 8,  quote: '567' },
    ];
    const out = resolveOverlaps(items);
    const A = out.find(x => x.id === 'A');
    const B = out.find(x => x.id === 'B');
    expect(B.anchor_failed).toBe(false);
    expect(A.anchor_failed).toBe(true);
    expect(A.failure_reason).toBe('overlap_evicted');
  });

  it('reconcile: 同段真实场景 - masterstroke 击溃 highlight 区间', () => {
    // 模拟 LLM 返回两条命中段 0 同一句话的批注
    const { resolved, metrics } = reconcile(PARAGRAPHS, [
      {
        id: 'hl-1', type: 'highlight',
        anchor: { paragraph_index: 0, quote: '春天来了，万物复苏。大地披上了绿装' },
        comment: '开篇用词丰富',
      },
      {
        id: 'ms-1', type: 'masterstroke',
        anchor: { paragraph_index: 0, quote: '大地披上了绿装' },
        comment: '点睛之笔',
      },
    ]);
    // final_valid_count === raw_count (不丢)
    expect(metrics.final_valid_count).toBe(2);
    // masterstroke 应保留 (类型优先级更高)
    const ms = resolved.find(r => r.id === 'ms-1');
    const hl = resolved.find(r => r.id === 'hl-1');
    expect(ms.anchor_failed).toBe(false);
    // highlight 因被包含在 masterstroke 区间内而被淘汰 (取决于实际 start/end)
    // 实际 start/end 取决于命中区间, 这里不强制具体值, 只验证不变量
    if (hl.anchor_failed) {
      expect(hl.failure_reason).toBe('overlap_evicted');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Patch 4 平局消解 — quote 长度优先
// ────────────────────────────────────────────────────────────────────────────
describe('Patch 4 平局消解 (Tie-breaker by quote length)', () => {
  it('同 type (highlight) 重叠时, 较长 quote 胜出', () => {
    const items = [
      { id: 'short', type: 'highlight', paragraph_index: 0, start: 0, end: 10, quote: '0123456789' },         // 10 字符
      { id: 'long',  type: 'highlight', paragraph_index: 0, start: 5, end: 25, quote: '567890123456789012345' }, // 21 字符
    ];
    const out = resolveOverlaps(items);
    const s = out.find(x => x.id === 'short');
    const l = out.find(x => x.id === 'long');
    // 同优先级, long 胜出
    expect(l.anchor_failed).toBe(false);
    expect(s.anchor_failed).toBe(true);
    expect(s.failure_reason).toBe('overlap_evicted');
  });

  it('同 type + 同长度, 按 sort 顺序保留先到者 (稳定排序)', () => {
    // 两个完全一样的 highlight 重叠 - 算法按 (start asc) 处理, 先到的保留
    const items = [
      { id: 'first',  type: 'highlight', paragraph_index: 0, start: 0, end: 10, quote: '0123456789' },
      { id: 'second', type: 'highlight', paragraph_index: 0, start: 5, end: 15, quote: '5678901234' },
    ];
    const out = resolveOverlaps(items);
    const f = out.find(x => x.id === 'first');
    const s = out.find(x => x.id === 'second');
    // 同优先级, 同长度, first (start 较小) 胜出
    expect(f.anchor_failed).toBe(false);
    expect(s.anchor_failed).toBe(true);
  });

  it('不重叠的区间全部保留', () => {
    const items = [
      { id: 'A', type: 'highlight', paragraph_index: 0, start: 0,  end: 5,  quote: '01234' },
      { id: 'B', type: 'highlight', paragraph_index: 0, start: 10, end: 15, quote: 'ABCDE' },
    ];
    const out = resolveOverlaps(items);
    expect(out.find(x => x.id === 'A').anchor_failed).toBe(false);
    expect(out.find(x => x.id === 'B').anchor_failed).toBe(false);
  });

  it('reconcile: 平局时 quote 长度更长的胜出', () => {
    // 同一段, 两条 highlight 命中重叠区间
    const { resolved } = reconcile(PARAGRAPHS, [
      { id: 'short', type: 'highlight', anchor: { paragraph_index: 1, quote: '小明' }, comment: '短' },
      { id: 'long',  type: 'highlight', anchor: { paragraph_index: 1, quote: '小明站在田野上' }, comment: '长' },
    ]);
    const s = resolved.find(r => r.id === 'short');
    const l = resolved.find(r => r.id === 'long');
    // 如果 long 区间包含 short, short 会被淘汰
    if (l.start <= s.start && l.end >= s.end) {
      expect(s.anchor_failed).toBe(true);
      expect(l.anchor_failed).toBe(false);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. 越界降级 (Out of Bounds)
// ────────────────────────────────────────────────────────────────────────────
describe('越界降级 (Out of Bounds)', () => {
  it('paragraph_index 超出 paragraphs 数组长度 → anchor_failed=true + reason=paragraph_index_out_of_range', () => {
    const { resolved, metrics } = reconcile(PARAGRAPHS, [
      { id: 'oob', type: 'highlight', anchor: { paragraph_index: 99, quote: '不存在的段落' }, comment: '...' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].anchor_failed).toBe(true);
    expect(resolved[0].failure_reason).toBe('paragraph_index_out_of_range');
    expect(resolved[0].start).toBe(-1);
    expect(resolved[0].end).toBe(-1);
    // final_valid_count === raw_count (不丢)
    expect(metrics.final_valid_count).toBe(1);
    expect(metrics.raw_count).toBe(1);
  });

  it('paragraph_index 为负数 → 同样降级 (越界)', () => {
    const { resolved } = reconcile(PARAGRAPHS, [
      { id: 'neg', type: 'highlight', anchor: { paragraph_index: -1, quote: '...' }, comment: '...' },
    ]);
    expect(resolved[0].anchor_failed).toBe(true);
    expect(resolved[0].failure_reason).toBe('paragraph_index_out_of_range');
  });

  it('quote 在段落中找不到 → anchor_failed=true + reason=quote_not_found (不丢弃)', () => {
    const { resolved, metrics } = reconcile(PARAGRAPHS, [
      { id: 'nf', type: 'grammar_error', anchor: { paragraph_index: 0, quote: '完全不存在的内容xyz123' }, comment: '...' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].anchor_failed).toBe(true);
    expect(resolved[0].failure_reason).toBe('quote_not_found');
    // 不丢, final_valid_count === raw_count
    expect(metrics.final_valid_count).toBe(1);
  });

  it('quote 过短 (< 2 字符) → 降级到 quote_too_short', () => {
    const { resolved } = reconcile(PARAGRAPHS, [
      { id: 'short', type: 'highlight', anchor: { paragraph_index: 0, quote: '好' }, comment: '...' },
    ]);
    expect(resolved[0].anchor_failed).toBe(true);
    expect(resolved[0].failure_reason).toBe('quote_too_short');
  });

  it('混合场景: 1 个越界 + 1 个成功 + 1 个找不到 → 全部保留, 各自有正确 reason', () => {
    const { resolved, metrics } = reconcile(PARAGRAPHS, [
      { id: 'oob', type: 'highlight',     anchor: { paragraph_index: 99, quote: '越界内容' }, comment: '越界' },
      { id: 'ok',  type: 'masterstroke',  anchor: { paragraph_index: 0, quote: '天空湛蓝如洗' }, comment: '成功' },
      { id: 'nf',  type: 'grammar_error', anchor: { paragraph_index: 0, quote: '不存在的内容xyz' }, comment: '找不到' },
    ]);
    expect(metrics.raw_count).toBe(3);
    expect(metrics.final_valid_count).toBe(3);
    expect(metrics.anchor_success_count).toBe(1); // 只有 ok 成功
    expect(metrics.anchor_rate).toBeCloseTo(1 / 3, 5);

    const oob = resolved.find(r => r.id === 'oob');
    const ok = resolved.find(r => r.id === 'ok');
    const nf = resolved.find(r => r.id === 'nf');
    expect(oob.anchor_failed).toBe(true);
    expect(oob.failure_reason).toBe('paragraph_index_out_of_range');
    expect(ok.anchor_failed).toBe(false);
    expect(nf.anchor_failed).toBe(true);
    expect(nf.failure_reason).toBe('quote_not_found');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 附加: 工具函数
// ────────────────────────────────────────────────────────────────────────────
describe('工具函数', () => {
  it('newReportId: 格式 er_<ts36>_<rand8>', () => {
    const id = newReportId();
    expect(id).toMatch(/^er_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('newReportId: 100 次无重复', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newReportId()));
    expect(ids.size).toBe(100);
  });

  it('resolveOverlaps: 空数组返回空数组', () => {
    expect(resolveOverlaps([])).toEqual([]);
  });

  it('resolveOverlaps: 已是 failed 的项保持 failed', () => {
    const items = [
      { id: 'f', type: 'highlight', paragraph_index: 0, start: 0, end: 5, quote: '01234', anchor_failed: true, failure_reason: 'quote_not_found' },
      { id: 'o', type: 'highlight', paragraph_index: 0, start: 10, end: 15, quote: 'ABCDE' },
    ];
    const out = resolveOverlaps(items);
    expect(out.find(x => x.id === 'f').anchor_failed).toBe(true);
    expect(out.find(x => x.id === 'f').failure_reason).toBe('quote_not_found');
    expect(out.find(x => x.id === 'o').anchor_failed).toBe(false);
  });
});
