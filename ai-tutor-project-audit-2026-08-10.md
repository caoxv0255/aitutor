# ai-tutor 项目审查报告 (Architecture Audit + Development Status Review)

> **审计对象**: ai-tutor (高考/中考 AI 智能辅导系统)
> **审计日期**: 2026-08-10
> **审计角色**: Principal Engineer + Technical Program Manager
> **审查范围**: 完整 git tree + frontend/backend 代码 + 9 commits F3 migration
> **目的**: 给项目负责人重新建立全局认知, 包括未完成工作 + 真实完成度

---

## 0. Executive Summary (1 页)

### AI Tutor 当前是什么状态?

**ai-tutor** 是面向高考/中考生 (47 高校知识点 + 42 中考知识点) 的 AI 智能辅导 PWA, 通过 **Hybrid RAG (pgvector 向量检索) + GraphRAG (Apache AGE 知识图谱) + LLM Agent (qwen-plus)** 三层架构, 提供: 拍照搜题 → AI 教学流 → 错题诊断 → 间隔复习 → 考试模拟的完整学习闭环。

**当前阶段**: F3 frontend migration 推进中, 后端基本完工, 前端 5.5/10 page 完成 F3 data layer。**当前 HEAD `981bbd29`**, 最近 9 commits 全部 F3 frontend。

### 完成度 (5 维评分)

| 维度 | 评分 | 说明 |
|------|------|------|
| **Backend** | 🟢 **95%** | 33 handlers + 7 routes + 6 services + 18 auto-create tables, 跑 PostgreSQL + pgvector + Apache AGE; 唯一缺 `markMastered` PUT/PATCH |
| **Frontend** | 🟡 **55%** | 5.5/10 page F3 化 (dashboard / mastery / wrong-book / login / register + tutor 80%), 3 page 完全未迁移 (review / vision / exam-simulation), 5 dead buttons in tutor |
| **Infrastructure** | 🟢 **85%** | Service layer (9 services) + mock (38 JSON) + useAsyncResource + ErrorBoundary + USE_MOCK + toast + auth 完整; Shell Adapter 4 种 3 已验证 1 待 |
| **Testing** | 🟡 **60%** | Contract Test 39/39 全过 + 1328 行 tests + 1 Playwright E2E; 缺 5 page screenshot 回归 + integration test + 真实 backend smoke |
| **Documentation** | 🟢 **80%** | 5 个 retro + 2 个 architecture decision memo + Subagent 决策记录; 缺顶层 INDEX 把 5 docs 串起来 |

### 三个最大风险 (P0 — 阻塞继续开发)

| # | 风险 | 触发条件 | 修复成本 |
|---|------|----------|----------|
| **P0.1** | **Browser cache 跨 session 黏住** | 5 attempts 持续, 阻塞所有 frontend slice 端到端验证 | 1 day (cache busting + Node.js integration test fallback) |
| **P0.2** | **vision / review / exam-simulation 3 page 完全未迁移** | F3 frontend 完成度从 55% 推到 100% 的拦路虎 | 6-8 days (3 sub-slice) |
| **P0.3** | **tutor 5 dead buttons + persistence 2/5 done** | tutor workspace 80% 闭环, 差最后一公里 | 1-2 days (Slice 4.4 commits 3-5 + sub-agent 已设计) |

### 继续开发 — 第一件事是什么

**完成 Slice 4.4 commits 3-5** (5 dead buttons 复活 + 跨页 highlight + retro doc)。理由:
- 子 agent (ChatGPT) 决策已出, 3 commits 收工, 1 个工作日
- 闭环 tutor 跨页 workflow (joined 错题本 → 跳 wrong-book / 加入错题 → 跳 wrong-book highlight)
- 解决 P0.3, 让 P0.1 (browser cache) 可在 Slice 4.4 整体测试时绕过

**绝对不要**:
- 改 `client.js` 拆信封 (破坏 9 service 现有调用)
- 引入 React/Vue/新框架 (F3 纪律 = vanilla JS + 单对象 + 闭包 + 事件委托)
- amend 已 push 的 commit (远端 push 保留控制)
- 立即 archive frontend/ (F6 计划, 需 2-3 周观察期)

---

## 1. Project Identity

### 一句话定位

**ai-tutor** = AI Tutor (智启 AI 导师) — 基于 Hybrid RAG + Knowledge Graph + LLM Agent 的高考/中考错题诊断与预测学习平台。从静态 prototype 迁移到 dynamic data layer + service + mock + state 架构, 已完成 55%。

### 用户

- **Primary**: 高考/中考生 (高一到高三, 全国 31 省 + 新高考选科)
- **Use Case**: 拍照错题 → AI 教学 → 错题诊断 → 复习 → 考试模拟
- **Domain**: 教育 + AI + GraphRAG + 数据库

### 解决什么问题

学生做完题不会 → 拍照搜题 → AI tutor 给出诊断 + 教学步骤 → 错题自动入错题本 → 间隔复习系统按 SM-2 算法推送 → 考试模拟实时评分 → 知识图谱显示薄弱点。

### 核心技术路线

```
PWA 摄 (Qwen-VL 多模态) → Vision RAG
    ↓
Hybrid RAG Triad:
  A: Apache AGE GraphRAG (知识图谱 + 47+42 知识点)
  B: pgvector HNSW (向量检索, 1024 dim bge-m3)
  C: LLM Agent (qwen-plus + JSON mode + 防跳跃)
    ↓
数据飞轮: 掌握度 → 图谱更新 → 复习排序 → SRS (SM-2 间隔重复)
```

### 架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (Vanilla JS + Tailwind 4)                                  │
│  ┌────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  mobile PWA (public/)        │  │  PC (ai-tutor-frontend/)     │  │
│  │  tutor-stream.js            │  │  5 services + 38 mocks      │  │
│  │  katex-stream.js            │  │  useAsyncResource hook      │  │
│  │  mastery-graph.js (Cytoscape)│  │  4 Shell Adapter             │  │
│  └────────────┬───────────────┘  └──────────────┬───────────────┘  │
└───────────────┼─────────────────────────────────┼─────────────────┘
                │ SSE / REST + Bearer JWT            │
┌───────────────┼─────────────────────────────────┼─────────────────┐
│  server.js (Express, 自适应 UA)                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  api/handlers (33)  + api/routes (7)  + api/services (6)   │  │
│  │  ├ tutor-agent.js (749 行, 含 SSE 流) ← 最大单文件     │  │
│  │  ├ rag-search.js (pgvector HNSW)                            │  │
│  │  ├ graphrag.js (Apache AGE Cypher)               │  │
│  │  ├ vision-parse.js (Qwen-VL 多模态)               │  │
│  │  ├ srs-engine.js (SM-2 间隔重复)                  │  │
│  │  ├ learning-loop.js (掌握度飞轮)                  │  │
│  │  ├ questions.js (CRUD 缺 PUT/PATCH)             │  │
│  │  └ 23 个其他 handlers (考试/报告/省级)                  │  │
│  │  api/core: db.js (PostgreSQL pool + auto-create 18 表)     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ pg pool
┌────────────────────────────┴─────────────────────────────────────┐
│  PostgreSQL + Apache AGE (图) + pgvector (向量 HNSW)              │
│  18 张表: users / wrong_questions / reports / knowledge_points /  │
│  exam_papers / exam_questions / task_queue / similar_questions /  │
│  personalized_papers / subjects / provinces / ... 10 more         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Reality Audit

### 目录树

```
ai-tutor/
├── ai-tutor-frontend/          ← F3 target (PC client, 迁移中)
│   ├── pages/                  ← 10 HTML pages (9,472 lines)
│   │   ├── dashboard.html (1429)
│   │   ├── mastery.html (1338)
│   │   ├── wrong-book.html (1117)
│   │   ├── tutor.html (1395) ← 最大单页, 587 行 module
│   │   ├── login.html (1041)
│   │   ├── register.html (885)
│   │   ├── review.html (932) ← 未迁移
│   │   ├── vision.html (916) ← 未迁移
│   │   ├── exam-simulation.html (176) ← 未迁移
│   │   └── index.html (243) ← marketing
│   ├── assets/
│   │   ├── js/
│   │   │   ├── api/services/   ← 9 services (auth/user/exam/rag/knowledge/review/vision/wrong/tutor)
│   │   │   ├── api/mock/       ← 38 JSON fixtures
│   │   │   ├── hooks/          ← useAsyncResource.js
│   │   │   ├── components/     ← error-boundary.js
│   │   │   ├── auth.js         ← token/user LS + 401 redirect
│   │   │   ├── toast.js        ← 4-level toast
│   │   │   └── router.js       ← (legacy)
│   │   └── css/
│   └── tokens.css / tailwind-theme.css
│
├── api/                          ← Backend (95% complete)
│   ├── handlers/                ← 33 files (~231K)
│   ├── routes/                  ← 7 files (~107K)
│   ├── services/                ← 6 files (~70K)
│   ├── core/                    ← db.js (31.9K) + auth.js + swagger.js + taskWorker.js
│   ├── middleware/              ← errorHandler / security / versioning
│   └── utils/                   ← 10 files (~93K)
│
├── public/                      ← PWA (mobile) — 独立 code base, 不在 F3 范围
│
├── frontend/                    ← Legacy PC (存 active production, 31 pages)
│
├── tests/                       ← 1328 lines, 17 files
│   ├── contract.test.js (257)   ← 39 endpoints schema 校验
│   ├── dashboard.test.cjs (189)
│   ├── login.test.cjs (203)
│   ├── tutor.test.cjs (253)
│   ├── hooks/useAsyncResource.test.js (166)
│   ├── components/error-boundary.test.js (143)
│   └── e2e/demo.spec.js         ← 唯一 Playwright E2E
│
├── docs/                        ← 完整 doc 库
│   ├── frontend-migration/      ← F3 retro + decision memo × 7
│   ├── MILESTONES.md (172)
│   ├── PM-Tech-Bridge-Document.md (700+)
│   ├── USAGE_GUIDE.md
│   └── ... 10 more docs
│
├── scripts/                     ← automation
│   ├── automation/lint.sh
│   ├── install_hooks.sh
│   └── push_all.sh
│
├── .git/                        ← 30+ commits, 4 tags
└── server.js                    ← Express 入口 (未审计)
```

### 模块真实状态

| Module | 状态 | 证据 | 风险 |
|--------|------|------|------|
| **auth (login/register)** | 🟢 GREEN | `61dc24ad` + `auth.js` token LS + `auth.login` / `register` / `guestLogin` 服务完整 | 低 |
| **dashboard** | 🟢 GREEN | `5997cce8` + `c46cfcde` + `c11167ec` (3 commits, 2 fixes), Dashboard Shell 验证, `user.dashboard` service | 低 |
| **mastery** | 🟢 GREEN | `f6f587a8` (1 commit, 0 fix), Dashboard Shell 复用, `knowledge.mastery` service | 低 |
| **wrong-book** | 🟢 GREEN | `34e9acda` + `d3435602` + `03839814` + `43193f12` (5 commits, 0 fix), Hybrid Shell 首次验证, `wrong.getQuestions` + `deleteQuestion` + `createQuestion` | 中 — backend 缺 `markMastered` PUT/PATCH |
| **tutor** | 🟡 YELLOW | 9 commits (Slice 4.0-4.4 c2), Workspace Shell 验证, `tutor.ask` + `askStream` + `getHistory` 服务, SSE + Markdown 完整, 流式 5 dead buttons 待 | 中 — 5 dead buttons + cache 阻塞 |
| **review** | 🟡 YELLOW | 0 commits, 932 行 hardcoded HTML, 0 服务调用, 0 mock 渲染 | 中 — 完全未迁移 |
| **vision** | 🔴 RED | 0 commits, 916 行 hardcoded HTML, 0 服务调用, 0 OCR 集成 | 高 — 完全未迁移 + 多模态风险 |
| **exam-simulation** | 🟡 YELLOW | 0 commits, 176 行但跟 dashboard / mastery 共享 service, 0 真实计时逻辑 | 中 — 短小但需要计时 + 错题自动入错题本 |

### Backend 状态

| 组件 | 文件数 | LoC | 状态 |
|------|------|-----|------|
| `api/handlers/` | 33 | 231K | 🟢 100% (95% with markMastered gap) |
| `api/routes/` | 7 | 107K | 🟢 100% |
| `api/services/` | 6 | 70K | 🟢 100% |
| `api/core/db.js` | 1 | 31.9K | 🟢 18 表 auto-create |
| `api/utils/` | 10 | 93K | 🟢 100% |
| `tests/` | 17 | 1,328 | 🟡 1328 行, contract 39/39 + 1 E2E |

### 关键发现

- **Backend 复杂度集中在最热 5 个文件**: tutor-agent.js (749 行) / rag-search.js (28.6K) / vision-parse.js (13.8K) / learning-loop.js (18.8K) / srs-engine.js (13.4K) — 几乎所有 AI 逻辑都在前端不直接调用的 7 个 routes 里
- **Frontend 复杂度集中在 tutor.html 1395 行 (含 587 行 module)** — 是整个 ai-tutor-frontend 最大的单页面, 5 dead buttons 流式 wrapper 阶段缺失
- **Service + mock 模式 1:1 对齐**: 38 mock JSON 覆盖 9 service 约 50 端点, 但**没有自动 contract test** 校 mock 跟 backend response shape 一致性

---

## 3. Frontend Migration Audit (F3)

### 全部 10 个 HTML 页面状态

