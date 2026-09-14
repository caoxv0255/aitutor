// tests/api/qb-validate.test.js — Gate B integrity validators
import { describe, it, expect } from 'vitest';
import { validateQuestion, REASONS, countOptionMarkers, isMojibake, isEmptyOptionLabels } from '../../scripts/qb/lib/validate.js';

const base = {
  source: 'parsed', subject: 'math', year: 2024, province: 'beijing',
  level: 'gaokao', qn: 1, type: 'choice',
  stem: '已知集合A={1,2,3}，则A的子集个数为（ ）',
  options: ['A. 4', 'B. 8', 'C. 16', 'D. 32'], answer: 'B', analysis: '2^3=8',
  kpTags: [], difficulty: 2, score: 5, hasImage: false,
};

describe('validateQuestion', () => {
  it('passes a healthy record', () => {
    expect(validateQuestion(base)).toEqual({ ok: true, reasons: [] });
  });
  it('rejects empty / undefined stem', () => {
    expect(validateQuestion({ ...base, stem: '' }).reasons).toContain(REASONS.NO_STEM);
    expect(validateQuestion({ ...base, stem: 'undefined' }).reasons).toContain(REASONS.UNDEFINED_STEM);
  });
  it('rejects option-only fragments (no CJK, starts with A.)', () => {
    const r = validateQuestion({ ...base, stem: 'A. grateful B. surprised C. convinced D. regretful' });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.OPTION_ONLY_FRAGMENT);
  });
  it('rejects mojibake', () => {
    expect(isMojibake('��ͼΪ�ƴ�')).toBe(true);
    const r = validateQuestion({ ...base, stem: '��ͼΪ�ƴ���������' });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.MOJIBAKE);
  });
  it('rejects merged multi-question stems (>=8 option markers)', () => {
    const merged = '若直线为对称轴，则a（ ）A. 1 B. 2 C. 3 D. 4 ' +
      '4 已知函数f(x)=x，则（ ）A. 5 B. 6 C. 7 D. 8 ' +
      '5 已知函数g(x)，则（ ）A. 9 B. 10 C. 11 D. 12';
    expect(countOptionMarkers(merged)).toBeGreaterThanOrEqual(8);
    const r = validateQuestion({ ...base, stem: merged });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.MULTI_OPTION_SET_MERGE);
  });
  it('rejects choice with empty option labels', () => {
    const r = validateQuestion({ ...base, options: ['A.', 'B.', 'C.', 'D.'] });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.EMPTY_OPTION_LABELS);
    expect(isEmptyOptionLabels(['A.', 'B. '])).toBe(true);
    expect(isEmptyOptionLabels(['A. 1', 'B. 2'])).toBe(false);
  });
  it('rejects latex-stripped hollow short stems (fill, no options)', () => {
    const r = validateQuestion({ ...base, type: 'fill', options: null, stem: '已知集合，，则（    ）' });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.LATEX_STRIPPED_SHORT_STEM);
  });
  it('rejects dangling image tokens when not resolvable', () => {
    const r = validateQuestion({ ...base, stem: '反应过程如下：[图片7_1] 回答下列问题', hasImage: true });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(REASONS.DANGLING_IMAGE_REF);
  });
  it('passes image tokens when resolver confirms', () => {
    const r = validateQuestion(
      { ...base, stem: '反应过程如下：[图片7_1] 回答下列问题', hasImage: true },
      { resolveImage: () => true },
    );
    expect(r.ok).toBe(true);
  });
});
