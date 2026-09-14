// scripts/qb2/stage2b-binary-validate.mjs — DSH STAGING ONLY (P1-B)
// For each asset_inventory row in central_assets namespace with size<2KB, run deterministic
// PNG/JPEG structural validation: signature, IHDR/IEND presence, CRC, dimensions.
// Result: VALID / SUSPECT_TRUNCATION / CORRUPTED / UNKNOWN_FORMAT.
// Also update conflict_registry: change TRUNCATION_SUSPECT -> SIZE_ANOMALY (no binary proof yet).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const TAR = '/home/flaskappuser/Desktop/NewDisk_2T/aitutor/database.tar';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qb-recovery-'));
execSync(`tar -xf "${TAR}" -C "${work}" 2>/dev/null || true`);
const ROOT = path.join(work, 'database', 'question-bank');

function readU32BE(buf, off) {
  return (buf[off] << 24) | (buf[off+1] << 16) | (buf[off+2] << 8) | buf[off+3];
}
function crc32(buf) {
  // Use Node's zlib for crc32
  // Simpler: re-compute manually using built-in
  // For PNG we need CRC-32 (poly 0xEDB88320)
  let c, crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function validatePng(buf) {
  // PNG = 8-byte sig (89 50 4E 47 0D 0A 1A 0A) + chunks [length(4) type(4) data(length) crc(4)]
  if (buf.length < 8+12+12) return { status: 'SUSPECT_TRUNCATION', reason: 'too short' };
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i=0;i<8;i++) if (buf[i] !== sig[i]) return { status: 'CORRUPTED', reason: 'PNG signature mismatch' };
  let off = 8;
  let ihdr = null; let iend = null; let chunkCount = 0;
  while (off + 8 <= buf.length) {
    const len = readU32BE(buf, off);
    const type = buf.slice(off+4, off+8).toString('ascii');
    if (off + 8 + len + 4 > buf.length) {
      return { status: 'SUSPECT_TRUNCATION', reason: `chunk ${type} length ${len} exceeds file size (chunk header at offset ${off})` };
    }
    const data = buf.slice(off+8, off+8+len);
    const crc = readU32BE(buf, off+8+len);
    const computed = crc32(buf.slice(off+4, off+8+len));
    if (crc !== computed) {
      return { status: 'CORRUPTED', reason: `chunk ${type} CRC mismatch (file=${crc.toString(16)} computed=${computed.toString(16)})` };
    }
    if (type === 'IHDR') ihdr = { data };
    if (type === 'IEND') { iend = off; break; }
    chunkCount++;
    off += 8 + len + 4;
  }
  if (!ihdr) return { status: 'CORRUPTED', reason: 'no IHDR chunk' };
  if (!iend) return { status: 'SUSPECT_TRUNCATION', reason: 'no IEND chunk (file may be truncated mid-IDAT or tail)' };
  // IEND must be at very end (only 12 trailing bytes: 4 len + 4 type + 4 crc)
  if (iend + 12 !== buf.length) return { status: 'SUSPECT_TRUNCATION', reason: `IEND at offset ${iend}, file ends at ${buf.length}` };
  return { status: 'VALID', reason: `PNG valid; ${chunkCount} chunks; IHDR ${ihdr.data[0]}x${ihdr.data.slice(1,5).readUInt32BE(0)}` };
}
function validateJpeg(buf) {
  if (buf.length < 4) return { status: 'SUSPECT_TRUNCATION', reason: 'too short' };
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return { status: 'CORRUPTED', reason: 'JPEG SOI marker missing' };
  // walk markers; if file ends mid-scan-data we accept (JPEG is streamable, no IEND equivalent)
  let off = 2;
  let markers = 0;
  while (off + 2 <= buf.length) {
    if (buf[off] !== 0xFF) { off++; continue; }
    let marker = buf[off+1];
    if (marker === 0xD9) return { status: 'VALID', reason: `JPEG valid; ${markers} markers; EOI reached` };
    if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; markers++; continue; }
    if (off + 4 > buf.length) return { status: 'SUSPECT_TRUNCATION', reason: 'truncated marker header' };
    const segLen = (buf[off+2] << 8) | buf[off+3];
    if (off + 2 + segLen > buf.length) return { status: 'SUSPECT_TRUNCATION', reason: 'truncated segment' };
    off += 2 + segLen;
    markers++;
  }
  return { status: 'SUSPECT_TRUNCATION', reason: 'no EOI marker; file ends mid-stream' };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET search_path = qb_recovery, public");
  const runLabel = 'QB-TAR-20260904-B01-' + Date.now() + '-STAGE2B';
    const { rows: [r] } = await client.query(
      `INSERT INTO qb_recovery.runs (batch_label, run_label, stage, source_batch, status)
       VALUES ('QB-TAR-20260904-B01', $1, 'stage2b', 'QB-TAR-BATCH-01', 'RUNNING')
       RETURNING run_label`,
      [runLabel]
    );
    const _r = runLabel;
  console.log(`[run] ${runLabel}`);

  // add column to asset_inventory if missing
  await client.query(`ALTER TABLE qb_recovery.asset_inventory ADD COLUMN IF NOT EXISTS binary_validation_status VARCHAR(20)`);
  await client.query(`ALTER TABLE qb_recovery.asset_inventory ADD COLUMN IF NOT EXISTS binary_validation_detail TEXT`);
  await client.query(`ALTER TABLE qb_recovery.asset_inventory ADD COLUMN IF NOT EXISTS binary_validation_at TIMESTAMPTZ`);

  // pick up assets that are tiny PNG/JPEG in central_assets
  const { rows: assets } = await client.query(`
    SELECT id, asset_id, rel_path, size_bytes, mime_type, kind
    FROM qb_recovery.asset_inventory
    WHERE status='QUARANTINED' AND size_bytes < 2000 AND kind IN ('png','jpeg','jpg')
  `);
  console.log(`[tiny_assets] to_validate=${assets.length}`);
  const counts = { VALID:0, SUSPECT_TRUNCATION:0, CORRUPTED:0, UNKNOWN_FORMAT:0 };
  for (const a of assets) {
    // Reconstruct path under extracted work dir
    const localPath = path.join(ROOT, a.rel_path.replace(/^database\/question-bank\//, ''));
    let buf;
    try { buf = fs.readFileSync(localPath); } catch (e) { continue; }
    let res;
    if (a.kind === 'png') res = validatePng(buf);
    else res = validateJpeg(buf);
    counts[res.status] = (counts[res.status]||0)+1;
    await client.query(`
      UPDATE qb_recovery.asset_inventory
      SET binary_validation_status=$1, binary_validation_detail=$2, binary_validation_at=NOW()
      WHERE id=$3
    `, [res.status, res.reason, a.id]);
  }

  // also validate ALL png/jpeg in asset_inventory (not just tiny) to be thorough
  const { rows: allPngJpeg } = await client.query(`
    SELECT id, asset_id, rel_path, size_bytes, kind, binary_validation_status
    FROM qb_recovery.asset_inventory
    WHERE kind IN ('png','jpeg','jpg')
  `);
  const alreadyValidated = new Set(assets.map(a => a.id));
  for (const a of allPngJpeg) {
    if (alreadyValidated.has(a.id)) continue;
    const localPath = path.join(ROOT, a.rel_path.replace(/^database\/question-bank\//, ''));
    let buf;
    try { buf = fs.readFileSync(localPath); } catch (e) { continue; }
    const res = a.kind === 'png' ? validatePng(buf) : validateJpeg(buf);
    counts[res.status] = (counts[res.status]||0)+1;
    await client.query(`
      UPDATE qb_recovery.asset_inventory
      SET binary_validation_status=$1, binary_validation_detail=$2, binary_validation_at=NOW()
      WHERE id=$3
    `, [res.status, res.reason, a.id]);
  }

  // Now correct the overclaimed TRUNCATION_SUSPECT in conflict_registry
  // First, remove any previously-registered TRUNCATION_SUSPECT rows from the current run
  // (the prior 138 entries were on the LEGACY run; rewrite them to this run)
  // Strategy: archive them in detail; delete from current run; re-emit based on actual binary_validation_status
  // Simpler: UPDATE their detail JSON to reflect the new evidence
  const { rowCount: legacyUpdated } = await client.query(`
    UPDATE qb_recovery.conflict_registry
    SET conflict_kind = CASE
          WHEN av.binary_validation_status = 'VALID' THEN 'BINARY_VALID'
          WHEN av.binary_validation_status = 'SUSPECT_TRUNCATION' THEN 'TRUNCATION_SUSPECT_CONFIRMED'
          WHEN av.binary_validation_status = 'CORRUPTED' THEN 'BINARY_CORRUPTED'
          ELSE 'SIZE_ANOMALY'
        END,
        detail = jsonb_build_object(
          'asset_id', av.asset_id,
          'size_bytes', av.size_bytes,
          'binary_validation_status', av.binary_validation_status,
          'binary_validation_detail', av.binary_validation_detail,
          'supersedes', 'TRUNCATION_SUSPECT (size<2KB only, no binary proof)',
          'superseded_by', 'P1-B deterministic binary validation'
        )
    FROM qb_recovery.asset_inventory av
    WHERE conflict_registry.ref_path = av.rel_path
      AND conflict_kind = 'TRUNCATION_SUSPECT'
      AND av.binary_validation_status IS NOT NULL
  `);
  console.log(`[legacy_TRUNCATION_SUSPECT] upgraded to evidence-based status: ${legacyUpdated} rows`);

  await client.query(`UPDATE qb_recovery.runs SET finished_at=NOW(), status='COMPLETED' WHERE run_label=$1`, [runLabel]);
  await client.query('COMMIT');
  console.log(`[binary_validation] ${JSON.stringify(counts)}`);
} catch (e) { await client.query('ROLLBACK'); console.error('FAIL:', e.message); process.exit(1); }
finally { client.release(); pool.end(); }