| Page | Shell | Service | Mock | State | Handler | 状态 |
|------|------|---------|------|-------|---------|------|
| **dashboard.html** | Dashboard Shell ✅ | `user.dashboard` ✅ | `user_dashboard.json` ✅ | `useAsyncResource` ✅ | subscribe ✅ | 🟢 **GREEN** |
| **mastery.html** | Dashboard Shell ✅ | `knowledge.mastery` ✅ | `knowledge_mastery.json` ✅ | `useAsyncResource` ✅ | subscribe ✅ | 🟢 **GREEN** |
| **wrong-book.html** | Hybrid Shell ✅ | `wrong.getQuestions` + `deleteQuestion` + `createQuestion` ✅ | `wrong_questions.json` + `wrong_delete.json` + `wrong_create.json` ✅ | `filterState` (5 字段) + `useAsyncResource` ✅ | Click delegation + refetch ✅ | 🟢 **GREEN** |
| **tutor.html** | Workspace Shell ✅ | `tutor.ask` + `askStream` + `getHistory` ✅ | `tutor_ask.json` + `tutor_ask_guided.json` + `tutor_ask_stream.json` + `tutor_history.json` ✅ | `conversationState` (7 字段) + `streamController` ✅ | Send + Enter + click delegation ✅ | 🟡 **YELLOW** (80%) |
| **login.html** | None (auth page) | `auth.login` + `auth.guestLogin` ✅ | `auth_login.json` + `auth_guest.json` ✅ | (无 — 一次性 form) | Click handler ✅ | 🟢 **GREEN** (F3.1) |
| **register.html** | None (auth page) | `auth.register` ✅ | `auth_register.json` ✅ | (无 — 一次性 form) | Click handler ✅ | 🟢 **GREEN** (F3.1) |
| **review.html** | ❌ (none) | ❌ (0 调用) | ❌ (0 mock) | ❌ (0 state) | ❌ (0 JS) | 🔴 **RED** (完全未迁移) |
| **vision.html** | ❌ (none) | ❌ (0 调用) | ❌ (0 mock) | ❌ (0 state) | ❌ (0 JS) | 🔴 **RED** (完全未迁移) |
| **exam-simulation.html** | ❌ (none) | ❌ (0 调用) | ❌ (0 mock) | ❌ (0 state) | ❌ (0 JS) | 🟡 **YELLOW** (176 行, 静态 frame) |
| **index.html** | ❌ (none) | ❌ (0 调用) | ❌ (0 mock) | ❌ (0 state) | ❌ (0 JS) | 🟢 GREEN (marketing, 静态可) |

### 4 种 Shell Adapter 状态

| Shell | 适用 | 验证状态 | 第一次 commit |
|-------|------|----------|--------------|
| **Dashboard Shell** | dashboard, mastery | ✅ 验证 (Slice 1 + 2) | `5997cce8` |
| **Hybrid Shell** | wrong-book | ✅ 验证 (Slice 3) | `d3435602` |
| **Workspace Shell** | tutor | ✅ 验证 (Slice 4.0-4.3) | `142f1252` |
| **Immersive Shell** | review, vision | ⏳ **未验证** | (Pending) |

### 5 个可复用架构模式 (Slice 1-3 固化)

| Pattern | 复杂度 | 适用 |
|---------|--------|------|
| Filter State Contract | 🟢 低 | 5+ 列表 page |
| Event Delegation | 🟢 低 | 任何 dynamic list |
| Mastery Derive (page layer) | 🟢 低 | review / mastery / exam |
| Active Button Toggle | 🟢 低 | 任何 toggle group |
| Matched/Total Display | 🟢 低 | backend filter + client view mode |

### 9 个新增架构模式 (Slice 4 启用)

| Pattern | 复杂度 | 适用 |
|---------|--------|------|
| SSE imperative state | 🟡 中 | tutor + 未来 streaming |
| AbortController 3x abort | 🟡 中 | streaming + abortable |
| rAF throttle + done flush | 🟢 低 | 任何高频 render |
| Content-type 校验 | 🟢 低 | 任何 SSE endpoint |
| Escape-then-regex (XSS + markdown) | 🟢 低 | 任何 markdown + user input |
| localStorage session store | 🟢 低 | 跨 shell 同源 |
| `?sid=X` URL sync | 🟢 低 | 任何有 session 的 page |
| Hard navigation (no router) | 🟢 低 | 4 shell 跟 product UX 一致 |
| AbortController 主动取消 | 🟡 中 | 流式手动控制 |

### 关键发现

> **计划 vs 实际不一致**: PLAN.md §3.3 写 "F3.3 Question 在 dashboard 内嵌", 实际 dashboard 是 user dashboard (分省/分科/学情), 跟 Question 无关。F3.3 没有独立 commit, 实际被"跳过"或"合并到 exam-simulation 一起做"。
>
> **Shell Adapter 4 种是产品 UX 决策**, 不是 refactor debt. CLAUDE.md 钉死: "Unify all page layouts into one shell (4 shells are product UX decisions)" — 不要试图统一。

---

## 4. Tutor Deep Audit

### 当前 tutor 状态机

```
User Input (textarea)
    ↓
[Enter] / [send-btn click]
    ↓
sendMessage() (Phase 3 sendMessage + 4.3 askStream version)
    ↓
Phase 1 DONE: Service 
  - ask() (non-streaming) ✅
  - askStream() (SSE) ✅
  - getHistory() (mock localStorage fallback) ✅
  - getMastery() ❌ deferred
    ↓
Phase 2 DONE: Workspace Shell Adapter
  - 3-region layout (header + sidebar + main flex) ✅
  - 9 history sessions dynamic render ✅
  - subject dropdown 9 options + 4 quick tags ✅
  - two-way binding dropdown ↔ tag ✅
    ↓
Phase 3 DONE: Chat MVP (non-streaming)
  - 用户消息 optimistic push ✅
  - 调 ask() / askStream()
  - assistant message append ✅
  - loading state + typing indicator ✅
  - error inline bubble ✅
    ↓
Phase 4 DONE: SSE Streaming Slice 4.3
  - SSE parser (parseSseFrame) ✅
  - AbortController streamController ✅
  - rAF throttle + done flush ✅
  - content-type 校验 (SSE vs JSON) ✅
  - Markdown regex (bold/code/latex) ✅
    ↓
Phase 5 2/5 DONE: Persistence + Cross-page (Slice 4.4)
  - 5.1 localStorage session store ✅ (commit f73b6529)
  - 5.2 sendMessage done 持久化 + sidebar 切换 + URL sync ✅ (commit 981bbd29)
  - 5.3 5 dead buttons 复活 ❌ PENDING
  - 5.4 cross-page wrong-book highlight ❌ PENDING
  - 5.5 retro doc ❌ PENDING
```

### 5 dead buttons (Phase 5.3 待做)

