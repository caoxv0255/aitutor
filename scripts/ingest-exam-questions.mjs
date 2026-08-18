#!/usr/bin/env node
/**
 * ingest-exam-questions.mjs — 批量灌入 parsed-examples/*.json → exam_questions
 *
 * 特性:
 * - 增量 upsert (ON CONFLICT (question_uid) DO UPDATE)
 * - 自动生成 question_uid (parsed 数据中 uid 字段为空)
 * - 限制最大题数 (--limit) 防止雪崩
 * - 9 学科 2021-2025 共 ~20,000 题
 *
 * 用法 (在 Docker 容器内):
 *   docker exec aitutor-app-1 node /app/scripts/ingest-exam-questions.mjs [--limit N] [--subject math]
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};
const LIMIT = getArg('--limit') ? parseInt(getArg('--limit')) : Infinity;
const SUBJECT = getArg('--subject');

const SUBJ_MAP = {
  math: 'math', physics: 'physics', chemistry: 'chemistry',
  biology: 'biology', chinese: 'chinese', english: 'english',
  geography: 'geography', history: 'history', politics: 'politics'
};

const PROVINCE_MAP = {
  '北京': 'beijing', '上海': 'shanghai', '天津': 'tianjin', '重庆': 'chongqing',
  '浙江': 'zhejiang', '江苏': 'jiangsu', '山东': 'shandong', '广东': 'guangdong',
  '河北': 'hebei', '河南': 'henan', '湖南': 'hunan', '湖北': 'hubei',
  '辽宁': 'liaoning', '吉林': 'jilin', '黑龙江': 'heilongjiang',
  '陕西': 'shaanxi', '甘肃': 'gansu', '青海': 'qinghai', '宁夏': 'ningxia',
  '新疆': 'xinjiang', '西藏': 'xizang', '云南': 'yunnan', '贵州': 'guizhou',
  '四川': 'sichuan', '广西': 'guangxi', '海南': 'hainan',
  '内蒙古': 'neimenggu', '福建': 'fujian', '安徽': 'anhui', '江西': 'jiangxi',
  '山西': 'shanxi'
};

function provCode(provStr) {
  if (!provStr) return null;
  if (PROVINCE_MAP[provStr]) return PROVINCE_MAP[provStr];
  if (typeof provStr !== 'string') return null;
  if (provStr.startsWith('全国')) return 'national';
  if (provStr.includes('I')) return 'national_i';
  if (provStr.includes('II')) return 'national_ii';
  if (provStr.includes('甲')) return 'national_a';
  if (provStr.includes('乙')) return 'national_b';
  return provStr.toLowerCase().substring(0, 20);
}

// Generate UID using id (parsed data often shares year/province/question_number)
function genUid(q, subject) {
  const id = q.id ?? `${q.year||''}_${q.province||''}_${q.question_number||''}`;
  return `${subject}_${id}_${crypto.createHash('sha1').update(`${subject}|${id}`).digest('hex').slice(0, 8)}`;
}

async function main() {
  console.log('=== exam_questions Batch Ingest ===');
  console.log(`Limit: ${LIMIT === Infinity ? 'all' : LIMIT} | Subject: ${SUBJECT || 'all'}`);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const dataDir = process.env.DATA_DIR || '/tmp/parsed-examples';
  const allFiles = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => !SUBJECT || f.startsWith(SUBJECT + '_'))
    .sort();

  console.log(`Files: ${allFiles.length}`);
  console.log();

  let total = 0, success = 0, skipped = 0, failed = 0;
  const startTime = Date.now();

  for (const file of allFiles) {
    const filepath = path.join(dataDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch (e) {
      console.error(`  ❌ ${file}: ${e.message}`);
      continue;
    }

    const subject = file.split('_')[0];
    const subjectCode = SUBJ_MAP[subject] || subject;
    const year = parseInt(file.match(/_(\d{4})\.json/)?.[1]) || 2024;

    const questions = data.questions || [];
    if (questions.length === 0) {
      console.log(`  ⏭  ${file}: 0 questions`);
      continue;
    }

    // Generate UIDs for all questions
    const enriched = questions.map(q => ({
      ...q,
      year: q.year || year,
      // Generate UID if empty
      question_uid: q.question_uid || genUid({ ...q, subject }, subject)
    }));

    // Filter out invalid (no stem)
    const valid = enriched.filter(q => q.stem && q.stem.trim().length > 0);
    if (valid.length === 0) {
      console.log(`  ⏭  ${file}: no valid stems`);
      continue;
    }

    // 批量查询已有 UID
    const allUids = valid.map(q => q.question_uid);
    const existingResult = await pool.query(
      `SELECT question_uid FROM exam_questions WHERE question_uid = ANY($1::text[])`,
      [allUids]
    );
    const existingSet = new Set(existingResult.rows.map(r => r.question_uid));
    const toInsert = valid.filter(q => !existingSet.has(q.question_uid));
    skipped += valid.length - toInsert.length;
    total += valid.length;

    if (toInsert.length === 0) {
      console.log(`  ⏭  ${file}: all ${valid.length} already in DB`);
      continue;
    }

    // 限制总题数
    const remaining = LIMIT === Infinity ? toInsert.length : Math.min(toInsert.length, LIMIT - success);
    if (remaining <= 0) break;

    const batch = toInsert.slice(0, remaining);
    const values = [];
    const placeholders = [];
    let p = 1;
    for (const q of batch) {
      values.push(
        q.question_uid,                                                            // question_uid
        null,                                                                       // paper_id
        q.question_number || 1,                                                    // question_number
        q.question_type || 'unknown',                                              // question_type
        q.stem,                                                                     // stem
        Array.isArray(q.options) ? JSON.stringify(q.options) : null,             // options
        q.answer || null,                                                           // answer
        q.analysis || null,                                                         // analysis
        Array.isArray(q.knowledge_points) ? JSON.stringify(q.knowledge_points) : null, // knowledge_points
        Math.max(1, Math.min(5, q.difficulty || 3)),                                  // difficulty (CHECK 1-5)
        typeof q.ability_tags === 'string' && q.ability_tags ? q.ability_tags : null, // ability_tags
        q.score && !isNaN(parseFloat(q.score)) ? parseFloat(q.score) : null,      // score
        subjectCode,                                                                // subject_code
        q.year || 2024,                                                             // year
        provCode(q.province),                                                       // province_code
        q.has_image || false,                                                       // has_image
        q.has_formula || false,                                                     // has_formula
        null,                                                                       // raw_image_path
        typeof q.image_descriptions === 'string' && q.image_descriptions ? q.image_descriptions : null, // image_descriptions
        typeof q.latex_formulas === 'string' && q.latex_formulas ? q.latex_formulas : null,               // latex_formulas
        typeof q.formula_semantics === 'string' && q.formula_semantics ? q.formula_semantics : null      // formula_semantics
      );
      placeholders.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
    }

    try {
      await pool.query(`
        INSERT INTO exam_questions
          (question_uid, paper_id, question_number, question_type, stem, options,
           answer, analysis, knowledge_points, difficulty, ability_tags, score,
           subject_code, year, province_code, has_image, has_formula, raw_image_path,
           image_descriptions, latex_formulas, formula_semantics)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (question_uid) DO UPDATE SET
          stem = EXCLUDED.stem,
          options = EXCLUDED.options,
          answer = EXCLUDED.answer,
          analysis = EXCLUDED.analysis,
          knowledge_points = EXCLUDED.knowledge_points,
          difficulty = EXCLUDED.difficulty,
          score = EXCLUDED.score,
          subject_code = EXCLUDED.subject_code,
          year = EXCLUDED.year,
          province_code = EXCLUDED.province_code,
          updated_at = NOW()
      `, values);
      success += batch.length;
      console.log(`  ✅ ${file}: ${batch.length}/${toInsert.length} (skipped ${valid.length - toInsert.length})`);
    } catch (err) {
      failed += batch.length;
      console.error(`  ❌ ${file}: ${err.message.slice(0, 300)}`);
    }

    if (success >= LIMIT) break;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();
  console.log('╔══════════════════════════════════════╗');
  console.log('║   exam_questions Ingest Complete     ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Total seen:  ${String(total).padStart(6)} 题                  ║`);
  console.log(`║  Success:     ${String(success).padStart(6)} 题                  ║`);
  console.log(`║  Skipped:     ${String(skipped).padStart(6)} 题 (已存在)         ║`);
  console.log(`║  Failed:      ${String(failed).padStart(6)} 题                  ║`);
  console.log(`║  Elapsed:     ${String(elapsed).padStart(6)} 秒                   ║`);
  console.log('╚══════════════════════════════════════╝');

  const stat = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT subject_code) as subjects,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM exam_questions
  `);
  console.log(`\n📊 DB: ${stat.rows[0].total} 题, ${stat.rows[0].subjects} 学科 (${stat.rows[0].min_year}-${stat.rows[0].max_year})`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });