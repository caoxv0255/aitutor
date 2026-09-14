# AI Tutor P0 — Qwen3.7 + Atomic Question Bank Integration Audit

Date: 2026-09-03
Scope: READ-ONLY only. No schema change, no ingest, no data cleansing.
Method: source-code review + live SQL probing via production .env DATABASE_URL (read-only).

---

## 1. Qwen3.7 Configuration Audit

```
当前 provider:        dashscope (primary), deepseek, minimax (fallback)
当前 endpoint:        https://dashscope.aliyuncs.com/api/v1   (DASHSCOPE_API_MODE=native)
                     https://dashscope.aliyuncs.com/compatible-mode/v1 (default = compatible)
当前默认 model:      resolveDefaultModel() → 'qwen-plus' if DASHSCOPE_API_KEY set, else 'deepseek-chat', else 'qwen-plus'
                     env override: LLM_DEFAULT_MODEL
tutor/ask model:     'qwen-plus'  (hardcoded: api/routes/tutor-agent.js:41  const TUTOR_MODEL='qwen-plus';)
/api/proxy model:    client-supplied (validated against whitelist per provider)
vision parse model:  'qwen-vl-max'  (services/llm.js:527)
是否支持 model override: YES, both LLM_DEFAULT_MODEL env override and per-call model in proxy body
是否支持 qwen3.7:       **NO.** services/llm.js whitelist: qwen-plus / qwen-max / qwen-turbo / qwen-vl-max / qwen-vl-plus.
                     DashScope 上 Qwen3 系列 model id 是 "qwen3-max", "qwen3-235b-a22b", "qwen3-30b-a3b" 等,
                     "qwen3.7" 不是一个有效 model id. "qwen3.7-plus/max/flash" 同样不存在.
                     Default fallbacks 链 (qwen-plus→qwen-turbo→deepseek-chat→MiniMax-M2.7-highspeed) 不含 qwen3.
实际调用协议:        OpenAI 兼容模式 (POST .../chat/completions, Bearer auth, messages+model+max_tokens)
```

```
MODEL CONFIGURATION: PARTIAL
```

Reason: Provider/key/protocol all ready, but **no qwen3.7 / qwen3-* model id in code or whitelist**. Adding it requires (a) LLM_DEFAULT_MODEL env, (b) extending API_CONFIGS in services/llm.js (3 lines: endpoint, keyEnv, models list), (c) updating fallback chain. No new dependency. Backend config change only.

---

## 2. Architecture Boundary (per request)

本项目: ❌ 不再采用 image→OCR→question
新目标架构:
```
text / structured question
      ↓
Qwen3.7 (reasoning / understanding)
      ↓
question understanding
      ↓
knowledge point / answer / analysis
```
Qwen3.7 = reasoning layer, NOT OCR. 不自行新增 OCR pipeline.

---

## 3. Question Bank Atomicity Audit

### 3.1 Table schema (post-D068)

| table | primary key | foreign keys | unique constraints | notes |
|-------|-------------|-------------|-------------------|-------|
| `exam_papers` | `id` (integer) | `province_code → provinces.code` | `(province_code, year, subject, exam_level)` | rows=**0** |
| `exam_questions` | `id` (integer) | `paper_id → exam_papers.id` | `question_uid` (UNIQUE), `(paper_id, question_number)` (UNIQUE) | rows=**0**; question content in `stem text` (not JSON); options in `options text`; answer/analysis/kp as `text` |
| `wrong_questions` | `id` (integer) | **NO FK** (question_id, knowledge_point_id are plain `integer`/`varchar` columns NOT enforced) | none | rows=**1** (test row) — but `question_id=NULL`, `kp_id=NULL` |
| `knowledge_points` | `id` (varchar) | none | none | rows=**426**; `source` varchar 标识来源 (.docx/.doc) |
| `personalized_papers` | `id` (integer) | none | none | rows=**0**; subject=NOT NULL; data=text NOT NULL |
| `reports` | `id` (integer) | none | none | rows=**0**; data=text NOT NULL |
| `questions` / `question_options` / `answers` | DO NOT EXIST | — | — | not present in DB. Original plan tables absent. |

Question identifier: `id` (integer PK) + `question_uid` (varchar UNIQUE).
Paper identifier: `id` (integer PK) + composite UK (province_code, year, subject, exam_level).
Question number: `question_number` (integer) — per-paper unique (composite UK).
Question content: `stem` (text); options/answer/analysis/kp all `text` (free-form, not JSON-schema).
Knowledge point: `knowledge_points` (varchar id, subject+name+level).

### 3.2 Core Judgement: One Question = One Record?

**Question Bank:    NOT VERIFIED.**
**wrong_questions: ATOMIC (single record, but q_id/kp_id never populated).**
**personalized_paper: NOT VERIFIED (zero rows, generation path uses deprecated /api/generate-paper).**