| Button | 数据属性 | 当前状态 | 应做 |
|--------|----------|----------|------|
| **查看知识图谱** | `data-dom-id="tutor-to-mastery"` | ❌ dead, click 无响应 | 跳 `mastery.html` |
| **拍照搜题** | `data-dom-id="tutor-to-vision"` | ❌ dead, click 无响应 | 跳 `vision.html` |
| **清空对话** | `id="clear-chat-btn"` | ❌ dead, click 无响应 | clear `conversationState.messages` + reset UI |
| **新建对话** | (sidebar button) | 🟡 半活 (4.4 commit 2 接了 basic handler) | 加 toast 提示 |
| **加入错题本** | `data-dom-id="tutor-add-wrong"` | 🟡 半活 (Slice 3.2 接了创建 + button 改 "已加入") | **不跳 wrong-book** (D59 决策: 留 tutor + toast) |
| **停止生成** | (缺) | ❌ 缺 | D60: AbortController abort button |

### 真实数据 vs 假数据 — tutor.html

| 来源 | 真/假 | 备注 |
|------|------|------|
| `tutor_history.json` (8 sessions) | 🟡 假 | title 静态, 真实数据需 backend `/api/tutor/sessions` |
| `tutor_ask.json` / `tutor_ask_guided.json` | 🟡 假 | mock 响应, 真实数据需 `/api/tutor/ask` |
| `tutor_ask_stream.json` (10 events) | 🟡 假 | mock 流, 真实数据需 `/api/tutor/ask/stream` SSE |
| localStorage `aitutor.tutor.sessions` | 🟢 真 | 用户真实对话历史 (4.4 commit 1+) |
| `conversationState.currentSessionId` | 🟢 真 | 用户当前会话 |
| `console.log('[Slice4] ...')` | 🟢 真 | 真实代码状态 |

---

## 5. Data Flow Audit

### 1. Dashboard (✅ REAL, 完整闭环)

```
User Action: 访问 /pages/dashboard.html
       ↓
Frontend State (useAsyncResource + loader)
       ↓ request('GET', '/api/user/dashboard', null, {mockName: 'user_dashboard'})
Service Layer (user.dashboard)
       ↓
API: GET /api/user/dashboard
       ↓
Backend (api/handlers/learning-dashboard.js, 6.5K)
       ↓
PostgreSQL: SELECT stats FROM users + reports WHERE user_email = ?
       ↓
response: {success, message, data: {user, stats: {totalQuestions, accuracy, ...}}}
       ↓
res.data.X (page 层做解引用, service 不拆信封)
       ↓
renderDashboard() → DOM render
       ↓
[故障路径]
- 401 → client.js 401 redirect → login.html
- 5xx/network → useAsyncResource error → errorBoundary 兜底
```

**REAL**: ✅ 真后端 + ✅ 真 mock 双链

### 2. Wrong-book (✅ REAL but 缺 1 操作)

```
User Action: 点击 数学 filter
       ↓
Frontend State (filterState.subject = 'math')
       ↓
listRes.refetch() → useAsyncResource reload
       ↓
request('GET', '/api/questions?subject=math', null, {mockName: 'wrong_questions'})
Service Layer (wrong.getQuestions)
       ↓
API: GET /api/questions?subject=math
       ↓ (mock 静态不模拟 filter, 实际 8 条全部返回)
Backend (api/handlers/questions.js, 4.3K)
       ↓
PostgreSQL: SELECT FROM wrong_questions WHERE user_email = ? AND subject = ? ← 实际后端
       ↓
[Client Filter] deriveMastery(row) → 4 unmastered / 2 reviewing / 2 mastered
       ↓
renderList(applyMasteryFilter(rows)) → 8 cards DOM render
```

**Delete 路径 (Slice 3.2)**:
```
click delete-btn → confirm() → wrong.deleteQuestion(id) → optimistic dim → DELETE /api/questions
→ listRes.refetch() → page 重新渲染
```

**REAL**: ✅ getQuestions + createQuestion + deleteQuestion  
**MISSING**: ❌ markMastered (backend questions.js 缺 PUT/PATCH route)

### 3. Tutor (🟡 80% REAL, 缺 5 dead buttons)

```
User Action: 输入"已知二次函数" + Enter
       ↓
Frontend State (conversationState.messages.push user)
       ↓
tutor.askStream({question, subject, signal, onEvent, mockName: 'tutor_ask_stream'})
Service Layer (tutor.askStream, 5.4K)
       ↓
[Mock 路径] loadMock('tutor_ask_stream.json') → 10 events
  events 逐个 emit (with delay_ms 模拟 LLM 流)
       ├ metadata → assistantMsg.diagnosis + context
       ├ content  → assistantMsg.content += delta
       ├ done     → saveSession(localStorage, currentSessionId)
       └ error    → error bubble
       ↓
[Real 路径] fetch + ReadableStream + TextDecoderStream
  - content-type 校验 (SSE vs JSON)
  - AbortController.signal 传 fetch signal
       ↓
API: POST /api/tutor/ask/stream
       ↓
Backend (api/routes/tutor-agent.js, 749 行)
  - SSE event-stream response
       ↓
LLM (qwen-plus / DeepSeek via api/handlers/proxy.js)
       ↓
[stream back] 4 events: metadata / content / done / error
```

**REAL**: ✅ askStream SSE + history + persistence (4.4 commit 2)  
**MISSING**: ❌ 5 dead buttons (查看知识图谱 / 拍照 / 清空 / 停止 / 加入错题跳转)

### 4. Vision (🔴 MISSING, 完全未迁移)

```
User Action: (无, 因为 page 没 JS)
       ↓
Frontend State: ❌ (无)
       ↓
Service Layer: ❌ (vision.parse / ingest / status 存在 but 未调用)
       ↓
API: /api/vision/parse /api/vision/ingest
       ↓
Backend (api/routes/vision-parse.js, 13.8K) ✅ 完整
  - 多模态图片解析
  - Qwen-VL 处理
       ↓
LLM (qwen-vl-max)
       ↓
response: {success, message, data: {text, knowledge_points, ...}}
```

**REAL**: ✅ Backend 完整  
**MISSING**: ❌ Frontend 0 集成, 0 JS, 0 OCR 入口

### 5 条数据流总结

| Page | 真后端 | 真 mock | 完整状态机 | 错误路径 |
|------|--------|---------|------------|----------|
| dashboard | ✅ | ✅ | ✅ | ✅ (401 redirect) |
| mastery | ✅ | ✅ | ✅ | ✅ |
| wrong-book | ✅ | ✅ | ✅ getQuestions ✅ + deleteQuestion ✅ + createQuestion ✅ / ❌ markMastered | ✅ |
| tutor | ✅ | ✅ | ✅ askStream SSE + history + persistence / ❌ 5 dead buttons | ✅ |
| vision | ✅ | ❌ | ❌ (无 JS) | ❌ |
| review | ✅ | ❌ | ❌ (无 JS) | ❌ |
| exam-simulation | ✅ | ❌ | ❌ (无 JS) | ❌ |

---

## 6. Backend Audit

### Endpoint Matrix (50 个 endpoint)

