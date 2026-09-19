/* ============================================================================
 * essayReconcile.js — D086 §12 L4 V1.0 · 作文批改核心算法 (重构版)
 *
 * 职责: 将 LLM 返回的 anchor.quote 对齐回段落文本的字符偏移, 输出前端可消费的
 *       resolved[] (含 start/end/anchor_failed), 并保证同段落内区间不重叠.
 *
 * 关键变更 (相对 D086 L4):
 *   - 入参 contract 升级: LLM 直接输出 anchor.quote (而非 markdown 字符串)
 *   - 锚定失败不再丢弃, 标 anchor_failed=true, 由前端降级展示 (段末"未对齐"卡片)
 *   - 新增 resolveOverlaps() 步骤: 同段内按 type 优先级 + quote 长度做冲突消解
 *     (Patch 4: masterstroke > grammar_error > highlight > 其它)
 *   - 保留 line_no 字段 (来自转录阶段), 仅作为前端展示参考, 不参与算法决策
 *
 * 不变量 (前端消费契约):
 *   I1. resolved[i].start === -1 iff resolved[i].anchor_failed === true
 *   I2. 同 paragraph_index 内, 所有 !anchor_failed 项的 [start, end) 严格不相交
 *   I3. final_valid_count === raw_count (V1.0 不丢任何批注, 只标失败)
 *   I4. paragraph_index 越界 → anchor_failed=true + failure_reason='paragraph_index_out_of_range'
 * ============================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────────────────
// 常量: 类型优先级 (Patch 4: 数值越小越优先保留)
// ────────────────────────────────────────────────────────────────────────────

/** 类型优先级: 数值越小越优先. 用于 resolveOverlaps() 冲突消解 */
const TYPE_PRIORITY = Object.freeze({
  masterstroke: 0,    // 点睛之笔 (品牌红, 最高优先级)
  grammar_error: 1,   // 语病 (警示红, 教学价值高)
  highlight: 2,       // 好词好句 (暖绿, 鼓励为主)
  advanced_vocab: 3,  // 高级词汇 (信息蓝)
  logic_issue: 4,     // 逻辑/结构 (提醒黄)
});

// ────────────────────────────────────────────────────────────────────────────
// 工具函数: 规范化字符串
// ────────────────────────────────────────────────────────────────────────────

/**
 * 规范化: 去除所有空白 + 中英文标点 + 破折号等.
 * @param {string} s
 * @returns {string}
 */
function norm(s) {
  if (!s) return '';
  return String(s)
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。；：、！？「」『』""''()《》·…—,\.;:!?"'''()\-]/g, '');
}

/**
 * 把"规范化后"的字符索引映射回原始字符串索引.
 *
 * @param {string} original 原始字符串
 * @param {number} normIdx  规范化字符串中的索引
 * @returns {number} 原始字符串中对应的索引
 */
function mapNormIdxToReal(original, normIdx) {
  if (!original) return 0;
  if (normIdx <= 0) return 0;
  let ni = 0;
  for (let i = 0; i < original.length; i++) {
    const isPunct = /[\s\u3000，。；：、！？「」『』""''()《》·…—,\.;:!?"'''()\-]/.test(original[i]);
    if (isPunct) continue;
    if (ni === normIdx) return i;
    ni++;
  }
  return original.length;
}

/**
 * 朴素 LCS: 返回最长公共子串在 s 中的位置 + 长度.
 * 性能护栏: m*n > 5e6 直接放弃.
 *
 * @param {string} s 主串 (段落全文)
 * @param {string} t 模式串 (anchor.quote)
 * @returns {{start:number, end:number, length:number}|null}
 */
export function longestCommonSubstring(s, t) {
  if (!s || !t) return null;
  const m = s.length;
  const n = t.length;
  if (m * n > 5_000_000) return null;
  let bestLen = 0;
  let bestEnd = 0;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s[i - 1] === t[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > bestLen) {
          bestLen = dp[i][j];
          bestEnd = i;
        }
      }
    }
  }
  if (bestLen === 0) return null;
  return { start: bestEnd - bestLen, end: bestEnd, length: bestLen };
}

