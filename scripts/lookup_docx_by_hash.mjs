#!/usr/bin/env node
/**
 * lookup_docx_by_hash.mjs - 用 sha16 反查 docx 源文件
 *
 * 用法：
 *   node scripts/lookup_docx_by_hash.mjs <sha16>           # 查单个
 *   node scripts/lookup_docx_by_hash.mjs --from-manifest    # 列出 manifest
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DATABASE_DIR = path.join(ROOT, 'database');
const EXTRACTED = path.join(DATABASE_DIR, 'extracted');
const MANIFEST = path.join(EXTRACTED, 'manifest.json');

async function scanForSha(sha16) {
  // 扫描所有 docx/doc 算 sha256，对比前缀
  // 注：这是 O(N) 反查，文件多时慢；建议先看 manifest
  async function walk(d) {
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return []; }
    let hits = [];
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('~$')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'extracted' && d === DATABASE_DIR) continue;
        if (/^output(_|$)/.test(e.name) || e.name === 'node_modules' || e.name === 'kg_exports' || e.name === 'rag_index') continue;
        hits = hits.concat(await walk(p));
      } else if (e.isFile() && /\.(docx|doc)$/i.test(e.name)) {
        const sha = crypto.createHash('sha256').update(p).digest('hex');
        if (sha.startsWith(sha16)) hits.push(p);
      }
    }
    return hits;
  }
  return walk(DATABASE_DIR);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.log('usage: node scripts/lookup_docx_by_hash.mjs <sha16>');
    console.log('       node scripts/lookup_docx_by_hash.mjs --list');
    process.exit(0);
  }
  if (argv[0] === '--list' || argv[0] === '-l') {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
    for (const e of m.slice(0, 30)) {
      console.log(`${e.sha16}  q=${e.questions}  f=${e.formulas}  ${e.paper_id.slice(0, 50)}`);
    }
    console.log(`\n... ${m.length} total. full list in ${MANIFEST}`);
    return;
  }
  const sha16 = argv[0];
  const hits = await scanForSha(sha16);
  if (hits.length === 0) {
    console.log(`not found: ${sha16}`);
    process.exit(1);
  }
  for (const h of hits) {
    console.log(h);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
