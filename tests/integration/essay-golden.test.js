// tests/integration/essay-golden.test.js — D086 plan §12 L4 Golden E2E
//
// Dual-gate acceptance (P0-3):
//   FEATURE gate:  raw_intrinsic_valid_rate >= 0.95 AND final invariants = 0
//   EXACT-MODEL gate: meta.fallback_used === false AND
//                     normalizeModel(meta.model) === normalizeModel('qwen3-vl-plus')
//
// Fixture gate: tests/fixtures/essay/LICENSE-SYNTHETIC.md + essay-{01,02,03}.jpg present
//
// Run (server must be up with essay routes):
//   PORT=3003 node server.js &
//   BCT_URL=http://localhost:3003 npx vitest run tests/integration/essay-golden.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { countOverlaps } from '../../api/handlers/essay/essayReconcile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BCT_URL || 'http://localhost:3003';
const FIXTURE_DIR = resolve(__dirname, '../fixtures/essay');
const ESSAYS = ['essay-01.jpg', 'essay-02.jpg', 'essay-03.jpg'];
// Model under test — must match PROMPTS.ESSAY_GRADING.model on the server.
// Probe (D086-DP02): ESSAY_MODEL=qwen-vl-max → asserts requested=qwen-vl-max.
const EXPECTED_MODEL = process.env.EXPECTED_ESSAY_MODEL || 'qwen3-vl-plus';

function normalizeModel(m) {
  if (typeof m !== 'string') return '';
  return m.replace(/-\d{4}(-([a-z0-9-]+))?$/i, '');
}

describe('Essay Golden Sample — synthetic fixtures (P0 fixture gate)', () => {
  it('fixture gate: LICENSE-SYNTHETIC.md + 3 essays present', () => {
    expect(fs.existsSync(resolve(FIXTURE_DIR, 'LICENSE-SYNTHETIC.md'))).toBe(true);
    for (const f of ESSAYS) {
      expect(fs.existsSync(resolve(FIXTURE_DIR, f))).toBe(true);
    }
  });
});

describe('Essay Golden Sample — dual-gate E2E', () => {
  let token = null;

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) {
      const j = await res.json();
      token = j.data?.token || j.token;
    }
    if (!token) {
      throw new Error('guest login failed — server must expose /api/auth/guest');
    }
  });

  for (const f of ESSAYS) {
    it(`${f}: FEATURE gate (raw_intrinsic_valid_rate >= 0.95) + EXACT-MODEL gate (fallback_used=false)`,
      { timeout: 120_000 },
      async () => {
      const b64 = readFileSync(resolve(FIXTURE_DIR, f)).toString('base64');
      const res = await fetch(`${BASE}/api/essay/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          images: [`data:image/jpeg;base64,${b64}`],
          essay_title: '合成测试作文',
          exam_level: 'gaokao',
          grade: '高三',
        }),
      });
      const j = await res.json();
      expect(j.success, `grade should succeed: ${j.message || ''}`).toBe(true);

      const meta = j.data.data.meta;
      const annotations = j.data.data.annotations;
      const transcript = j.data.data.transcript;

      // === FEATURE gate (DP03): anchor_rate >= 0.95 ===
      const metrics = meta.metrics;
      expect(metrics).toBeDefined();
      expect(metrics.raw_count).toBeGreaterThan(0);
      console.log(`\n[${f}] metrics:`, JSON.stringify(metrics));
      expect(metrics.anchor_rate).toBeGreaterThanOrEqual(0.95);

      // final invariants (post-anchor): 0 overlap / 0 cross-pid / 0 bad slice / 0 unresolved pid
      expect(countOverlaps(annotations)).toBe(0);
      let unresolved = 0, badSlice = 0;
      for (const a of annotations) {
        const p = transcript.paragraphs.find(p => p.id === a.paragraph_id);
        if (!p) { unresolved++; continue; }
        // anchored annotations must have deterministic integer offsets that slice-match
        expect(Number.isInteger(a.start)).toBe(true);
        expect(Number.isInteger(a.end)).toBe(true);
        if (p.text.slice(a.start, a.end) !== a.original) badSlice++;
      }
      expect(unresolved).toBe(0);
      expect(badSlice).toBe(0);
      // Every surviving annotation must have been anchored (structural-valid + verbatim-found)
      expect(metrics.anchor_success_count).toBe(metrics.final_valid_count);

      // === EXACT-MODEL gate (P0-3) ===
      expect(meta.requested_model).toBe(EXPECTED_MODEL);
      expect(meta.fallback_used).toBe(false);
      expect(normalizeModel(meta.model)).toBe(normalizeModel(EXPECTED_MODEL));

      // report persisted (auto-persist NEW-2)
      expect(j.data.reportId).toBeTruthy();
      expect(typeof String(j.data.reportId)).toBe('string');
      console.log(`[${f}] PASS: reportId=${j.data.reportId} confidence=${meta.confidence} model=${meta.model}`);
      });
    }
});