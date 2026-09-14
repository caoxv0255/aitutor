# GATE B — QB-P0 RECOVERY DESIGN v2 (R-B-first, MULTIMODAL RAW SOURCE)

Date: 2026-09-03 (v2 — supersedes v1's R-A/R-C recommendation per human input)
Status: **READ-ONLY design.** No implementation, no production write, no schema change,
no corpus/file modification (including nothing under `.Trash-1000`).
Builds on: `.ai/decisions/D087-*.md` (D1–D4), `.ai/audits/QB-P0-AUDIT-2026-09-03.md` (criteria),
`.ai/audits/gate-b-recovery-design-2026-09-03.md` (v1 dry-run evidence, still valid).

---

## 0. Human inputs received (2026-09-03) — binding for this design

| Question | Human decision |
|---|---|
| Final goal | **全国全部省份中高考全量题库知识库** |
| Raw format | **docx + docx 转换的 PDF**；但**公式与几何图形是图片**；语文/英语漫画类、地理地图类等**多模态配图多** → 需语义分析保存 |
| Answer pairing | **原卷版 + 解析版成对获取** ✅ |
| Pilot scope | **北京高考试点先行**（raw docx 已在 `.Trash-1000/files/北京高考题库/`，2008–2025，356 份/332 MB） |

Design conclusion: with raw original material obtainable and the final goal being a **nationwide
中高考 full corpus**, the durable asset is a **source-agnostic, multimodal-aware canonical ingest
pipeline** (R-B-first). Branch A (`parsed-examples`) is demoted to a **validation/diff corpus**
(prove the pipeline reproduces its 113 unique papers / 2,271 unique questions → P0-QB-15/16).

---

## 1. Multimodal reality (verified read-only this session)

1. `question_images` table **already exists** with a complete asset schema:
   `question_id, image_type, file_path (NOT NULL), semantic_description, caption, width, height, sort_order`.
   → The data model anticipated first-class images; it is simply unpopulated (0 rows).
2. Branch B `metadata.json` declares `images:[{filename:"page_1_img_1.png",page,width,height}]` but the
   **actual image files are NOT in the repo** (0 png/jpg under `database/question-bank/`). The image
   manifest is an index into files that were never shipped or were stripped.
3. Raw docx (source of truth) embeds formulas/figures as **image objects inside the document** —
   docx is a ZIP; embedded media is recoverable (`word/media/*`), positions anchored to text via
   `document.xml` relationships. This is the correct extraction point.
4. Existing `exam_questions` multimodal columns (from schema): `has_image`, `has_formula`,
   `raw_image_path`, `image_descriptions`, `latex_formulas`, `formula_semantics`,
   `semantic_description`, `solution_description`, subject `_structure` JSONB — plus `question_images`
   as the normalized child. **No schema change is required to store multimodal questions**; only
   population is missing.

---

## 2. Adopted architecture (design only)

### 2.1 Pipeline (R-B-first)

```
Raw docx (per paper: province, year, subject, exam_level, 原卷版/解析版 pair)
   │  (source manifest drives this; provenance read from filename/dir, not parsed heuristics)
   ▼
docx → unzip word/media/* + document.xml text & image anchors      [LibreOffice/ADM only where needed]
   │
   ▼  per-question segmentation (by structural markers 一/二/…/1./(1) + 题型 hints)
Question candidates (text + embedded image set + page coords)
   │
   ▼  multimodal enrichment (vision LLM — qwen3-vl-plus class, per P0.3 precedent)
       · formula image → latex_formulas + formula_semantics
       · figure/comic/map → semantic_description (+ caption)
   │
   ▼  canonicalizer
       · paper identity → exam_papers (province/city, year, subject, exam_level, paper_type)
       · question_uid Rule A (subject_year_province_qn) or q_{paperId}_{qn}
       · dedup by content signature across 原卷版/解析版 and across sources
   │
   ▼  DB (staging first)
       exam_papers / exam_questions / question_images / question_knowledge_points
```

### 2.2 Scope units — lock before schema extension

- **高考**: province OR 全国卷 (national I/II/甲/乙/新高考 I/II) — fits `provinces`/`exam_papers` with
  a `province_code='national*'` convention already present in `PROVINCE_MAP` (`national_i`…).
- **中考**: **city-level** in most provinces. Current `exam_papers UNIQUE (province_code, year,
  subject, exam_level)` is **province-granular → insufficient** for city-level zhongkao.
  → A **city/region dimension** (either a `city_code` column or `province_code` value like
  `beijing_chongwen` + separate unique key) must be decided in the schema step. ⚠️ Must be decided
  before writing the P0-QB-05 UNIQUE migration so the key isn't rebuilt later.

### 2.3 Answer pairing rule

`原卷版` = stem/options/questions with **no answers**; `解析版` = same paper **with** answer+analysis.
Design rule: canonicalize on 原卷版 (question identity, images), then **join 解析版 by
(qn, stem-signature)** to attach `answer` + `analysis`. This fixes the 20.5%-missing-answer defect
at the source instead of via LLM hallucination. Papers lacking a 解析版 are ingested with
`answer=NULL` and flagged `needs_answer_backfill` in the manifest (NOT guessed by LLM in Step 2).

### 2.4 Province/paper identity

Never trust parsed metadata again (v1 dry-run: 40/113 papers had conflicting province signals).
Source manifest = explicit per-paper record `{source_file, province, city?, year, subject,
exam_level, paper_type, variant(原卷|解析), sha256, q_count}` created at **acquisition time** from
filename/dir + human review, stored as JSON (e.g. `database/raw-gaokao/manifest.json`). Pipeline
reads provenance from the manifest only.

---

## 3. Pilot definition (Beijing gaokao, as approved)

1. Restore/adopt `.Trash-1000/files/北京高考题库/` **only after human restoration decision** (I will
   not move files from trash). Target subset: **1–2 subjects × 2021–2025** (e.g. math + english),
   both 原卷版 and 解析版.
2. Build in **staging schema** (`qb_recovery`) on the same DB — never production tables until the
   pilot passes.
3. Pilot acceptance = **end-to-end single paper traceability** first (1 paper → N questions → images
   extracted → DB rows → reverse lookup), THEN batch expansion within pilot scope.
4. Compare against Branch A for the same (subject, year): the pipeline must reproduce ≥ Branch A's
   unique questions for that slice and additionally recover formula/images Branch A lost
   (P0-QB-15/16 + content quality).

---

## 4. What was NOT done / not decided (honesty)

- Nothing implemented; no file moved; no trash content touched; no DB write; no schema change.
- **Not decided:** city-dimension representation for zhongkao (§2.2); whether national-卷 codes map
  to existing provinces rows or need seed additions; vision-LLM vs local OCR for formula images at
  scale (cost/perf trade-off — qwen3-vl-plus precedent exists, but volume for nationwide corpus
  needs a budget decision); where image files physically live (uploads/ vs a new raw-asset store);
  Branch D restore action (human).
- 北京 raw docx are currently in `.Trash-1000` — trash cleanup could destroy the best available
  upstream. Flagged for human action.

---

## 5. Human decisions required before Step 2 (implementation)

| # | Decision |
|---|---|
| 2-1 | Restore `.Trash-1000/files/北京高考题库/` into repo-adjacent `database/raw-gaokao-beijing/` (human file op) — yes/no; and confirm the 北京中考真题（25）.zip disposition |
| 2-2 | Schema step: add **city dimension** for zhongkao now (design only) vs defer to a later zhongkao pilot |
| 2-3 | Multimodal enrichment backend: DashScope qwen3-vl-plus (pay per token) vs local LaTeX-OCR + separate caption model — need volume estimate to budget |
| 2-4 | Image asset store location + retention (uploads/ dir served by app vs object store later) |
| 2-5 | Staging scope approval: create `qb_recovery` schema on local DB + run pilot pipeline inside it |

Until 2-1..2-5 are decided, this design remains frozen and no implementation begins.