// ────────────────────────────────────────────────────────────────────────────
// 锚定核心: findQuoteInParagraph
// ────────────────────────────────────────────────────────────────────────────

/**
 * 在 paragraph 中寻找 quote 的精确字符区间 (3 级匹配: 精确 → norm → LCS)
 *
 * @param {string} quote
 * @param {{paragraph_index:number, lines:Array<{line_no:number, text:string}>}} paragraph
 * @returns {{paragraph_index:number, start:number, end:number}|null}
 */
export function findQuoteInParagraph(quote, paragraph) {
  if (!quote || !paragraph || !Array.isArray(paragraph.lines)) return null;
  const fullText = paragraph.lines.map((l) => l.text || '').join('');
  if (!fullText) return null;

  const paraIndex = paragraph.paragraph_index ?? 0;

  // 1. 精确匹配
  let idx = fullText.indexOf(quote);
  if (idx >= 0) {
    return { paragraph_index: paraIndex, start: idx, end: idx + quote.length };
  }

  // 2. 规范化匹配
  const normFull = norm(fullText);
  const normQuote = norm(quote);
  if (normQuote.length === 0) return null;
  const normIdx = normFull.indexOf(normQuote);
  if (normIdx >= 0) {
    const start = mapNormIdxToReal(fullText, normIdx);
    const end = Math.min(fullText.length, start + quote.length);
    return { paragraph_index: paraIndex, start, end };
  }

  // 3. LCS 兜底 (≥ 6 字符)
  const FUZZY_MIN = 6;
  const lcs = longestCommonSubstring(fullText, quote);
  if (lcs && lcs.length >= FUZZY_MIN) {
    return { paragraph_index: paraIndex, start: lcs.start, end: lcs.end };
  }

  return null;
}

/**
 * findInParagraphs — 两种调用形态 (按第二个入参分派):
 *
 *   1. 旧契约 (essayService / tests/api/essay-reconcile.test.js):
 *      findInParagraphs(quote, [{ id, text }]) → { paragraph_id, start, end, original } | null
 *      在所有段落里依次找 (精确 → 去标点 → LCS ≥ 6)
 *   2. 新契约 (tests/api/essay-reconcile-v1.test.js):
 *      findInParagraphs(quote, { paragraph_index, lines }) —— 等价于 findQuoteInParagraph
 *
 * @param {string} quote
 * @param {Array<{id:string, text:string}>|object} paragraphs
 * @returns {{paragraph_id?:string, paragraph_index?:number, start:number, end:number, original:string}|null}
 */
