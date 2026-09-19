// scripts/qb/lib/parsers.js — Gate B source readers (QB-P0-AUDIT, 2026-09-03)
//
// 读取两个上游分支 + single-paper 参考文件, 输出统一 record:
//   { source, path, subject, year, province, level,
//     qn, type, stem, options[], answer, analysis, kpTags[],
//     difficulty, score, hasImage, srcId, srcUid, paperFilePath? }
//
// 纯函数 / 无 DB 访问 / 无副作用 (stdout 打印除外).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { normalizeQuestionType, parseScore, parseDifficulty } from '../../../api/core/questionBank.js';

export const UID_PATTERN = /^([a-z_]+)_(\d{4})_([a-z0-9_]+)_(\d{1,3})$/;

export function parseUid(uid) {
  if (!uid) return null;
  const m = UID_PATTERN.exec(String(uid).trim());
  if (!m) return null;
  return { subject: m[1], year: Number.parseInt(m[2], 10), province: m[3], qn: Number.parseInt(m[4], 10) };
}

export function stemSig(stem) {
  const s = String(stem || '').replace(/\s+/g, ' ').trim();
  return crypto.createHash('md5').update(s).digest('hex');
}

/**
 * 把 JSON 文件按 question_number 重置为 1 切分为 paper-block.
 */
export function splitPaperBlocks(questions) {
  const sorted = [...questions].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const blocks = [];
  let cur = [];
  for (const q of sorted) {
    if (q.question_number === 1 && cur.length > 0) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(q);
  }
  if (cur.length > 0) blocks.push(cur);
  return blocks;
}

/**
 * provenance 判定 (paper 级):
 *  Tier A — 单 block 连贯整卷文件 (1..N, N>=10), 以 paper_info.province_code 为准
 *  Tier B — block 内 >=60% record 带可解析 uid 且 (subject,year,province) 一致
 * 返回 [{block, province, tier, uidYear, uidSubject, uidProvince, uidCoverage}]
 */
export function classifyBlocks(questions, { subject, year, paperInfo }) {
  const blocks = splitPaperBlocks(questions);
  const out = [];
  for (const block of blocks) {
    const qns = block.map((q) => q.question_number);
    const parsed = block.map((q) => parseUid(q.question_uid)).filter(Boolean);
    const consistent = new Set(parsed.map((p) => `${p.subject}|${p.year}|${p.province}`));
    const main = consistent.size === 1 && parsed.length > 0 ? parsed[0] : null;
    const uidCoverage = parsed.length / block.length;

    const isCoherentFullPaper =
      blocks.length === 1 &&
      qns.length >= 10 &&
      qns[0] === 1 &&
      qns.every((n, i) => i === 0 || n === qns[i - 1] + 1) &&
      paperInfo?.province_code &&
      paperInfo?.exam_level === 'gaokao';

    let province = null;
    let tier = null;
    if (main && uidCoverage >= 0.6) {
      // uid 内部一致, 且年份与文件名一致 (防跨年串文件)
      if (main.year === year && main.subject === subject) {
        province = main.province;
        tier = 'B';
      }
    } else if (isCoherentFullPaper) {
      province = paperInfo.province_code;
      tier = 'A';
    }
    out.push({ block, province, tier, uidCoverage, uidInfo: main });
  }
  return out;
}

/**
 * parsed-examples record → 统一 record (仅当 qn 唯一; caller 负责按 paper 聚合去重).
 */
export function parsedToRecord(block, { province, subject, year, sourceFile }) {
  const records = [];
  const seenQn = new Set();
  for (const q of block) {
    const qn = q.question_number;
    if (qn == null || seenQn.has(qn)) continue; // block 内 qn 重复 → 取第一个
    seenQn.add(qn);
    const { type, changed: typeChanged } = normalizeQuestionType(q.question_type);
    records.push({
      source: 'parsed',
      sourceFile,
      subject,
      year,
      province,
      level: 'gaokao',
      qn,
      type,
      typeChanged,
      stem: (q.stem || '').trim(),
      options: Array.isArray(q.options) ? [...q.options] : null,
      answer: (q.answer || '').trim() || null,
      analysis: (q.analysis || '').trim() || null,
      kpTags: Array.isArray(q.knowledge_points) ? [...q.knowledge_points].filter(Boolean) : [],
      difficulty: parseDifficulty(q.difficulty),
      score: parseScore(q.score),
      hasImage: Boolean(q.has_image),
      srcId: q.id ?? null,
      srcUid: q.question_uid || null,
      paperFilePath: null, // caller 填入 paper 级
      physicsStructure: q.physics_structure ?? {},
      chemistryStructure: q.chemistry_structure ?? {},
      mathStructure: q.math_structure ?? {},
      latexFormulas: q.latex_formulas || null,
      imageDescriptions: q.image_descriptions || null,
    });
  }
  return records;
}