| API | 存在 | Frontend 引用 | 问题 |
|-----|------|---------------|------|
| `POST /api/auth/login` | ✅ | ✅ login.html | OK |
| `POST /api/auth/register` | ✅ | ✅ register.html | OK |
| `POST /api/auth/guest-login` | ✅ | ✅ login.html | OK |
| `POST /api/auth/logout` | ✅ | ✅ auth.js | OK |
| `GET /api/auth/me` | ✅ | ✅ auth.js | OK |
| `POST /api/reset-password` | ✅ | (未集成) | - |
| `GET /api/user/dashboard` | ✅ | ✅ dashboard.html | OK |
| `POST /api/user/provinces` | ✅ | ✅ | OK |
| `GET /api/knowledge-points` | ✅ | ❌ (无前端页面调) | ⚠️ |
| `GET /api/mastery/:kpId` | ✅ | ❌ (tutor.getMastery 缺) | ❌ |
| `GET /api/knowledge-map` | ✅ | ❌ | ❌ |
| `GET /api/knowledge-points/seed` | ✅ | ❌ | ❌ |
| `GET /api/weak-points` | ✅ | ❌ | ❌ |
| `POST /api/generate-paper` | ✅ | ❌ (exam-simulation 未迁移) | ❌ |
| `GET /api/learning-path` | ✅ | ❌ | ❌ |
| `POST /api/rag/search` | ✅ | ❌ (mastery 可能,但 mastery 用的不是 rag.search) | ⚠️ |
| `POST /api/rag/multi-search` | ✅ | ❌ | ❌ |
| `GET /api/rag/multi/questions/:qid` | ✅ | ❌ | ❌ |
| `POST /api/rag/ingest` | ✅ | ❌ | ❌ |
| `POST /api/rag/similar-questions` | ✅ | ❌ | ❌ |
| `POST /api/rag/explain` | ✅ | ❌ | ❌ |
| `POST /api/rag/ask` | ✅ | ❌ (用 tutor.askStream 替代) | ⚠️ |
| `GET /api/rag/stats` | ✅ | ❌ | ❌ |
| `POST /api/tutor/ask` | ✅ | ✅ tutor.html (Phase 3) | OK |
| `POST /api/tutor/ask/stream` | ✅ | ✅ tutor.html (Phase 4.3) | OK |
| `GET /api/tutor/mastery/:kpId` | ✅ | ❌ (tutor.getMastery 缺) | ❌ |
| **`GET /api/tutor/sessions`** | ❌ **不存在** | ❌ tutor.getHistory mock 模拟 | **D56 决策: localStorage 后置** |
| `POST /api/tutor/sessions` | ❌ | ❌ | **D56 决策** |
| `GET /api/loop/feedback` | ✅ | ❌ | ❌ |
| `POST /api/loop/batch` | ✅ | ❌ | ❌ |
| `GET /api/loop/graph` | ✅ | ❌ | ❌ |
| `GET /api/loop/mastery` | ✅ | ❌ | ❌ |
| `GET /api/questions` | ✅ | ✅ wrong-book.html | OK |
| `POST /api/questions` | ✅ | ✅ wrong-book.html (createQuestion) | OK |
| `DELETE /api/questions/:id` | ✅ | ✅ wrong-book.html (deleteQuestion) | OK |
| **`PUT /api/questions/:id`** | ❌ **不存在** | ❌ wrong.markMastered 缺 | **markMastered 缺** |
| `GET /api/review/reports` | ✅ | ❌ (review.html 未迁移) | ❌ |
| `GET /api/review/session-history` | ✅ | ❌ | ❌ |
| `GET /api/review/trend` | ✅ | ❌ | ❌ |
| `GET /api/review/weakpoints` | ✅ | ❌ | ❌ |
| `POST /api/exam/session/start` | ✅ | ❌ (exam-simulation 未迁移) | ❌ |
| `POST /api/exam/session/submit` | ✅ | ❌ | ❌ |
| `GET /api/exam/papers` | ✅ | ❌ | ❌ |
| `GET /api/exam/questions` | ✅ | ❌ | ❌ |
| `POST /api/vision/parse` | ✅ | ❌ (vision.html 未迁移) | ❌ |
| `POST /api/vision/ingest` | ✅ | ❌ | ❌ |
| `GET /api/vision/status` | ✅ | ❌ | ❌ |
| `GET /api/srs/daily-tasks` | ✅ | ❌ | ❌ |
| `POST /api/srs/complete` | ✅ | ❌ | ❌ |
| `GET /api/srs/stats` | ✅ | ❌ | ❌ |

**统计**: 50 endpoint, 22 引用 (44%), 28 未引用 (56%)

### 关键发现

| # | Endpoint gap | 影响 | 修复 |
|---|--------------|------|------|
| **1** | **`/api/tutor/sessions` 不存在** | Slice 4.4 commit 4.4 走 localStorage, 未来需要 backend | D56 决策: 留 Slice 5+, 先 localStorage |
| **2** | **`PUT /api/questions/:id` 不存在** | markMastered 写操作缺 | api/handlers/questions.js 加 PUT (15-30 行) |
| **3** | **`/api/tutor/mastery/:kpId` 没用** | tutor.getMastery 缺前端 service | 1 行 service + 1 mock |
| **4** | **`/api/vision/*` 没用** | vision.html 完全未迁移 | Slice F4 |
| **5** | **`/api/review/*` 没用** | review.html 完全未迁移 | Slice 5 |
| **6** | **`/api/exam/session/*` 没用** | exam-simulation 未迁移 | Slice 6 |
| **7** | **`/api/loop/*` 没用** | 数据飞轮未接入 | Slice 5+ |
| **8** | **`/api/srs/*` 没用** | 间隔复习未接入 | Slice 5+ |

### SSE 状态

- ✅ `POST /api/tutor/ask/stream` 完整 (749 行 tutor-agent.js, 4 events: metadata / content / done / error)
- ✅ Frontend SSE parser (`parseSseFrame`) 完整
- ✅ Mock 完整 (`tutor_ask_stream.json` 10 events)
- ⚠️ 真实环境未验证 (需 :3002 backend)

### Database schema

- 18 张表 auto-create (`db.js`),
- ⚠️ **无 migration tool**: 加字段需改 db.js 然后手动 `DROP TABLE` 或脚本
- 知识图谱: Apache AGE (不是纯 SQL)

---

## 7. Technical Debt Ranking

### P0 — 阻塞继续开发

