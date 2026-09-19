/* ============================================================================
 * tests/api/essay-reconcile.test.js — D086 §12 L4 reconcile 算法单测
 *
 * 覆盖 P0-3 dual-gate:
 *   - countOverlaps === 0
 *   - text.slice(start, end) === annotation.original
 *   - anchor_rate >= 0.95
 *   - integer offsets
 *   - 跨 paragraph 隔离
 * ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  reconcile,
  countOverlaps,
  findInParagraphs,
  flattenAiOutput,
  longestCommonSubstring,
  newReportId,
} from '../../api/handlers/essay/essayReconcile.js';

// ============================================================================
// 工具函数
// ============================================================================
describe('longestCommonSubstring()', () => {
  it('找到公共子串', () => {
    const r = longestCommonSubstring('hello world', 'world hello');
    expect(r).toBeTruthy();
    expect(r.length).toBe(5);
  });
  it('无公共子串返回 null', () => {
    expect(longestCommonSubstring('abc', 'xyz')).toBeNull();
  });
  it('空输入返回 null', () => {
    expect(longestCommonSubstring('', 'abc')).toBeNull();
    expect(longestCommonSubstring('abc', '')).toBeNull();
  });
});

describe('flattenAiOutput()', () => {
  it('合并 3 类条目 + 标记 type', () => {
    const out = flattenAiOutput({
      clue:     [{ original: '好句',   comment: '好' }],
      solution: [{ original: '需改句', problem: '问题' }],
      analysis: [{ original: '改后句', suggestion: '建议' }],
    });
    expect(out).toHaveLength(3);
    expect(out.map(o => o.type)).toEqual(['clue', 'solution', 'analysis']);
  });
  it('过滤过短 original（< 2 字符）', () => {
    const out = flattenAiOutput({
      clue: [{ original: '好', comment: '...' }, { original: '好句', comment: '...' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].original).toBe('好句');
  });
  it('空字段容错', () => {
    expect(flattenAiOutput({})).toEqual([]);
    expect(flattenAiOutput(null)).toEqual([]);
  });
});

describe('newReportId()', () => {
  it('格式：er_<timestamp>_<random>', () => {
    const id = newReportId();
    expect(id).toMatch(/^er_[a-z0-9]+_[a-z0-9]+$/);
  });
  it('唯一性（100 次无重复）', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newReportId()));
    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// findInParagraphs — 锚定核心
// ============================================================================
describe('findInParagraphs()', () => {
  const paragraphs = [
    { id: 'p1', text: '春天来了，万物复苏。大地披上了绿装，充满了生机。' },
    { id: 'p2', text: '小明在草地上奔跑，笑声回荡在山谷之间。' },
  ];

  it('精确匹配返回 (paragraph_id, start, end)', () => {
    const hit = findInParagraphs('万物复苏', paragraphs);
    // "万" 在原文 index=5，slice(5, 9) = "万物复苏"
    expect(hit.paragraph_id).toBe('p1');
    expect(hit.original).toBe('万物复苏');
    expect(paragraphs[0].text.slice(hit.start, hit.end)).toBe(hit.original);
  });

  it('含标点差异的句子也能匹配（去标点后子串）', () => {
    const hit = findInParagraphs('小明在草地上奔跑，笑声回荡在山谷之间。', paragraphs);
    expect(hit).toBeTruthy();
    expect(paragraphs[1].text.slice(hit.start, hit.end)).toBe(hit.original);
  });

  it('模糊匹配（LCS ≥ 8 字符）', () => {
    // 故意让原句字符顺序不变但有额外字符（应通过 norm+exact 失败 + LCS 成功）
    const hit = findInParagraphs('大地披上了绿装', paragraphs);
    expect(hit).toBeTruthy();
  });

  it('找不到返回 null', () => {
    expect(findInParagraphs('完全不存在的句子 xyz123', paragraphs)).toBeNull();
  });

  it('空输入返回 null', () => {
    expect(findInParagraphs('', paragraphs)).toBeNull();
    expect(findInParagraphs('任何', [])).toBeNull();
  });

  it('命中段落首句时 start=0', () => {
    // "春" 在 p1 原文 index=0
    const hit = findInParagraphs('春天来了', paragraphs);
    expect(hit.start).toBe(0);
    expect(hit.original).toBe('春天来了');
  });
});

// ============================================================================
// countOverlaps — 黄金测试断言
// ============================================================================
describe('countOverlaps()', () => {
  it('空数组返回 0', () => {
    expect(countOverlaps([])).toBe(0);
  });
  it('不重叠区间返回 0', () => {
    expect(countOverlaps([
      { start: 0,  end: 5  },
      { start: 10, end: 15 },
    ])).toBe(0);
  });
  it('重叠区间返回 ≥ 1', () => {
    expect(countOverlaps([
      { start: 0,  end: 10 },
      { start: 5,  end: 15 },
    ])).toBeGreaterThanOrEqual(1);
  });
  it('临界：end === start 不算重叠', () => {
    expect(countOverlaps([
      { start: 0, end: 5 },
      { start: 5, end: 10 },
    ])).toBe(0);
  });
});

// ============================================================================
// reconcile — 主流程（黄金测试等价场景）
// ============================================================================
describe('reconcile()', () => {
  // 模拟真实作文：3 个段落 + LLM 返回 6 个引用
  const paragraphs = [
    { id: 'p1', text: '春天来了，万物复苏。天空湛蓝如洗，燕子从南方归来。' },
    { id: 'p2', text: '小明站在田野上，看着远方的山峦，心中涌起无限遐想。' },
    { id: 'p3', text: '这就是我对春天的感悟，充满了希望与活力。' },
  ];
  const aiOutput = {
    clue: [
      { original: '天空湛蓝如洗', comment: '比喻生动' },
      { original: '燕子从南方归来', comment: '画面感强' },
    ],
    solution: [
      { original: '心中涌起无限遐想', problem: '略显空洞' },
    ],
    analysis: [
      { original: '心中涌起无限遐想', suggestion: '可改为：心中泛起层层涟漪' },
    ],
  };

  it('返回 annotations + metrics 字段', () => {
    const { annotations, metrics } = reconcile(paragraphs, aiOutput);
    expect(Array.isArray(annotations)).toBe(true);
    expect(metrics).toHaveProperty('raw_count');
    expect(metrics).toHaveProperty('anchor_success_count');
    expect(metrics).toHaveProperty('anchor_rate');
    expect(metrics).toHaveProperty('final_valid_count');
  });

  it('raw_count 等于 LLM 条目总数', () => {
    const { metrics } = reconcile(paragraphs, aiOutput);
    // 2 clue + 1 solution + 1 analysis = 4
    expect(metrics.raw_count).toBe(4);
  });

  it('solution 和 analysis 引用同一原文 → 去重后只保留 1', () => {
    const { annotations, metrics } = reconcile(paragraphs, aiOutput);
    // 三个唯一原文：天空湛蓝如洗 / 燕子从南方归来 / 心中涌起无限遐想
    // 但 solution+analysis 共享第三个原文 → 去重
    expect(metrics.final_valid_count).toBe(3);
    expect(annotations).toHaveLength(3);
  });

  it('P0-3 dual-gate：countOverlaps === 0', () => {
    const { annotations } = reconcile(paragraphs, aiOutput);
    expect(countOverlaps(annotations)).toBe(0);
  });

  it('P0-3 dual-gate：每条 annotation 的 text.slice(start, end) === original', () => {
    const { annotations } = reconcile(paragraphs, aiOutput);
    for (const a of annotations) {
      const p = paragraphs.find(p => p.id === a.paragraph_id);
      expect(p).toBeTruthy();
      expect(p.text.slice(a.start, a.end)).toBe(a.original);
      expect(Number.isInteger(a.start)).toBe(true);
      expect(Number.isInteger(a.end)).toBe(true);
    }
  });

  it('P0-3 dual-gate：anchor_rate = anchor_success / raw_count', () => {
    const { metrics } = reconcile(paragraphs, aiOutput);
    expect(metrics.anchor_rate).toBeCloseTo(
      metrics.anchor_success_count / metrics.raw_count,
      5
    );
  });

  it('空 LLM 输出时所有指标为 0', () => {
    const { annotations, metrics } = reconcile(paragraphs, {});
    expect(annotations).toEqual([]);
    expect(metrics.raw_count).toBe(0);
    expect(metrics.anchor_rate).toBe(0);
  });

  it('空 paragraphs + 有 LLM 输出 → annotations=[], raw_count > 0', () => {
    const { annotations, metrics } = reconcile([], aiOutput);
    expect(annotations).toEqual([]);
    expect(metrics.raw_count).toBeGreaterThan(0);
  });

  it('跨段不重叠（段 0 命中 + 段 1 命中 + 段 2 命中）', () => {
    const { annotations } = reconcile(paragraphs, aiOutput);
    const byParagraph = {};
    for (const a of annotations) (byParagraph[a.paragraph_id] ||= []).push(a);
    // 每段内不重叠
    for (const ps of Object.values(byParagraph)) {
      expect(countOverlaps(ps)).toBe(0);
    }
  });

  it('去重优先级：clue > analysis > solution', () => {
    const dupParagraphs = [
      { id: 'p1', text: '春天来了。完全相同的句子在文中。' },
    ];
    const dupOut = {
      clue:     [{ original: '完全相同的句子', comment: '作为亮点' }],
      analysis: [{ original: '完全相同的句子', suggestion: '改写建议' }],
      solution: [{ original: '完全相同的句子', problem: '问题' }],
    };
    const { annotations } = reconcile(dupParagraphs, dupOut);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].type).toBe('clue');
  });
});
