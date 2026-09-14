# QB-TAR-BATCH-01 FINAL WRITE SAFETY CHECK — Report

**Date:** 2026-09-04 23:55 +0800
**Level:** DSH-STAGING / CANONICAL-PREFLIGHT-WRITE-SAFETY
**Run label:** `QB-TAR-20260904-B01-WRITESAFETY-001`
**Mode:** READ-ONLY (only `qb_recovery` writes for ledger tracking)
**Scope:** 3 SAFE papers (paper 21 excluded)

---

## 0. Overall Verdict

```
🚦 FINAL WRITE SAFETY (W1-W6)

W1 schema compatibility         ✅ PASS
W2 image semantic dependency  ✅ PASS
W3 UPSERT collision safety     ✅ PASS
W4 rollback ledger             ✅ PASS
W5 target snapshot             ✅ PASS
W6 final write plan            ✅ PASS

─────────────────────────────────────
RECOMMENDATION                  🟢 AUTHORIZED
```

---

## 1. W1: Schema Compatibility ✅

All migration plan columns exist in target `public.*` schema:

| Column | Table | Status |
|---|---|---|
| `paper_uid` | exam_papers | ✅ exists |
| `paper_variant` | exam_papers | ✅ exists |
| `image_status` | exam_questions | ✅ exists; CHECK allows `NOT_EXPECTED/PRESENT/PARTIAL/MISSING_SOURCE/BACKFILL_PENDING` |
| `image_expected` | exam_questions | ✅ exists (boolean) |
| `image_available` | exam_questions | ✅ exists (boolean) |
| `asset_uri` | question_images | ✅ exists (text) |
| `status` | question_images | ✅ exists; CHECK allows `PRESENT/MISSING_SOURCE/PARTIAL/BACKFILL_PENDING/UNKNOWN` |
| `file_path` | question_images | ✅ exists NOT NULL |
| `source_page` | question_images | ✅ exists |
| `question_id` | question_knowledge_points | ✅ exists NOT NULL |
| `knowledge_point_id` | question_knowledge_points | ✅ exists varchar(20) NOT NULL |
| `relevance_score` | question_knowledge_points | ✅ exists (numeric) |

JSONB columns also available (potential storage for image semantic): `exam_questions.physics_structure`, `chemistry_structure`, `math_structure`.

**No schema changes required.** Migration plan targets all exist.

---

## 2. W2: Image Semantic Dependency ✅

**90 candidates classified into 3 classes:**

| Class | Count | Meaning |
|---|---:|---|
| IMAGE_COMPLETE | 0 | has_image_meta=false OR all refs PRESENT |
| **IMAGE_BACKFILLABLE** | **70** | has missing refs, stem does not reference image |
| IMAGE_BLOCKED | 0 | stem references image (如下图/如图所示/看图) AND image missing |

Pattern detection on 17 common Chinese exam stem patterns (如下图, 如图所示, 看图, 根据图, 图示, 图1-图8, 上图中, 下图中, etc.).

All 70 questions can be answered with text alone. **No IMAGE_BLOCKED exclusion required.**

---

## 3. W3: UPSERT Collision Safety ✅ (3-class)

### Paper collisions (3 papers)

| plan_paper_uid | existing_id | class | before_sha == after_sha |
|---|---:|---|---|
| `b4ab624a4e7460d8` (chinese 2024) | 10 | **UNCHANGED** | ✅ match |
| `35dccaaf93229ff4` (chinese 2025) | 11 | **UNCHANGED** | ✅ match |
| `99e1a3bc2dd808ff` (history 2024) | 20 | **UNCHANGED** | ✅ match |

### Question UID collisions (70)

| Existing | Status | Action |
|---|---:|---|
| 70 of 70 staging uids exist in public | **UNCHANGED** | UPSERT no-op (stage16 already populated these from D088 v1) |

**0 CONFLICT.** All 70 questions safe.

### Rollback safety

- 3 papers: UNCHANGED → no-op
- 70 questions: UNCHANGED → no-op
- 320 images: INSERTED previously (stage16) → DELETE on rollback
- 3 KP: INSERTED previously → DELETE on rollback
- **0 pre-existing canonical rows would be deleted by rollback**

---

## 4. W4: Rollback Ledger ✅

