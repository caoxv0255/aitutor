// tests/api/qb-dedupe.test.js — Gate B cross-source winner selection
import { describe, it, expect } from 'vitest';
import { chooseWinner, resolveGroup, groupByPaperQuestion } from '../../scripts/qb/lib/dedupe.js';

const parsedRec = (extra = {}) => ({
  source: 'parsed', subject: 'math', year: 2024, province: 'beijing', qn: 1,
  stem: '同一道题', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], answer: 'B', analysis: '', ...extra,
});
const qbRec = (extra = {}) => ({
  source: 'question-bank', subject: 'math', year: 2024, province: 'beijing', qn: 1,
  stem: '同一道题', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], answer: 'B', analysis: '详解', ...extra,
});

describe('chooseWinner', () => {
  it('prefers richer analysis when scores equal otherwise', () => {
    const w = chooseWinner(parsedRec(), qbRec());
    expect(w.source).toBe('question-bank');
  });
  it('ties break to parsed (lower source rank)', () => {
    const a = parsedRec({ analysis: 'x' });
    const b = qbRec({ analysis: 'y' });
    const w = chooseWinner(a, b);
    expect(w.source).toBe('parsed');
  });
});

describe('resolveGroup / groupByPaperQuestion', () => {
  it('merges same-stem sources into one winner', () => {
    const { winner, dupes } = resolveGroup([parsedRec(), qbRec(), parsedRec()]);
    expect(dupes.length).toBe(0);
    expect(winner.source).toBe('question-bank');
  });
  it('flags distinct stems at same (paper, qn) as dupes', () => {
    const a = parsedRec();
    const b = parsedRec({ stem: '完全不同的题干' });
    const { winner, dupes } = resolveGroup([a, b]);
    expect(dupes.length).toBe(1);
    expect(winner.stem).toBe('同一道题'); // 最大簇胜出
  });
  it('groups by paper+qn key', () => {
    const g = groupByPaperQuestion([parsedRec(), parsedRec({ qn: 2 })]);
    expect(g.size).toBe(2);
  });
});
