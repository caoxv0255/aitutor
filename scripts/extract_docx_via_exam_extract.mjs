#!/usr/bin/env node
/**
 * docx/doc → schema v5 JSON 批量提取（aitutor 端 Node 桥接）
 *
 * 扫描 database/ 下所有 .docx / .doc 源文件，调 exam-extract-v5 包（Python）
 * 抽 schema v5 JSON，落 database/extracted/<paper_id>.json。
 *
 * 用法：
 *   node scripts/extract_docx_via_exam_extract.mjs           # 跑全部
 *   node scripts/extract_docx_via_exam_extract.mjs --limit 5  # 限 5 个做 smoke test
 *   node scripts/extract_docx_via_exam_extract.mjs --workers 4 # 4 并发
 *   node scripts/extract_docx_via_exam_extract.mjs --dry-run  # 只列不出
 *
 * 设计原则：
 * - paper_id 用 relative_path 编码（同省同科不同年份 docx 不会撞 paper_id）
 * - 单 docx 失败 log error 继续，不 break（与 exam-extract-v5 cli._cmd_batch 一致）
 * - 并发可控（默认 4，CPU 不爆）
 * - 输出到 database/extracted/，原 docx 不动
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// === 配置 ===
const DATABASE_DIR = path.join(ROOT, 'database');
const OUTPUT_DIR = path.join(DATABASE_DIR, 'extracted');
// exam-extract-v5 包根（用 PYTHONPATH 模式，避开 pip install -e 的网络依赖）
const EXAM_V5_ROOT = process.env.EXAM_V5_ROOT
  || '/home/cx/exam-extract-v5';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

// === CLI 参数 ===
const argv = process.argv.slice(2);
function getArg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}
function hasFlag(name) {
  return argv.includes(`--${name}`);
}
const LIMIT = parseInt(getArg('limit', '0'), 10);  // 0 = 不限
const WORKERS = parseInt(getArg('workers', '4'), 10);
const DRY_RUN = hasFlag('dry-run');
const ONLY_PATTERN = getArg('only', null);  // 只跑路径匹配的（如 "江苏高考"）

// === 主流程 ===
async function main() {
  console.log(`[extract-via-exam-v5] starting`);
  console.log(`  ROOT: ${ROOT}`);
  console.log(`  EXAM_V5_ROOT: ${EXAM_V5_ROOT}`);
  console.log(`  OUTPUT_DIR: ${OUTPUT_DIR}`);
  console.log(`  WORKERS: ${WORKERS}${LIMIT ? `  LIMIT: ${LIMIT}` : ''}`);

  if (!fs.existsSync(EXAM_V5_ROOT)) {
    console.error(`  ERROR: exam-extract-v5 not found at ${EXAM_V5_ROOT}`);
    console.error(`  set EXAM_V5_ROOT env var or clone it next to this repo`);
    process.exit(2);
  }

  // 1) 扫描 docx / doc
  console.log(`\n[1/3] scanning ${DATABASE_DIR} for .docx / .doc ...`);
  const allDocx = await scanDir(DATABASE_DIR, /\.(docx|doc)$/i);
  console.log(`  found ${allDocx.length} files`);

  // 过滤 only pattern
  let docxList = allDocx;
  if (ONLY_PATTERN) {
    docxList = docxList.filter(p => p.includes(ONLY_PATTERN));
    console.log(`  after --only "${ONLY_PATTERN}": ${docxList.length} files`);
  }

  // 限制数量
  if (LIMIT > 0) {
    docxList = docxList.slice(0, LIMIT);
  }

  // 2) 算 paper_id + 文件名
  const tasks = docxList.map(absPath => {
    const fileName = makeFileName(absPath);
    return {
      absPath,
      relPath: path.relative(DATABASE_DIR, absPath),
      paperId: path.parse(absPath).name,  // docx.stem 作 paper_id
      outPath: path.join(OUTPUT_DIR, fileName),
      fileName,
    };
  });
  console.log(`  ${tasks.length} tasks prepared`);

  // dry-run 只列出
  if (DRY_RUN) {
    console.log(`\n[dry-run] first 5 tasks:`);
    for (const t of tasks.slice(0, 5)) {
      console.log(`  ${t.paperId}  ${t.relPath}`);
    }
    if (tasks.length > 5) console.log(`  ... and ${tasks.length - 5} more`);
    return;
  }

  // 3) 并发跑
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`\n[2/3] extracting ${tasks.length} files (workers=${WORKERS}) ...`);
  const t0 = Date.now();
  const results = await runWithPool(tasks, WORKERS, extractOne);
  const elapsed = (Date.now() - t0) / 1000;

  // 4) 统计
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`\n[3/3] done in ${elapsed.toFixed(1)}s  (${(tasks.length / elapsed).toFixed(2)} files/s)`);
  console.log(`  ok:   ${ok.length}`);
  console.log(`  fail: ${fail.length}`);
  if (fail.length > 0) {
    console.log(`\n  failed files (first 10):`);
    for (const f of fail.slice(0, 10)) {
      console.log(`    ${f.relPath}: ${f.error}`);
    }
  }

  // 退出码：与 cli._cmd_batch 一致
  process.exit(fail.length === 0 ? 0 : 1);
}

async function scanDir(dir, pattern) {
  const out = [];
  // 只跳过自己刚生成的输出目录，不级联到其他子目录里的 extracted/parsed/
  // （aitutor 自己的 textbooks/extracted/ 里也有 docx）
  const SKIP_DIRS = new Set([
    path.resolve(OUTPUT_DIR),                  // 自己的 extracted/
    path.join(ROOT, 'node_modules'),
  ]);
  const SKIP_DIR_PATTERNS = [
    /^output(_|$)/,                            // v1/v2/v3 旧 schema 产物
    /^(kg_exports|rag_index)$/,                // 旧导出目录
  ];
  const FILE_SKIP_PREFIX = '~$';                // Office 临时锁
  async function walk(d) {
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.name.startsWith(FILE_SKIP_PREFIX)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        const resolved = path.resolve(p);
        if ([...SKIP_DIRS].some(s => resolved === s)) continue;
        if (SKIP_DIR_PATTERNS.some(re => re.test(e.name))) continue;
        await walk(p);
      } else if (e.isFile() && pattern.test(e.name)) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out;
}

function makeFileName(absPath) {
  // Linux NAME_MAX=255 bytes（中文 3 bytes/char）。长路径文档必须截断。
  // 用 sha16 (16 hex) 唯一标识 + docx.stem 短前缀（限 80 字符）保证反查可读。
  const stem = path.parse(absPath).name;  // docx.stem
  const sha16 = crypto.createHash('sha256').update(absPath).digest('hex').slice(0, 16);
  // 截 stem 到 80 字符（保守：80 ASCII ~ 80 bytes，80 中文 ~ 240 bytes，+sha16=32 字节）
  const safeStem = stem.length > 80 ? stem.slice(0, 80) : stem;
  return `${safeStem}__${sha16}.json`;
}

async function extractOne(task) {
  const { absPath, outPath, paperId } = task;
  try {
    await execFileP(PYTHON_BIN, [
      '-m', 'exam_extract_v5.cli',
      'extract', absPath,
      '-o', outPath,
      '--paper-id', paperId,
    ], {
      cwd: EXAM_V5_ROOT,
      env: {
        ...process.env,
        PYTHONPATH: path.join(EXAM_V5_ROOT, 'src'),
      },
      maxBuffer: 32 * 1024 * 1024,
      timeout: 60_000,
    });
    return { ...task, ok: true };
  } catch (e) {
    // 完整 traceback（不截断 mtef 之外的行）
    const raw = e.stderr || e.stdout || e.message || 'unknown';
    // 只过滤 mtef DEBUG 噪音，保留真实错误
    const cleaned = raw.split('\n')
      .filter(l => l && !l.includes('(DEBUG)MTEF'))
      .join('\n')
      .trim();
    return { ...task, ok: false, error: cleaned || 'unknown error' };
  }
}

async function runWithPool(items, n, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function runner() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      // 进度（每 50 条一行）
      if ((i + 1) % 50 === 0 || i === items.length - 1) {
        const ok = results.slice(0, i + 1).filter(r => r.ok).length;
        process.stdout.write(`\r  progress: ${i + 1}/${items.length}  (${ok} ok)`);
      }
    }
  }
  await Promise.all(Array.from({ length: n }, runner));
  process.stdout.write('\n');
  return results;
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
