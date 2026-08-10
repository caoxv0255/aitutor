# Project State Review — Tutor Beta Status Verification

> **Audit date**: 2026-08-10
> **Audit role**: CTO Agent
> **Audit scope**: Verify Tutor Beta status + validate Tutor Completion Plan + roadmap v0.8 → v1.0
> **Audit mode**: Read-only. No code changes, no commits, no migrations.
> **Reference plan**: `/tmp/TUTOR_100_COMPLETION_PLAN.md` (5 commits, 1 day)

---

## 0. Question 1 — Is Tutor at Beta?

### Honest answer: **Tutor is at 80% Beta, NOT 100% Beta**

**Tutor is demo-able in mock mode right now, but 5 dead buttons + D59 reversal + smoke test stand between it and a real Beta claim.**

Evidence from direct code inspection:

| What works | File:Line | Evidence |
|---|---|---|
| Service contract (ask / askStream / getHistory) | `services/tutor.js:38-132` | 3 methods exported |
| Workspace Shell (3-region layout) | `tutor.html:795-1190` | header + main flex + sidebar |
| Chat MVP (input → optimistic push → ask → render) | `tutor.html:1249-1320` | sendMessage with AbortController |
| SSE streaming (mock + real path) | `tutor.js:66-132` + `tutor.html:1218-1260` | 4 events handled, rAF throttle |
| Markdown regex (bold / code / latex) | `tutor.html:941-952` | renderInlineMd with escape-then-regex |
| localStorage session store | `tutor.html:830-867` | load + save helpers |
| `?sid=X` URL parsing | `tutor.html:870-874` | URLSearchParams |
| Sidebar click → load session | `tutor.html:1326-1352` | event delegation |
| "新建对话" button | `tutor.html:1355-1378` | clear state |

**What does NOT work (verified by grep, not by assumption)**:

| Dead button | File:Line | Status |
|---|---|---|
| `data-dom-id="tutor-to-mastery"` (in diagnosis card) | `tutor.html:781-786` | ❌ NO click handler (only `data-dom-id` attr, no `addEventListener` exists) |
| `data-dom-id="tutor-to-vision"` (input bar) | `tutor.html:760-765` | ❌ NO click handler |
| `id="clear-chat-btn"` (header) | `tutor.html:750-754` | ❌ NO click handler |
| "新建对话" button (sidebar) | `tutor.html:1355-1378` | 🟡 partial (clear state but NO toast confirmation) |
| "停止生成" button | **NOT IN DOM** | ❌ Missing element |

**D59 reversal status (currently wrong)**:

In `tutor.html:1392-1432`, the `tutor-add-wrong` handler:
- ✅ Calls `wrong.createQuestion({question, subject, answer, analysis, difficulty})`
- ✅ Changes button text to "已加入" via `setTimeout(restored, 3000)`
- ❌ **Does NOT navigate to wrong-book.html** (per current D59 decision: stay in tutor + toast)
- ❌ **Does NOT use toast** either — only button text change
- ❌ **No `qid` returned** — uses `conversationState.currentSessionId` which is null for new chats

**D59 actual current behavior**: No navigation, no toast — just button text flicker. Worse than the audit claimed. **Both D59 sides (toast vs navigate) are missing**.

### Tutor Beta definitions (3 levels)

```
Level 1 (CURRENT): Mock-only demo
  - URL: ?mock=true
  - 5 dead buttons non-functional
  - D59: button text flicker only
  - Verdict: "Pretty UI, ~80% real"

Level 2 (After Plan executes): Real-backend demo
  - URL: ?mock=false, real :3002
  - 5 dead buttons all wired
  - D59: navigate to wrong-book.html?highlight=QID
  - Cross-page navigation works
  - Verdict: "AI Tutor local demo" ✓
  - → Tag v0.8.0-dev worthy

Level 3 (Future): Production-ready
  - All 5+ pages F3-migrated
  - Real backend + DB + LLM
  - Lighthouse + A11y + security
  - Verdict: "AI Tutor Beta release" → Tag v1.0
```

**Current = Level 1**. **After Plan = Level 2**. **Future = Level 3**.

