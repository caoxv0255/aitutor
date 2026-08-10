# Tutor Real Backend Smoke Test

> **Date**: 2026-08-10
> **Slice**: 4.4 commit 3 (D59 reversal + 5 dead buttons)
> **Goal**: Validate `ai-tutor-frontend` F3 pages against **real** `:3002` backend (not mock)
> **Status**: ⏳ PENDING — manual test record

## Why this matters

9 F3 commits + 4 additional commits (Slice 4.0–4.4 c1-c4) have **never** been tested against real backend. All F3 verification has been **mock-only** (`?mock=true`). The 9 commits + 4 commits shipped code that **may not work** against real backend due to:

- Backend response shape drift (mock fixtures manually written, not auto-generated)
- Auth header differences (Bearer JWT vs mock no-auth)
- CORS / `ALLOWED_ORIGINS` config
- LLM `/api/tutor/ask/stream` SSE wire format differences
- pgvector / bge-m3 embedding model availability
- wrong_questions table seeding status

## Pre-conditions

| # | Check | Required |
|---|-------|----------|
| 1 | `DATABASE_URL` set in `.env` | ✅ PostgreSQL with pgvector + Apache AGE |
| 2 | `DASHSCOPE_API_KEY` set | ✅ qwen-plus access |
| 3 | `JWT_SECRET` set | ✅ auth dev bypass auto-loads |
| 4 | `ALLOWED_ORIGINS` includes `http://localhost:9001` | ✅ CORS for HTTP server |
| 5 | `node_modules` installed | ✅ `npm install` |
| 6 | `git pull` (latest main) | ✅ Slice 4.4 c1-c4 commits |
| 7 | Empty tables OR seed script ready | ✅ Run `node scripts/seed-wrong-questions.cjs` if empty |
| 8 | Real browser (chrome / firefox) | ❌ NOT browser tool (cache blocker) |

> **Health check**: backend has NO `/api/health` endpoint. Use `/api/auth/me` with valid token as health check.

## Step 1 — Start backend

```bash
cd /home/cx/aitutor
node server.js &
# Expect: "✅ PostgreSQL 数据库连接池初始化成功" within 2s
# Expect: "Server listening on port 3002"
```

If bge-m3 / Ollama not running, embed-related endpoints will fail. Mark in results.

## Step 2 — Start frontend mock-off

```bash
cd /home/cx/aitutor
python3 -m http.server 9001 --bind 127.0.0.1 --directory ai-tutor-frontend
# URL: http://localhost:9001/pages/login.html
```

## Step 3 — Login flow (real backend)

Open `http://localhost:9001/pages/login.html` in **real browser** (not browser tool).

**Pass criteria**:

- [ ] Phone tab active, password tab toggleable
- [ ] Tab to password tab, enter `demo@aitutor.cn` / `demo123`
- [ ] Click "登录" → page navigates to `dashboard.html` within 1s
- [ ] Browser DevTools → Network → `POST /api/auth/login` returns 200 with `{token, user}`
- [ ] `localStorage.aitutor.token` populated
- [ ] `localStorage.aitutor.user` populated with `{id, email, name, grade, ...}`
- [ ] No 401, no CORS error

**Real backend curl test (sanity)**:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@aitutor.cn","password":"demo123"}' \
  | jq .
```

Expected: `{success: true, token: "ey...", user: {...}}`. **Save token for Step 4**.

## Step 4 — Tutor real-backend smoke

Navigate to `http://localhost:9001/pages/tutor.html` (no `?mock=true`).

**Verify**:

- [ ] Console shows `[client.js] API_BASE = http://localhost:3002`
- [ ] Console does NOT show `[MOCK] ON`
- [ ] Sidebar shows 0-8 sessions (whatever is in DB `exam_sessions` table)
- [ ] Subject dropdown shows 9 options + 4 quick tags
- [ ] Type "已知二次函数" + Enter
- [ ] Expect: 1-3s delay, then 4 SSE events: `metadata` → `content` (8 chunks) → `done`
- [ ] Expect: AI reply with diagnosis card (if `skip_allowed=false`)
- [ ] Expect: "加入错题本" button visible in diagnosis card

**Real backend curl test**:

```bash
TOKEN=<from step 3>
curl -X POST http://localhost:3002/api/tutor/ask/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"已知二次函数","subject":"数学"}' \
  -H "Accept: text/event-stream" \
  -N | head -20
```

