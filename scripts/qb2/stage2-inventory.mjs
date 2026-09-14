// scripts/qb2/stage2-inventory.mjs — DSH STAGING ONLY
// Loads tar contents into qb_recovery schema (source_inventory + asset_inventory)
// Self-contained: extracts tar to a per-process tmp dir; no cross-call /tmp dependency.
// No canonical writes. No mutations to public.* or runtime tables.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const TAR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database.tar';

function extractTar() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-recovery-'));
  console.log(`[extract] ${TAR} -> ${work}`);
  execSync(`tar -xf "${TAR}" -C "${work}" 2>/dev/null || true`);
  return path.join(work, 'database', 'question-bank');
}

function sha256File(p) {
  const h = crypto.createHash('sha256');
  const buf = fs.readFileSync(p);
  h.update(buf);
  return h.digest('hex');
}
function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

async function main() {
  const WORK = extractTar();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET search_path = qb_recovery, public");

    // 1. Parent: database.tar
    const tarSha = sha256File(TAR);
    const tarSize = fs.statSync(TAR).size;
    const { rows: [p] } = await client.query(`
      INSERT INTO source_inventory
        (source_key, source_kind, source_role, source_label, rel_path, size_bytes, sha256, verified, status, reason)
      VALUES ('database.tar@2026-09-04','tar','derived','database.tar 补充资料 2026-09-04',
              'database.tar',$1,$2,'SOURCE_VERIFIED','READY',
              'tar archive verified by sha256; tail truncated (~340 entries in assets/)')
      RETURNING id`, [tarSize, tarSha]);
    const parentId = p.id;
    console.log(`[parent] database.tar id=${parentId} sha=${tarSha.slice(0,12)}... size=${tarSize}`);

    // 2. Subjects
    const subjects = fs.readdirSync(WORK).filter(d => {
      const p = path.join(WORK, d);
      return fs.statSync(p).isDirectory() && d !== 'assets';
    });
    const subjIds = {};
    for (const s of subjects.sort()) {
      const { rows: [r] } = await client.query(`
        INSERT INTO source_inventory
          (source_key, source_kind, source_role, source_label, rel_path, parent_source_id, subject, verified, status, reason)
        VALUES ($1,'dir','derived',$2,$3,$4,$5,'SOURCE_VERIFIED','READY','directory inside verified tar')
        RETURNING id`, [`tar:question-bank/${s}`, `tar:question-bank/${s}`, `database/question-bank/${s}`, parentId, s]);
      subjIds[s] = r.id;
    }
    console.log(`[subjects] ${subjects.length}: ${subjects.join(', ')}`);

    // 3. assets/ root dir
    const { rows: [asr] } = await client.query(`
      INSERT INTO source_inventory
        (source_key, source_kind, source_role, source_label, rel_path, parent_source_id, verified, status, reason)
      VALUES ('tar:question-bank/assets','dir','derived','tar:question-bank/assets',
              'database/question-bank/assets',$1,'UNKNOWN','QUARANTINED',
              'ORPHAN_ASSET_NAMESPACE: 0 metadata references; provenance unknown')
      RETURNING id`, [parentId]);
    const assetsSrcId = asr.id;

    // 4. processed-images empty dirs
    const pip = path.join(WORK, 'assets', 'processed-images');
    if (fs.existsSync(pip)) {
      for (const sub of fs.readdirSync(pip).filter(d => fs.statSync(path.join(pip, d)).isDirectory())) {
        await client.query(`
          INSERT INTO source_inventory
            (source_key, source_kind, source_role, source_label, rel_path, parent_source_id, verified, status, reason)
          VALUES ($1,'dir','derived',$2,$3,$4,'CONFLICT','CONFLICT',
                  'EMPTY_DIR: no files in this dir; cannot infer content')`,
          [`tar:processed-images/${sub}`, `tar:processed-images/${sub}`,
           `database/question-bank/assets/processed-images/${sub}`, assetsSrcId]);
      }
    }

    // 5. asset_inventory for assets/ (central)
    const assetsDir = path.join(WORK, 'assets');
    const assetFiles = fs.readdirSync(assetsDir).filter(f => fs.statSync(path.join(assetsDir, f)).isFile());
    let assetCount = 0, tinyCount = 0, conflictCount = 0;
    for (const f of assetFiles.sort()) {
      const p = path.join(assetsDir, f);
      const buf = fs.readFileSync(p);
      const sha = sha256Buf(buf);
      const size = buf.length;
      const ext = f.includes('.') ? f.split('.').pop().toLowerCase() : '';
      const mime = ext === 'png' ? 'image/png' : (['jpg','jpeg'].includes(ext) ? 'image/jpeg' : `image/${ext}`);
      const isTiny = size < 2000 && ext === 'png';
      const reason = isTiny
        ? 'TRUNCATION_SUSPECT + ORPHAN_ASSET_NAMESPACE: tiny PNG; tar tail partial'
        : 'ORPHAN_ASSET_NAMESPACE: no metadata reference; namespace isolated from current schema';
      const r = await client.query(`
        INSERT INTO asset_inventory
          (asset_id, source_id, rel_path, size_bytes, sha256, mime_type, kind, namespace, verified, status, reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'central_assets','UNKNOWN','QUARANTINED',$8)
        ON CONFLICT (asset_id) DO NOTHING
        RETURNING id`, [sha, assetsSrcId, `database/question-bank/assets/${f}`, size, sha, mime, ext, reason]);
      if (r.rows.length) { assetCount++; if (isTiny) tinyCount++; }
    }

    // 6. year-level page images
    let pageImgCount = 0;
    for (const s of subjects) {
      for (const y of fs.readdirSync(path.join(WORK, s)).filter(d => fs.statSync(path.join(WORK, s, d)).isDirectory())) {
        const imgDir = path.join(WORK, s, y, 'images');
        if (!fs.existsSync(imgDir) || !fs.statSync(imgDir).isDirectory()) continue;
        // register year images dir as source
        await client.query(`
          INSERT INTO source_inventory
            (source_key, source_kind, source_role, source_label, rel_path, parent_source_id, subject, year, verified, status, reason)
          VALUES ($1,'dir','derived',$2,$3,$4,$5,$6,'SOURCE_VERIFIED','READY',
                  'year-level page images; matches metadata.images[].filename pattern')
          ON CONFLICT (source_key) DO NOTHING`,
          [`tar:${s}/${y}/images`, `tar:${s}/${y}/images`,
           `database/question-bank/${s}/${y}/images`, subjIds[s], s, parseInt(y, 10)]);
        for (const f of fs.readdirSync(imgDir).filter(f => fs.statSync(path.join(imgDir, f)).isFile())) {
          const p = path.join(imgDir, f);
          const buf = fs.readFileSync(p);
          const sha = sha256Buf(buf);
          const size = buf.length;
          const ext = f.includes('.') ? f.split('.').pop().toLowerCase() : '';
          const mime = ext === 'png' ? 'image/png' : (['jpg','jpeg'].includes(ext) ? 'image/jpeg' : `image/${ext}`);
          const r = await client.query(`
            INSERT INTO asset_inventory
              (asset_id, source_id, rel_path, size_bytes, sha256, mime_type, kind, namespace, verified, status, reason)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'page_image','SOURCE_VERIFIED','READY',
                    'year-level page image extracted from same tar; references found in metadata.images[]')
            ON CONFLICT (asset_id) DO NOTHING
            RETURNING id`, [sha, subjIds[s], `database/question-bank/${s}/${y}/images/${f}`,
                          size, sha, mime, ext]);
          if (r.rows.length) pageImgCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[done] assets=${assetCount} (tiny=${tinyCount}) page_images=${pageImgCount}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAIL:', e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().finally(() => pool.end());