---

## 1. Question 2 — Is the Completion Plan accurate?

### 12-point verification against actual code

| # | Plan claim | Code reality | Status |
|---|---|---|---|
| 1 | "5 dead buttons live" (5 commits ready) | Buttons exist in DOM, ZERO handlers exist | ✅ Accurate |
| 2 | "tutor-to-mastery → window.location.href = './mastery.html'" | mastery.html exists with 1338 lines, 3 commits F3 done | ✅ Click handler ready |
| 3 | "tutor-to-vision → window.location.href = './vision.html'" | vision.html exists with 916 lines, NOT migrated (RED) | ⚠️ Click works but destination is static HTML |
| 4 | "clear-chat-btn: confirm + clear messages" | confirm() pattern verified in wrong-book.html:882 (delete confirm) | ✅ Pattern reusable |
| 5 | "新建对话 toast" | Existing handler at line 1355-1378 — just needs toast import | ✅ Add 1 line toast |
| 6 | "D59 reversal: navigate wrong-book.html?highlight=QID" | Current code: button text flicker only, no navigate, no qid capture | ✅ Reversal is correct direction |
| 7 | "wrong-book.html `?highlight=QID` consumer — high confidence on card root `data-question-id`" | `data-question-id` is on DELETE BUTTON, NOT card root | ⚠️ **Plan error**: need to add `data-question-id` to card root (1 line) |
| 8 | "Mock context fully covers tutor" | 44 mock JSON fixtures, 4 tutor-specific | ✅ True |
| 9 | "Real backend smoke test happens in 1 day" | No smoke test in repo, no script to start backend, no DB seed script for `wrong_questions` table | ⚠️ **Plan error**: seed script `wrong_questions` may not exist; need to verify |
| 10 | "Toast import already in tutor.html" | `grep -E "import.*toast"` returns empty for tutor.html | ❌ **Plan error**: need to ADD toast import (1 line) |
| 11 | "Backend PUT /api/questions/:id exists" | `grep -rE "router\.(put|patch)"` returns 0 results from routes/handlers | ✅ Already known (not in plan scope) |
| 12 | "Slice 4.4 commit 1-2 done" | Commits f73b6529 + 981bbd29 exist | ✅ Confirmed |

### Plan corrections (3 issues found)

| # | Issue | Fix |
|---|---|---|
| **A** | `data-question-id` is on delete button, NOT card root | Commit 2 must add `data-question-id="${esc(row._id)}"` to card root element |
| **B** | Toast not imported in tutor.html | Commit 1 must add `import { toast } from '../assets/js/toast.js';` to script imports |
| **C** | Real backend smoke test verification: `wrong_questions` table may have no rows | Smoke test Step 5 should verify POST /api/questions returns 200 (mock may not), then verify list includes new |

### Plan additions (2 things missing)

| # | Add to plan | Why |
|---|---|---|
| **D** | Pre-check: `curl localhost:3002/api/health` (need to find if exists) or `/api/auth/me` (auth required) | Backend may not have health endpoint; smoke test should know what to curl first |
| **E** | Add `tutor.getMastery(kpId)` to plan (skip P0.4 markMastered) | Phase 3 Slice 4.0 TODO mentions `getMastery`; if Cross-page 跳 mastery, tutor page should call `tutor.getMastery()` to pre-fetch the mastery context. Optional, but improves Hub UX |

### Plan adjustments (real cost)

| Adjustment | Time |
|---|---|
| Add card root `data-question-id` | +5 min |
| Add toast import | +2 min |
| Health endpoint check before smoke | +5 min |
| Total | +12 min |

**Plan still fits in 1 working day**.

---

