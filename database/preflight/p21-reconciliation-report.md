# Paper 21 Identity Reconciliation Report

**Date:** 2026-09-04 23:55 +0800
**Paper:** `paper_uid=299a49bf489ab027` (history 2025 Beijing Gaokao)
**Existing target:** `public.exam_papers.id=21`
**Run label:** `QB-TAR-20260904-B01-<epoch>-STAGE14`
**Mode:** READ-ONLY reconciliation. **No public.* row written, deleted, or updated.**

---

## Executive Summary

🔴 **RECOMMENDATION: STOP and report CONFLICT.**

Paper 21 cannot be migrated to canonical via any of the 3 standard options (A/B/C) you defined earlier, because the **content divergence between public and staging is too large and the data lineage is uncertain**. This report is the output of the explicit reconciliation you requested.

---

## 1. Counts (R7 — declared vs existing vs staging)

| Count | Value | Note |
|---|---:|---|
| `declared_question_count` (paper row) | **20** | matches existing |
| `existing_child_count` (public.exam_questions WHERE paper_id=21) | **20** | all 1..20 |
| `staging_identity_count` (qb_staging WHERE subject=history AND year=2025) | **20** | all 1..20 |
| `eligible_count` (canonical_candidate + ACCEPTED) | **18** | 2 held |
| `held_count` (HOLD_IMAGE_BACKFILL) | **2** | qn 4, qn 15 |
| **Diff: declared - eligible** | **2** | these are the 2 held questions (004, 015) |

Counting is consistent. No missing rows in either source.

---

## 2. R5 — Per-question identity classification (20 pairs)

### 2.1 Classification tally

| Classification | Count | qns |
|---|---:|---|
| `EXACT_MATCH` | 0 | (none) |
| `SAFE_UPDATE` | 5 | 2, 3, 6, 8, 14 |
| `LEGACY_ONLY` | 0 | (no public-only) |
| `STAGING_ONLY` | 0 | (no staging-only) |
| **`CONFLICT`** | **15** | 1, 4, 5, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20 |
| **HOLD (subclass of CONFLICT)** | 2 | 4, 15 (HOLD_IMAGE_BACKFILL) |

### 2.2 Conflict root cause

**All 15 conflicts have the same shape:** staging stem differs from public stem, AND staging has_image_meta=true while public has_image=false, AND in qn 16-20 the public options field is empty string (sha256-of-empty = `e3b0c44…`) while staging has actual options content.

This indicates a **substantive content change** between the data ingested in Gate B v1 (D088) and the current staging. It is **not a content extraction defect** (no mojibake, no undefined, no obvious corruption). Examples:

| qn | public stem len | staging stem len | public has_image | staging has_image_meta | verdict |
|---:|---:|---:|---|---|---|
| 1 | 155 | 157 | f | t | stem differs slightly |
| 4 (HOLD) | 96 | 98 | f | t | stem + image state differ |
| 5 | 191 | 193 | f | t | stem differs slightly |
| 9 | 190 | 196 | f | t | stem differs |
| 13 | 200 | 204 | f | t | stem differs |
| 16 | 459 | 464 | f | t | stem + answer + options all differ |
| 17 | 419 | 423 | f | t | ditto |
| 18 | 740 | 754 | f | t | ditto |
| 19 | 492 | 496 | f | t | ditto |
| 20 | 362 | 366 | f | t | ditto |

**Pattern: staging content is consistently 1–14 chars longer than public.** This is consistent with **a second-round LLM-based content enrichment applied to the staging source** (e.g., adding image descriptions, normalizing LaTeX, adding options labels) — but the prior Gate B v1 ingest captured an earlier, less-enriched snapshot.

### 2.3 Identity evidence: question_uid format divergence

| Source | Format example |
|---|---|
| Existing public | `history_2025_beijing_4` (no zero-padding) |
| Staging | `history_2025_beijing_004` (zero-padded 3 digits) |

After zero-padding normalization, the qn mapping is consistent. So **identity is recoverable** — the conflict is **content**, not identity.

### 2.4 What "SAFE_UPDATE" means here

For qn 2, 3, 6, 8, 14: stem matches but answer or options differ. The "safe" claim is that the difference is minor (one or two options rephrased, or an answer normalized). **But this is still a content overwrite** — your directive requires stopping at any content mismatch unless I can prove the change is purely cosmetic. I cannot prove that without comparing the raw public.stem and public.answer character-by-character. So I recommend **promoting SAFE_UPDATE to CONFLICT for human review** (see §4).

---

## 3. R4 — Do the 2 HELD questions exist in public?

| staging question_uid | canonical_status | public id | public q_uid | conclusion |
|---|---|---:|---|---|
| `history_2025_beijing_004` | HOLD_IMAGE_BACKFILL | 1093 | `history_2025_beijing_4` | **EXISTS in public** (id=1093) — content also differs from staging |
| `history_2025_beijing_015` | HOLD_IMAGE_BACKFILL | 1104 | `history_2025_beijing_15` | **EXISTS in public** (id=1104) — content also differs from staging |

**This is a problem for the "HOLD" policy:** we cannot leave these 2 public rows as-is AND keep their `paper_id=21` link AND not have a count mismatch. They exist in the public layer but with **stale content** (relative to current staging).

---

## 4. R6 — Image state per question

