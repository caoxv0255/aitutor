# QB-TAR-BATCH-01 FINAL WRITE SAFETY CHECK — Report

**Date:** 2026-09-04 23:00 +0800
**Level:** DSH-STAGING / CANONICAL-PREFLIGHT-WRITE-SAFETY
**Mission:** Narrow-scope safety verification immediately before any `public.*` write
**Public.* writes:** **NONE EXECUTED** (read-only probes + staging only)
**Author:** DSH (this report)

---

## 0. TL;DR

| W-check | Result | Severity |
|---|---|---|
| **W1 schema** | **FAIL** | 🔴 **HARD BLOCK** — 8 plan-referenced columns do not exist in target `public.*` |
| **W2 image semantic** | **CONDITIONAL FAIL** | 🔴 — 2 questions are IMAGE_BLOCKED (stem depends on missing image) |
| **W3 collision** | MIXED | 🟡 — 0 question_uid collision, but **4 paper UK already in `public.exam_papers`** (id=10,11,20,21 from Gate B v1) → UPSERT DO UPDATE not INSERT |
| **W4 ledger** | FAIL | 🔴 — `qb_recovery.canonical_migration_ledger` does not exist; rollback is not structurally safe across re-runs |
| **W5 snapshot** | PASS | 🟢 — recorded in `database/preflight/target-snapshot.json` |
| **W6 plan** | DOCUMENTED | 🟢 — `database/preflight/` has 4 SQL files + rollback plan |

### Recommendation

> # 🔴 **NOT AUTHORIZED**
>
> **Three independent hard blocks prevent safe Canonical Write execution:**
>
> 1. **W1 schema:** 8 columns (`paper_uid`, `paper_variant`, `image_status`, `image_expected`, `image_available`, `asset_uri`, `status`, `source_page`) are absent from `public.*`. The migration SQL would fail with `column does not exist` at first INSERT.
>
> 2. **W2 semantic:** 2 questions (`history_2025_beijing_004`, `history_2025_beijing_015`) reference "如下图" in their stem but have **0 PRESENT / 12 MISSING** images. Per spec §21 and your "W2: no question with semantic dependency on a missing image may enter canonical" rule, these must be **REMOVED from the 90-candidate set** or **HELD until image backfill**.
>
> 3. **W4 ledger:** No `canonical_migration_ledger` table exists. Rollback can only filter by `paper_uid IN (...)`, which is structurally unsafe if any prior run inserted the same UIDs (currently W3 shows 4 papers already present from Gate B v1, meaning the UK collision is real and rollback risk is non-theoretical).
>
> These are blocking issues, not advisory. Each must be resolved with **explicit schema migration + ledger table creation + candidate filter** before any Canonical Write can be authorized.

---

## 1. W1 — Schema Compatibility (🔴 FAIL)

| Table | Plan-referenced column | Exists in `public.*`? |
|---|---|---|
| `exam_papers` | `paper_uid` | ❌ |
| `exam_papers` | `paper_variant` | ❌ |
| `exam_questions` | `image_status` | ❌ |
| `exam_questions` | `image_expected` | ❌ |
| `exam_questions` | `image_available` | ❌ |
| `question_images` | `asset_uri` | ❌ |
| `question_images` | `status` | ❌ |
| `question_images` | `source_page` | ❌ |
| `exam_papers` | `province_code`, `year`, `subject`, `exam_level`, `question_count` | ✅ |
| `exam_questions` | `question_uid`, `paper_id`, `question_number`, `question_type`, `stem`, `options`, `answer`, `analysis`, `knowledge_points`, `subject_code`, `province_code`, `year`, `has_image`, `file_path` | ✅ |
| `question_knowledge_points` | `question_id`, `knowledge_point_id`, `relevance_score` | ✅ |

