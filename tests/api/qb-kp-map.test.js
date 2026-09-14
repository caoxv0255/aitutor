// tests/api/qb-kp-map.test.js — Gate B deterministic KP mapping
import { describe, it, expect } from 'vitest';
import { buildKpIndex, mapKpTags, matchTag } from '../../scripts/qb/lib/kp-map.js';

const NODES = [
  { id: 'BIO-G0-001', subject: 'biology', name: '第1章 走近细胞', subtopics: ['细胞学说', '原核细胞'] },
  { id: 'BIO-G0-002', subject: 'biology', name: '第2章 组成细胞的分子', subtopics: ['蛋白质', 'DNA', '糖类'] },
  { id: 'MAT-G0-001', subject: 'math', name: '集合', subtopics: ['集合运算', '子集'] },
];

describe('buildKpIndex / matchTag', () => {
  const idx = buildKpIndex(NODES);
  it('exact name match', () => {
    expect(matchTag('biology', '第1章 走近细胞', idx)?.id).toBe('BIO-G0-001');
  });
  it('normalized match ignores 第/章 and whitespace', () => {
    expect(matchTag('biology', '第1章走近细胞', idx)?.id).toBe('BIO-G0-001');
  });
  it('substring match against subtopics', () => {
    expect(matchTag('biology', 'DNA的分子结构', idx)?.id).toBe('BIO-G0-002');
  });
  it('no cross-subject leakage', () => {
    expect(matchTag('math', 'DNA', idx)).toBeNull();
  });
  it('unmatched returns null', () => {
    expect(matchTag('biology', '不存在的知识点', idx)).toBeNull();
  });
});

describe('mapKpTags', () => {
  const idx = buildKpIndex(NODES);
  it('separates matched and unmatched', () => {
    const { matched, unmatched } = mapKpTags('biology', ['第1章 走近细胞', '光合作用的影响因素'], idx);
    expect(matched.map((m) => m.id)).toEqual(['BIO-G0-001']);
    expect(unmatched).toEqual(['光合作用的影响因素']);
  });
  it('dedupes matched ids at caller level', () => {
    const { matched } = mapKpTags('biology', ['第1章 走近细胞', '第1章走近细胞'], idx);
    expect(matched.length).toBe(2); // 两个 tag 各命中同节点 — 由 caller 对 id 去重
  });
});
