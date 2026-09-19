// scripts/qb/lib/dedupe.js — Gate B cross-source winner selection (QB-P0-AUDIT, 2026-09-03)
//
// 同 (paper, qn) 双源并存且规范化 stem 相同 → 打分选胜:
//   score = options(4 且非空 ? 4 : 1..3) + answer(?2) + analysis(?1)
//   平分 → 取 sourceRank 低者 (parsed=0 优先于 question-bank=1, 因 parsed 字段更全)
import { stemSig } from './parsers.js';

function recordScore(rec) {
  let s = 0;
  const opts = Array.isArray(rec.options) ? rec.options.filter((o) => String(o).trim().length > 3) : [];
  if (opts.length >= 2) s += 3;
  if (rec.answer) s += 2;
  if (rec.analysis) s += 1;
  return s;
}

const SOURCE_RANK = { parsed: 0, 'question-bank': 1, 'single-paper': 2 };

export function chooseWinner(a, b) {
  if (!a) return b;
  if (!b) return a;
  const sa = recordScore(a);
  const sb = recordScore(b);
  if (sa !== sb) return sa > sb ? a : b;
  const ra = SOURCE_RANK[a.source] ?? 9;
  const rb = SOURCE_RANK[b.source] ?? 9;
  return ra <= rb ? a : b;
}

/**
 * 归并候选: 按 (subject, year, province, qn) 分组, 组内按 stemSig 聚类去重.
 * 同一 paper+qn 下若出现多个不同 stem (真正的重复/污染) → 全部保留为 candidates,
 * 由 caller 校验层丢弃 (同 paper+qn 只允许一个 canonical).
 * @param {object[]} records 统一 record 列表
 * @returns {Map<string, object[]>} key=`subj|year|prov|qn`
 */
export function groupByPaperQuestion(records) {
  const map = new Map();
  for (const r of records) {
    const key = `${r.subject}|${r.year}|${r.province}|${r.qn}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

/**
 * 组内按 stem 聚类: 返回 [primaryWinner, ...duplicates] 信息
 */
export function resolveGroup(candidates) {
  if (candidates.length === 1) return { winner: candidates[0], dupes: [] };
  const clusters = new Map();
  for (const c of candidates) {
    const sig = stemSig(c.stem);
    if (!clusters.has(sig)) clusters.set(sig, []);
    clusters.get(sig).push(c);
  }
  const sigs = [...clusters.keys()];
  if (sigs.length === 1) {
    // 同 stem 多源 → winner
    return { winner: candidates.reduce(chooseWinner), dupes: [] };
  }
  // 不同 stem 并存 → 真正的污染/重复; 取最大簇的 winner, 其余计 dupes
  const biggest = [...clusters.entries()].sort((a, b) => b[1].length - a[1].length)[0][1];
  const winner = biggest.reduce(chooseWinner);
  const dupes = candidates.filter((c) => c !== winner);
  return { winner, dupes };
}