Expected: `event: metadata\ndata: {...}\n\nevent: content\ndata: {...}\n\n...`.

## Step 5 — D59 reversal (cross-page navigation)

After Step 4's reply, click "加入错题本" button.

**Verify**:

- [ ] Button shows "添加中..." with spinner
- [ ] Toast appears: "已加入错题本, 正在跳转..."
- [ ] After 800ms, page navigates to `wrong-book.html?highlight=<qid>`
- [ ] Wrong-book page shows the new card
- [ ] Card has `ring-2 ring-primary-500 ring-offset-2` classes (5s highlight)
- [ ] Card scrolls into view (smooth scroll)
- [ ] After 5s, ring disappears

**Real backend curl test**:

```bash
curl -X POST http://localhost:3002/api/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"已知二次函数","subject":"数学"}'
```

Expected: `{success: true, data: {id: "wq_..."}}`. **Save ID for highlight test**.

## Step 6 — Cross-page highlight verify

After Step 5, you should already be on `wrong-book.html?highlight=<id>`.

In browser, manually URL bar change to `?highlight=2` (or any existing `_id`). Check:

- [ ] Card with `data-question-id="2"` has ring classes
- [ ] Card scrolls to center
- [ ] After 5s, ring disappears

## Step 7 — Other 5 dead buttons

Now back on `tutor.html` (or via tab nav):

| Button | Test | Expected |
|---|---|---|
| "查看知识图谱" (in diagnosis card) | Click | Navigate to `mastery.html` |
| "拍照搜题" (input bar) | Click | Navigate to `vision.html` + toast.info |
| "清空对话" (header trash) | Click → confirm OK | Messages cleared + toast.success |
| "新建对话" (sidebar) | Click | State cleared + toast.success |
| "加入错题本" (already in Step 5) | Click | Navigate to wrong-book.html?highlight |

## Step 8 — Test against real backend

After confirming mock works, redo Steps 4-7 with `?mock=true` removed:

```bash
# In browser:
# 1. Open DevTools → Application → Local Storage
# 2. Delete aitutor.useMock key
# 3. Reload page
# 4. Repeat Steps 4-7
```

## Common failures

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 Unauthorized | Token expired / wrong format | Re-login, check `localStorage.aitutor.token` |
| CORS error in console | `ALLOWED_ORIGINS` missing | Add `http://localhost:9001` to `.env` |
| 5xx on `/api/tutor/ask/stream` | `DASHSCOPE_API_KEY` invalid / quota | Check `.env`, log into DashScope console |
| SSE doesn't stream | Backend `X-Accel-Buffering: no` header missing | Check `tutor-agent.js:619` |
| LLM not responding | qwen-plus rate limit | Backoff, retry in 30s |
| pgvector error | Wrong embedding model | Check `services/embedding.js` provider config |
| wrong_questions table empty | DB seed missing | Run `node scripts/seed-wrong-questions.cjs` |
| mock=true flag stuck | `?mock=true` URL still set | Remove from URL, clear LS key |

## Test record (manual fill)

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 2026-08-10 | (project lead) | ⏳ PENDING | Initial manual smoke |

## Pass criteria (overall)

- [ ] All 6 steps (Login → Tutor → D59 → Highlight → Dead buttons → Real backend) succeed
- [ ] No 401 / 5xx / CORS errors
- [ ] SSE events arrive in correct order
- [ ] cross-page highlight ring works 5s as specified
- [ ] D59 reversal navigates to wrong-book.html with `?highlight=QID`
- [ ] localStorage.aitutor.user populated
- [ ] Console 0 errors throughout

## Acceptance

After all 6 steps pass:

```bash
git tag -a v0.8.0-dev -m "Tutor Closed Loop Beta - 5 dead buttons live, D59 reverse, cross-page highlight, real backend smoke pass"
git push origin v0.8.0-dev
git push uibe v0.8.0-dev
git push localtest v0.8.0-dev
```

## Non-acceptance

If any step fails:

1. **Do NOT tag v0.8.0-dev**
2. Document the failure in this file under "Test record"
3. Fix the root cause (commit + push)
4. Re-run smoke test
5. Only tag after all 6 pass

## Deferred to v0.9 (not in this smoke test)

- `tutor.getMastery()` (commented as TODO in services/tutor.js)
- Real backend markMastered PUT (backend endpoint missing)
- vision.html / review.html / exam-simulation.html (not F3-migrated)
- "停止生成" button (D60, owner framing deferred to v0.9)