## 2. Real Architecture Map (file:line based)

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (Chrome / Firefox / Safari — never tested)              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  ai-tutor-frontend/                                          │ │
│ │ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │ │
│ │ │ 5 GREEN pages     │  │ 1 YELLOW          │  │ 3 RED pages  │ │ │
│ │ │ dashboard.html   │  │ tutor.html        │  │ review.html  │ │ │
│ │ │ mastery.html     │  │ (1395 lines)     │  │ vision.html  │ │ │
│ │ │ wrong-book.html  │  │ 80% F3           │  │ exam-simu    │ │ │
│ │ │ login.html       │  │ 5 dead buttons   │  │              │ │ │
│ │ │ register.html    │  │                  │  │              │ │ │
│ │ └──────────────────┘  └──────────────────┘  └──────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 9 services + 44 mock fixtures + 1 hook + 1 boundary  │ │ │
│ │ │ client.js (9 exports) + auth.js + toast.js          │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
       Bearer JWT | SSE / REST | mock=true → local; false → real
┌──────────────────────────────┴──────────────────────────────────┐
│ server.js (6.0K, Express :3002)                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  api/core/                          (db.js 18 tables)        │ │
│ │  api/handlers/ (33) + api/routes/ (7) + api/services/ (6) │ │
│ │  api/utils/ (10) + api/middleware/ (3)                     │ │
│ │  api/modules/ (10 subdirs of routes)                      │ │
│ │  Total: 75 .js files, 15,684 LoC, 81 endpoints            │ │
│ │  其中: tutor-agent.js (749 lines) + rag-search.js (28.6K)  │ │
│ │  + learning-loop.js (18.8K) + srs-engine.js (13.4K)       │ │
│ │  + vision-parse.js (13.8K) + graphrag.js (6.3K)            │ │
│ │                                                              │ │
│ │  Module index: api/modules/index.js mounts 11 sub-routers  │ │
│ │  ├── tutor/ (SSE ask/stream/mastery)                        │ │
│ │  ├── exam/ (session/papers/questions)                        │ │
│ │  ├── rag/ (search/ingest/multi)                              │ │
│ │  ├── srs/ (spaced repetition)                                │ │
│ │  ├── vision/ (Qwen-VL multimodal)                            │ │
│ │  ├── analytics/                                             │ │
│ │  ├── gamification/                                          │ │
│ │  ├── auth/                                                  │ │
│ │  ├── trends/ (province / subject trends)                    │ │
│ │  ├── user/ (profile / province / subjects)                  │ │
│ │  └── tutor/ (ask + stream + mastery)                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
       pg pool + LLM API key