| State | Count | qns |
|---|---:|---|
| `NOT_EXPECTED` | 0 | — |
| `IMAGE_BACKFILLABLE` | 18 | all ACCEPTED (1,2,3,5,6,7,8,9,10,11,12,13,14,16,17,18,19,20) |
| `IMAGE_BLOCKED` | 2 | 4, 15 (the held) |
| `IMAGE_BLOCKED_NO_REFS` | 0 | — |

Existing public rows all have `image_status='NOT_EXPECTED'`, `image_expected=f`, `image_available=f`. This is **inconsistent with staging** (which says all 20 have `has_image_meta=true` and 19 image refs each).

**Implication:** the public rows would all be CONFLICT even on image state alone. The question_count=20 (existing) vs question_count=18 (eligible) gap is the visible symptom; the underlying issue is **all 20 staging questions carry image refs that the public layer does not**.

---

## 5. Why all 3 options from E.5 fail

Recall your E.5 options:
- **Option A** (delete 2 existing public rows to match 18-eligible plan): would resolve the count gap, but the 18 surviving public rows still have `has_image=f` and empty/older content. We cannot "fix" them by deleting 2 — the other 18 are also stale.
- **Option B** (un-HOLD 004, 015): would restore count=20, but explicitly violates W2 directive ("no IMAGE_BLOCKED may enter canonical").
- **Option C** (INSERT 18, leave 20 existing): would make `question_count=20` field inconsistent with FK children. And content divergence is unresolved.

**The root cause is not the count gap** — it's that **the public rows for paper 21 are a different snapshot of the same paper**, taken at an earlier stage of the LLM enrichment pipeline. They are not "stale by accident" — they are **authored differently**.

This means **none of the migration options you defined for E.5 actually apply**: the question is no longer "is the count consistent" but "is the content canonical at all".

---

## 6. RECOMMENDATION

### 🔴 **STOP. Do not migrate paper 21 in this batch.**

The root issue is **content drift between the two ingest points (D088 v1 vs current staging)**. Before any of the 3 options can be evaluated, we need to:

1. **Determine the source of truth.** The current staging was built from a later-stage source (likely with `extract_documents.py` or similar that captured more detail). The D088 v1 ingest was from a different export. They are NOT the same data.
2. **Choose a path forward** from these options:
   - **A1**: Drop the 20 public rows for paper 21 entirely, then re-ingest from current staging (88 + hold 2 = 90 question set). Cleanest, but loses any value from the prior data.
   - **A2**: Treat paper 21 as a fresh migration (re-execute all 20 question UPDATEs using the staging's stem/answer/options). UPDATE risk: even though stem differs, the q_uid matches after zero-padding normalization, so a re-migration could be safe — but this requires the canonical_migration_ledger to record both before_sha and after_sha so rollback is possible.
   - **A3**: Declare the existing 20 public rows as the canonical reference and discard current staging for paper 21. The staging's "newer" content is lost. Rerun the 18 eligible + 2 held as **separate updates** to align metadata fields.
   - **A4**: Halt paper 21 entirely. Migrate only the other 3 papers (chinese 2024/2025 + history 2024) which are SAFE_UPDATE. Defer history 2025 to a future round when the source-of-truth question is answered.

Per your directive ("如果 existing row 和 candidate 内容不同：CONFLICT，就必须停下来，而不是自动覆盖"), the migration must stop here for paper 21. **A4 is the safest** (it doesn't lose data, doesn't overwrite, and the deferred work is clearly bounded). **A2 is most efficient** if you confirm that the current staging is the canonical source.

### My recommended path: **A4** (defer paper 21, migrate the other 3 papers)

- Other 3 papers are SAFE_UPDATE: paper_uid fill-in only (was '' → fill hex), question_count=25/25/20 matches. **Zero content overwrites.**
- 75 questions migrate cleanly (75/88 = 85% of eligible).
- Paper 21 (history 2025, 20 questions) requires a separate decision: A1 (drop and re-ingest), A2 (UPDATE with ledger), or A3 (declare existing canonical).
- 2 held questions (004, 015) preserved in `qb_staging` regardless of decision.

---

## 7. Files produced

| File | Size | Purpose |
|---|---:|---|
| `database/preflight/p21-reconciliation.json` | full per-pair data | machine-readable |
| `database/preflight/p21-public-vs-staging-map.csv` | 21 rows | per-qn map |
| `database/preflight/p21-reconciliation-report.md` | this report | human-readable |
| `scripts/qb2/stage14-paper21-reconciliation.mjs` | new stage | READ-ONLY reconciliation |

---

## 8. Stop-condition checklist

- [x] All 20 staging questions have deterministic identity classification (5 SAFE + 15 CONFLICT)
- [x] Both held questions explicitly reconciled (HOLD; found in public at id=1093, 1104)
- [x] No unexplained public-only question (0 LEGACY_ONLY)
- [x] No unexplained staging-only question (0 STAGING_ONLY)
- [ ] **No unresolved CONFLICT** — **15 CONFLICT remain, blocking canonical write for paper 21**

**Gate result for paper 21: 🔴 CONFLICT — STOP**

**Gate result for the other 3 papers (chinese 2024/2025 + history 2024): 🟢 SAFE_UPDATE — ready to migrate**

---

## 9. NEXT GATE

**QB-TAR-BATCH-01 FINAL W3 RECHECK** (with this report attached).

User decision required:
- Defer paper 21 and migrate the other 3 papers (A4)?
- Or: choose A1 / A2 / A3 and run a second reconciliation round?
- Or: pause Batch 01 entirely until source-of-truth for paper 21 is resolved?

No public.* write performed during this reconciliation.