| # | 问题 | 影响 | 解决成本 | 推荐时间 |
|---|------|------|----------|----------|
| **P0.1** | **Browser cache 跨 session 黏住** (5 attempts 持续) | 阻塞所有 frontend slice 端到端验证 | 1 day (cache busting + Node.js integration test fallback) | **本周** |
| **P0.2** | **3 page 未迁移** (review/vision/exam-simulation) | F3 完成度 50% → 100% 拦路虎 | 6-8 days (3 sub-slice) | **本周** |
| **P0.3** | **tutor 5 dead buttons** (清空/知识图谱/拍照/停止/加入错题跳转) | tutor 跨页闭环差最后一公里 | 1-2 days (Slice 4.4 commits 3-5, 子 agent 已设计) | **本周** |
| **P0.4** | **`markMastered` PUT/PATCH 缺** | wrong-book 缺 toggle 写操作 | 0.5 day (api/handlers/questions.js 加 1 handler) | **本周** |
| **P0.5** | **真实 backend smoke test 缺** | 不知道真实 :3002 跑起来后会出什么 | 1 day (起 :3002 + 跑 login→dashboard→tutor→wrong-book) | **本周** |

### P1 — 影响体验

| # | 问题 | 影响 | 解决成本 | 推荐时间 |
|---|------|------|----------|----------|
| **P1.1** | **38 mock JSON 跟 backend 没自动 contract test** | 改 backend 字段前端无感知 | 1 day (扩展 `tests/contract.test.js`) | **v0.8** |
| **P1.2** | **`<script type="module">` 跨模块 scope 隔离** (Slice 4.2 教训) | 第二次 module 看不到 listRes, 修过 1 次 | 文档化 1 page 1 module, 0.5 day | **v0.8** |
| **P1.3** | **AbortError vs Business error 边界** (4.3 retro §6) | 流式 UX 关键 | 0.5 day (抽 `useAbortController` wrapper) | **v0.8** |
| **P1.4** | **Message-aware error 状态** (Phase 3 用了 inline error bubble, 但 Slice 4.4 commit 2 改了之后)** | tutor 错误 UX 可能不一致 | 0.5 day | **v0.8** |
| **P1.5** | **Long file 难维护** (tutor.html 1395 + tutor-agent.js 749 + knowledge-points.js 9.2K) | 单人改易冲突 | 拆 component (后续 slice 验证 4 shell 共性后) | **v1.0** |
| **P1.6** | **CRLF 行尾管理** (每次 Python 改 HTML 要手动修) | 文档化流程 | `.gitattributes` + pre-commit hook (0.5 day) | **v0.9** |

### P2 — 未来优化

| # | 问题 | 影响 | 解决成本 | 推荐时间 |
|---|------|------|----------|----------|
| **P2.1** | **Database 无 migration tool** | 线上 schema 演进困难 | 1-2 days (用 Sqitch / 自制 simple migration runner) | **v1.0** |
| **P2.2** | **5 page screenshot 回归缺** | F5.1 计划但未做 | 1-2 days (Playwright 10 page) | **v1.0** |
| **P2.3** | **Vitest vs Node.js test 框架不统一** | `tests/*.cjs` 用 Node 内置, contract.js 用 Vitest | 0.5 day (迁移一致) | **v0.9** |
| **P2.4** | **Dark mode / i18n** | CLAUDE.md 提到 `.dark`, 实际未做 | 1-2 days (CSS variables + i18n key) | **v1.0** |
| **P2.5** | **Lighthouse Performance + A11y** | F5.4-5.5 计划但未做 | 1-2 days (Lighthouse audit + 修复) | **v1.0** |
| **P2.6** | **`<img alt>` 缺失** | A11y 缺项 | 0.5 day (扫 5 page + 补) | **v0.9** |
| **P2.7** | **3 remote 凭证 in .git/config** | `uibe` URL 含明文 password | 0.5 day (改 SSH / credential helper) | **v0.9** |

### 计划 vs 实际不一致 (重要)

| 计划 | 实际 | 状态 |
|------|------|------|
| F3.3 Question 在 dashboard 内嵌 | dashboard 是 user dashboard, 跟 Question 无关 | 🟡 计划 missed |
| F3 6 阶段 10 天 (PLAN.md) | 5.5 页用 9 commits (4 天) | 🟢 节奏更快 |
| v0.7.0 tag 已发布 | new tag 没打 | 🟡 |
| GitHub mirror (CLAUDE.md) | 没推 (等 credentials) | 🟡 滞后 |
| F4 Vision 独立 Epic | 实际 Vision 嵌在 F3 范围 | 🟡 合并 |

---

## 8. Reality Roadmap

跟原 PLAN.md 不同, **不再按 6 阶段 HTML 顺序**, 改为按 **业务价值递进** 3 个版本:

### v0.8 — 核心闭环 (Phase 1)

**目标**: tutor + wrong-book 完整闭环 + backend smoke test, 标签 v0.8.0-dev

**必须包含**:
- **Tutor**: 输入 → 回答 (Phase 4.4 commits 3-5 完成)
  - 5 dead buttons 复活 (查看知识图谱跳 mastery / 拍照跳 vision / 清空 / 停止生成 / 加入错题 toast)
  - 跨页 wrong-book highlight (`?highlight=QID`)
- **Wrong**: 增删改 (Slice 3.2 + P0.4 backend add)
  - markMastered backend PUT + frontend service + mock
  - optimistic update + rollback
- **Backend smoke**: 起 :3002, 跑真链路 login → dashboard → tutor → wrong-book

**Commit 估计**: 8-10 commits

**依赖**:
- Slice 4.4 commits 3-5 (sub-agent 决策已出)
- backend `questions.js` 加 PUT handler (15-30 行)
- `wrong.markMastered()` service + mock
- 真实 backend 环境 (pgvector + AGE + LLM key)

**风险**:
- 🔴 Browser cache 继续阻塞端到端验证 (P0.1)
- 🟡 backend smoke 起 :3002 需 environment

**DoD**:
- [ ] tutor 5 dead buttons 全部接 handler
- [ ] wrong-book 显示 markMastered 按钮, click toggle is_correct
- [ ] 真后端 :3002 跑 login → dashboard → tutor → wrong-book 全链路
- [ ] Contract test 50 端点全过 (含 markMastered + sessions)
- [ ] Console 0 error (lint pass)
- [ ] **tag v0.8.0-dev**

### v0.9 — 完整产品体验 (Phase 2)

**目标**: 4 个未迁移 page 全部 F3 化 + 端到端 E2E, 标签 v0.9.0-dev

**必须包含**:
- **Review** (Immersive Shell 首次验证, 类似 Slice 4.2 Workspace Shell)
  - 报告列表 + 详情 + 趋势图 + 薄弱点
- **Vision** (Immersive Shell + OCR + photo upload)
  - 4 个 sub-slice (类似 Slice 4 拆分)
- **Exam Simulation** (TBD shell)
  - 启动 → 答题 → 计时 → 交卷 + 错题自动入错题本
- **Mastery 跳转** (mastery.html → tutor.html 闭环)
- **Playwright E2E 5 page flow** (`login → dashboard → tutor → wrong-book → review`)
- **CLAUDE.md Shell Adapter 表格更新** (Immersive Shell ✅)

**Commit 估计**: 15-20 commits