**Existence verified via `information_schema.columns`.** All UNIQUE / FK constraints referenced by plan (e.g. `uq_exam_questions_paper_number`) exist. So the underlying schema is **FK-valid**, but **incomplete relative to v1.0 spec**.

### Required resolution

A separate **schema migration (e.g. `018_v1_canonical_status_columns.sql`)** must add:
- `exam_papers.paper_uid VARCHAR(32) UNIQUE`
- `exam_papers.paper_variant VARCHAR(20) DEFAULT 'main'`
- `exam_questions.image_status VARCHAR(20)`
- `exam_questions.image_expected BOOLEAN`
- `exam_questions.image_available BOOLEAN`
- `question_images.asset_uri TEXT`
- `question_images.status VARCHAR(20)`
- `question_images.source_page INTEGER`

Until that migration is **separately authorized and applied**, all Canonical Write plans remain unsafe to execute.

---

## 2. W2 — Image Semantic Classification (🔴 CONDITIONAL FAIL)

Of 90 canonical candidates, classified by stem-image dependency:

| Category | Count | Meaning | Action allowed |
|---|---:|---|---|
| IMAGE_COMPLETE | 0 | `has_image_meta=false` OR all refs PRESENT | ✅ can ingest |
| IMAGE_BACKFILLABLE | 88 | has missing refs, but stem does not reference image | ✅ ingest with `image_status='MISSING_SOURCE'` (backfill later) |
| **IMAGE_BLOCKED** | **2** | stem contains 如下图/如图/图1/图2 with missing images | ❌ **REMOVE from canonical set** |

### IMAGE_BLOCKED details (2)

| question_uid | stem excerpt | PRESENT | MISSING |
|---|---|---:|---:|
| `history_2025_beijing_004` | contains "如图所示" / "下图" | 0 | 12 |
| `history_2025_beijing_015` | contains "如图所示" / "下图" | 0 | 12 |

**Why blocked:** Per spec §21 ("FAIL，不得标记为 Canonical" if original image is referenced but not available), and per your W2 directive ("no question with semantic dependency on a missing image may enter canonical"). These questions **cannot be answered without the figure** — accepting them as canonical would create a permanent "wrong-by-design" entry.

### Required resolution

The canonical candidate set must be reduced from 90 to **88** before any Canonical Write. Specifically:
- `history_2025_beijing_004` → `canonical_status = HOLD`, `canonical_ready_step = 'image_pending'`
- `history_2025_beijing_015` → `canonical_status = HOLD`, `canonical_ready_step = 'image_pending'`

Both remain in `qb_staging` with full metadata, so when original PDF re-extraction (B3: WAIT_FOR_ORIGINAL_SOURCE) becomes available, they can be re-promoted.

---

## 3. W3 — UPSERT Collision Safety (🟡 MIXED)

### Pre-existing row count in target `public.*`

| table | count | min_id | max_id |
|---|---:|---:|---:|
| `public.exam_papers` | 35 | 1 | 35 |
| `public.exam_questions` | 679 | 691 | 1369 |
| `public.question_images` | 0 | – | – |
| `public.question_knowledge_points` | 122 | 130 | 251 |

These were inserted during Gate B v1 (D088, 2026-09-03 14:24) — same source data, pre-preflight flow.

### Paper UK collision (REAL — 4 hits)

| plan paper_uid | (province, year, subject, level) | existing `public.exam_papers`.id | would_be |
|---|---|---:|---|
| `b4ab624a4e7460d8` | beijing, 2024, chinese, gaokao | **10** | **UPDATED** (id=10) |
| `35dccaaf93229ff4` | beijing, 2025, chinese, gaokao | **11** | **UPDATED** (id=11) |
| `99e1a3bc2dd808ff` | beijing, 2024, history, gaokao | **20** | **UPDATED** (id=20) |
| `299a49bf489ab027` | beijing, 2025, history, gaokao | **21** | **UPDATED** (id=21) |