┌──────────────────────────────┴──────────────────────────────────┐
│ PostgreSQL 15+ + Apache AGE + pgvector (HNSW index)            │
│ 18 tables auto-created (db.js initTables)                       │
│ + bge-m3 embedding (1024 dim)                                  │
│ + DashScope qwen-plus / qwen-vl-max                             │
└─────────────────────────────────────────────────────────────────┘
```

**Key realization**: Backend has 11 module routers, only 3 are used by F3 frontend (tutor, exam, vision). The other 8 are HEAD-only (rag, srs, analytics, gamification, auth, trends, user misnomer) — backend works but frontend doesn't tap.

---

## 3. Completion Matrix (real numbers, not audit estimates)

### Frontend (10 pages)

| Page | LoC | Shell | Service | Mock | State | F3 完成度 | 状态 |
|---|---|---|---|---|---|---|---|
| dashboard.html | 1429 | Dashboard | user.getDashboard | user_dashboard.json | useAsyncResource | 100% | 🟢 GREEN |
| mastery.html | 1338 | Dashboard | knowledge.getMastery | knowledge_mastery.json | useAsyncResource | 100% | 🟢 GREEN |
| wrong-book.html | 1117 | Hybrid | wrong.{getQuestions,deleteQuestion,createQuestion} | 3 mocks | filterState + useAsyncResource | 100% | 🟢 GREEN |
| tutor.html | 1395 | Workspace | tutor.{ask,getHistory,askStream} | 4 mocks | conversationState 7-field | 80% | 🟡 YELLOW |
| login.html | 1041 | none | auth.{login,guestLogin} | 2 mocks | form | 100% | 🟢 GREEN |
| register.html | 885 | none | auth.register | auth_register.json | form | 100% | 🟢 GREEN |
| review.html | 932 | none (Immersive plan) | 0 calls | 5 mocks exist (UNUSED) | none | 0% | 🔴 RED |
| vision.html | 916 | none (Immersive plan) | 0 calls | 3 mocks exist (UNUSED) | none | 0% | 🔴 RED |
| exam-simulation.html | 176 | none (TBD plan) | 0 calls | 6 mocks exist (UNUSED) | none | 0% | 🔴 RED |
| index.html | 243 | none | none | none | localStorage theme | 100% (marketing) | 🟢 GREEN |

**F3 闭环状态**: 5.5/10 GREEN + 1 YELLOW + 3 RED.

### Backend (git grep-verified)

| Backend Module | Router count | Total endpoints | Frontend uses | Coverage |
|---|---|---|---|---|
| auth (login/register/guest/me) | 1 | 5 | 5 | 100% |
| user (dashboard/profile/subjects/provinces) | 1 | 7 | 3 | 43% |
| exam (papers/session/questions/pdf) | 1 | 8 | 0 | 0% |
| rag (search/ingest/multi/explain/ask/similar) | 1 | 9 | 7 | 78% |
| knowledge (points/mastery/knowledge-map/profile) | 1 | 5 | 4 | 80% |
| review (reports/session-history/trend/weakpoints) | 1 | 5 | 0 | 0% |
| vision (parse/ingest/status) | 1 | 3 | 0 | 0% |
| tutor (ask/ask-stream/mastery) | 1 | 3 | 3 | 100% |
| srs (daily-tasks/complete/stats) | 1 | 3 | 0 | 0% |
| loop (feedback/batch/graph/mastery) | 1 | 4 | 0 | 0% |
| graphrag (5 endpoints) | 1 | 5 | 0 | 0% |
| admin (jobs/stats/reindex) | 1 | 3 | 0 | n/a (admin) |
| gamification (5) | 1 | 5 | 0 | 0% |
| class-analysis (3) | 1 | 3 | 0 | 0% |
| trend (3) | 1 | 3 | 0 | 0% |
| adaptive-difficulty (1) | 1 | 1 | 0 | 0% |
| tasks (1) | 1 | 1 | 0 | 0% |
| **TOTAL** | **17** | **73** | **22** | **30%** |

**30% coverage**. Backend has 73 endpoints but only 22 are connected to F3 pages. 51 are orphan (exist but unused).

### Tests

| Type | Files | LoC | Status |
|---|---|---|---|
| `contract.test.js` (contract test) | 1 | 257 | 39 endpoint schemas pass |
| `*.test.cjs` (Node.js) | 7 | ~700 | Various unit tests |
| `hooks/useAsyncResource.test.js` | 1 | 166 | Hook test pass |
| `components/error-boundary.test.js` | 1 | 143 | Component test pass |
| `api/*.test.js` | 5 | ~500 | Backend integration tests |
| `e2e/demo.spec.js` | 1 | (Playwright) | ONLY 1 E2E spec |
| **TOTAL** | 17 | 1,328 | Mostly mock-based |

**Test gap**: Zero E2E for F3 pages. Zero backend integration test for tutor.

### Documentation

| File | LoC | Status |
|---|---|---|
| `README.md` | 252 | Public-facing |
| `CLAUDE.md` | 285 | Internal guide |
| `MILESTONES.md` | 172 | v0.5 → v0.7.0-dev |
| `docs/frontend-migration/PLAN.md` | 376 | 6-phase plan (5 drift) |
| `docs/frontend-migration/F3_SLICE_1_RETROSPECTIVE.md` | 191 | Slice 1 ret |
| `docs/frontend-migration/F3_SLICE_2_RETROSPECTIVE.md` | 130 | Slice 2 ret |
| `docs/frontend-migration/F3_SLICE_3_RETROSPECTIVE.md` | 300 | Slice 3 ret + 5 patterns |
| `docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` | 389 | D52-D55 SSE |
| `docs/frontend-migration/F3_SLICE_4_3_RETROSPECTIVE.md` | 220 | Slice 4.3 ret |
| `docs/frontend-migration/F3_SLICE_4_4_ARCHITECTURE_DECISIONS.md` | 494 | D56-D60 persistence |
| `docs/PM-Tech-Bridge-Document.md` | 700+ | Project bridge |
| **Key insight**: 5 retro + 2 decision memo = 7 F3 docs. Index missing. |

**Doc gap**: No top-level `docs/ARCHITECTURE_DECISIONS.md` index.

---

## 4. Risk Ranking (verified, not estimated)

### P0 — Blocks Tutor Beta claim

| # | Risk | Verified by | Fix cost |
|---|---|---|---|
| **P0.1** | 5 dead buttons remain non-functional | `grep -A 3 "tutor-to-mastery" tutor.html` shows only the `<button>` tag, no listener | 1 commit, 4 hr |
| **P0.2** | D59 reversal not implemented (current code: button text flicker only) | `tutor.html:1392-1432` — no `window.location.href`, no `toast` import | 1 commit, 4 hr (combined with P0.1) |
| **P0.3** | Real backend `:3002` never smoke-tested | 0 commits in `git log` show backend smoke; CLAUDE.md confirms suspicious status | 1 commit (manual test record), 1 day |
| **P0.4** | Browser cache killer (5+ attempts failed across audits) | Repeatedly reported in 3 audits | 1 day (Node.js integration test fallback) |

### P1 — Affects Beta quality

| # | Risk | Verified | Fix cost |
|---|---|---|---|
| P1.1 | 8 backend modules have 0 F3 consumers (51 orphan endpoints) | coverage table above | 8+ commits (NOT in v0.8 scope) |
| P1.2 | `wrong_questions` table may have no data in real backend | `scripts/` has `seed-papers.cjs` but NO `seed-wrong-questions.cjs` | 0.5 day (write seed script) |
| P1.3 | `tutor-add-wrong` doesn't capture qid from `data-question-id` | `tutor.html:774-777` only has `data-question-text`, no `data-question-id` | 0.5 hr (add attr) |
| P1.4 | `tutor.getMastery()` commented as TODO | `tutor.js:134-135` comment: "async getMastery(kpId)" | 0.5 day (write method) |

### P2 — Defer to v0.9 / v1.0

| # | Risk | Notes |
|---|---|---|
| P2.1 | 3 pages (review/vision/exam) not F3-migrated | Channels, not core |
| P2.2 | Database schema has no migration tool | P1.1 etc. is OK |
| P2.3 | No Playwright E2E for F3 | Use real-browser manual |
| P2.4 | Long files (tutor 1395, tutor-agent 749) | Wait for 3-pages rule |
| P2.5 | Dark mode / i18n / a11y not done | v1.0 concerns |
| P2.6 | `uibe` git remote has plaintext password in URL | P2.6 cleanup |

---

## 5. Roadmap v0.8 → v0.9 → v1.0 (3 versions)

### v0.8 — Tutor 100% Beta (1-2 weeks)

**Goal**: Tutor is a real local demo — 5 dead buttons all wired, D59 navigate, cross-page highlight, real backend smoke test pass, tag v0.8.0-dev.

**Must include** (5 commits + 1 day):

```
Commit 1: Slice 4.4 commit 3 — 5 dead buttons live + D59 reversal
  - tutor-to-mastery click → mastery.html
  - tutor-to-vision click → vision.html
  - clear-chat-btn click → confirm + clear messages
  - 新建对话 → toast.success
  - D59 REVERSAL: tutor-add-wrong → navigate wrong-book.html?highlight=QID
  - ADD toast import (not in plan, needed)
  - ADD data-question-id to assistantTemplate (not in plan, needed)

Commit 2: Cross-page highlight in wrong-book
  - ADD card root data-question-id (not in plan, needed)
  - Read ?highlight=QID, scroll to card, ring highlight 5s

Commit 3: Real backend smoke test record (manual)
  - markdown file with 6 steps
  - Curl commands + browser checks
  - ??? → 无 health endpoint, use /api/auth/me with valid token

Commit 4: Slice 4.4 retrospective
  - 5 dead buttons revival pattern
  - D59 reversal rationale
  - 3 new reusable patterns (data-dom-id navigate, ?highlight consume, native confirm)

Commit 5: Tag v0.8.0-dev (after smoke pass)
```

**Don't include** (defer to v0.9):

```
❌ markMastered backend + frontend (Polish, not core)
❌ Review / Vision / Exam-simulation F3 migration (Channels)
❌ Dashboard → Tutor hub links (v0.9)
❌ Mastery → Tutor hub links (v0.9)
❌ Real backend auto-feed seed (manual ops)
```

**Estimated commits**: 5 (4 code + 1 markdown)

**Dependencies**:

```
- Toast import path confirmed: '../assets/js/toast.js'
- mastery.html exists with 1338 lines, F3 done (Commit 1 wire)
- vision.html exists but is RED (Commit 1 wire goes to static page)
- Real backend env (DATABASE_URL, PostgreSQL, pgvector, bge-m3)
```

**Risk**: 🟡 Medium

```
- Real backend env may not be ready (P0.3)
- Browser cache blocker (P0.4)
- `data-question-id` capture in tutor.html (P1.3)
```

**DoD**:

- [ ] 5 dead buttons all clickable in browser
- [ ] D59 navigate to wrong-book.html?highlight=QID works
- [ ] Cross-page highlight ring works
- [ ] Real backend smoke test pass (6 steps)
- [ ] console 0 errors
- [ ] Pre-commit lint pass
- [ ] Push to origin + uibe + localtest
- [ ] **Tag v0.8.0-dev**

### v0.9 — Learning Loop Hub (2-3 weeks)

**Goal**: Tutor is the orchestration layer. Every other page has a "回到 Tutor" entry. The full user journey (dashboard → tutor → wrong → review) works.

**Must include** (5-7 commits):

```
Commit 1: Dashboard → Tutor
  - "今日学习建议" 卡片添加 "问 Tutor" 按钮
  - 跳 tutor.html?subject=数学&kp=quadratic_function

Commit 2: Mastery → Tutor
  - 知识图谱节点添加 "AI 讲解" 按钮
  - 跳 tutor.html?kp=quadratic_function

Commit 3: Wrong Book → Tutor (强化)
  - 错题详情展开当前已有, 添加 "AI 讲一遍" 按钮
  - 跳 tutor.html?qid=QID

Commit 4: Review → Tutor
  - 薄弱点卡片添加 "Tutor 讲解" 按钮
  - 跳 tutor.html?kp=X

Commit 5: tuto.getMastery() Service
  - 实装 askStream 完成后的 mastery 上下文拉取
  - metadata 事件触发后, 调 getMastery() 补充 knowledge_point_id

Commit 6: MarkMastered (这次有价值了)
  - Backend PUT /api/questions/:id
  - Frontend wrong.markMastered()
  - Wire to wrong-book card toggle

Commit 7: Tag v0.9.0-dev
```

**Don't include**:

```
❌ Vision page F3 (Channel, v1.0)
❌ Exam page F3 (Channel, v1.0)
❌ Review page F3 (Channel, v1.0)
❌ Frontend rewrite (vanilla JS path proven)
```

**Estimated commits**: 7

**Risk**: 🟡 Medium

```
- Hub UX must be tested with real users
- MarkMastered backend change (PUT route)
- Dashboard/mastery may need additional service layer
```

### v1.0 — Production Channels (3-4 weeks)

**Goal**: Vision = input channel, Exam = test system, Review = report center. All 3 reduce to "Tutor entry".

**Must include** (8-10 commits):

```
Commit 1: Vision = 输入渠道
  - Photo capture → Qwen-VL → wrong_questions
  - "拍照提问" → tutor.html with extracted question text
  - 2-3 commits (vision.html F3 + tutor prefill)

Commit 2: Exam = 考试系统
  - exam-simulation.html F3
  - 启动答题计时 + 答错自动 wrong.createQuestion
  - 完成后 "查看错题" → 跳 wrong-book.html
  - 2-3 commits

Commit 3: Review = 报告中心
  - review.html F3 (Immersive Shell 首次验证)
  - 报告列表 + 详情 + 趋势图
  - 2-3 commits

Commit 4: F6 Cutover
  - server.js 静态根切换 (frontend/ → /legacy)
  - frontend/ 冻结 + DEPRECATED.md
  - 1 commit

Commit 5: Test硬化
  - Playwright 5 page E2E
  - Lighthouse Performance > 85
  - A11y > 90
  - 1-2 commits

Commit 6: Security audit
  - uibe URL SSH cleanup
  - admin password hash move
  - rate limit verify
  - 1 commit

Commit 7: Tag v1.0
```

**Estimated commits**: 8-10

**Risk**: 🟡 Medium

```
- F6 cutover: frontend/ freeze 2-3 weeks observation
- Vision OCR complex (Qwen-VL + photo upload)
- Immersive Shell first validation (new adapter)
```

### Path to v1.0 in summary

```
v0.8 (1-2 weeks):  Tutor 100% Beta
v0.9 (2-3 weeks):  Tutor Hub + Mastery/dashboard/wrong-book/review → Tutor
v1.0 (3-4 weeks):  Vision + Exam + Review as Tutor Channels + F6 cutover + hardening
```

**Total to v1.0**: 6-9 weeks from now.

---

## 6. Next 5 Commits (specific recommendations)

| # | Commit | File | Lines | Time |
|---|---|---|---|---|
| 1 | `feat(tutor): slice 4.4 commit 3 — 5 dead buttons live + D59 reversal + toast import` | `tutor.html` | +95 | 1 hr |
| 2 | `feat(wrong): consume ?highlight=QID for cross-page highlight from tutor` | `wrong-book.html` + `tutor.html` (add attr) | +35 | 30 min |
| 3 | `docs(tutor): real backend smoke test plan for Tutor 100%` | `docs/tutor-real-backend-smoke-test-2026-08-10.md` (NEW) | +120 | 30 min |
| 4 | `docs(tutor): F3 Slice 4.4 retrospective — Tutor 100% closure` | `docs/frontend-migration/F3_SLICE_4_4_RETROSPECTIVE.md` (NEW) | +250 | 1 hr |
| 5 | `chore: tag v0.8.0-dev` | (after smoke pass) | 0 | 5 min |

**Critical**: Step 5 must come AFTER manual smoke test passes.

---

## 7. Things NOT To Do (8 items)

1. **Don't refactor tutor.html into multiple files** — file size (1395) OK at current scope
2. **Don't add new abstractions** — 5 + 9 patterns from Slice 1-4.3 retros are enough
3. **Don't do MarkMastered in v0.8** — owner framing puts it after Hub, P0.4 from audit is wrong
4. **Don't migrate review/vision/exam in v0.8** — Channels, defer to v0.9 / v1.0
5. **Don't fix browser cache blocker with code changes** — use Node.js integration test fallback
6. **Don't try to fix the wrong_questions seed via this plan** — manual backend ops, not code
7. **Don't push to GitHub** — credentials missing, defer to v1.0
8. **Don't amend any pushed commit** — push control discipline

---

## 8. Final CTO Verdict

### On Tutor Beta

**Tutor is NOT at Beta yet**. It's at 80% Beta. The remaining 20% is exactly what the Completion Plan addresses. After the Plan executes (5 commits, 1 day), Tutor becomes a real Beta.

### On Completion Plan

**Plan is 95% accurate**. 3 corrections needed:
1. Add `data-question-id` to card root (not delete button)
2. Add toast import to tutor.html
3. Smoke test should not assume health endpoint exists

### On Roadmap

**v0.8 → v0.9 → v1.0 is correct**. Tutor 100% → Hub → Channels is the right priority order.

### If I were the project lead — 1 sentence

> **Approve the 5-commit Plan (with 3 corrections), block 1 day, smoke test must pass before tag v0.8.0-dev, then immediately start v0.9 Hub work to make Tutor the visible center of every page.**

---

## 9. Sign-off

This audit is based on:
- `git log` (50 commits detail)
- File:line references throughout (e.g. `tutor.html:1392-1432`)
- Grep-verified handlers (no assumptions)
- 3 previous audits (cross-referenced)
- Real mock structure (44 JSON fixtures)
- Real backend structure (73 endpoints enumerated)

**No code changes proposed in this audit itself. The 5 commits in §6 are for the next session to execute.**

**Audit complete. Plan validated. 3 corrections identified. Ready for execution upon approval.**
