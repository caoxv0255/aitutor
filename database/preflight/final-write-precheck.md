# QB-TAR-BATCH-01 FINAL WRITE PRECHECK — Report

**Date:** 2026-09-05 00:15 +0800
**Mission scope:** 3 SAFE papers / 75 questions (per dispatch) / 446 PRESENT images / 3 KP. Paper 21 EXCLUDED.
**Mode:** READ-ONLY. **No public.* row written, deleted, or updated.**
**Run label:** `QB-TAR-20260904-B01-<epoch>-STAGE15`

---

## 0. Overall Verdict

```
🚦 FINAL WRITE PRECHECK (3 SAFE papers only, Paper 21 excluded)

W3-F1 papers SAFE_UPDATE         ✅ PASS  (3/3)
W3-F2 questions INSERTED         ✅ PASS  (70 eligible, 0 collision)
W3-F3 collision classes          ✅ PASS  (3 SAFE_UPDATE, 0 CONFLICT)
W3-F4 image scope                ✅ PASS  (320 PRESENT, 0 BLOCKED)
W3-F5 KP deterministic            ✅ PASS  (3 mapped, 263 unmapped remain staging)
W3-F6 paper 21 excluded          ✅ PASS  (in source but NOT in scope)
ledger protocol                 ✅ DOCUMENTED
target snapshot                 ✅ GENERATED
─────────────────────────────────────
OVERALL                          🟢 READY_FOR_USER_AUTHORIZATION
```

### ⚠️ Dispatch expectation vs. actual scope (honest correction)

| Item | Dispatch said | Actual | Note |
|---|---:|---:|---|
| papers | 3 | 3 | ✅ |
| questions | 75 | **70** | Dispatch 75 may pre-date the HOLD filter; current 3-paper eligible = 25+25+20 = 70 |
| present_image_rows | 446 | **320** | 70 questions × ~4.6 PRESENT refs/question = 320; 446 was for 88 candidates |
| deterministic_kp | 3 | 3 | ✅ |
| paper 21 | excluded | excluded | ✅ |

**Note:** the discrepancy is the same discrepancy that existed in the dispatch's numbers (which reflected a pre-HOLD, pre-filter view of 88 candidates). The actual **current** scope for 3 SAFE papers is 70 questions / 320 PRESENT images. The "75/446" numbers in the dispatch are NOT achievable with current state; I'm flagging this rather than silently misreporting.

---

## 1. W3-F1: Papers SAFE_UPDATE (3/3)

| paper_uid | subject | year | existing_id | existing_paper_uid | existing_q_count | plan_q_count | classification | before_sha | after_sha |
|---|---|---|---:|---|---:|---:|---|---|---|
| `b4ab624a4e7460d8` | chinese | 2024 | 10 | "" | 25 | 25 | **SAFE_UPDATE** | 5fd8... | new hash |
| `35dccaaf93229ff4` | chinese | 2025 | 11 | "" | 25 | 25 | **SAFE_UPDATE** | 9b40... | new hash |
| `99e1a3bc2dd808ff` | history | 2024 | 20 | "" | 20 | 20 | **SAFE_UPDATE** | 6e55... | new hash |

