#!/usr/bin/env node
// scripts/td-005/phase3-reextract-stems.mjs
// TD-005 Phase 3 Step 2: 完整题干重提取
//
// 目标: 对 exam_questions 中 stem 残缺的题目, 从 docx 重新提取题干
//   - 残缺判定: stem 为空/纯数字/卷头说明/单字符
//   - docx 定位: paper_id → exam_papers.paper_uid → incoming/{subject}/{year}/ 文件
//   - 题块切分: 正则 ^(\d+)\s*[.、．] 匹配题号
//   - 健康度对比: 新 stem 比旧 stem 长 + 通过 HEALTHY 校验才 UPDATE
//   - 单事务批量 UPDATE, 幂等 (重复运行不会二次破坏)
//
// 用法:
//   node scripts/td-005/phase3-reextract-stems.mjs --dry-run         # 0 风险验证
//   node scripts/td-005/phase3-reextract-stems.mjs --dry-run --limit 200   # 限制处理数量
//   node scripts/td-005/phase3-reextract-stems.mjs --commit         # 真实写入
//
// 验收标准 (TD-005 §5 Phase 3):
//   抽样 100 题, 与源 docx 对比, 题干可读率 ≥ 95%

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mammoth from 'mammoth';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'td-005-phase3-reextract';
const TIMESTAMP = new Date().toISOString();
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10);
  return null;
})();
const OFFSET = (() => {
  const i = args.indexOf('--offset');
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10);
  return 0;
})();

// ─── DB ───────────────────────────────────────────────────
function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[phase3] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── Province 映射 ────────────────────────────────────────
const PROVINCE_ZH = {
  beijing: '北京', shanghai: '上海', tianjin: '天津', chongqing: '重庆',
  hebei: '河北', shanxi: '山西', liaoning: '辽宁', jilin: '吉林',
  heilongjiang: '黑龙江', jiangsu: '江苏', zhejiang: '浙江', anhui: '安徽',
  fujian: '福建', jiangxi: '江西', shandong: '山东', henan: '河南',
  hubei: '湖北', hunan: '湖南', guangdong: '广东', hainan: '海南',
  sichuan: '四川', guizhou: '贵州', yunnan: '云南', shaanxi: '陕西',
  gansu: '甘肃', qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆',
  neimenggu: '内蒙古', guangxi: '广西', xizang: '西藏',
  national: '全国', national_i: '全国I', national_ii: '全国II', national_iii: '全国III'
};

function parsePaperUid(uid) {
  if (!uid) return null;
  // 格式: {subject}_{year}_{province}_gaokao 或 {subject}_{year}_{province}
  const m = uid.match(/_(\d{4})_([a-z_]+?)(?:_gaokao)?$/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), province: m[2], zh: PROVINCE_ZH[m[2]] || m[2] };
}

