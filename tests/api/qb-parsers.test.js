// tests/api/qb-parsers.test.js — Gate B source readers (pure functions)
import { describe, it, expect } from 'vitest';
import {
  parseQbContentMd, parseUid, splitPaperBlocks, classifyBlocks, stemSig,
} from '../../scripts/qb/lib/parsers.js';

describe('parseUid', () => {
  it('parses D063 Rule A uid', () => {
    expect(parseUid('biology_2025_beijing_015')).toEqual({ subject: 'biology', year: 2025, province: 'beijing', qn: 15 });
    expect(parseUid('')).toBeNull();
    expect(parseUid('whatever')).toBeNull();
  });
});

describe('parseQbContentMd', () => {
  const md = [
    '# 第1题',
    '**题型**: 选择题',
    '**难度**: ★☆☆☆☆',
    '**分值**: 4分',
    '---',
    '## 题目内容',
    '已知集合M={x|-4<x≤1}，则M∪N=（    ）',
    '## 选项',
    'A. {x|-4<x<3}',
    'B. {x|-1<x≤1}',
    'C. {0,1,2}',
    'D. {x|-1<x<4}',
    '---',
    '## 参考答案',
    'A',
    '## 解析',
    '由并集定义可得。',
  ].join('\n');
  const out = parseQbContentMd(md);
  it('extracts stem/options/answer/analysis sections', () => {
    expect(out.stem).toContain('已知集合M={x|-4<x≤1}');
    expect(out.options).toEqual(['A. {x|-4<x<3}', 'B. {x|-1<x≤1}', 'C. {0,1,2}', 'D. {x|-1<x<4}']);
    expect(out.answer).toBe('A');
    expect(out.analysis).toContain('由并集定义可得');
  });
  it('tolerates alternate section headings', () => {
    const alt = '## 题目\n甲题\n## 选项\nA. 1\nB. 2\n## 参考答案\nB\n';
    const o = parseQbContentMd(alt);
    expect(o.stem).toBe('甲题');
    expect(o.options).toEqual(['A. 1', 'B. 2']);
    expect(o.answer).toBe('B');
  });
});

describe('splitPaperBlocks / classifyBlocks', () => {
  const mk = (id, qn, uid = '') => ({ id, question_number: qn, question_uid: uid, stem: `s${qn}` });
  it('splits on question_number reset to 1', () => {
    const qs = [mk(1, 1), mk(2, 2), mk(3, 3), mk(4, 1), mk(5, 2)];
    const blocks = splitPaperBlocks(qs);
    expect(blocks.length).toBe(2);
    expect(blocks[0].length).toBe(3);
    expect(blocks[1].length).toBe(2);
  });
  it('tier A: coherent single full paper via paper_info', () => {
    const qs = Array.from({ length: 21 }, (_, i) => mk(i + 1, i + 1));
    const cls = classifyBlocks(qs, { subject: 'geography', year: 2021, paperInfo: { province_code: 'beijing', exam_level: 'gaokao' } });
    expect(cls[0].province).toBe('beijing');
    expect(cls[0].tier).toBe('A');
  });
  it('tier B: uid-carrying block', () => {
    const qs = [mk(1, 1), mk(2, 2, 'math_2024_beijing_2'), mk(3, 3, 'math_2024_beijing_3'), mk(4, 4, 'math_2024_beijing_4'), mk(5, 5, 'math_2024_beijing_5')];
    const cls = classifyBlocks(qs, { subject: 'math', year: 2024, paperInfo: {} });
    expect(cls[0].province).toBe('beijing');
    expect(cls[0].tier).toBe('B');
  });
  it('tier B year must match filename year', () => {
    const qs = [mk(1, 1), mk(2, 2, 'math_2020_beijing_2'), mk(3, 3, 'math_2020_beijing_3')];
    const cls = classifyBlocks(qs, { subject: 'math', year: 2024, paperInfo: {} });
    expect(cls[0].province).toBeNull();
  });
});

describe('stemSig', () => {
  it('normalizes whitespace', () => {
    expect(stemSig('  a   b ')).toBe(stemSig('a b'));
  });
});