⚠️ **The plan cannot claim "INSERTED 4 papers"** — they will be UPDATE (paper_uid backfill + question_count refresh). The `paper_uid` column doesn't exist, so a schema migration is the gate.

### Question_uid collision (clean — 0 hits)

- 0 of the 90 candidate question_uids currently exist in `public.exam_questions`.
- All 90 will be **INSERTED** as new rows.

### ID allocation check

- Next `exam_papers.id` will be **36** (after max=35). No collision.
- Next `exam_questions.id` will be **1370** (after max=1369). No collision.
- `question_images.id` is fresh (table empty).
- `question_knowledge_points.id` after 122 is 252+.

### Rollback safety — RE-EXAMINED

Previous report claimed "SAFE" because `paper_uid` column was missing (the collision probe returned 0 pre-existing rows silently). The **real** state is:

- 4 papers (id 10,11,20,21) exist with same UK as plan target.
- These papers have **existing question rows** from the original 679 (id 691..1369).
- A naive `DELETE FROM public.exam_papers WHERE paper_uid IN (...)` would delete these 4 papers.
- The ON DELETE CASCADE from `exam_papers.id` → `exam_questions.paper_id` would **delete 90 questions** — but those 90 are the **new INSERTs**, not the pre-existing 679 (since the 4 paper IDs have existing question rows for different questions).
- However, **W4 (missing ledger)** makes it impossible to distinguish "this run inserted these 90" from "this run updated these 4 papers and inserted these 90". Without a ledger, rollback scope is ambiguous.

**Conclusion:** rollback safety cannot be claimed as **structurally safe** without W4 ledger.

---

## 4. W4 — Rollback Ledger (🔴 FAIL)

### Current state

```
information_schema.tables WHERE table_name='canonical_migration_ledger'  →  0 rows
```

**The `qb_recovery.canonical_migration_ledger` table does not exist.**

### Why this matters

Rollback safety depends on being able to answer: "what rows did THIS run touch?" Without a per-run ledger:
- `paper_uid IN (...)` filter would catch rows from any prior run with the same UK (currently 4 papers).
- `question_uid IN (...)` would catch questions from any prior run with the same uid (currently 0, but structurally unsafe).
- The UPSERT in the plan uses `ON CONFLICT DO UPDATE` — meaning the rollback would also need to revert the UPDATE on the 4 pre-existing papers to their pre-run state. **Without `before_sha/after_sha` recorded, this reversion cannot be precise.**

### Required resolution

Create `qb_recovery.canonical_migration_ledger`:

```sql
CREATE TABLE qb_recovery.canonical_migration_ledger (
  id          SERIAL PRIMARY KEY,
  run_label   VARCHAR(80) NOT NULL,
  op          VARCHAR(20) NOT NULL,           -- BEGIN / UPSERT_PAPER / UPSERT_QUESTION / INSERT_IMAGE / INSERT_KP / COMMIT
  schema_name VARCHAR(20) NOT NULL,           -- 'public.exam_papers' etc.
  row_id      INTEGER,                        -- exam_papers.id, exam_questions.id, etc.
  row_uid     VARCHAR(80),                    -- paper_uid / question_uid / knowledge_point_id
  before_sha  VARCHAR(64),                    -- sha256 of pre-image of the row (or NULL for INSERT)
  after_sha   VARCHAR(64),                    -- sha256 of post-image
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_run ON qb_recovery.canonical_migration_ledger(run_label);
```

Each UPSERT must:
1. Read the existing row (or null for INSERT)
2. Compute before_sha
3. Perform the UPSERT
4. Compute after_sha
5. Write a ledger row

Rollback then filters by `run_label` and uses `before_sha` to restore the original row contents.

---

## 5. W5 — Target Snapshot (🟢 PASS)

Persisted to `database/preflight/target-snapshot.json`. Captured 35 exam_papers, 679 exam_questions, 0 question_images, 122 question_knowledge_points. **No modifications made.**