// 在目录内找匹配文件 (按 province 中文名 + 原卷/解析/...)
function findDocxInDir(dir, provInfo) {
  let files;
  try { files = fs.readdirSync(dir); } catch { return null; }
  const candidates = [];
  for (const f of files) {
    if (!/\.(docx?|pdf)$/i.test(f)) continue;
    let score = 0;
    if (provInfo?.zh && f.includes(provInfo.zh)) score += 10;
    if (provInfo?.year && f.includes(String(provInfo.year))) score += 2;
    if (f.includes('解析')) score += 3;
    else if (f.includes('原卷')) score += 1;
    if (score > 0) candidates.push({ file: f, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.file || null;
}

// ─── docx 解析: 题块切分 ────────────────────────────────
function splitQuestions(rawText) {
  // 切分点: 行首题号 (Arabic + . / 、 / .)
  // 例: "1. 题干" / "12 已知..." / "16. （1）..."
  // 题号正则: 1-2 位数字 + 分隔符 + 后续必须是中文/字母 (排除 30.14 这类数据值误匹配)
  const re = /^\s*(\d{1,2})[.、．]\s*([^\d.．\s])/gm;
  const blocks = [];
  const matches = [];
  let m;
  while ((m = re.exec(rawText)) !== null) {
    matches.push({ num: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const text = rawText.slice(cur.start, next ? next.start : rawText.length).trim();
    blocks.push({ num: cur.num, text });
  }
  return blocks;
}

// 从题块中提取 stem (题干 + 选项, 去掉 【答案】【解析】等尾部)
function extractStem(blockText) {
  // 切断点优先级:
  //   1. 【答案】 → 之前的全是题干
  //   2. 【解析】 → 之前的全是题干
  //   3. 选项 A. B. C. D. 全空 (LaTeX 抽空) → 保留整段题干
  //   4. 段落结束
  let endPos = blockText.length;
  // 1. 【答案】
  const answerMatch = blockText.match(/【答案】/);
  if (answerMatch) endPos = Math.min(endPos, answerMatch.index);
  // 2. 【解析】
  const analysisMatch = blockText.match(/【解析】/);
  if (analysisMatch) endPos = Math.min(endPos, analysisMatch.index);
  // 3. 【分析】 (有时出现在【解析】前)
  const analyzeMatch = blockText.match(/【分析】/);
  if (analyzeMatch) endPos = Math.min(endPos, analyzeMatch.index);

  const stem = blockText.slice(0, endPos).trim();

  // 4. 清理: 移除卷头说明 (理论上 splitQuestions 已经切到题号, 但要保险)
  return stem;
}

// ─── 健康度评估 ─────────────────────────────────────────
const HEADER_PATTERNS = [
  /^本试卷/, /^考试结束后/, /^考生注意/, /^第[IVX]+页/, /答题卡/,
  /^准考证/, /^姓名[：:]/, /^\d+\s*$/
];
const MOJIBAKE = /[\uFFFD\u0000-\u0008\u000B-\u001F]/;

function isHealthyStem(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 8) return false;             // 太短
  if (/^\d+\s*$/.test(t)) return false;         // 纯数字
  if (/^[\uFFFD\s]+$/.test(t)) return false;    // 全乱码/空格
  if (MOJIBAKE.test(t)) return false;            // 包含控制字符
  for (const re of HEADER_PATTERNS) {
    if (re.test(t)) return false;                // 卷头说明
  }
  return true;
}

// 判断 DB 中 stem 是否残缺 (需要重提取)
function isStemBroken(stem) {
  if (stem === null || stem === undefined) return true;
  const t = String(stem).trim();
  if (t.length === 0) return true;
  if (t.length < 5) return true;                          // 太短
  if (/^\d+\s*$/.test(t)) return true;                    // 纯数字
  if (/^[\uFFFD\s]+$/.test(t)) return true;               // 全乱码
  for (const re of HEADER_PATTERNS) {
    if (re.test(t)) return true;                           // 卷头说明
  }
  return false;
}

// docx 解析缓存 (同一 docx 不重复解析)
const docxCache = new Map();

async function parseDocxOnce(absPath) {
  if (docxCache.has(absPath)) return docxCache.get(absPath);
  try {
    if (!/\.docx?$/i.test(absPath)) {
      docxCache.set(absPath, { error: 'not_docx', blocks: [] });
      return docxCache.get(absPath);
    }
    const r = await mammoth.extractRawText({ path: absPath });
    const text = r.value || '';
    const blocks = splitQuestions(text);
    docxCache.set(absPath, { text, blocks, error: null });
  } catch (e) {
    docxCache.set(absPath, { error: e.message, blocks: [] });
  }
  return docxCache.get(absPath);
}

// 找到题目在 docx 中的对应 block
function findBlockForQuestion(blocks, questionNumber) {
  if (!questionNumber) return null;
  const qn = Number(questionNumber);
  return blocks.find(b => b.num === qn) || null;
}

// ─── 主流程 ─────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  TD-005 Phase 3 · 完整题干重提取 · ${TIMESTAMP}`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}` + (LIMIT ? ` · limit=${LIMIT}` : ''));
  console.log('='.repeat(78));

  // 1) 候选池: stem 残缺的题目
  const candRes = await pool.query(`
    SELECT q.id, q.question_uid, q.subject_code, q.stem AS db_stem,
           q.question_number, q.paper_id,
           q.file_path, q.has_image, q.has_formula,
           p.paper_uid, p.year AS paper_year
    FROM exam_questions q
    LEFT JOIN exam_papers p ON p.id = q.paper_id
    WHERE q.file_path IS NOT NULL
      AND q.file_path NOT LIKE 'parsed:%'
      AND q.file_path LIKE 'database/%'
      AND (
        q.stem IS NULL
        OR LENGTH(TRIM(q.stem)) < 5
        OR q.stem ~ '^[0-9]+\s*$'
        OR LEFT(TRIM(q.stem), 80) LIKE '考试结束后%'
        OR LEFT(TRIM(q.stem), 80) LIKE '本试卷%'
        OR LEFT(TRIM(q.stem), 80) LIKE '考生注意%'
        OR LEFT(TRIM(q.stem), 80) LIKE '在答题卡上作答%'
        OR LEFT(TRIM(q.stem), 80) LIKE '本大题%'
        OR LEFT(TRIM(q.stem), 30) ~ '^[0-9]+\s*[、,]\s*[0-9]'
        OR LEFT(TRIM(q.stem), 30) ~ '^[一二三四五六七八九十]+\s*[、]'
      )
    ORDER BY q.paper_id, q.question_number
    ${LIMIT ? `LIMIT ${LIMIT} OFFSET ${OFFSET}` : ''}
  `);
  const candidates = candRes.rows;
  console.log(`\n[1] 候选题目: ${candidates.length} 题`);

  if (candidates.length === 0) {
    console.log('  无需重提取 (所有 stem 健康)');
    await pool.end();
    return;
  }

  // 2) 按 paper_id 分组 (同一试卷共享 docx 解析)
  const byPaper = new Map();
  for (const q of candidates) {
    const pid = q.paper_id;
    if (!byPaper.has(pid)) byPaper.set(pid, []);
    byPaper.get(pid).push(q);
  }
  console.log(`[2] 涉及试卷: ${byPaper.size} 张`);

  // 3) 对每张试卷: 找 docx → 解析 → 对每题定位 block
  const updates = [];           // 待写入
  const skipped = [];            // 跳过原因
  const noDocx = [];             // 找不到 docx
  const noBlock = [];            // docx 中找不到对应题号
  const noImprovement = [];      // 新 stem 没比旧的好

  let dirMissing = 0;
  let parseError = 0;
  let pdfSkip = 0;

  for (const [pid, qs] of byPaper) {
    const sampleQ = qs[0];
    const dir = path.join(ROOT, sampleQ.file_path || '');
    if (!fs.existsSync(dir)) {
      dirMissing++;
      for (const q of qs) noDocx.push({ question_id: q.id, reason: 'dir_missing', file_path: sampleQ.file_path });
      continue;
    }
    const provInfo = parsePaperUid(sampleQ.paper_uid);
    const matched = findDocxInDir(dir, provInfo);
    if (!matched) {
      for (const q of qs) noDocx.push({ question_id: q.id, reason: 'no_match_file', dir: sampleQ.file_path });
      continue;
    }
    const absFile = path.join(dir, matched);
    if (/\.pdf$/i.test(matched)) {
      pdfSkip++;
      for (const q of qs) noDocx.push({ question_id: q.id, reason: 'pdf_skip', file: matched });
      continue;
    }

    const parsed = await parseDocxOnce(absFile);
    if (parsed.error) {
      parseError++;
      for (const q of qs) noDocx.push({ question_id: q.id, reason: 'extract_error', file: matched, err: parsed.error });
      continue;
    }

    // 4) 对该试卷下每题, 找 block
    for (const q of qs) {
      const block = findBlockForQuestion(parsed.blocks, q.question_number);
      if (!block) {
        noBlock.push({ question_id: q.id, qn: q.question_number, file: matched });
        continue;
      }
      const newStem = extractStem(block.text);
      if (!isHealthyStem(newStem)) {
        skipped.push({ question_id: q.id, qn: q.question_number, reason: 'new_stem_unhealthy', new_stem_preview: newStem.slice(0, 60) });
        continue;
      }
      // 对比新旧
      const oldLen = String(q.db_stem || '').trim().length;
      const newLen = newStem.length;
      if (newLen <= oldLen) {
        noImprovement.push({ question_id: q.id, qn: q.question_number, old_len: oldLen, new_len: newLen, old_stem: String(q.db_stem).slice(0, 40), new_stem: newStem.slice(0, 40) });
        continue;
      }
      updates.push({
        id: q.id,
        question_uid: q.question_uid,
        qn: q.question_number,
        old_stem: q.db_stem,
        new_stem: newStem,
        old_len: oldLen,
        new_len: newLen,
        file: matched
      });
    }
  }

  // 5) 统计
  console.log(`\n[3] 处理结果:`);
  console.log(`  待 UPDATE:     ${updates.length} 题 (${(updates.length / candidates.length * 100).toFixed(1)}%)`);
  console.log(`  新 stem 不健康: ${skipped.length} 题`);
  console.log(`  新不比旧好:    ${noImprovement.length} 题`);
  console.log(`  找不到 docx:   ${noDocx.length} 题 (dir_missing=${dirMissing}, parse_error=${parseError}, pdf_skip=${pdfSkip})`);
  console.log(`  docx 无对应题: ${noBlock.length} 题`);

  if (updates.length > 0) {
    const totalGain = updates.reduce((a, u) => a + (u.new_len - u.old_len), 0);
    const avgGain = (totalGain / updates.length).toFixed(1);
    console.log(`  平均 stem 长度增加: ${avgGain} 字符`);
    console.log(`\n  示例 (前 5 题):`);
    updates.slice(0, 5).forEach(u => {
      console.log(`    [q${u.id}] Q${u.qn}: "${String(u.old_stem).slice(0, 30)}" (${u.old_len}) → "${u.new_stem.slice(0, 50)}" (${u.new_len})`);
    });
  }

  if (!COMMIT) {
    console.log('\n[DRY-RUN] 不写入. 加 --commit 真实写入.');
    writeReport({
      mode: 'dry-run',
      candidates: candidates.length,
      papers: byPaper.size,
      stats: {
        to_update: updates.length,
        new_stem_unhealthy: skipped.length,
        no_improvement: noImprovement.length,
        no_docx: noDocx.length,
        dir_missing: dirMissing,
        parse_error: parseError,
        pdf_skip: pdfSkip,
        no_block: noBlock.length
      },
      updates_preview: updates.slice(0, 20).map(u => ({
        id: u.id, qn: u.qn, old_stem_preview: String(u.old_stem).slice(0, 50),
        new_stem_preview: u.new_stem.slice(0, 80),
        old_len: u.old_len, new_len: u.new_len
      })),
      failures_sample: {
        no_docx: noDocx.slice(0, 10),
        no_block: noBlock.slice(0, 10),
        skipped: skipped.slice(0, 10),
        no_improvement: noImprovement.slice(0, 10)
      }
    });
    await pool.end();
    return;
  }

  // 6) COMMIT: 单事务批量 UPDATE
  console.log('\n[4] COMMIT 开始...');
  const client = await pool.connect();
  let updated = 0;
  const ledgerOps = [];
  try {
    await client.query('BEGIN');

    for (const u of updates) {
      // 算 stem 哈希用于幂等
      const stemHash = crypto.createHash('sha256').update(u.new_stem).digest('hex').slice(0, 16);
      const sql = `
        UPDATE exam_questions
        SET stem = $1, updated_at = NOW()
        WHERE id = $2 AND (stem IS DISTINCT FROM $1)
        RETURNING id
      `;
      const r = await client.query(sql, [u.new_stem, u.id]);
      if (r.rowCount > 0) {
        updated++;
        ledgerOps.push({
          op: 'stem_reextract',
          question_id: u.id,
          question_uid: u.question_uid,
          old_stem_preview: String(u.old_stem).slice(0, 80),
          new_stem_preview: u.new_stem.slice(0, 80),
          old_len: u.old_len,
          new_len: u.new_len,
          source_docx: u.file,
          stem_hash: stemHash,
          run_label: RUN_LABEL,
          ts: TIMESTAMP
        });
      }
    }

    // 写 ledger (qb_recovery.canonical_migration_ledger)
    for (const op of ledgerOps) {
      const beforeSha = crypto.createHash('sha256').update(String(op.old_stem_preview || '')).digest('hex').slice(0, 16);
      const afterSha = op.stem_hash;
      await client.query(`
        INSERT INTO qb_recovery.canonical_migration_ledger
          (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        RUN_LABEL,
        'exam_question.stem',
        op.question_uid,
        op.question_id,
        'stem_reextract',
        beforeSha,
        afterSha,
        JSON.stringify({
          old_stem_preview: op.old_stem_preview,
          new_stem_preview: op.new_stem_preview,
          old_len: op.old_len,
          new_len: op.new_len,
          source_docx: op.source_docx,
          run_label: RUN_LABEL,
          ts: op.ts
        })
      ]);
    }

    await client.query('COMMIT');
    console.log(`  UPDATE 影响行数: ${updated} (实际去重后)`);
    console.log(`  Ledger 写入:     ${ledgerOps.length} 条`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('  ❌ ROLLBACK:', e.message);
    await pool.end();
    process.exit(1);
  } finally {
    client.release();
  }

  writeReport({
    mode: 'commit',
    candidates: candidates.length,
    papers: byPaper.size,
    updated,
    ledger_count: ledgerOps.length,
    stats: {
      to_update: updates.length,
      new_stem_unhealthy: skipped.length,
      no_improvement: noImprovement.length,
      no_docx: noDocx.length,
      dir_missing: dirMissing,
      parse_error: parseError,
      pdf_skip: pdfSkip,
      no_block: noBlock.length
    },
    failures_sample: {
      no_docx: noDocx.slice(0, 10),
      no_block: noBlock.slice(0, 10),
      skipped: skipped.slice(0, 10),
      no_improvement: noImprovement.slice(0, 10)
    }
  });
  console.log('\n报告 → docs/audits/td-005-phase3-reextract-report.json');
  await pool.end();
}

function writeReport(report) {
  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'td-005-phase3-reextract-report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\n报告 → ${path.relative(ROOT, file)}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
