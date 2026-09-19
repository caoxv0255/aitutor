// scripts/qb/lib/validate.js — Gate B per-question integrity validation (QB-P0-AUDIT, 2026-09-03)
//
// reason codes (对齐审计 rejected.ndjson 约定):
//   UNDEFINED_STEM | OPTION_ONLY_FRAGMENT | MULTI_OPTION_SET_MERGE | MOJIBAKE
//   | EMPTY_OPTION_LABELS | LATEX_STRIPPED_SHORT_STEM | DANGLING_IMAGE_REF
//   | NO_STEM
//
// validateQuestion(record, {resolveImage}) -> { ok, reasons: string[] }

export const REASONS = {
  NO_STEM: 'NO_STEM',
  UNDEFINED_STEM: 'UNDEFINED_STEM',
  OPTION_ONLY_FRAGMENT: 'OPTION_ONLY_FRAGMENT',
  MULTI_OPTION_SET_MERGE: 'MULTI_OPTION_SET_MERGE',
  MOJIBAKE: 'MOJIBAKE',
  EMPTY_OPTION_LABELS: 'EMPTY_OPTION_LABELS',
  LATEX_STRIPPED_SHORT_STEM: 'LATEX_STRIPPED_SHORT_STEM',
  DANGLING_IMAGE_REF: 'DANGLING_IMAGE_REF',
};

const HAS_CJK = /[\u4e00-\u9fff]/;
const OPTION_MARKER = /(?<![A-Za-z])[A-D][\.．、]/g;
const HOLLOW_PAREN = /（\s*）|\(\s*\)/;
const IMAGE_TOKEN = /\[图片[^\]]*\]|【图片[^\]]*】|\[image[^\]]*\]/i;

export function countCjk(text) {
  const m = String(text || '').match(/[\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

export function countOptionMarkers(stem) {
  const m = String(stem || '').match(OPTION_MARKER);
  return m ? m.length : 0;
}

export function isMojibake(stem) {
  return /\uFFFD/.test(String(stem || ''));
}

export function isOptionOnlyFragment(stem) {
  const s = String(stem || '').trim();
  return /^[A-D][\.．、]/.test(s) && !HAS_CJK.test(s);
}

export function isEmptyOptionLabels(options) {
  if (!Array.isArray(options) || options.length === 0) return false;
  return options.every((o) => /^[A-D][\.．、]?\s*$/.test(String(o).trim()));
}

export function hasImageToken(stem) {
  return IMAGE_TOKEN.test(String(stem || ''));
}

/**
 * @param {object} rec 统一 record
 * @param {{resolveImage?: (rec)=>boolean}} [opts]
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function validateQuestion(rec, opts = {}) {
  const { resolveImage } = opts;
  const reasons = [];
  const stem = String(rec.stem ?? '').trim();

  if (!stem) {
    reasons.push(REASONS.NO_STEM);
    return { ok: false, reasons };
  }
  if (stem === 'undefined' || stem.toLowerCase() === 'undefined') {
    reasons.push(REASONS.UNDEFINED_STEM);
    return { ok: false, reasons };
  }
  if (isMojibake(stem)) {
    reasons.push(REASONS.MOJIBAKE);
    return { ok: false, reasons };
  }
  if (isOptionOnlyFragment(stem)) {
    reasons.push(REASONS.OPTION_ONLY_FRAGMENT);
    return { ok: false, reasons };
  }
  // merge: >=2 套选项
  if (countOptionMarkers(stem) >= 8) {
    reasons.push(REASONS.MULTI_OPTION_SET_MERGE);
    return { ok: false, reasons };
  }
  // 选择题 options 必须 >=2 且非空标签 (退化/空数组视为损坏 — LaTeX 抽空信号)
  const isChoice = rec.type === 'choice' || rec.type === 'multi_choice';
  if (isChoice) {
    if (!Array.isArray(rec.options) || rec.options.length < 2 || isEmptyOptionLabels(rec.options)) {
      reasons.push(REASONS.EMPTY_OPTION_LABELS);
      return { ok: false, reasons };
    }
  }
  // LaTeX 抽空的短干: 空心括号 + CJK 极少 (数学导出典型 '已知集合，，则（    ）')
  if (HOLLOW_PAREN.test(stem) && countCjk(stem) < 8) {
    reasons.push(REASONS.LATEX_STRIPPED_SHORT_STEM);
    return { ok: false, reasons };
  }
  // 图片引用必须可解析
  if (hasImageToken(stem)) {
    const resolvable = typeof resolveImage === 'function' ? resolveImage(rec) : false;
    if (!resolvable) {
      reasons.push(REASONS.DANGLING_IMAGE_REF);
      return { ok: false, reasons };
    }
  }
  return { ok: true, reasons };
}
