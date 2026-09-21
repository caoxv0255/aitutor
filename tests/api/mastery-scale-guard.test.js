#!/usr/bin/env node
/**
 * tests/api/mastery-scale-guard.test.js — mastery 标度一致性闸门
 *
 * 起因 (2026-09-21, G6): `mastery_score` 长期被两套标度读写，差 100 倍。
 * schema 与多数读取方用 0..100，srs-engine 的 review 路径用 0..1 —— 后者读旧值 60、
 * 加 0.08 后 clamp 到 1，**把掌握度 60 覆写成 1**。这类缺陷不会报错、不会被单测发现
 * (两边各自自洽)，只能靠静态判据拦。
 *
 * 判据（机械可复现）：在这些文件里，凡是与 mastery / 分数变量同现的小数(0.x)或 1.0
 * 字面量，一律可疑 —— 0..100 标度下不应出现它们。
 *
 * 例外必须显式写进 ALLOW，并注明理由；不允许"顺手加一行"绕过。
 *
 * 用法: node tests/api/mastery-scale-guard.test.js   （命中即非零退出）
 */
import fs from 'node:fs';

const FILES = [
  'api/routes/srs-engine.js',
  'api/routes/learning-loop.js',
  'api/modules/knowledge/routes.js',
  'api/handlers/study-plan.js',
  'api/handlers/knowledge-profile.js',
];

/**
 * 显式例外：{ file, match, reason }
 * 每一行都必须说清"为什么 0.x 在这里是合法的"。
 */
const ALLOW = [
  {
    file: 'api/routes/srs-engine.js',
    match: 'Math.min(1, daysOverdue / 7)',
    reason: '逾期天数归一化(overdueFactor)，不是掌握度',
  },
  {
    file: 'api/routes/srs-engine.js',
    match: 'masteryWeight = 1 - (masteryScore / 100)',
    reason: '把 0..100 掌握度归一化为权重；除以 100 本身就是 0..100 标度的证据',
  },
  {
    file: 'api/routes/srs-engine.js',
    match: 'return masteryWeight * 0.6',
    reason: '优先级权重加权(0.6/0.4)，不是掌握度',
  },
  {
    file: 'api/routes/learning-loop.js',
    match: 'clampScore',
    reason: '死代码 processSingleFeedback 的辅助函数，已加警告注释；删除需决策',
  },
  {
    file: 'api/routes/learning-loop.js',
    match: 'CORRECT_WITH_HINT',
    reason: 'DELTA 常量本身是 0..100 单位(15/5/-20)',
  },
  {
    file: 'api/modules/knowledge/routes.js',
    match: 't.mastery < 0.6',
    reason:
      '这是 **API 输出层**：该端点的 by_topic[].mastery / overall 按 0..1 返回（F3 mastery.html 用 overall*100 显示），' +
      '与 DB 标度无关。API 输出层标度不统一已记为 SPEC-DATA G6-b',
  },
];

// 可疑形态：0.x 小数，或 1.0 / Math.min(1, / LEAST(1.0
const SUSPECT = /(\b0\.\d+|\b1\.0\b|Math\.min\(\s*1\s*[,)]|Math\.max\(\s*0\s*,\s*Math\.min\(\s*1\s*,|LEAST\(\s*1\.0|GREATEST\(\s*0\.0)/;
// 只检查与分数相关的行
const RELATED = /mastery|Mastery|clampScore|oldScore|newScore|score\s*[<>=]/;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

const hits = [];
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (COMMENT.test(line)) return;
    if (!RELATED.test(line) || !SUSPECT.test(line)) return;
    const allowed = ALLOW.some((a) => a.file === f && line.includes(a.match));
    if (!allowed) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) });
  });
}

if (hits.length) {
  console.error('❌ mastery 标度疑似分裂（应为 0..100，见 docs/spec/SPEC-DATA.md §2.5）：');
  for (const h of hits) console.error(`   ${h.file}:${h.line}  ${h.text}`);
  console.error('\n若确为合法用法，请在 tests/api/mastery-scale-guard.test.js 的 ALLOW 里添加例外并注明理由。');
  process.exit(1);
}

console.log(`✓ mastery 标度一致（检查 ${FILES.length} 个文件，0..100 标度）`);
