// scripts/qb2/stage3-schema-audit.mjs — DSH STAGING ONLY (REPAIR v2)
// 296 qdirs -> qb_staging with P0-2/P1-A status split
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const TAR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database.tar';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-recovery-'));
execSync(`tar -xf "${TAR}" -C "${work}" 2>/dev/null || true`);
const ROOT = path.join(work, 'database', 'question-bank');
const REPO = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/question-bank';

function shaFile(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function parseQbContentMd(md) {
  const out = { stem: '', options: [], answer: '', analysis: '' };
  if (!md) return out;
  let section = null;
  for (const line of md.split('\n')) {
    const h = /^#{2,3}\s*(.+?)\s*#*$/.exec(line.trim());
    if (h) { section = ({ 题目内容:'stem', 题目:'stem', 题干:'stem', 选项:'options', 参考答案:'answer', 参考解析:'analysis', 解析:'analysis' })[h[1].trim()] || null; continue; }
    if (!section) continue;
    const t = line.trim();
    if (!t || /^-+$/.test(t) || /^\*\*.*\*\*\s*$/.test(t)) continue;
    if (section === 'stem') out.stem = out.stem ? `${out.stem}\n${t}` : t;
    else if (section === 'options') { const m = /^\s*([A-D])[\.．、]\s*(.*)$/.exec(t); if (m) out.options.push(`${m[1]}. ${m[2].trim()}`); }
    else if (section === 'answer') { if (!out.answer) out.answer = t; }
    else if (section === 'analysis') out.analysis = out.analysis ? `${out.analysis}\n${t}` : t;
  }
  out.stem = out.stem.trim(); out.answer = out.answer.trim(); out.analysis = out.analysis.trim();
  return out;
}

const UID_PATTERN = /^[a-z]+_\d{4}_[a-z0-9_]+_\d{1,3}$/;
function classifyIdentity(uid, subject, year) {
  if (!uid || !UID_PATTERN.test(uid)) return 'UNKNOWN';
  const m = /^([a-z]+)_(\d{4})_([a-z0-9_]+)_(\d{1,3})$/.exec(uid);
  if (!m) return 'UNKNOWN';
  const [, su, sy, ,] = m;
  if (su !== subject || Number(sy) !== year) return 'AMBIGUOUS';
  return 'ESTABLISHED';
}

function classifyContent(stem, answer, analysis, opts, qType) {
  const stemS = String(stem || '').trim();
  if (!stemS) return 'UNDEFINED';
  if (stemS === 'undefined' || stemS.toLowerCase() === 'undefined') return 'UNDEFINED';
  if (/\uFFFD/.test(stemS)) return 'CORRUPTED';
  if (/^[A-D][\.．、]/.test(stemS) && !/[\u4e00-\u9fff]/.test(stemS)) return 'CORRUPTED';
  if (/(（\s*）|（\s+）|\(\s*\))/.test(stemS) && (stemS.match(/[\u4e00-\u9fff]/g) || []).length < 8) return 'CORRUPTED';
  const isChoice = qType === 'choice' || qType === 'multi_choice';
  const optsValid = !isChoice || (Array.isArray(opts) && opts.length >= 2 && !opts.every(o => /^[A-D][\.．、]?\s*$/.test(String(o).trim())));
  const answerOk = answer && answer !== 'undefined' && !['答案内容','见解析','待补充'].includes(answer);
  const analysisOk = analysis && analysis !== 'undefined' && analysis !== '解析内容';
  if (optsValid && answerOk && analysisOk) return 'COMPLETE';
  return 'INCOMPLETE';
}

function classifyCanonical(identity, content) {
  if (identity === 'UNKNOWN' || content === 'UNDEFINED' || content === 'CORRUPTED') return 'REJECTED';
  if (identity === 'AMBIGUOUS' || content === 'INCOMPLETE') return 'REVIEW_REQUIRED';
  return 'ACCEPTED';
}

function readyStep(rec) {
  if (rec.identity_status === 'UNKNOWN' || ['UNDEFINED','CORRUPTED'].includes(rec.content_status_split)) return null;
  if (rec.options_format === 'labels_only' || rec.options_format === 'malformed') return 'schema_valid';
  if (rec.content_status_split !== 'COMPLETE') return 'content_complete';
  if (!rec.content_matches_repo) return 'provenance_valid';
  return 'canonical_candidate';
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET search_path = qb_recovery, public");
    const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE3';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage3', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;
    console.log(`[run] ${runLabel}`);

    await client.query('TRUNCATE qb_recovery.qb_staging, qb_recovery.image_staging, qb_recovery.kp_staging_candidate RESTART IDENTITY CASCADE');
    const { rows: srcs } = await client.query(`SELECT id, rel_path FROM qb_recovery.source_inventory WHERE source_kind IN ('dir','derived')`);
    const sourceByRel = new Map(srcs.map(r => [r.rel_path, r.id]));

    const subjects = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT,d)).isDirectory() && d !== 'assets');
    let count = 0, stats = { identity: {}, content: {}, canonical: {}, ready_step: {} };
    for (const s of subjects) {
      for (const y of fs.readdirSync(path.join(ROOT,s)).filter(d => fs.statSync(path.join(ROOT,s,d)).isDirectory())) {
        for (const q of fs.readdirSync(path.join(ROOT,s,y)).filter(d => fs.statSync(path.join(ROOT,s,y,d)).isDirectory())) {
          const dir = path.join(ROOT, s, y, q);
          const mp = path.join(dir, 'metadata.json');
          const cp = path.join(dir, 'content.md');
          if (!fs.existsSync(mp) && !fs.existsSync(cp)) continue;
          let meta = null, parsed = { stem: '', options: [], answer: '', analysis: '' };
          try { meta = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch {}
          try { parsed = parseQbContentMd(fs.readFileSync(cp, 'utf8')); } catch {}
          const repoFile = path.join(REPO, s, y, q, 'content.md');
          const matchesRepo = fs.existsSync(repoFile) ? shaFile(cp) === shaFile(repoFile) : false;

          const identity_status = classifyIdentity(meta?.uid, s, parseInt(y,10));
          const content_status_split = classifyContent(parsed.stem, parsed.answer, parsed.analysis, parsed.options, meta?.question_type);
          const opts = parsed.options;
          const isEmptyOpts = !Array.isArray(opts) || opts.length === 0;
          const optsLabelOnly = !isEmptyOpts && opts.every(o => /^[A-D][\.．、]?\s*$/.test(String(o).trim()));
          const optsDup = !isEmptyOpts && opts.some(o => /^[A-D][\.．、]\s*[A-D][\.．、]/.test(String(o).trim()));
          const options_format = isEmptyOpts ? 'empty' : (optsLabelOnly ? 'labels_only' : 'array');
          const options_defect = optsLabelOnly ? 'labels_only_empty' : (optsDup ? 'duplicate_label_prefix' : null);
          const answer_status = !parsed.answer || parsed.answer.toLowerCase() === 'undefined' ? 'MISSING'
                              : ['答案内容','见解析','待补充'].includes(parsed.answer) ? 'PLACEHOLDER' : 'SOURCE_DERIVED';
          const analysis_status = !parsed.analysis || parsed.analysis.toLowerCase() === 'undefined' ? 'MISSING'
                                  : parsed.analysis === '解析内容' ? 'PLACEHOLDER' : 'SOURCE_DERIVED';
          const stem_status = parsed.stem === 'undefined' || (parsed.stem||'').toLowerCase() === 'undefined' ? 'UNDEFINED'
                             : parsed.stem === '' ? 'EMPTY'
                             : /\uFFFD/.test(parsed.stem) ? 'MOJIBAKE'
                             : content_status_split === 'CORRUPTED' ? 'CORRUPTED'
                             : 'OK';

          const canonical_status = classifyCanonical(identity_status, content_status_split);
          const subjRel = `database/question-bank/${s}`;
          const srcId = sourceByRel.get(subjRel) || null;
          const rec = {
            stem_status, options_format, options_defect, answer_status, analysis_status,
            matchesRepo, identity_status, content_status_split, canonical_status,
          };
          rec.canonical_ready_step = readyStep({
            ...rec, options_format, content_matches_repo: matchesRepo,
            identity_status, content_status_split,
          });

          await client.query(`
            INSERT INTO qb_staging
              (source_id, rel_path, question_uid, subject, year, province_code, exam_level, question_number,
               question_type_raw, stem_text, stem_status,
               options_raw, options_structured, options_format, options_defect,
               answer_raw, answer_status, analysis_raw, analysis_status,
               has_image_meta, image_count_meta, images_raw, knowledge_points_raw,
               raw_sha256, raw_content_sha256, content_matches_repo, content_status,
               identity_status, content_status_split, canonical_status, canonical_ready_step)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
          `, [srcId, `database/question-bank/${s}/${y}/${q}`, meta?.uid || null, s, parseInt(y,10), meta?.province || 'beijing', meta?.exam_level || 'gaokao', parseInt(q,10) || null,
               meta?.question_type, parsed.stem, rec.stem_status,
               JSON.stringify(parsed.options), null, rec.options_format, rec.options_defect,
               parsed.answer, rec.answer_status, parsed.analysis, rec.analysis_status,
               Boolean(meta?.has_image), meta?.image_count || 0, JSON.stringify(meta?.images || []), JSON.stringify(meta?.knowledge_points || []),
               fs.existsSync(mp) ? shaFile(mp) : null, fs.existsSync(cp) ? shaFile(cp) : null, matchesRepo, rec.stem_status === 'OK' ? 'OK' : (rec.stem_status === 'UNDEFINED' ? 'UNDEFINED' : 'MALFORMED'),
               rec.identity_status, rec.content_status_split, rec.canonical_status, rec.canonical_ready_step]);
          count++;
          stats.identity[identity_status] = (stats.identity[identity_status]||0)+1;
          stats.content[content_status_split] = (stats.content[content_status_split]||0)+1;
          stats.canonical[canonical_status] = (stats.canonical[canonical_status]||0)+1;
          stats.ready_step[rec.canonical_ready_step || 'rejected'] = (stats.ready_step[rec.canonical_ready_step || 'rejected']||0)+1;
        }
      }
    }
    await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
    await client.query('COMMIT');
    console.log(`[stage3] count=${count}`);
    console.log(`  identity_status:        ${JSON.stringify(stats.identity)}`);
    console.log(`  content_status_split:   ${JSON.stringify(stats.content)}`);
    console.log(`  canonical_status:       ${JSON.stringify(stats.canonical)}`);
    console.log(`  canonical_ready_step:   ${JSON.stringify(stats.ready_step)}`);
  } catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
  finally { client.release(); pool.end(); }
}

main();