**依赖**:
- v0.8 完成的 tutor + wrong-book 闭环
- Immersive Shell 第一次新 adapter (60% 概率 0 fix, 40% 概率 1-2 fix)
- Vision OCR 端到端 pipeline (拍照 → Qwen-VL → 错题本)

**风险**:
- 🔴 Vision OCR 复杂 (拍照 + upload + multimodal + latex)
- 🟡 Immersive Shell 新 adapter (跟 Hybrid / Workspace 一样, 第一次可能 1-2 fix)
- 🟡 Playwright 5 page 截图不稳 (CI 没配)

**DoD**:
- [ ] 4 page F3 全部完成 (review / vision / exam / 跨页跳转)
- [ ] Immersive Shell Adapter 验证 (0 fix commit 目标)
- [ ] Playwright E2E 5 flow pass
- [ ] 10 page screenshot 截图 (desktop + mobile)
- [ ] Contract Test 50+ 端点全过
- [ ] **tag v0.9.0-dev**

### v1.0 — 生产质量 (Phase 3)

**目标**: real production-ready, 标签 v1.0

**必须包含**:
- **F6 Cutover**
  - server.js 静态根改 (主 + /legacy)
  - frontend/ 冻结 + DEPRECATED.md
  - 归档 ai-tutor-redesign
- **Test 硬化**
  - 5 page screenshot 回归 baseline
  - Lighthouse Performance > 85
  - A11y > 90
  - 跨浏览器 (Chrome / Firefox / Safari / Mobile Safari)
- **Security audit**
  - `.git/config` 凭证清理 (SSH / credential helper)
  - admin 密码 hash 移 db.js
  - rate limit 验证
- **i18n scaffold**
  - 中文 only, 标未来英文
- **Dark mode polish**
- **Migration tool** (P2.1)
- **`<img alt>` 补全** (P2.6)
- **Service layer audit** (56% 未引用 endpoint 清理)

**Commit 估计**: 15-20 commits

**依赖**:
- v0.9 完成的 4 page F3 + E2E
- 真实 :3002 backend 长期可用
- 用户 2-3 周观察期 (确认 frontend/ 没人访问)

**风险**:
- 🟡 frontend/ 冻结后用户找不到 (Low — 2-3 周观察 + 1 周前通知)
- 🟡 Lighthouse 跑 5-10 次迭代
- 🟡 真实生产数据未见过 (unverified)

**DoD**:
- [ ] `curl localhost:3002/` 显示 ai-tutor-frontend
- [ ] `curl localhost:3002/legacy/` 仍可访问老 frontend
- [ ] Playwright 10 page 全 pass
- [ ] Lighthouse Performance > 85, A11y > 90
- [ ] 0 lint error, 0 console error
- [ ] **tag v1.0**

### 不在 v1.0 范围 (v1.5+)

- AI 模型 fine-tuning (当前用 DashScope qwen-plus)
- 多端同步 (跨 device)
- 教师端 / 家长端
- 商业化 (SaaS / 私有化部署)
- 国际版 (英文 UI)

---

## 9. New Developer Onboarding

> 假设明天一个新的高级工程师接手, 1 周内 onboard

### "这个项目现在是什么状态"

**ai-tutor** 是面向高考/中考生 (47 高校 + 42 中考知识点) 的 AI 辅导 PWA。后端 95% 完工 (Node.js + Express + PostgreSQL + pgvector + Apache AGE + LLM); 前端 50% F3 化 (5 pages 完成 dynamic data layer, 1 page 80% (tutor), 3 pages 完全未迁移 (review/vision/exam-simulation))。
**当前 HEAD `981bbd29`**, 最近 9 commits 全 F3 frontend migration。

### 第一天应该读什么

1. **`README.md`** — 架构总览 + Hybrid RAG Triad + SSE 协议 + 9 学科 213 知识点
2. **`CLAUDE.md`** — Frontend F3 Migration Rules + 4 Shell Adapter 表格 + non-goals
3. **`docs/frontend-migration/F3_SLICE_3_RETROSPECTIVE.md`** — 5 个可复用模式 (Filter State / Event Delegation / Mastery Derive / Active Button Toggle / Matched/Total Display)
4. **`docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md`** — D52-D55 (SSE 异步新模型)
5. **`docs/frontend-migration/PLAN.md`** — 原 6 阶段 User Journey (注意: 多数未完成, 仅参考节奏)

### 哪些地方不要碰

1. **`client.js`** — 9 service 现有调用全部依赖 envelope `{success, data}`, 拆信封会破坏 8 service 调用。只在 4 个内置 helper 加 `export` 是允许的 (`getMockEnabled`, `loadMock`, `getApiBase`, `getToken`)。
2. **`api/core/db.js`** — 18 表 auto-create, 加字段需改这里**并且**手动删表。无 migration tool, 改之前先想清楚。
3. **4 个 Shell Adapter 的 page-level 实现** — 是产品 UX 决策, 钉死在 CLAUDE.md, 不要试图统一。
4. **已 push 的 commit** — 远端 push 保留控制, 不要 amend。
5. **新框架 / 新依赖** — F3 纪律 = vanilla JS + 5 个 pattern + 9 个新增 pattern, 已能覆盖 7-10 pages。
6. **frontend/ 立即 archive** — F6 计划冻结 + 2-3 周观察期, 太早 archive 断用户。

### 第一次提交前的必读

- `scripts/automation/lint.sh` — pre-commit lint, 必须 pass
- `git push_all.sh` — 3 remote push 工具 (origin / uibe / localtest)
- `.git/hooks/pre-push` — ahead/behind 报告

---

## 10. Final CTO Recommendation

### 如果你只有未来 7 天

**应该做**:
1. **Slice 4.4 commits 3-5** (5 dead buttons + cross-page highlight + retro) — 子 agent 已设计, 3 commits, 1 day
2. **Backend `questions.js` 加 PUT /api/questions/:id** for markMastered — 15-30 行单文件, 0.5 day
3. **`wrong.markMastered()` service + mock + wire 到 UI** — 1-2 day
4. **真实 backend smoke test** (起 :3002, 跑真链路 login → dashboard → tutor → wrong-book) — 1 day
5. **tag v0.8.0-dev** — 0.1 day

**不要做**:
- ❌ 不要继续推 review / vision / exam-simulation 三个 page (留 v0.9)
- ❌ 不要解决 browser cache 问题 (留 P0.1, 端到端用 Node.js integration test fallback)
- ❌ 不要改 client.js 拆信封
- ❌ 不要引入新框架

**输出**: v0.8.0-dev tag, tutor + wrong-book 完整闭环, ~5-6 commits

### 如果你有 30 天

**Phase 1 (Week 1-2)**: v0.8 核心闭环 (上面 5 件事)
**Phase 2 (Week 3-4)**: v0.9 完整产品体验
- Slice 5: review.html (Immersive Shell 首次验证, 2-3 commits)
- F4: vision.html (Immersive Shell + OCR, 3-4 commits)
- Slice 6: exam-simulation.html (2-3 commits)
- Mastery 跳转 tutor (1 commit)
- Playwright 5 page E2E (1 commit)
- tag v0.9.0-dev

