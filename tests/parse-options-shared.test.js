// tests/parse-options-shared.test.js — 共享 options 容错解析工具回归闸门 (2026-09-24)
//
// 目的: 把原分散在 visionSearchService / paperGenerator / exam-pdf 的三份
//   options 解析收拢到 api/services/parseOptions.js 后, 机械证明两种语义
//   (「要数组」vs「透传」) 在所有边界上行为正确且差异明确。
//
// 边界覆盖: 空 / null / undefined / 纯空白 / 纯文本(非法 JSON) / 合法数组 /
//   合法非数组(对象/数字/布尔) / 已是数组的入参。
//
// 跑: npm test -- parse-options-shared

import { describe, it, expect, vi } from 'vitest';
import { parseOptionsAsArray, parseOptionsPassthrough } from '../api/services/parseOptions.js';

const PURE_TEXT = 'A. ①\tB. ②\tC. ③\tD. ④';
const ARRAY_JSON = JSON.stringify(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
const OBJECT_JSON = JSON.stringify({ A: '①', B: '②', C: '③', D: '④' });

describe('parseOptionsAsArray (语义 A: 结果必须是数组)', () => {
  it('1. 空 / null / undefined / 纯空白 → [] 且不回调失败', () => {
    for (const raw of [null, undefined, '', '   ', '\t\n']) {
      const onFailure = vi.fn();
      expect(parseOptionsAsArray(raw, onFailure)).toEqual([]);
      expect(onFailure).not.toHaveBeenCalled();
    }
  });

  it('2. 合法 JSON 数组 → 原数组, 不回调失败', () => {
    const onFailure = vi.fn();
    expect(parseOptionsAsArray(ARRAY_JSON, onFailure)).toEqual(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('3. 已是数组的入参 → 原样返回, 不回调失败', () => {
    const onFailure = vi.fn();
    const arr = ['A', 'B'];
    expect(parseOptionsAsArray(arr, onFailure)).toBe(arr);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('4. 纯文本 (非法 JSON) → [] 且 onFailure("invalid-json", raw)', () => {
    const onFailure = vi.fn();
    expect(parseOptionsAsArray(PURE_TEXT, onFailure)).toEqual([]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('invalid-json', PURE_TEXT);
  });

  it('5. 合法 JSON 但非数组: 对象 / 数字 / 布尔 / 字符串 → [] 且 onFailure("not-array")', () => {
    for (const raw of [OBJECT_JSON, '123', 'true', '"abc"', 'null']) {
      const onFailure = vi.fn();
      expect(parseOptionsAsArray(raw, onFailure)).toEqual([]);
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith('not-array', raw);
    }
  });

  it('6. onFailure 可选 (不传不抛)', () => {
    expect(() => parseOptionsAsArray(PURE_TEXT)).not.toThrow();
    expect(parseOptionsAsArray(PURE_TEXT)).toEqual([]);
  });
});

describe('parseOptionsPassthrough (语义 B: 失败保留原始字符串)', () => {
  it('7. 空 / null / undefined / 纯空白 → [] 且不回调失败', () => {
    for (const raw of [null, undefined, '', '   ']) {
      const onFailure = vi.fn();
      expect(parseOptionsPassthrough(raw, onFailure)).toEqual([]);
      expect(onFailure).not.toHaveBeenCalled();
    }
  });

  it('8. 合法 JSON 数组 → 原数组, 不回调失败', () => {
    const onFailure = vi.fn();
    expect(parseOptionsPassthrough(ARRAY_JSON, onFailure)).toEqual(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('9. 合法 JSON 但非数组 (对象/数字/布尔) → 原样透传, 不视为失败', () => {
    expect(parseOptionsPassthrough(OBJECT_JSON)).toEqual({ A: '①', B: '②', C: '③', D: '④' });
    expect(parseOptionsPassthrough('123')).toBe(123);
    expect(parseOptionsPassthrough('true')).toBe(true);
    expect(parseOptionsPassthrough('null')).toBe(null);
  });

  it('10. 纯文本 (非法 JSON) → 原始字符串 且 onFailure("invalid-json", raw)', () => {
    const onFailure = vi.fn();
    expect(parseOptionsPassthrough(PURE_TEXT, onFailure)).toBe(PURE_TEXT);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('invalid-json', PURE_TEXT);
  });

  it('11. onFailure 可选 (不传不抛)', () => {
    expect(() => parseOptionsPassthrough(PURE_TEXT)).not.toThrow();
    expect(parseOptionsPassthrough(PURE_TEXT)).toBe(PURE_TEXT);
  });
});

describe('两种语义的差异 (关键: 不得为统一而改变任一调用点行为)', () => {
  it('12. 纯文本: A 返回 [] + invalid-json; B 返回原字符串 + invalid-json', () => {
    const a = vi.fn();
    const b = vi.fn();
    const rA = parseOptionsAsArray(PURE_TEXT, a);
    const rB = parseOptionsPassthrough(PURE_TEXT, b);
    expect(rA).toEqual([]);
    expect(rB).toBe(PURE_TEXT);
    expect(a).toHaveBeenCalledWith('invalid-json', PURE_TEXT);
    expect(b).toHaveBeenCalledWith('invalid-json', PURE_TEXT);
  });

  it('13. 合法非数组 JSON (对象): A 返回 [] + not-array; B 原样透传且不回调', () => {
    const a = vi.fn();
    const b = vi.fn();
    expect(parseOptionsAsArray(OBJECT_JSON, a)).toEqual([]);
    expect(parseOptionsPassthrough(OBJECT_JSON, b)).toEqual({ A: '①', B: '②', C: '③', D: '④' });
    expect(a).toHaveBeenCalledWith('not-array', OBJECT_JSON);
    expect(b).not.toHaveBeenCalled();
  });

  it('14. 共同点: 空值与合法数组两语义结果一致', () => {
    for (const raw of [null, undefined, '', '  ', ARRAY_JSON]) {
      expect(parseOptionsAsArray(raw)).toEqual(parseOptionsPassthrough(raw));
    }
  });
});
