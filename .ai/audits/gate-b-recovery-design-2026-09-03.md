# GATE B — QB-P0 RECOVERY DESIGN + READ-ONLY DRY-RUN (STEP 1)

Date: 2026-09-03
Gate: QB-P0 Gate B (Authentic Question Bank) — Step 1: Recovery Design / Dry-run.
Mode: **READ-ONLY.** No production write, no schema change, no ingest, no corpus modification,
no migration. All dry-run evidence computed on the checked-out corpus in `/tmp` scratch scripts;
scripts live outside the repo and are not part of any deliverable.
Authorizes: nothing to implement. Produces design + evidence for human approval of Step 2.

---

## 0. Upstream decisions this step builds on

- `.ai/decisions/D087-p0.3-architecture-decision-gate.md` — D1–D4 APPROVED; Gate B (QB-P0) is the
  **mandatory prerequisite** before P0.3 Adapter 1.
- `.ai/audits/QB-P0-AUDIT-2026-09-03.md` (frozen) — the source of the P0-QB-01..17 acceptance
  criteria and the "NOT ATOMIC / NOT INGESTED" verdict.

---

## 1. Recovery Design — canonical source selection

### 1.1 Corpus branches (verified this session, read-only)

| Branch | Location | Records | Content | Verdict for canonical ingest |
|---|---|---|---|---|
| A | `database/parsed-examples/*.json` (45 files) | 19,813 records | DB export of a *previous* DB (ids 145k-197k, `created_at`), 88.6% redundant | ⚠️ candidate, needs canonicalization |
| B | `database/question-bank/<subj>/<yr>/NNN/` (1,239 dirs) | 1,239 dirs | 881 `undefined` stems (71.1%), 358 real | ❌ NOT usable as primary source (71% empty) |
| C | `database/extracted/manifest.json` | 2,067 papers / 32,888 q | LibreOffice-extracted textbook corpus (≠ gaokao papers) | ⚠️ different corpus; out of scope for 真题 bank |
| D | Raw docx/doc archive — **found OUTSIDE repo** in `.Trash-1000/files/北京高考题库/` (356 files, 332 MB, 2008–2025, 9 subjects) | — | authentic 原卷版/解析版 docx | 🔴 **key finding** — see §1.2 |

Branch D is a **new discovery this session**: a 332 MB / 356-file Beijing 高考 2008–2025 archive
sits in the filesystem trash (`/home/flaskappuser/Desktop/NewDisk_2T/.Trash-1000/files/北京高考题库/`),
NOT inside the repo and NOT referenced by any ingest script. It is the most plausible true upstream
of the parsed-examples branch, but **no LibreOffice/exam-extract pipeline is wired to it in the
current tree** (`database/extracted/manifest.json` points at a *textbook* corpus of 3819 docx/doc,
not at the Beijing 真题 archive).

### 1.2 Design fork — MUST be decided by human before Step 2

Because branch D exists (authentic raw source) but is outside the repo and in the trash:

```
Option R-A   Recover from Branch A (parsed-examples) via canonicalization/dedup
             + fix merge/split/province metadata. No raw re-parse.
             → gives 113 unique papers / ~2,271 unique questions, but inherits
               stripped-LaTeX math, mojibake, dead image refs (audit §6/§7).
             Fastest; content-quality ceiling = whatever the export already has.

Option R-B   Restore Branch D raw docx → new LibreOffice + exam-extract-v5 pipeline
             → re-parse 原卷版 → clean canonical papers (best quality for math LaTeX/
               images), but needs file restore (it's in .Trash-1000) + pipeline work.
             Highest fidelity; slowest; requires user action to restore files.

Option R-C   Hybrid: canonicalize Branch A now (row-count/atomicity recovery) and
             schedule Branch D re-parse as a later content-quality pass.
```