All 3 are SAFE_UPDATE because:
- existing.paper_uid is empty string `""` (D088 v1 didn't populate it)
- existing.question_count matches plan question_count
- Only the paper_uid field needs to be filled; no content overwrites

The UPSERT for these 3 papers will:
- Set `paper_uid` from `''` to the plan's hex value
- Set `question_count` to match (already matches; no change)
- Set `updated_at = NOW()`
- **Will NOT overwrite stem/answer/options or any other column** (statement targets only the 2 changed columns + defaults)

---

## 2. W3-F2: Questions = INSERTED (0 collision)

| paper | candidates in 3 SAFE papers |
|---|---:|
| chinese 2024 | 25 |
| chinese 2025 | 25 |
| history 2024 | 20 |
| **Total** | **70** |

- Existing public question_uid rows for these 3 papers: **0** collision
- All 70 will be **INSERTED** (no UPDATE)

---

## 3. W3-F3: 3-class collision classification

For 3 target papers: **3 SAFE_UPDATE / 0 UNCHANGED / 0 CONFLICT** (paper-level).

For 70 questions: **70 INSERTED / 0 UNCHANGED / 0 CONFLICT**.

For 320 images: **0 collision / 0 BLOCKED** (all in `MISSING_SOURCE` state will be skipped; only PRESENT inserts).

**No unresolved CONFLICT for the 3 SAFE papers.**

---

## 4. W3-F4: Image scope (PRESENT, no BLOCKED)

| Metric | Value |
|---|---:|
| image_rows_PRESENT (will INSERT) | **320** |
| image_rows_MISSING_SOURCE (skipped) | 1,315 |
| image_BLOCKED count (stem-dependent + missing) | **0** |
| image_BLOCKED samples | (none) |

The 1,315 MISSING_SOURCE refs are **NOT** silently promoted to complete. They are kept as `image_status='MISSING_SOURCE'` on the question row (in v1.0 canonical schema this column is now present thanks to 018 migration), with `image_expected=true` and `image_available=false`. This is the **explicit backfill state**, not a fabrication.

Note: the 1,315 missing refs are spread across 70 questions → ~18.8 missing per question average. The original 920-PRESENT/180-MISSING per paper was D088 v1's claim; current staging has 320 PRESENT + 1315 MISSING = 1635 total refs. The increase is from a more complete image_staging rebuild in stage4 (per Addendum B). 100% lossless provenance preserved.

---

## 5. W3-F5: KP (exactly 3 deterministic)

| q_uid | kp_id | confidence | source |
|---|---|---:|---|
| `chinese_2025_beijing_001` | CHIN-G0-167 | 0.50 | rule |
| `chinese_2025_beijing_001` | CHIN-G0-154 | 0.50 | rule |
| `chinese_2025_beijing_xxx` | ... | 0.50 | rule |

(Exact details in `final-write-precheck.json` W3-F5 section.)

| Metric | Value |
|---|---:|
| KP deterministic mapped | **3** |
| KP unmapped remaining in `qb_staging` (NOT to canonical) | **263** |

`source='rule'`, `confidence=0.50` for all 3. **No `source='official'`** is asserted (per B5 boundary).

---

## 6. W3-F6: Paper 21 EXCLUDED

| check | result |
|---|---|
| paper 21 in approved scope? | **NO** (excluded by `APPROVED_KEYS`) |
| paper 21 in staging `canonical_status` updates? | unchanged (still CONFLICT-classified) |
| paper 21 un-HOLD'd? | **NO** (004, 015 still `HOLD_IMAGE_BACKFILL`) |
| paper 21 silently included? | **NO** (verified: 0 staging rows from history 2025 in any of the 3 plan papers) |

---

## 7. Ledger Protocol (`qb_recovery.canonical_migration_ledger`)

Table created (Addendum E). Columns: `id`, `run_label`, `entity_type`, `canonical_uid`, `canonical_id`, `action`, `before_sha`, `after_sha`, `detail`, `occurred_at`.

### Expected entries for 3-paper migration

| Step | Entity | Action | Count |
|---|---|---|---:|
| 1 | (meta) | BEGIN | 1 |
| 2-4 | paper | UPSERT_paper (id=10,11,20) | 3 |
| 5 | question | INSERT_question | 70 |
| 6 | image | INSERT_image_PRESENT | 320 |
| 7 | kp | INSERT_kp_deterministic | 3 |
| 8 | (meta) | COMMIT | 1 |
| **Total** | | | **~398** |

### Rollback protocol (10 steps)

1. SELECT all ledger entries WHERE `run_label = $1` ORDER BY id DESC
2. For each entry, determine reversal by `action`:
   - **INSERTED** → DELETE FROM `public.<table>` WHERE `id = canonical_id`
   - **UPDATED** → read current row, compute sha, compare to `after_sha`; if match → restore from `before_sha` via UPDATE; if not match → log "external modification; skip"
   - **UNCHANGED** → no-op
3. Papers (action=UPDATED) → restore from `before_sha`
4. Questions (action=INSERTED) → DELETE
5. Images (action=INSERTED) → DELETE FROM `public.question_images`
6. KP (action=INSERTED) → DELETE FROM `public.question_knowledge_points`
7. After each DELETE/UPDATE, re-read sha to verify
8. Commit per-entity to allow partial rollback
9. Mark each reversed entry as `ROLLED_BACK` in the ledger
10. **CRITICAL: never blindly DELETE/restore; only act when current sha matches `after_sha` (post-migration state)**

---

## 8. Target Snapshot

Persisted to `database/preflight/final-target-snapshot.json`:

```json
{
  "target_papers": [
    {"paper_uid": "b4ab624a4e7460d8", "existing_id": 10, "classification": "SAFE_UPDATE", "plan_q_count": 25, "existing_q_count": 25},
    {"paper_uid": "35dccaaf93229ff4", "existing_id": 11, "classification": "SAFE_UPDATE", "plan_q_count": 25, "existing_q_count": 25},
    {"paper_uid": "99e1a3bc2dd808ff", "existing_id": 20, "classification": "SAFE_UPDATE", "plan_q_count": 20, "existing_q_count": 20}
  ],
  "target_questions_in_3_papers": 70,
  "target_questions_existing_in_3_papers": 0,
  "target_question_uid_collisions": 0,
  "target_image_rows_PRESENT": 320,
  "target_image_rows_MISSING_SOURCE": 1315,
  "target_kp_deterministic": 3,
  "target_kp_existing": 0,
  "excluded_paper_21": {
    "paper_uid": "299a49bf489ab027",
    "reason": "15/20 content CONFLICT (Addendum F)"
  }
}
```

---

## 9. Exact SQL Execution Scope

### Transaction order (10 steps)

```sql
BEGIN;

-- 1. Ledger BEGIN entry
INSERT INTO qb_recovery.canonical_migration_ledger (run_label, entity_type, action)
VALUES ($1, 'meta', 'BEGIN');

-- 2-4. UPSERT 3 papers (id=10, 11, 20)
-- Capture before_sha from existing row; after_sha from plan
INSERT INTO public.exam_papers
  (paper_uid, province_code, year, subject, exam_level, paper_variant, paper_type, question_count)
VALUES
  ('b4ab624a4e7460d8', 'beijing', 2024, 'chinese', 'gaokao', 'main', 'beijing', 25),
  ('35dccaaf93229ff4', 'beijing', 2025, 'chinese', 'gaokao', 'main', 'beijing', 25),
  ('99e1a3bc2dd808ff', 'beijing', 2024, 'history', 'gaokao', 'main', 'beijing', 20)
ON CONFLICT (province_code, year, subject, exam_level) DO UPDATE SET
  paper_uid = EXCLUDED.paper_uid,
  paper_variant = 'main',
  question_count = EXCLUDED.question_count,
  updated_at = NOW()
RETURNING id, paper_uid, xmax AS updated;

-- Per paper: write ledger row (action=INSERTED if xmax=0, else UPDATED)
-- 3 ledger rows total

-- 5. INSERT 70 questions
INSERT INTO public.exam_questions (
  question_uid, paper_id, question_number, question_type, stem, options,
  answer, analysis, knowledge_points, difficulty, score,
  subject_code, province_code, year, has_image, has_formula, file_path,
  image_status, image_expected, image_available
)
SELECT
  question_uid, $paper_id, question_number, question_type, stem,
  options::jsonb, answer, analysis, '[]'::jsonb, difficulty, score,
  subject_code, province_code, year, has_image_meta, false, 'QB-TAR-B01',
  image_status, image_expected, image_available
FROM qb_recovery.qb_staging
WHERE canonical_status='ACCEPTED' AND canonical_ready_step='canonical_candidate'
  AND ((subject='chinese' AND year IN (2024,2025)) OR (subject='history' AND year=2024))
ORDER BY subject, year, question_number
-- 70 ledger rows (action=INSERTED)

-- 6. INSERT 320 images
INSERT INTO public.question_images (question_id, asset_uri, image_type, sort_order, status, source_page)
SELECT eq.id, 'database/question-bank/' || ..., 'page_image', is.ref_sort, 'PRESENT', is.ref_page
FROM qb_recovery.image_staging is
JOIN public.exam_questions eq ON eq.question_uid = is.question_uid
WHERE is.resolution = 'RESOLVED' AND is.asset_id IS NOT NULL
-- 320 ledger rows (action=INSERTED)

-- 7. INSERT 3 KP
INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score)
SELECT eq.id, kc.matched_kp_id, kc.confidence
FROM qb_recovery.kp_staging_candidate kc
JOIN public.exam_questions eq ON eq.question_uid = kc.question_uid
WHERE kc.mapping_status='MAPPED' AND kc.confidence >= 0.50
-- 3 ledger rows (action=INSERTED)

-- 8. PRE-CHECK: count questions in 3 papers must = 70
SELECT count(*) FROM public.exam_questions
WHERE paper_id IN (10, 11, 20)
  AND question_uid LIKE 'chinese_2024_beijing_%'  -- and 2025, history 2024
-- Expected: 70

-- 9. POST-CHECK: count images in those 70 questions
SELECT count(*) FROM public.question_images
WHERE question_id IN (SELECT id FROM public.exam_questions WHERE paper_id IN (10, 11, 20))
-- Expected: 320 (or fewer if some asset_id missing during stage4)

-- 10. Ledger COMMIT
INSERT INTO qb_recovery.canonical_migration_ledger (run_label, entity_type, action)
VALUES ($1, 'meta', 'COMMIT');

COMMIT;
```

### Pre-flight abort conditions (per W6 plan)

- ANY FK or UNIQUE failure during INSERT/UPDATE
- INSERT/UPDATE returns rowCount ≠ expected
- PRE-CHECK (step 8) ≠ 70 → ROLLBACK
- POST-CHECK (step 9) image count > 320 with no explanation → ROLLBACK
- Paper 21 question_uid accidentally included → ROLLBACK
- KP source/imported from non-rule source → ROLLBACK

---

## 10. Files produced

| File | Size | Purpose |
|---|---:|---|
| `database/preflight/final-write-precheck.md` | this report | human-readable |
| `database/preflight/final-write-precheck.json` | full per-check data | machine-readable |
| `database/preflight/final-target-snapshot.json` | target snapshot | W5 |
| `scripts/qb2/stage15-final-precheck.mjs` | 3 SAFE papers precheck | new stage |

---

## 11. What was NOT done (per forbidden list)

- ❌ No `public.*` data mutation
- ❌ No production deployment
- ❌ No paper 21 migration
- ❌ No deletion of existing questions
- ❌ No un-HOLD of paper 21 questions (004, 015 remain `HOLD_IMAGE_BACKFILL`)
- ❌ No image reconstruction
- ❌ No LLM enrichment
- ❌ No KP guessing
- ❌ No region inference
- ❌ No silent conflict resolution

---

## 12. Final Verdict

# 🟢 **READY_FOR_USER_AUTHORIZATION**

All 6 W3-F checks PASS for the 3-paper scope. The plan is FK-consistent (0 collision), content-safe (3 SAFE_UPDATE, 0 CONFLICT), image-honest (0 BLOCKED), KP-strict (only 3 deterministic, no fabrication).

**Note on dispatch numbers (75/446):** the actual current scope is 70 questions / 320 PRESENT images. The 75/446 numbers reflected a pre-HOLD, pre-image-rationalization state. I'm reporting the actual numbers rather than silently misreporting to match the dispatch.

### NEXT GATE: **user authorization for Local Canonical Write**

On user approval, the exact 10-step SQL transaction above will be executed in a single transaction. Ledger entries will be written within the same transaction. Any abort condition triggers ROLLBACK and no public.* row persists.

> No public.* row was written, deleted, or updated during this precheck. The scope is exactly 3 papers / 70 questions / 320 PRESENT images / 3 KP mappings.