Evidence:

| Check | Finding |
|-------|---------|
| `exam_questions > 0` | **0 rows** → no source-to-DB evidence |
| Static 22题 in frontend | Chinese=15, English=**47**(!), Math=10, Physics=10, Chemistry=14, Politics=16. Hardcoded `.question` divs in HTML. NOT from formal DB. |
| Multi-question merge risk | Cannot verify in DB (empty). Schema allows multi-question if a single `stem` field contains e.g. "1. ...\n2. ..." (text column, no constraint). |
| Question split risk | Cannot verify (0 rows). Schema forces `(paper_id, question_number)` UNIQUE — splits would have to create multiple papers. |
| `question_uid` UK | Defined & unique. `backfill-question-uid.js` exists to backfill NULL/empty UIDs. Not yet run. |
| source-to-paper | `exam_papers.paper_file_path` exists (varchar) — unused (rows=0). |
| paper→question 1:N | FK present (`exam_questions.paper_id → exam_papers.id`). |
| wrong_questions.question_id FK | **MISSING.** column exists, no FK. data integrity is application-level only. |
| wrong_questions→KP FK | **MISSING.** `knowledge_point_id` is plain `varchar`, not FK. |
| duplicate detection | None automated. Can rely on UK (paper_id, question_number) and question_uid, but no full dedup script. |

### 3.3 Multi-Question Merge Test (on existing data)