**Recommendation (advisory): R-C** — Gate B acceptance criteria P0-QB-01/02/05/08 are about
*canonical identity + dedup*, satisfiable from Branch A; P0-QB-09/10/11 (stem/image/LaTeX integrity)
are *content-quality*, which Branch A cannot satisfy for math. R-C makes the identity layer
recoverable immediately while keeping the quality ceiling open via Branch D later.
This is a **human decision**; this document does not implement either.

---

## 2. Dry-run evidence (read-only, audit-aligned methods)

Method note: records inside each parsed-examples file are ordered by `question_number` groups, not
contiguously per paper; reconstructing papers requires **sort by `id` then cut a new block wherever
`question_number === 1`** (this reproduces the frozen audit's 638 paper-blocks exactly).

### 2.1 Canonicalization outcome (19,813 records → canonical entities)

| Metric | Value | Method |
|---|---|---:|---|
| Parsed records (45 files) | **19,813** | file scan |
| Paper-blocks (after id-sort, qn reset) | **638** | id-sort + qn==1 cut |
| **Unique papers** (stem-only block content signature) | **113** | md5 over joined stems |
| Unique papers (stem+qn signature) | 114 | +1 explained by chinese_2025 qn inconsistency (see 2.3) |
| **Unique questions** `(subject, year, stem)` | **2,271** | trim-only key |
| Redundancy | 17,542 dup = **88.6%** | (19,813−2,271)/19,813 |
| `question_uid` populated / blank | 812 / **19,001 (95.9% blank)** | record count |
| Answer present / missing (record level) | 14,738 / 5,075 | — |

### 2.2 Canonical-question quality after dedup (the 2,271 best case)

| Dimension | Count | Coverage |
|---|---:|---:|
| with answer | 1,805 | 79.5% |
| with analysis | 1,583 | 69.7% |
| with KP tag (chapter string) | 1,707 | 75.2% |
| with question_uid already | 667 | 29.4% |
| stem empty | 0 | — |
| stem <15 chars (suspicious) | 98 | 4.3% |
| types | choice 1,571 / solve 405 / fill 263 / multi_choice 32 | — |

### 2.3 Paper identity (province/year/subject) on the 113 unique papers

| Metric | Value |
|---|---:|
| unique papers | 113 |
| single consistent province signal | 73 (64.6%) |
| **conflicting province signals** (`paper_info` vs `question_uid`) | **40 (35.4%)** |
| ambiguous sample | biology_2021: `pi:tianjin` vs `uid:beijing`; biology_2024: `pi:qinghai` vs `uid:beijing`; biology_2025: `pi:beijing` vs `uid:beijing` (consistent) |
| by year | 2021:26, 2022:22, 2023:21, 2024:18, 2025:26 |
| by subject | chinese 20, english 26, chemistry 17, physics 14, math 10, politics 8, biology 7, history 6, geography 5 |

**Key evidence for P0-QB-04/12:** 40/113 unique papers carry contradictory province provenance
between `paper_info.province_code` and embedded `question_uid`. A canonical ingest **cannot trust
either signal alone**; the recovery step must decide a province-resolution rule (e.g. prefer
`question_uid` province when non-empty and in provinces table; else `paper_info`; log conflicts).
math has only 10 unique papers but **all LaTeX is stripped** (audit §7.1) — content-quality
ceiling of Branch A is real for math.

### 2.4 Ingest-script defects (confirmed read-only, `scripts/ingest-exam-questions.mjs`)

| Line | Defect | Consequence |
|---|---|---|
| 142 | `null, // paper_id` hardcoded | orphans every question from `exam_papers` → P0-QB-04 FAIL; `(paper_id, question_number)` collapses to `(NULL,n)` |
| 155 | `provCode(q.province)` | parsed questions have **no** `province` field (17,467/19,813 lack it per frozen audit); falls back to `q.year \|\| 2024` at line 103/154 → year metadata also fabricated when missing |
| 58–61 | `genUid()` keyed on foreign `q.id` | replicas of the same question carry different surrogate `id` → **distinct uids for identical content** → P0-QB-03/QB-08 FAIL (would ingest 88.6% redundancy as "unique") |
| 109 | filters `stem` non-empty | drops split fragments but also keeps merged (multi-question) stems → P0-QB-06/07 unresolved |
| 149 | KP only as denormalized text | `question_knowledge_points` stays empty → P0-QB-13/14 FAIL |
| 174 | `ON CONFLICT (question_uid) DO UPDATE` | upsert key is itself unstable (defect above) — conflict target meaningless |

### 2.5 DB-schema readiness (live, from earlier gate evidence)

- `exam_questions`: `question_uid` UNIQUE **NOT NULL** (no default), paper FK nullable, `(paper_id, question_number)` = **plain index, not UNIQUE** → P0-QB-05 requires a real `UNIQUE` to be created (migration) in Step 2/3.
- `exam_papers`: UNIQUE `(province_code, year, subject, exam_level)` already exists.
- `question_knowledge_points`: FK-enforced M:N, unique `(question_id, knowledge_point_id)`; 0 rows.

---

## 3. Gate B Step 1 → Step 2 proposal (design only)

### 3.1 Human decisions required before Step 2

1. **Source fork: R-A / R-B / R-C** (§1.2). Recommends R-C.
2. **Branch D disposition**: is the `.Trash-1000` 北京高考题库 archive to be restored & adopted as
   the future content-quality upstream (R-B/R-C path), or left out of scope?
3. **Scope of Step 2** (next gate): (a) write canonicalizer + dry-run on a **scratch/staging DB**
   (create temp schema `qb_recovery`), (b) author migration for P0-QB-05 UNIQUE + partition cleanup,
   (c) ingest policy — all under explicit approval.

### 3.2 Recovery stages mapped to acceptance criteria

| # | Stage (design) | Fulfils |
|---|---|---|
| S1 | Paper-block reconstruction (id-sort + qn reset) | P0-QB-01/02 (papers + questions exist) |
| S2 | Paper dedup by stem content signature; province resolution rule (§2.3) | P0-QB-04/08/12 |
| S3 | Question dedup by `(subject, year, stem)`; stable `question_uid` generation decoupled from foreign surrogate id (use Rule A `api/core/questionUid.js`, fall back to `q_{paperId}_{qn}` / `legacy_{seq}`) | P0-QB-03/08/15 |
| S4 | Merge/split handling policy (7 merged / 80 split in frozen audit; see R-A content ceiling) | P0-QB-06/07 |
| S5 | `UNIQUE (paper_id, question_number)` migration + orphan partition cleanup | P0-QB-05 |
| S6 | KP mapping: chapter-string tags → `knowledge_points.id` (needs mapping table/LLM-assisted match, NOT plain string equality) + populate `question_knowledge_points` | P0-QB-13/14 |
| S7 | Bidirectional traceability check (DB↔source) on sampled questions | P0-QB-16 |
| S8 | Point `personalized-paper` selection at `exam_questions` (code change, later gate) | P0-QB-17 |

**P0-QB-09/10/11 (stem/image/LaTeX integrity) cannot pass from Branch A** for math (stripped LaTeX)
and images (0 rows, dead refs) → these criteria require R-B (Branch D re-parse) or explicit
scope decision that quality pass is a later milestone.

---

## 4. Honesty constraints honoured

- Zero writes: no DB, no repo source/code change, no schema, no migration, no ingest.
- Dry-run scripts executed from `/tmp` (outside repo); all numbers above are stdout-only evidence.
- No test data created, no row deleted, no `.Trash-1000` file touched (only listed read-only).
- The 113-vs-114 paper signature delta is explained (§2.3 chinese_2025), not hidden.
- **Not decided here:** source fork R-A/R-B/R-C, Branch D disposition, Step 2 scope — all human.

---

## 5. STOP

Gate B Step 1 (design + read-only dry-run) is complete. **No implementation begins.** Awaiting human
decision on §3.1 (source fork, Branch D, Step 2 scope) before any canonicalizer / migration / ingest
work. P0.3 Adapter 1 remains blocked by design (D087) until Gate B passes.