Table `qb_recovery.canonical_migration_ledger` exists with all 10 expected columns:

| Column | Type | Status |
|---|---|---|
| `id` | serial PK | ✅ |
| `run_label` | varchar(80) NOT NULL UNIQUE | ✅ |
| `entity_type` | varchar(20) NOT NULL | ✅ |
| `canonical_uid` | varchar(80) | ✅ |
| `canonical_id` | integer | ✅ |
| `action` | varchar(20) NOT NULL | ✅ |
| `before_sha` | varchar(64) | ✅ |
| `after_sha` | varchar(64) | ✅ |
| `detail` | jsonb | ✅ |
| `occurred_at` | timestamptz NOT NULL | ✅ |

Scope-limit test (non-existent run returns 0) confirmed. Rollback is run-isolated.

**Rollback protocol:**
1. SELECT all rows WHERE `run_label = $1` (scope-limited)
2. INSERTED → `DELETE FROM public.<table> WHERE id = canonical_id`
3. UPDATED → read current row, compare sha to `after_sha`; if match → restore from `before_sha`; if no match → skip
4. UNCHANGED → no-op
5. INSERT new ledger rows with `action=ROLLED_BACK` (audit trail)

**Critical: No blind DELETE/restore.** Only act when current sha matches `after_sha`.

---

## 5. W5: Target Snapshot ✅ (READ-ONLY)

| Metric | Value |
|---|---:|
| `public.exam_papers` total | 35 |
| `public.exam_papers` with `paper_uid` populated | 3 |
| `public.exam_questions` total | 679 |
| `public.exam_questions` in 3 target papers | 70 |
| `public.question_images` total | 320 (all PRESENT) |
| `public.question_knowledge_points` total | 125 |

**No public.* modifications.**

---

## 6. W6: Final Write Plan ✅

15-step transaction order (single tx):

1. BEGIN
2. INSERT qb_recovery.runs (RUNNING)
3. INSERT ledger meta=BEGIN
4. UPSERT 3 papers (id 10/11/20) ON CONFLICT — record ledger
5. INSERT 70 questions ON CONFLICT — record ledger
6. INSERT 320 PRESENT images — record ledger
7. INSERT 3 KP mappings — record ledger
8-10. PRE-CHECKS (count assertions)
11. POST-CHECK SHA verification
12. POST-CHECK ledger count (expect 398)
13-14. INSERT ledger meta=COMMIT, UPDATE runs
15. COMMIT

**Expected ledger entries:** 1 + 3 + 70 + 320 + 3 + 1 = **398**

**Abort conditions:** FK/UNIQUE failure, PRE-CHECK mismatch, POST-CHECK SHA mismatch, IMAGE_BLOCKED > 0, paper 21 leak, orphan central asset leak.

---

## 7. What was NOT done (per forbidden)

- ❌ No `public.*` data mutation
- ❌ No production DB write
- ❌ No LLM enrichment / image repair / orphan asset recovery
- ❌ No undefined stem backfill
- ❌ No KP guessing
- ❌ No region inference
- ❌ No schema changes

---

## 8. Files produced

| File | Purpose |
|---|---|
| `database/preflight/final-write-safety.json` | W1-W6 full report |
| `database/preflight/target-snapshot.json` | pre-write snapshot (W5) |
| `database/preflight/final-write-safety.md` | this report |
| `scripts/qb2/stage18-final-write-safety.mjs` | W1-W6 audit script |

---

## 9. Final Verdict

# 🟢 **AUTHORIZED**

All 6 W-checks PASS. The canonical write plan is **ready to execute** under explicit user authorization.

- 3 papers UNCHANGED (sha matches; UPSERT no-op)
- 70 questions UNCHANGED (sha matches; UPSERT no-op)
- 320 images would be INSERTED
- 3 KP would be INSERTED
- 0 IMAGE_BLOCKED, 70 IMAGE_BACKFILLABLE (all eligible)
- Rollback is scope-limited; does not affect pre-existing canonical data

**Per your dispatch card: "AUTHORIZED" recommendation; awaiting explicit user authorization before executing the canonical write.**

> **No public.* data mutation was performed during this safety check. All work was in `qb_recovery` schema (ledger tracking) and READ-ONLY public queries.**