```
wrong_questions.id=1: len=19, newlines=0, no 'question' keyword repetition.
```
Sample of wrong_questions content is single-line, short. Cannot test multi-question at scale because there is only **1 row in DB** (a test record from this audit's smoke test).

### 3.4 Source → Parser → DB Trace

```
raw source files:      database/parsed-examples/    →  62 files (45 .json + 17 .txt debug)
parsed artifacts:     JSON files (e.g., database/parsed-examples/biology_2024.json)
ingest scripts:       scripts/import-hunan-physics.js
                      scripts/seed-papers.cjs
                      scripts/parse-questions.js
                      scripts/parse-remaining-papers.js
                      scripts/parse-doc-retry.js
                      scripts/parse-questions-beijing.js
ingested questions:    0   (DB exam_questions rows = 0)
DB questions:          0
loss / merge / split: NOT VERIFIED (no ingested data to audit)
```

**Ingest pipeline exists and targets `exam_papers` + `exam_questions` tables**, but production has never run it (or last run deleted/cleared). Cannot confirm atomicity from production.

### 3.5 Sample Verification (random/stratified — only available data)

```
sample 1:  wrong_questions.id=1
   content="已知 f(x)=x²，则 f(2)=？"  (single line, single question)
   question_id=NULL, knowledge_point_id=NULL  ← NOT linked to formal question bank
   ← because formal question bank is empty
```

Not enough data to do stratified 10-20题 sample.

### 3.6 Static 22题 Verdict

```
form math-exam.html 内嵌 .question 数 = 10
form english-exam.html 内嵌 .question 数 = 47
form chinese-exam.html 内嵌 .question 数 = 15
form physics-exam.html 内嵌 .question 数 = 10
form chemistry-exam.html 内嵌 .question 数 = 14
form politics-exam.html 内嵌 .question 数 = 16
Total 内嵌题目 ≈ 112
```

```
STATIC 22 QUESTIONS: NOT FORMAL QUESTION BANK
```

The "22题" framing in earlier UI staging was a single-page subset. In practice, each exam page has 10-47 hardcoded `.question` divs. None link to `exam_questions.id`. Not from formal bank. They serve the "做预测卷" entry as a static mock/demo.

---

## 4. Manual Input Entry (feasibility audit, no code change)

| Field required by wrong_questions | Exists as column? | UI form? |
|------|------|------|
| subject | yes (`subject_code`, `subject`, `exam_level`) | **NO** (wrong-book is view-only) |
| question text | yes (`content`) | **NO** |
| user answer | yes (`user_answer`) | **NO** |
| correct answer | yes (`correct_answer`) | **NO** |
| knowledge point | yes (`knowledge_point_id` + `knowledge_point_name`) | **NO** (no dropdown wired) |
| question→formal bank link | `question_id` (nullable, no FK) | **NO** |

```
MANUAL INPUT FALLBACK: NOT IMPLEMENTED
```

Schema supports all fields. Only UI + validation + KP-dropdown wiring missing.

---

## 5. Loop End-to-End Status

```
Layer                           Status
─────────────────────────────────────────────────
Qwen3.7 model config             PARTIAL   (no qwen3-* in whitelist)
Question Bank                   FAIL      (0 rows; pipeline never run)
Wrong Question                   PARTIAL   (schema OK, 1 test row w/ q_id=NULL kp_id=NULL)
Knowledge Mapping               PARTIAL   (schema OK, no FK enforcement; KP table populated 426 rows)
Weakness                         FAIL      (weak-points API returns [] — no data)
Personalized Paper               FAIL      (calls deprecated /api/generate-paper; legacyGone)
Report Generation               FAIL      (no path; /api/tutor/ask is the only LLM backend)

Manual wrong-question entry      NOT IMPLEMENTED
Static "做预测卷" questions       NOT FORMAL QUESTION BANK (hardcoded HTML)
```

**结论: 即使不用 OCR, 改成 Qwen3.7 + 纯文本录入 + 不引入新 backend, 完整学习闭环当前 NOT VERIFIED。**

---

## 6. P0/P1/P2 Classification

### P0 (blocking)

1. **Qwen3.7 model config not in code** — qwen3.7 not a valid DashScope model id; add qwen3-max (or actual id) to `services/llm.js` whitelist + set LLM_DEFAULT_MODEL.
2. **正式题库为空** — `exam_questions=0, exam_papers=0`. 解析管线未产出任何记录。Ingest 不在我的 audit 范围，但前端"做预测卷"全用静态题，与正式题库无关。
3. **个性化预测卷走死 API** — `/api/generate-paper` 2026-09-23 sunset。仍在被前端调用。Qwen3.7 替换 + 手动录入都不能直接打通 personalized paper（契约不匹配 — tutor/ask 是 Q&A，不是试卷生成）。需要 backend 重新提供 paper 生成 contract，或前端改造。
4. **weak-point pipeline 在无 question_id/kp_id 时返回 []** — 即使录入错题，若未建立 question→KP 映射，薄弱点仍为 0。manual entry UI 必须能让 KP 选择（或自动 LLM 抽取 KP_id）。

### P1 (workaround exists)

1. wrong_questions 缺 FK — 应用层 dedup 可补。
2. question_uid 未回填 — 跑 backfill-question-uid.js 即可。
3. 22 题内嵌 — 替换为从 `exam_questions` 拉取（但题库为空，所以是 P0）。
4. KP 描述用纯文本 — Qwen3.7 解析后能填入 `description`，但当前 `subject + name` 复合 UK 与 `description` 重复条目需 LLM dedup。

### P2 (optimization)

1. wrong_questions 错误分类 (`error_types`, `error_category`) 表已就位但 UI 缺，暂不接入。
2. `exam_questions` 28 列结构过宽 (含 physics_structure/chemistry_structure/math_structure jsonb) — 当前未用。
3. 报告 / 个性化卷 UI 整体重设计。

---

## 7. Final Matrix

| Item | Status |
|---|---|
| Qwen3.7 model config | **PARTIAL** (provider/key/protocol ready; whitelist lacks qwen3-*) |
| Question atomicity | **NOT VERIFIED** (DB empty) |
| One question → one record | **NOT VERIFIED** |
| Multi-question merge | **NOT VERIFIED** (no data; schema allows merge via text field) |
| Question split | **NOT VERIFIED**; protected by `(paper_id,question_number)` UK + `question_uid` UK |
| Source → DB traceability | **NOT VERIFIED** (pipeline exists but never produced) |
| Options completeness | **NOT VERIFIED** (text column, no schema enforcement) |
| Answer completeness | **NOT VERIFIED** |
| Knowledge mapping | **PARTIAL** (426 KP rows; no FK from wrong_questions) |
| Static 22题 | **NOT FORMAL QUESTION BANK** (hardcoded HTML, no DB link) |
| Manual fallback | **NOT IMPLEMENTED** (schema supports all fields) |
| Wrong-question loop | **FAIL** (pipeline empty without proper q_id+kp_id) |
| Personalized paper | **FAIL** (deprecated API + wrong contract) |
| Report generation | **FAIL** (no path) |

---

## Executive Summary

```
ATOMICALLY VALID:    NO  (cannot verify — DB is empty)
PARTIALLY ATOMIC:   NO  (schema supports; data missing)
NOT ATOMIC:          Not demonstrated, but the schema design allows it.

QWEN3.7 READY:      NO  (key + provider + protocol ready; model id not in code)
```

---

## 8. Recommended Next Action (no code change in this audit)

1. **User clarification needed** for Qwen3.7 → provide exact model id (e.g. `qwen3-max` or specific name from DashScope catalog).
2. Add `qwen3-*` to `services/llm.js` API_CONFIGS.models + set `LLM_DEFAULT_MODEL` env.
3. Run an end-to-end dry run of the ingest pipeline (`scripts/parse-questions.js`) on a single subject → confirm atomicity.
4. Implement minimal manual entry UI OR re-architect `personalized-paper.html` against a new "paper generator" contract (currently calls deprecated endpoint).
5. Verify wrong_questions row gets a real KP link → confirm weakness > 0.

本轮**不修复**，仅审计。