const SECTION_ALIAS = {
  题目内容: 'stem', 题目: 'stem', 题干: 'stem',
  选项: 'options', 参考答案: 'answer', 参考解析: 'analysis', 解析: 'analysis',
};

/**
 * question-bank content.md → {stem, options[], answer, analysis}
 * 容错: 分节标题大小写/空格, 选项行以 A. B. C. D. 开头.
 */
export function parseQbContentMd(md) {
  const out = { stem: '', options: [], answer: '', analysis: '' };
  if (!md) return out;
  const lines = md.split(/\r?\n/);
  let section = null;
  for (let line of lines) {
    line = line.trimEnd();
    const h = /^#{2,3}\s*(.+?)\s*#*$/.exec(line.trim());
    if (h) {
      const key = SECTION_ALIAS[h[1].trim()];
      section = key || null;
      continue;
    }
    if (!section) continue;
    const t = line.trim();
    if (t === '' || /^-{3,}$/.test(t) || /^\*\*.*\*\*\s*$/.test(t)) continue; // 空行/分隔线/元信息
    if (section === 'stem') {
      if (!/^#{1,3}\s/.test(line)) {
        out.stem = out.stem ? `${out.stem}\n${t}` : t;
      }
    } else if (section === 'options') {
      const m = /^\s*([A-D])[\.．、]\s*(.*)$/.exec(t);
      if (m) out.options.push(`${m[1]}. ${m[2].trim()}`);
    } else if (section === 'answer') {
      if (!out.answer) out.answer = t;
    } else if (section === 'analysis') {
      out.analysis = out.analysis ? `${out.analysis}\n${t}` : t;
    }
  }
  out.stem = out.stem.trim();
  out.answer = out.answer.trim();
  out.analysis = out.analysis.trim();
  return out;
}

/**
 * question-bank 目录 (含 metadata.json) → 统一 record; 返回 null 若 content 是 undefined/缺 stem.
 */
export function qbDirToRecord(dirPath, { subject, year }) {
  const metaPath = `${dirPath}/metadata.json`;
  const mdPath = `${dirPath}/content.md`;
  if (!fs.existsSync(metaPath) || !fs.existsSync(mdPath)) return null;
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  if (!md || md.includes('undefined')) return null;
  const { stem, options, answer, analysis } = parseQbContentMd(md);
  if (!stem) return null;
  const { type, changed: typeChanged } = normalizeQuestionType(meta.question_type);
  return {
    source: 'question-bank',
    sourceFile: mdPath,
    subject,
    year,
    province: 'beijing',
    level: 'gaokao',
    qn: Number.parseInt(meta.question_number, 10) || null,
    type,
    typeChanged,
    stem,
    options: options.length ? options : null,
    answer: answer || null,
    analysis: analysis || null,
    kpTags: Array.isArray(meta.knowledge_points) ? meta.knowledge_points.filter(Boolean) : [],
    difficulty: parseDifficulty(meta.difficulty),
    score: parseScore(meta.score),
    hasImage: Boolean(meta.has_image) || /!\[.*\]\(/.test(md),
    srcId: meta.uid ?? null,
    srcUid: meta.uid || null,
    uid: meta.uid || null,
    imageCount: meta.image_count ?? 0,
  };
}

export function loadParsedFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const base = filePath.split('/').pop();
  const subject = base.split('_')[0];
  const year = Number.parseInt(/(\d{4})/.exec(base)?.[1] ?? '0', 10);
  return {
    subject,
    year,
    metadata: data.metadata ?? {},
    paperInfo: data.paper_info ?? {},
    questions: data.questions ?? [],
  };
}