---

## 6. W6 — Final Write Plan (🟢 DOCUMENTED)

10-step transaction order with explicit pre/post checks and abort conditions. See `database/preflight/migration-plan.sql`, `question-plan.sql`, `image-plan.sql`, `kp-plan.sql`, `rollback-plan.sql`.

**Cannot be safely executed today** because of W1, W2, W4 blockers. **The plan is correct, but the target is not ready.**

---

## 7. Stop conditions reached

- ✅ W1 FAIL: target schema lacks plan-required columns → **execution would 500**
- ✅ W2 IMAGE_BLOCKED count = 2 → **spec §21 violation, candidate filter required**
- ✅ W4 ledger missing → **rollback not structurally safe**

All three are **independent hard blocks**. Any one blocks Canonical Write authorization.

---

## 8. Recommendation

# 🔴 **NOT AUTHORIZED**

**Reasoning:**

| Blocker | Why it must be resolved | Who can authorize |
|---|---|---|
| W1 schema | 8 columns absent; INSERT/UPDATE would fail with `column does not exist` | Schema migration `018_v1_canonical_columns.sql` (separately authorized) |
| W2 semantic | 2 questions reference "如下图" but 0 images present; violates spec §21 | Filter out the 2 BLOCKED qdirs from canonical candidate set, or HOLD them with `canonical_status='HOLD'` |
| W4 ledger | No per-run audit trail; rollback cannot distinguish "this run" from "prior run" | Create `qb_recovery.canonical_migration_ledger` table + write UPSERT wrapper |

**Sequence to unblock:**
1. Add migration `018_v1_canonical_columns.sql` (with the 8 columns + `canonical_migration_ledger` table).
2. Filter the canonical candidate set: exclude `history_2025_beijing_004` and `history_2025_beijing_015` (or mark HOLD until image backfill).
3. Re-run `qb-build` → `qb-ingest` (or preflight) to regenerate plan with 88 candidates.
4. Re-execute W1-W6. If W1-W4 all PASS, then **NOT AUTHORIZED becomes CONDITIONAL**, and a final user authorization for Canonical Write can be requested.

**Until all three are addressed, no public.* write should occur.**

---

## 9. Files produced (all in `database/preflight/`)

| File | Size | Purpose |
|---|---:|---|
| `write-safety-report.json` | full W1-W6 + overall | this report (structured) |
| `target-snapshot.json` | pre-run snapshot | W5 |
| `migration-plan.json` | 14 metrics | v3 (still valid) |
| `migration-plan.sql` | 95 lines | plan files (W1 fail = cannot execute) |
| `question-plan.sql` | 4081 lines | |
| `image-plan.sql` | 3320 lines | |
| `kp-plan.sql` | 27 lines | |
| `rollback-plan.sql` | 136 lines | W3/W4-conditional unsafe |
| `simulate-result.json` | v3 simulation | unchanged |

## 10. Scripts (all in `scripts/qb2/`)

| Script | Purpose |
|---|---|
| `stage12-write-safety.mjs` | this report (W1-W6 + W4 ledger design) |

---

**NEXT GATE:**
# QB-TAR-BATCH-01 WRITE-SAFETY REVIEW

**Result:**
```
W1 schema:           🔴 FAIL
W2 image semantic:   🔴 FAIL  (2 IMAGE_BLOCKED)
W3 collision:        🟡 MIXED  (4 paper UK collide; 0 question_uid collide)
W4 ledger:          🔴 FAIL
W5 snapshot:         🟢 PASS
W6 plan:             🟢 DOCUMENTED

RECOMMENDATION:     🔴 NOT AUTHORIZED
```

**Why NOT AUTHORIZED:** three independent hard blocks (W1 schema, W2 semantic, W4 ledger). Each requires separate authorization. The Canonical Write plan itself is **correct** — the target environment is **not ready**.

> No public.* write was performed during this safety check.