export function findInParagraphs(quote, paragraphs) {
  if (!Array.isArray(paragraphs)) {
    return findQuoteInParagraph(quote, paragraphs);
  }
  if (!quote) return null;

  for (const para of paragraphs) {
    const text = para?.text || '';
    if (!text) continue;

    // 1. 精确匹配
    const idx = text.indexOf(quote);
    if (idx >= 0) {
      return { paragraph_id: para.id, start: idx, end: idx + quote.length, original: quote };
    }

    // 2. 去标点后子串匹配
    const normText = norm(text);
    const normQuote = norm(quote);
    if (normQuote) {
      const normIdx = normText.indexOf(normQuote);
      if (normIdx >= 0) {
        const start = mapNormIdxToReal(text, normIdx);
        const end = Math.min(text.length, start + quote.length);
        return { paragraph_id: para.id, start, end, original: text.slice(start, end) };
      }
    }

    // 3. LCS 兜底 (≥ 6 字符)
    const lcs = longestCommonSubstring(text, quote);
    if (lcs && lcs.length >= 6) {
      return {
        paragraph_id: para.id,
        start: lcs.start,
        end: lcs.end,
        original: text.slice(lcs.start, lcs.end),
      };
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Patch 4: resolveOverlaps
// ────────────────────────────────────────────────────────────────────────────

/**
 * 消解同段落内的重叠区间.
 *
 * 规则:
 *   - 按 (paragraph_index, start) 升序遍历
 *   - 若 curr 与 lastKept 重叠 (curr.start < lastKept.end):
 *     1. 比较 type 优先级 (masterstroke > grammar_error > highlight > ...)
 *     2. 同优先级时, 比较 quote 长度 (更长者更优先, 信息量更大)
 *     3. 失败方 anchor_failed=true, failure_reason='overlap_evicted', start/end 置 -1
 *   - 若 curr.anchor_failed=true (已被前序步骤标记), 直接保留
 *
 * @param {Array<object>} resolved reconcile 第一阶段产出的待消解数组
 * @returns {Array<object>} 消解后的数组 (长度 === 输入长度)
 */
export function resolveOverlaps(resolved) {
  if (!Array.isArray(resolved) || resolved.length === 0) return resolved || [];

  // 1. 排序
  const sorted = [...resolved].sort((a, b) => {
    if (a.paragraph_index !== b.paragraph_index) {
      return a.paragraph_index - b.paragraph_index;
    }
    const aStart = a.anchor_failed ? -1 : (a.start ?? -1);
    const bStart = b.anchor_failed ? -1 : (b.start ?? -1);
    if (aStart !== bStart) return aStart - bStart;
    return (a.end ?? -1) - (b.end ?? -1);
  });

  // 2. 段内分组
  const byPara = new Map();
  for (const r of sorted) {
    if (!byPara.has(r.paragraph_index)) byPara.set(r.paragraph_index, []);
    byPara.get(r.paragraph_index).push(r);
  }

  const result = [];

  for (const arr of byPara.values()) {
    let lastKept = null;

    for (const curr of arr) {
      // 已失败的项: 直接保留
      if (curr.anchor_failed) {
        result.push(curr);
        continue;
      }

      // 无 lastKept 或 不重叠: 直接保留 (确保 anchor_failed: false 显式设置)
      if (!lastKept || curr.start >= lastKept.end) {
        const normalized = { ...curr, anchor_failed: false };
        result.push(normalized);
        lastKept = normalized;
        continue;
      }

      // 重叠: 优先级裁决
      const lastPrio = TYPE_PRIORITY[lastKept.type] ?? 99;
      const currPrio = TYPE_PRIORITY[curr.type] ?? 99;
      const lastQuoteLen = (lastKept.quote || lastKept.original || '').length;
      const currQuoteLen = (curr.quote || curr.original || '').length;

      const currWins =
        currPrio < lastPrio ||
        (currPrio === lastPrio && currQuoteLen > lastQuoteLen);

      if (currWins) {
        // 淘汰 lastKept, 保留 curr (规范化 anchor_failed: false)
        const idx = result.lastIndexOf(lastKept);
        if (idx >= 0) {
          result[idx] = {
            ...lastKept,
            anchor_failed: true,
            start: -1,
            end: -1,
            failure_reason: 'overlap_evicted',
          };
        }
        const normalized = { ...curr, anchor_failed: false };
        result.push(normalized);
        lastKept = normalized;
      } else {
        // 淘汰 curr, 保留 lastKept
        result.push({
          ...curr,
          anchor_failed: true,
          start: -1,
          end: -1,
          failure_reason: 'overlap_evicted',
        });
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// 主函数: reconcile
// ────────────────────────────────────────────────────────────────────────────

/**
 * 把 LLM 返回的 annotations 锚定到 paragraphs 文本中.
 *
 * 流程:
 *   1. 遍历每条 annotation
 *   2. findQuoteInParagraph() 找区间 (3 级匹配)
 *   3. 找到 → 记录 start/end/original
 *      找不到 → anchor_failed=true, failure_reason 标注原因
 *   4. paragraph_index 越界 → 同样标 anchor_failed
 *   5. resolveOverlaps() 消解同段冲突 (Patch 4)
 *   6. 计算 anchor_metrics
 *
 * @param {Array<{paragraph_index:number, lines:Array}>} paragraphs  来自转录阶段
 * @param {Array<{id?:string, type:string, anchor:{paragraph_index:number, quote:string, line_no?:number}, comment:string}>} annotations
 * @returns {{ resolved: Array, metrics: { raw_count, anchor_success_count, anchor_rate, final_valid_count } }}
 */
export function reconcile(paragraphs, annotations) {
  // 两种入参契约并存:
  //   - 新契约 (gradeService): annotations 是 [{ type, anchor: { paragraph_index, quote } }]
  //   - 旧契约 (essayService, 线上 POST /api/essay/grade 在用):
  //     aiOutput 是 { clue: [], solution: [], analysis: [] }, 段落是 [{ id, text }]
  if (!Array.isArray(annotations)) {
    return reconcileLegacyOutput(paragraphs, annotations);
  }
  if (!Array.isArray(paragraphs)) paragraphs = [];

  const resolved = [];
  const raw_count = annotations.length;

  for (const ann of annotations) {
    const annoId = ann.id || `anno_${resolved.length}`;
    const paraIndex = ann.anchor?.paragraph_index;
    const quote = String(ann.anchor?.quote || '').trim();
    const lineNo = typeof ann.anchor?.line_no === 'number' ? ann.anchor.line_no : -1;

    // 1. quote 长度防御
    if (quote.length < 2) {
      resolved.push({
        id: annoId,
        paragraph_index: paraIndex ?? -1,
        start: -1,
        end: -1,
        original: quote,
        quote,
        type: ann.type,
        comment: ann.comment || '',
        line_no: lineNo,
        anchor_failed: true,
        failure_reason: 'quote_too_short',
      });
      continue;
    }

    // 2. paragraph_index 越界
    const para = paragraphs[paraIndex];
    if (!para) {
      resolved.push({
        id: annoId,
        paragraph_index: paraIndex ?? -1,
        start: -1,
        end: -1,
        original: quote,
        quote,
        type: ann.type,
        comment: ann.comment || '',
        line_no: lineNo,
        anchor_failed: true,
        failure_reason: 'paragraph_index_out_of_range',
      });
      continue;
    }

    // 3. 3 级匹配
    const hit = findQuoteInParagraph(quote, para);
    if (hit) {
      const fullText = para.lines.map((l) => l.text || '').join('');
      const realEnd = Math.min(fullText.length, hit.end);
      const original = fullText.slice(hit.start, realEnd);
      resolved.push({
        id: annoId,
        paragraph_index: paraIndex,
        start: hit.start,
        end: realEnd,
        original,
        quote,
        type: ann.type,
        comment: ann.comment || '',
        line_no: lineNo,
        anchor_failed: false,
      });
    } else {
      // 4. 全部失败: 降级, 不丢弃
      resolved.push({
        id: annoId,
        paragraph_index: paraIndex,
        start: -1,
        end: -1,
        original: quote,
        quote,
        type: ann.type,
        comment: ann.comment || '',
        line_no: lineNo,
        anchor_failed: true,
        failure_reason: 'quote_not_found',
      });
    }
  }

  // 5. Patch 4: 消解同段重叠
  const noOverlap = resolveOverlaps(resolved);

  // 6. 最终排序
  noOverlap.sort((a, b) => {
    if (a.paragraph_index !== b.paragraph_index) {
      return a.paragraph_index - b.paragraph_index;
    }
    const aStart = a.anchor_failed ? Number.MAX_SAFE_INTEGER : (a.start ?? 0);
    const bStart = b.anchor_failed ? Number.MAX_SAFE_INTEGER : (b.start ?? 0);
    if (aStart !== bStart) return aStart - bStart;
    return (a.end ?? 0) - (b.end ?? 0);
  });

  // 7. 指标
  const anchor_success_count = noOverlap.filter((r) => !r.anchor_failed).length;
  const anchor_rate = raw_count > 0 ? anchor_success_count / raw_count : 0;

  return {
    resolved: noOverlap,
    metrics: {
      raw_count,
      anchor_success_count,
      anchor_rate,
      final_valid_count: noOverlap.length,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 工具: 报告 ID 生成
// ────────────────────────────────────────────────────────────────────────────

export function newReportId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `er_${ts}_${rand}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 旧契约 (essayService.js 线上路径在用)
//   paragraphs: [{ id, text }]
//   aiOutput:   { clue: [], solution: [], analysis: [] }
//   → { annotations, metrics }
//
// essayService 曾因重构版只返回 { resolved, metrics } 而拿到 annotations=undefined,
// 批改报告存库时批注全丢. 这里恢复该契约, 两套并存.
// ────────────────────────────────────────────────────────────────────────────

/** 旧契约去重优先级: clue > analysis > solution (数值越小越优先) */
const LEGACY_TYPE_PRIORITY = Object.freeze({ clue: 0, analysis: 1, solution: 2 });

/**
 * 把 { clue, solution, analysis } 摊平成带 type 的数组.
 * 过滤 original 过短 (< 2 字符) 的条目.
 *
 * @param {{clue?:Array, solution?:Array, analysis?:Array}|null} aiOutput
 * @returns {Array<object>}
 */
export function flattenAiOutput(aiOutput) {
  if (!aiOutput || typeof aiOutput !== 'object') return [];
  const out = [];
  for (const type of ['clue', 'solution', 'analysis']) {
    const list = Array.isArray(aiOutput[type]) ? aiOutput[type] : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const original = String(item.original ?? '').trim();
      if (original.length < 2) continue;
      out.push({ ...item, original, type });
    }
  }
  return out;
}

/**
 * 统计重叠区间对数. 带 paragraph_id 时按段内统计 (跨段偏移不可比).
 *
 * @param {Array<{start:number, end:number, paragraph_id?:string}>} items
 * @returns {number}
 */
export function countOverlaps(items) {
  if (!Array.isArray(items) || items.length < 2) return 0;

  const byPara = new Map();
  for (const it of items) {
    if (!it || !Number.isInteger(it.start) || !Number.isInteger(it.end)) continue;
    if (it.start < 0 || it.end < 0) continue;
    const key = it.paragraph_id ?? '';
    if (!byPara.has(key)) byPara.set(key, []);
    byPara.get(key).push(it);
  }

  let overlaps = 0;
  for (const arr of byPara.values()) {
    arr.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 1; i < arr.length; i++) {
      // 临界: end === start 不算重叠
      if (arr[i].start < arr[i - 1].end) overlaps++;
    }
  }
  return overlaps;
}

/**
 * 旧契约主流程: { clue, solution, analysis } → annotations[]
 *
 * @param {Array<{id:string, text:string}>} paragraphs
 * @param {object} aiOutput
 * @returns {{ annotations: Array, metrics: { raw_count, anchor_success_count, anchor_rate, final_valid_count } }}
 */
function reconcileLegacyOutput(paragraphs, aiOutput) {
  const paras = Array.isArray(paragraphs) ? paragraphs : [];
  const flat = flattenAiOutput(aiOutput);
  const raw_count = flat.length;

  const annotations = [];
  const byKey = new Map(); // `${paragraph_id}::${original}` → 已保留的 annotation
  let anchor_success_count = 0;

  for (const item of flat) {
    const hit = findInParagraphs(item.original, paras);
    if (!hit) continue;
    anchor_success_count++;

    const key = `${hit.paragraph_id}::${hit.original}`;
    const prev = byKey.get(key);
    const prio = LEGACY_TYPE_PRIORITY[item.type] ?? 9;

    if (prev) {
      // 同原文: 保留优先级更高的 (clue > analysis > solution)
      if (prio >= (LEGACY_TYPE_PRIORITY[prev.type] ?? 9)) continue;
      const idx = annotations.indexOf(prev);
      const merged = { ...item, ...hit };
      annotations[idx] = merged;
      byKey.set(key, merged);
      continue;
    }

    const ann = { ...item, ...hit };
    annotations.push(ann);
    byKey.set(key, ann);
  }

  annotations.sort((a, b) => a.start - b.start || a.end - b.end);

  return {
    annotations,
    metrics: {
      raw_count,
      anchor_success_count,
      anchor_rate: raw_count > 0 ? anchor_success_count / raw_count : 0,
      final_valid_count: annotations.length,
    },
  };
}