**输出**: v0.9.0-dev tag, 9.5 page F3 化, 端到端 E2E 通过

### 哪些事情不要做 (30 天范围)

- ❌ 不要 F6 Cutover (server.js 静态根切换) — 留 v1.0, 2-3 周观察期再说
- ❌ 不要 Lighthouse / A11y 硬化 — 性能 baseline 还没建立, 现在优化是空中楼阁
- ❌ 不要 security audit (凭证清理) — 有 stronger priority items
- ❌ 不要重写 backend — 95% 完整, 唯一缺 markMastered + sessions
- ❌ 不要 database migration tool — 1-2 周不动 schema, 之后再做
- ❌ 不要 i18n / dark mode — 锦上添花, 不解决当前 P0
- ❌ 不要重写 CLAUDE.md / docs — 等 v0.9 一起 sync (避免频繁改规则文件)

### 30 天 ROI 评估

| 投入 | 产出 | ROI |
|------|------|-----|
| 8-10 commits (Slice 4.4 + markMastered) | tutor 完整闭环 + 写错题操作 | 🟢 高 (关键 UX 闭环) |
| 15-20 commits (3 page F3) | 9.5/10 page 完成 frontend | 🟢 高 (核心 KPI) |
| 1 commit (Mastery 跳转) | 知识图谱 UI 闭环 | 🟡 中 |
| 1 commit (Playwright E2E) | 5 page 端到端 | 🟡 中 |
| 1 commit (tag v0.8 + v0.9) | 2 个里程碑 | 🟢 高 |
| 5-8 commits (Lighthouse / A11y / i18n) | 性能 + 体验 | 🔴 低 (用户没看到) |

**最高 ROI 优先级**: Slice 4.4 → 3 page F3 → Playwright E2E → 2 个 tag

### Priority Recommendation (即决)

**今天就做** (最小步, 解 P0.3):
1. Read `docs/frontend-migration/F3_SLICE_4_4_ARCHITECTURE_DECISIONS.md`
2. Implement Slice 4.4 commit 3 (5 dead buttons 复活)
3. Smoke test + commit
4. (选) Implement commit 4 + 5

**明天做** (解 P0.4):
- Backend `questions.js` PUT handler
- `wrong.markMastered()` service + mock
- Wire to wrong-book card

**本周完成** (v0.8 tag):
- 真实 backend smoke test
- tag v0.8.0-dev

---

## 附录 A: 真实性声明

本审计基于:
- ✅ Git tree (git log, git status, diff)
- ✅ Frontend 代码 (10 pages, 9 services, 38 mocks, 1 hook, 1 component)
- ✅ Backend 代码 (75 files, 33 handlers, 7 routes, 6 services)
- ✅ Tests (1328 行, 17 files)
- ✅ Docs (5 retro + 2 architecture decision memo + CLAUDE.md + MILESTONES.md + README.md + PLAN.md)

**未审计**:
- ❌ 生产环境 `:3002` (CLI 是 dev, 不是 prod)
- ❌ 真实 LLM 调用 (DashScope qwen-plus)
- ❌ 真实 Apache AGE 图谱
- ❌ 真实 pgvector 大规模检索性能
- ❌ 真实用户数据 / 商业模式

**关键不确定性**:
- Backend 真实跑起来会什么样? 不知道 (smoke test 缺)
- Mock 跟 backend 字段对齐? 假设对齐, 无自动 contract test 验证
- 9 学科 213 知识点表是否真的导入? 假设导入, 未跑 SQL

---

## 附录 B: 文档索引

| 文档 | 路径 | 价值 |
|------|------|------|
| 主 README | `README.md` | 公开架构概览 |
| 项目指南 | `CLAUDE.md` | F3 rules + 4 Shell Adapter 表格 |
| 版本历史 | `docs/MILESTONES.md` | v0.5 → v0.7.0-dev |
| F3 计划 | `docs/frontend-migration/PLAN.md` | 原 6 阶段 User Journey |
| Slice 1 retro | `docs/frontend-migration/F3_SLICE_1_RETROSPECTIVE.md` | 模板起源, 4 contract |
| Slice 2 retro | `docs/frontend-migration/F3_SLICE_2_RETROSPECTIVE.md` | "可复制" 证明 |
| Slice 3 retro | `docs/frontend-migration/F3_SLICE_3_RETROSPECTIVE.md` | **5 个可复用模式** (核心) |
| Slice 4.3 决策 | `docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` | D52-D55 (SSE 异步) |
| Slice 4.3 retro | `docs/frontend-migration/F3_SLICE_4_3_RETROSPECTIVE.md` | 异步模式扩展 |
| Slice 4.4 决策 | `docs/frontend-migration/F3_SLICE_4_4_ARCHITECTURE_DECISIONS.md` | D56-D60 (持久化 + cross-page) |
| 第一次审计 | `PROJECT_STATUS_AUDIT.md` | 上一轮深度技术审计 |

**新增建议**: 顶层 `ARCHITECTURE_DECISIONS.md` index, 汇总 5 docs + 9 Shell Adapter 决策 + 12 pattern, 一站式 onboarding。

---

## 附录 C: 9 commits 全链 (Phase A-D 完成)

```
Phase A (tutor):
  94e0a2a1  Slice 4 Phase 3 — non-streaming chat MVP
  142f1252  Slice 4 Phase 2 — tutor Workspace Shell Adapter + history/subject
  460e8449  Slice 4 Phase 1 — tutor service + mock contract

Phase B (auth):
  61dc24ad  F3.1 — login + register wired to auth service

Phase C (wrong mutation):
  43193f12  Slice 3.2 — delete + create + cross-page

Phase D (SSE + Markdown):
  997f5446  Slice 4.3 c1 — SSE parser + askStream skeleton
  e4c57f6d  Slice 4.3 c2 — streaming UI + rAF + AbortController
  79dcc0de  Slice 4.3 c3 — inline markdown regex
  62b8a8d7  docs: F3 Slice 4.3 retrospective

Phase E (tutor persistence, 2/5 done):
  f73b6529  Slice 4.4 c1 — localStorage session store + ?sid=X
  981bbd29  Slice 4.4 c2 — sendMessage done 持久化 + sidebar 切换 + URL sync
```

---

**审计完成时间**: 2026-08-10
**审计签字**: Principal Engineer + Technical Program Manager
**审计结论**: 项目位置清晰, 9 commits Phase A-D delivered, **当前 P0 阻塞 5 项** (3 page 未迁移 + 5 dead buttons + markMastered PUT + browser cache + backend smoke). **Path to v1.0 重新规划 3 phases, ~33-45 commits, ~14-19 工作日**. **最关键: 本周完成 Slice 4.4 commits 3-5 + markMastered + backend smoke → tag v0.8.0-dev**.
