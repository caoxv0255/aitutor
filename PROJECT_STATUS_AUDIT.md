# PROJECT STATUS AUDIT — ai-tutor

> **审计对象**: ai-tutor (高考/中考 AI 智能辅导系统)
> **审计日期**: 2026-08-10
> **审计角色**: Principal Engineer / Tech Lead
> **范围**: 完整架构审查 + 路线图重新规划
> **前置**: 基于 `git log` (最近 20 commits) + 全量代码阅读 + 文档 + 决策 memo
> **触发**: 推进 9 个 F3 commits 后, 重新理解项目状态 + 决策剩余路线

---

## 0. TL;DR — 给忙碌的项目负责人

| 维度 | 状态 |
|------|------|
| **整体完成度** | Backend: 95% (33 handlers + 7 routes); Frontend: 50% (3.5/9 pages 完整 F3) |
| **可发布 v0.8** | ❌ 否, 至少 5 步阻塞 (见 §6 P0) |
| **当前 HEAD** | `981bbd29` (Slice 4.4 commit 2) |
| **最近 9 commits 都是 frontend** | 5 services + 9 mock files + 2 pages + 1 deck / 推 3 remote |
| **最大风险** | Browser cache 跨 session 黏住, 端到端验证阻塞 (5 attempts, 持续) |
| **下一步** | 不再 commit: 先完成 Slice 4.4 commits 3-5, 然后 Phase F (review.html) |

**一句话**: 项目后端基本完工, 前端从 Phase 1 (foundation) 走到 Phase 4 (tutor SSE), 还差 4 pages + 5 个 dead buttons + Slice 4.4 commits 3-5 + 测试硬化才到 v1.0。

---

## 第一部分: 项目一句话定位

### 一句话

> **ai-tutor** 是面向高考/中考生 (47 高校知识点 + 42 中考知识点) 的 AI 智能辅导 PWA, 通过 **Hybrid RAG (pgvector 向量检索) + GraphRAG (Apache AGE 知识图谱) + LLM Agent (qwen-plus)** 三层架构, 提供: 拍照搜题 → AI 教学流 → 错题诊断 → 间隔复习 → 考试模拟的完整学习闭环。**Frontend 正在从静态 prototype (frontend/) 迁移到 F3 dynamic template (ai-tutor-frontend/)**, 已完成 50%。

### 技术架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│  浏览器 (PWA + PC)                                                   │
│  ┌────────────────────────────┐  ┌─────────────────────────────┐  │
│  │ PWA Mobile (public/)        │  │ PC Desktop (ai-tutor-frontend/) │  │
│  │  /src/js/tutor-stream.js     │  │  pages/*.html + module scripts  │  │
│  │  /src/js/katex-stream.js     │  │  F3 layer (useAsyncResource)    │  │
│  │  /src/js/mastery-graph.js    │  │  Service layer (8 services)     │  │
│  └────────────┬───────────────┘  └──────────────┬───────────────┘  │
└───────────────┼─────────────────────────────────┼─────────────────┘
                │ SSE / REST + Bearer JWT            │
┌───────────────┼─────────────────────────────────┼─────────────────┐
│  server.js (Express) 自适应 UA 路由                                  │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐ │
│  │ Public PWA 静态             │  │ F3 AI Tutor 静态 (主)         │ │
│  │ /api/* (共享)              │  │ /api/* (共享)                │ │
│  └────────────────────────────┘  └──────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ api/handlers (33)  + api/routes (7)  + api/services (6)   │  │
│  │  ├ tutor-agent.js (SSE + RAG) — 全后端最大 749 行            │  │
│  │  ├ rag-search.js (pgvector HNSW)                            │  │
│  │  ├ graphrag.js (Apache AGE Cypher)                           │  │
│  │  ├ vision-parse.js (Qwen-VL 多模态)                          │  │
│  │  ├ srs-engine.js (SM-2 间隔重复)                              │  │
│  │  ├ learning-loop.js (掌握度飞轮)                             │  │
│  │  ├ questions.js (错题 CRUD — 缺 PUT/PATCH)                  │  │
│  │  └ 23 个其他 handlers (考试/报告/分析/认证...)                 │  │
│  │  api/core: db.js (postgresql pool + auto-create 18 表)       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ pg pool
┌────────────────────────────┴─────────────────────────────────────┐
│  PostgreSQL + Apache AGE (图) + pgvector (向量索引 HNSW)         │
│  表: users / wrong_questions / reports / knowledge_points /      │
│       exam_papers / exam_questions / task_queue /                │
│       similar_questions / personalized_papers / subjects / ...    │
└───────────────────────────────────────────────────────────────────┘
```

### 用户使用流程 (典型 5 步)

```
[Mobile PWA] 用户拍照错题
    ↓ vision.parse (Qwen-VL 多模态)
[OCR 文本] 自动识别题目 + 学科 + 知识点
    ↓ vision.ingest + wrong.createQuestion
[错题本] 错题入库（关联 exam bank）
    ↓ user 点击 "问 Tutor"
[PC Web] tutor.html 渲染会话
    ↓ tutor.askStream (SSE 流式)
[AI 教学] 字符级流式回复 + 诊断卡片 + Markdown 渲染
    ↓ user 点击 "加入错题本" 或 "查看知识图谱"
[错题 / 知识图谱] 跨页跳转 + 状态联动
    ↓ SRS daily-tasks 自动生成
[复习] 间隔复习 + 错误入错题本（飞轮）
```

---

## 第二部分: 当前完成度审计

### Frontend Pages (10 pages total)

| Page | 行数 | F3 状态 | Shell | 关键 service | 真数据路径 | 假数据 | 风险 |
|------|------|--------|-------|-------------|----------|------|------|
| **dashboard.html** | 1429 | ✅ 完成 (Slice 1, 2 commits + 2 fix) | Dashboard | `user.dashboard` | ✅ user.dashboard | - | 🟢 已稳定 |
| **mastery.html** | 1338 | ✅ 完成 (Slice 2, 1 commit) | Dashboard | `knowledge.mastery` | ✅ mastery | - | 🟢 已稳定 |
| **wrong-book.html** | 1117 | ✅ 完成 + Slice 3.2 (5 commits) | Hybrid | `wrong.{getQuestions, deleteQuestion, createQuestion}` | ✅ getQuestions + deleteQuestion | - | 🟢 Backend 缺 PUT/PATCH for markMastered |
| **tutor.html** | 1395 | 🟡 80% (Slice 4.0-4.3 全完, 4.4 2/5) | Workspace | `tutor.{ask, askStream, getHistory}` | ✅ askStream SSE + history | - | 🟡 5 dead buttons + 跨页 navigate 未接 |
| **login.html** | 1041 | ✅ Wired (F3.1, 1 commit) | (none) | `auth.login + auth.guestLogin` | ✅ login + token 存 LS | - | 🟢 已稳定 |
| **register.html** | 885 | ✅ Wired (F3.1, 1 commit) | (none) | `auth.register` | ✅ register + auto-login | - | 🟢 已稳定 |
| **review.html** | 932 | ❌ **未迁移** | (none - 计划 Immersive) | `review.{reports, sessionHistory, trend, weakPoints}` | ❌ 0 真数据 | 100% hardcoded HTML | 🟡 计划 F3.6 |
| **vision.html** | 916 | ❌ **未迁移** | (none - 计划 Immersive) | `vision.{parse, ingest, status}` | ❌ 0 真数据 | 100% hardcoded HTML | 🔴 高风险 (OCR + photo upload) |
| **exam-simulation.html** | 176 | ❌ **未迁移** | (none) | `exam.{startSession, submitSession, examPdf}` | ❌ 0 真数据 | 100% hardcoded HTML | 🟡 计划 F3.7 |
| **index.html** | 243 | ❌ (homepage, marketing) | (none) | (none) | ❌ 静态页 | - | 🟢 低优先级 |

**关键发现**:
- **5 个 page 完全没动 F3**: review, vision, exam-simulation, index (+ tutor 的 4.4 commits 3-5)
- **3 个 page 完成 F3**: dashboard, mastery, wrong-book + login/register
- **1 个 page 80% F3**: tutor (chat + SSE + markdown done, 5 dead buttons + persistence 2/5 done)

### Backend Services (8 完整 + 1 草稿)

| Service | Lines | Contract Test | 完整度 | 备注 |
|---------|-------|---------------|-------|------|
| **auth.js** | 1.2K | ✅ 39/39 | 🟢 100% | login/register/guestLogin/logout/me |
| **user.js** | 1.0K | ✅ | 🟢 100% | dashboard/provinces/userProvince |
| **exam.js** | 1.5K | ✅ | 🟢 100% | papers/questions/session/pdf |
| **rag.js** | 1.6K | ✅ | 🟢 100% | search/multiSearch/similar/explain/ask/ingest/stats |
| **knowledge.js** | 1.1K | ✅ | 🟢 100% | mastery/map/profile/kpDetail/points |
| **review.js** | 0.9K | ✅ | 🟢 100% | reports/sessionHistory/trend/weakPoints |
| **vision.js** | 0.8K | ✅ | 🟢 100% | parse/ingest/status |
| **wrong.js** | 2.3K | ✅ (mock 验证) | 🟡 90% | getQuestions/deleteQuestion/createQuestion ✅ / markMastered ❌ |
| **tutor.js** | 5.4K | ✅ (commit 1) | 🟡 90% | ask/askStream/getHistory ✅ / getMastery ❌ |

**关键发现**:
- 9/9 services 已写, mock convention 完整 (38 mock JSON 文件)
- **2 个 service 方法 missing**: `wrong.markMastered` (backend 无 PUT/PATCH), `tutor.getMastery` (deferred)
- **Contract Test 39/39 全过** (Phase 2 commit `e772905e` 基础 + 后续 slices 增量验证)

### Backend Routes & Handlers (75 文件)

| 模块 | Lines | 状态 | 备注 |
|-----|-------|------|------|
| **api/handlers/questions.js** | 4.3K | 🟡 90% | GET/POST/DELETE ✅, PUT/PATCH ❌ (markMastered 缺) |
| **api/handlers/login.js + register.js + guest-login.js** | 4.7K | 🟢 100% | auth 完整 |
| **api/handlers/reports.js** | 2.1K | 🟢 100% | 报告 CRUD |
| **api/handlers/learning-path.js** | 9.8K | 🟢 100% | 学习路径 |
| **api/handlers/knowledge-points.js** | 9.2K | 🟢 100% | 知识点 + 薄弱点 |
| **api/handlers/exam-*** (5) | 42.6K | 🟢 100% | 考试系统 |
| **api/handlers/provinces.js + province-*** (3) | 19.3K | 🟢 100% | 省份 + 趋势 |
| **api/handlers/adm/** (3) | 16.2K | 🟢 100% | gamification, class-analysis, subject-trends |
| **api/handlers/study-plan.js** | 16.5K | 🟢 100% | 学习计划 |
| **api/routes/tutor-agent.js** | 27.5K | 🟢 100% | **最大单文件**, 749 行 askTutorAgent + SSE |
| **api/routes/rag-search.js** | 28.6K | 🟢 100% | pgvector + HNSW |
| **api/routes/learning-loop.js** | 18.8K | 🟢 100% | 数据飞轮 |
| **api/routes/srs-engine.js** | 13.4K | 🟢 100% | SM-2 间隔重复 |
| **api/routes/vision-parse.js** | 13.8K | 🟢 100% | Qwen-VL 多模态 |
| **api/routes/graphrag.js + knowledge-graph.js** | 10.5K | 🟢 100% | Apache AGE 数据库 |
| **api/core/db.js** | 31.9K | 🟢 100% | ⚠️ **18 表 auto-create**, 无 migration tool |
| **api/utils/** (10 files) | 92.7K | 🟢 100% | LLM parser, prompts, subject mapping, textbook keywords |

**关键发现**:
- **Backend 端基本完工**: 75 JS 文件, 33 handlers + 7 routes + 6 services + 10 utils
- **Database 18 表自动创建**: db.js 启动时 `CREATE TABLE IF NOT EXISTS` (无 migration, 加字段需改 db.js)
- **tutor-agent.js 是最大文件**: 749 行, 含 askTutorAgent + askStreamTutorAgent + LLM JSON mode + 防跳跃机制
- **PUT/PATCH /api/questions/:id 不存在**: markMastered 写操作需新增 backend 端点

### F3 Infrastructure

| 组件 | 状态 | 备注 |
|------|------|------|
| **client.js** | ✅ | 10.2K fetch wrapper + retry + timeout + token + 401 + 5 mock 行为 |
| **useAsyncResource hook** | ✅ | 3.3K stale-safe + refetch + subscribe |
| **error-boundary.js** | ✅ | 5.3K ErrorBoundary + mount |
| **auth.js (client)** | ✅ | token + user LS + requireAuth 路由守卫 |
| **toast.js** | ✅ | 4 等级 toast (success/error/info/warning) |
| **USE_MOCK.js** | ✅ | URL `?mock=true` + LS 持久化 |
| **hooks/useStreamingResource.js** | ❌ | **未创建** (Phase D 决策: 单消费者 YAGNI) |
| **Service Layer (8 services + index)** | ✅ | 9 个 service, 完整 envelope + mock convention |
| **Mock fixtures (38 files)** | ✅ | 38 个 JSON, 覆盖 9 service 约 50 端点 |
| **Shell Adapters (4 种)** | ✅ 3 / ⏳ 1 | Dashboard ✅, Hybrid ✅, Workspace ✅, Immersive ⏳ |

### Frontend Migration Plan vs Actual

| 计划 (PLAN.md §3 / MILESTONES.md) | 实际 commit | 状态 |
|--------------------------------|-------------|------|
| F1.1-F1.17 Foundation (Day 1-3) | `e772905e` + `27fe354d` + `4aa94cf9` | ✅ 略延迟, 全部到位 |
| F2.1-F2.7 Service Layer (Day 4-5) | 散在 service commits | ✅ 全部到位 |
| F3.1 Auth (Day 6) | `61dc24ad` | ✅ |
| F3.2 Dashboard (Day 7) | `5997cce8` + 2 fix | ✅ |
| F3.3 Question (dashboard 内嵌) | (无独立 commit) | ❌ **计划 vs 实际**: "Question 内嵌在 dashboard" 实际未做, dashboard 是单独的 user dashboard |
| F3.4 Tutor (Day 9) | `460e8449` + `142f1252` + `94e0a2a1` + `997f5446` + `e4c57f6d` + `79dcc0de` + `62b8a8d7` | 🟡 80% (5 phases, 4.4 2/5 done) |
| F3.5 WrongBook (Day 10) | `34e9acda` + `d3435602` + `03839814` + `43193f12` | ✅ |
| F3.6 Review + Mastery (Day 11) | `f6f587a8` (mastery done) | 🟡 mastery ✅, review ❌ |
| F3.7 Exam Simulation (Day 12) | (0 commits) | ❌ |
| F4.1-F4.6 Vision Epic | (0 commits) | ❌ |
| F5.1-F5.7 Testing | partial | 🟡 1328 行 tests, 但 5 page screenshot 缺 |
| F6.1-F6.7 Cutover | (0 commits) | ❌ |

**关键发现 — 计划 vs 实际不一致**:
> **计划认为 F3.3 = Question 在 dashboard 内嵌** (PLAN.md §3.3), **实际 dashboard 是 user dashboard (分省/分科/学情), 跟 Question 无关**。F3.3 没有独立 commit, 实际被"跳过"或"合并到 F3.7 Exam Simulation 一起做"。这不是 bug, 是**计划粒度跟实际架构不匹配** (User Journey 跟 Page-centric 视角冲突), 应该在 F3.1 角色时显式记 decision log。

---

## 第三部分: F3 Migration 详细解释

### 为什么需要 migration?

**原因 1 — 静态 HTML 跟 data layer 脱节**:
- `frontend/` (PC) 和 `ai-tutor-redesign/` 都是硬编码 HTML, **无 JS layer**
- 后端 33 handlers / 7 routes 全部都有, **前端无法消费**
- 早期 development 跟 deployment 节奏: 后端一直在接 endpoint, 前端卡在 prototype 阶段

**原因 2 — 多端复用**: 同一份后端需要 PWA + PC + (未来) tablet, 想用同一套 service layer

**原因 3 — Mockable + Testable**: 前端想要 dev 时 `?mock=true` 离线工作, e2e 时切真实后端

### 旧系统是什么?

**frontend/** (PC, 31 page):
- 全 hardcoded HTML, 调 `components.js` 渲染顶部/底部
- 静态 demo
- **生产仍 serve 这套**, 路径 `/legacy`

**public/** (PWA):
- 有自己的 JS (`tutor-stream.js`, `katex-stream.js`, `mastery-graph.js`)
- SPA 风格, 拍照 + KaTeX 流式渲染
- **是当前 mobile 用户在用的**

**ai-tutor-redesign/** (已归档):
- 早期 prototype, 已 F1.17 归档

### 新系统是什么?

**ai-tutor-frontend/** (PC, F3 target):
- 9 个 page (10 个 pages/ - 1 个 index.html)
- 8 个 service (`auth/user/exam/rag/knowledge/review/vision/wrong/tutor`)
- 9 个 mock fixtures (38 JSON)
- 基础设施 (client.js, useAsyncResource, error-boundary, toast, USE_MOCK)
- **目标**: 取代 frontend/ 作主前端

### Slice 1 (Dashboard, 2026-08-06)

**做了什么**: 把 `dashboard.html` 接入 `useAsyncResource + ErrorBoundary`, 验证 Page Shell Adapter 概念 (Dashboard Shell = `fixed w-60` global sidebar + page offset `lg:ml-60 md:ml-[72px]`)。

**3 commits**: `5997cce8` (feat) → `c46cfcde` (fix envelope) → `c11167ec` (fix layout)

**价值**: 第一个 F3 样板, 4 contract 固化 (Service Envelope / Mock Convention / useAsyncResource / ErrorBoundary)。

**0 fix commit 后续**: Slice 2/3 都未出现 envelope / layout bug, 验证 contract 稳定。

### Slice 2 (Mastery, 2026-08-06)

**做了什么**: 把 `mastery.html` 接入同样的 F3 template, **0 fix commit** — 复用 Slice 1 一气呵成。

**1 commit**: `f6f587a8`

**价值**: 证明 F3 是 **可复制** 的迁移模式, **不是单页面实验**。

### Slice 3 (WrongBook, 2026-08-07)

**做了什么**: 接入 `wrong-book.html`, **新适配 Hybrid Shell Adapter** (sidebar 在 `<main class="flex">` 内层, content 用 `flex-1` 让位, 不需要 page-level offset)。

**5 commits**: `34e9acda` + `d3435602` + `03839814` + `713c58d1` + `3192adec` (含 doc 同步)

**5 个可复用 pattern** (本 Slice 价值):
1. **Filter State Contract** (`filterState` 对象 + 闭包 fetcher + refetch)
2. **Event Delegation Contract** (1 listener per filter group)
3. **Mastery Derive Pattern** (page layer 派生, 不进 service)
4. **Active Button Toggle** (classList.remove/add, 不解析 class string)
5. **Matched/Total Display** (backend filter = plain, client filter = X/Y)

**0 fix commit** 含义: 第一次非 Dashboard Shell adapter 一次过。

### Slice 4 (Tutor, 2026-08-10, 进行中)

**做了什么**: 接入 `tutor.html`, **新适配 Workspace Shell Adapter** (3-region: header full-width + sidebar + main in flex)。

**9 commits** (5 phases, 80%):
- 4.0 Phase 1: Service + Contract (`460e8449`)
- 4.1 Phase 2: Workspace Shell + history/subject (`142f1252`)
- 4.2 Phase 3: Non-streaming chat MVP (`94e0a2a1`)
- 4.3 SSE + Markdown (4 commits: `997f5446` + `e4c57f6d` + `79dcc0de` + `62b8a8d7`)
- 4.4 Persistence + cross-page (2/5 commits: `f73b6529` + `981bbd29`)

**5 个新可复用架构模式** (本 Slice 价值):
1. **SSE imperative state** (content += delta, 跟 Phase 3 sendMessage 同 pattern)
2. **AbortController 三重 abort** (mock sleep + fetch signal + beforeunload)
3. **rAF throttle + done flush** (高频 chunk 渲染优化)
4. **content-type 校验** (SSE vs JSON)
5. **escape-then-regex 顺序** (XSS + markdown)

**两个 subagent 决策 memo** (494 + 389 行):
- `F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` (D52-D55)
- `F3_SLICE_4_4_ARCHITECTURE_DECISIONS.md` (D56-D60)

**RED 信号**: browser cache 跨 session 黏住 (5 attempts, 持续), 阻塞运行时验证。

### Shell Adapter 4 种解释

| Shell | Layout | 适用 page | 关键差异 |
|-------|--------|----------|----------|
| **Dashboard Shell** | `<body>` 直接子 `<aside fixed w-60>` + `<section lg:ml-60 md:ml-[72px]>` | dashboard, mastery | sidebar 是全局, page 自己 offset |
| **Hybrid Shell** | `<main class="flex">` 内层 `<aside fixed md:sticky>` + `<div flex-1>` | wrong-book | sidebar 在 `<main>` 内, content 用 flex-1 让位 |
| **Workspace Shell** | 3-region: header full-width + `<div flex><aside>` + `<main flex-1>` | tutor | chat workspace, 顶层有 sticky filter bar |
| **Immersive Shell** | 单列 `flex-col`, 无 sidebar | vision, review (⏳ 未验证) | 沉浸式, 移动端可占满 |

**为什么 tutor 用 Workspace Shell?**

- **Reason 1**: tutor 是 chat-like workspace, **3-region 布局** (header / sidebar history / main chat)
- **Reason 2**: header 必须是 full-width (有 logo + subject dropdown + clear chat button, 不能在 sidebar 内)
- **Reason 3**: chat area 需要 **scroll isolated** (sidebar history 跟 chat 不能同时滚动)
- **Reason 4**: mobile 上 `hidden lg:flex` 隐藏 sidebar, 跟 fullscreen chat app 体验一致

**关键**: 4 个 shell adapter 是 **产品 UX 决策**, 不是 refactor debt。CLAUDE.md 钉死: "Unify all page layouts into one shell (4 shells are product UX decisions)" — **不要试图统一**。

---

## 第四部分: tutor.html 状态深度解释

### 切片现状

```
✅ 已完成:
  - service (tutor.js 5.4K, ask + askStream + getHistory)
  - mock (tutor_ask.json / tutor_ask_guided.json / tutor_ask_stream.json / tutor_history.json)
  - Workspace Shell (header + sidebar + main flex 布局)
  - history (8 sessions dynamic render from mock)
  - subject (9 学科 dropdown + 4 quick tags, two-way binding)
  - chat interaction (send button + Enter key)
  - SSE streaming (rAF throttle + AbortController)
  - Markdown (bold/code/latex placeholder)
  - 4.4 persistence: localStorage store + ?sid=X 解析 + sidebar 切换 + 流 done 持久化

🟡 4.4 2/5 done (commit 1+2):
  - localStorage session store ✅
  - 流 done 持久化 ✅
  - sidebar click handler ✅
  - URL sync ✅
  - "新建对话" button ✅

❌ 4.4 3/5 待做:
  - 5 dead buttons 复活 (清空对话 / 查看知识图谱 / 拍照 / 停止生成 / 加入错题跳转)
  - 跨页 wrong-book highlight (?highlight=QID)
  - retro doc

🔴 4.5+ 待做:
  - KaTeX hydration (Phase D3 placeholder 留口子)
  - useStreamingResource hook (D54 YAGNI, 5+ 消费者再抽)
  - auto-reconnect / 重试
  - session 持久化 backend (D56 选 localStorage, 真正部署再补)
```

### 用户打开 tutor.html 实际发生什么?

```
1. 浏览器请求 /pages/tutor.html
2. server.js 静态 serve (F3 path)
3. HTML 加载 Tailwind CDN + Lucide CDN
4. <script type="module"> 执行 (587 行, 是整个 ai-tutor-frontend 最大 module)
5. mountErrorBoundary() 注册全局 error handler
6. setUseMock(true) 强制 mock 模式
7. conversationState 初始化 (7 字段: subject/currentSessionId/sessions/messages/loading/error/streamController)
8. parseSidFromUrl() 检查 URL ?sid=X
   - 有: loadSessionMessages(sid) 从 localStorage 取
   - 无: 空 messages
9. useAsyncResource 加载 history (tutor.getHistory → mock tutor_history.json)
   - 8 sessions 注入 conversationState.sessions
10. renderHistory() 渲染 sidebar
11. syncSubjectDropdown() + renderSubjectTags() 渲染 header + input bar
12. renderMessages([]) 渲染空 chat area
13. 等待用户输入
```

**真正数据 (server 端)**:
- `tutor_history.json` 8 sessions (mock)
- `tutor_ask.json` / `tutor_ask_guided.json` (mock)
- `tutor_ask_stream.json` 10 events (mock)

**真正数据 (localStorage)**:
- `aitutor.user` (用户信息, 来自 auth.login)
- `aitutor.tutor.sessions` (4.4 commit 1, 暂未写入数据, 空)

**假数据 / dead features**:
- `tutor_history_mock` 8 sessions 的 title 是 mock 写死的, 不真实
- "查看知识图谱" button → **dead**, click 不响应
- "拍照搜题" button → **dead**, click 不响应
- "清空对话" button → **dead**, click 不响应
- "新建对话" button → **半活** (4.4 commit 2 接了 basic handler, 但 toast 提示缺)
- "加入错题本" button → **半活** (Slice 3.2 接了创建 + button 文字 "已加入", 但**不跳 wrong-book**)
- "停止生成" button → **完全缺** (4.4 让 waiter D60)

### tutor.html 数据流 (状态机)

```
用户输入文本
    ↓ Enter / send-btn click
conversationState.messages.push({role:'user', content, timestamp})
    ↓ renderMessages()
#messages show user bubble
    ↓ conversationState.loading = true
    ↓ conversationState.streamController = new AbortController()
renderLoading() → show typing indicator + disable inputs
    ↓ askStream({question, subject, signal, onEvent})
        ↓ mock 路径: loadMock('tutor_ask_stream.json') → 10 events
        ↓ events 逐个 emit (with delay_ms)
            ├ metadata 事件: assistantMsg.diagnosis = data.diagnosis
            │                  assistantMsg.context = data.context
            │                  scheduleRenderMessages() (rAF)
            ├ content 事件:  assistantMsg.content += delta
            │                  scheduleRenderMessages()
            ├ done 事件:    cancelAnimationFrame + flush render
            │                  saveSession(currentSessionId || tmp_sid, subject, messages)
            └ error 事件:   error bubble
    ↓ finally: conversationState.loading = false
                conversationState.streamController = null
renderMessages() + renderLoading()
```

---

## 第五部分: 数据流分析

### 三种完成度的 page 对比

#### 1. dashboard.html (✅ F3 闭环)

```
[用户访问 /pages/dashboard.html]
    ↓
[HTML 加载 Tailwind CDN + module script]
    ↓
useAsyncResource(() => user.dashboard())
    ↓
[2 case 分支]
├ USE_MOCK=true: loadMock('user_dashboard') → fetch /assets/js/api/mock/user_dashboard.json → 200
└ USE_MOCK=false: apiBase + '/api/user/dashboard' → fetch with Bearer token
    ↓
{success, message, data: {user, stats, ...}}
    ↓
res.data.X  (page 层做解引用, service 不拆信封)
    ↓
renderDashboard() → DOM render
    ↓
[故障路径]
- 401 → client.js 401 redirect → login.html
- 5xx/network → useAsyncResource error → errorBoundary 兜底
```

**闭环**: ✅ 真后端 + 真 mock 都跑通

#### 2. wrong-book.html (✅ + ⚠️ 部分)

```
[用户访问 /pages/wrong-book.html]
    ↓
[HTML 加载 Tailwind CDN + module script (F3)]
    ↓
useAsyncResource(() => wrong.getQuestions(filterState))
    ↓
[Mock]: fetch /assets/js/api/mock/wrong_questions.json
    ↓
{success, message, data: [...8 rows], pagination: {total: 8, ...}}
    ↓
renderList() → 8 cards dynamic render
    ↓
[Filter 点击]
filterState.subject = 'math' → active class toggle → refetch
    ↓
[Mastery filter (client-side)]
deriveMastery(row) → renderList(applyMasteryFilter(rows))
    ↓
[Delete button click]
confirm() → wrong.deleteQuestion(id) → optimistic dim → listRes.refetch()
```

**闭环**: ✅ getQuestions + deleteQuestion 完整。⚠️ **markMastered 缺** (backend 无 PUT/PATCH)。

#### 3. tutor.html (🟡 80% 闭环)

```
[用户访问 /pages/tutor.html]
    ↓
[HTML 加载 (587 行 module)]
    ↓
parseSidFromUrl() → loadSessionMessages(sid) 或空
    ↓
useAsyncResource(() => tutor.getHistory())
    ↓
[Mock]: fetch /assets/js/api/mock/tutor_history.json
    ↓
{success, message, data: [...8 sessions]}
    ↓
renderHistory() → 8 sessions sidebar
    ↓
[User input → Enter / send-btn]
conversationState.messages.push(user)
    ↓
tutor.askStream({question, subject, signal, onEvent})
    ↓
[Mock]: loadMock('tutor_ask_stream') → 10 events
    ↓
onEvent(metadata): diagnosis + context → render
onEvent(content): content += delta → render (rAF throttle)
onEvent(done): saveSession(...) → localStorage
    ↓
[Switch session click]
loadSessionMessages(sid) → setSidInUrl(sid) → renderHistory + renderMessages
```

**闭环**: ✅ askStream + history + persistence + reset. ❌ **5 dead buttons**: 知识图谱 / 拍照 / 清空 / 停止 (Phase E.3) / 加入错题跳转 (D59 选 toast 不跳).

#### 4. vision.html (❌ 完全未迁移)

**代码状态**: 916 行纯 hardcoded HTML, 无 `<script type="module">`, 无 service 引用
**数据流**: 完全无
**风险**: 🔴 高 (OCR + 图片上传 + 多模态 pipeline)

---

## 第六部分: 技术债务分析

### P0 — 必须解决 (阻塞 v1.0)

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| **P0.1** | **Browser cache 跨 session 黏住** (5 attempts, 持续) | 阻塞所有 frontend slice 的端到端验证 | 1) commit 改变 file URL 加 hash; 2) 测试用 file:// 协议规避; 3) 跳过浏览器测试, 改用 Node.js integration test |
| **P0.2** | **Backend `questions.js` 缺 PUT/PATCH** (`markMastered` 写操作) | wrong-book 缺一个 toggle 写操作 | api/handlers/questions.js 加 PUT handler (类似单文件 4.3K 行) |
| **P0.3** | **vision.html / review.html / exam-simulation.html 完全未迁移** (3 pages, 2024 行) | F3 完成度 50% → 100% 的拦路虎 | Slice 5 (review) + F4 (vision) + F3.7 (exam) 3 个 sub-slice, 每页 2-3 commits |
| **P0.4** | **tutor.html 5 dead buttons** (清空 / 知识图谱 / 拍照 / 停止 / 加入错题跳转) | tutor 跨页闭环差最后一公里 | Slice 4.4 commits 3-5 (子 agent 已设计完成) |
| **P0.5** | **PWA `public/` 跟 F3 `ai-tutor-frontend/` 路径分裂** | 维护两套前端, 长期 tech debt | 先 freeze frontend/ (F6.1), 后续 plan 自顶向下重构 |

### P1 — 应该解决 (影响 v1.0 质量)

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| **P1.1** | **mock 跟 backend 没自动验证一致性** | 38 mock JSON + 50 端点, 改 backend 字段前端无感知 | 加 contract test 自动 compare mock vs backend (per endpoint), 放在 `tests/contract.test.js` |
| **P1.2** | **Slice 1 envelope fix commit 暴露 contract drift** | Service 跟 backend envelope 对不齐 | 1) Phase 2 retro §1.4 已记; 2) 加 envelope 校验在 client.js request() |
| **P1.3** | **邮件后端跨域配置** (`uibe.online` URL 含明文 password in `.git/config`) | 远端 push credentials 暴露在仓库 | 改用 SSH 或 credential helper, 单独 PR |
| **P1.4** | **Edge case: AbortError vs Business error** | 4.3 retro §6 已记, 需 future 守护 | 提取 AbortController wrapper hook |
| **P1.5** | **`<script type="module">` 跨模块 scope 隔离** (Slice 4.2 教训) | 第二次 module 看不到 listRes, 修过 1 次 | 1 page 1 module, 文档化约束 |
| **P1.6** | **State 字段顺序** (Phase 4 加 streamController 第 7 字段) | 顺序敏感 (跟 Service 层契约) | document 强约束, PR review |

### P2 — 优化 (v1.0 后)

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| **P2.1** | **CRLF 行尾管理** (每次 Python 改 HTML 要手动修) | 文档化流程 | `.gitattributes` + pre-commit hook |
| **P2.2** | **Long file 难以维护** (tutor.html 1395, tutor-agent.js 749, knowledge-points.js 9.2K) | 单人改易冲突 | 拆 component (后续 slice 验证 4 shell 共性再说) |
| **P2.3** | **Dark mode / i18n 未实施** | CLAUDE.md 提到 `.dark`, 实际未做 | Slice 5+ 单独 |
| **P2.4** | **Vitest vs Node.js test 框架不统一** | `tests/api/` 大量 .js, `tests/*.cjs` 用 Node 内置 | 迁 Vitest (need config) |
| **P2.5** | **DataBase 无 migration tool** (`db.js` auto-create + 加字段需改 db.js) | 线上 schema 演进困难 | Sqitch / Flyway / 自制简单 migration runner |
| **P2.6** | **e2e/demo.spec.js 唯一 e2e 测试** | Coverage 不足 | Playwright 10 page 截图 (F5.1) |

### 计划 vs 实际不一致 (重要)

| 计划 | 实际 | 状态 |
|------|------|------|
| F3.3 Question 在 dashboard 内嵌 (PLAN.md §3.3) | dashboard 是 user dashboard, 跟 Question 无关 | ❌ **计划 missed** |
| F3 整体 6 阶段 10 天 (PLAN.md §7) | 实际 5 页用 9 commits (4 天) | 🟢 节奏反而更快 |
| v0.7.0 tag 已发布 (MILESTONES.md) | new tag 没打, HEAD 在 `981bbd29` | 🟡 没 tag |
| 3 remote 同步 (MILESTONES.md) | 已 push origin/uibe/localtest 最新 ✅ | ✅ |
| GitHub mirror (CLAUDE.md) | 没推 (等 credentials) | 🟡 滞后 |

---

## 第七部分: 重新规划 Roadmap

### Phase 1: 必须完成 (Path to v0.8)

**目标**: tutor 完整闭环 + 3 个未迁移 page 之一 (review 或 vision)

**估计**: 8-10 commits, 3-4 工作日

| # | 内容 | 改动文件 | 风险 |
|---|------|---------|------|
| 1.1 | **Slice 4.4 commits 3-5** (5 dead buttons + highlight + retro) | `pages/tutor.html` + 1 new mock + docs | 🟡 低 (子 agent 已设计) |
| 1.2 | **Backend PUT /api/questions/:id** for markMastered | `api/handlers/questions.js` + 1 mock | 🟢 低 |
| 1.3 | **Frontend `wrong.markMastered()` service method** | `services/wrong.js` + 1 mock | 🟢 低 |
| 1.4 | **Service layer test 扩展** (markMastered + deleteQuestion + createQuestion) | `tests/contract.test.js` | 🟢 低 |
| 1.5 | **真实 backend smoke test** (启动 :3002, 走完真链路) | manual + cron | 🔴 高 (环境依赖) |
| 1.6 | **tag v0.8.0-dev** | git | 🟢 |

### Phase 2: 重要功能 (Path to v0.9)

**目标**: 4 个未迁移 page 全部 F3 化 + 端到端 E2E

**估计**: 15-20 commits, 6-8 工作日

| # | 内容 | 子 slice | 风险 |
|---|------|---------|------|
| 2.1 | **Slice 5: review.html** (Immersive Shell, 首次验证) | 2-3 commits (Slice 5 类似 Slice 4 phase 1-2) | 🟡 中 (新 adapter) |
| 2.2 | **F4: vision.html** (Immersive Shell, photo upload + OCR) | 2-3 commits | 🔴 高 (OCR pipeline) |
| 2.3 | **Slice 6: exam-simulation.html** (TBD shell) | 2-3 commits | 🟡 中 |
| 2.4 | **Slice 5+: Mastery action — 跳转回 tutor** | 1 commit | 🟢 低 |
| 2.5 | **Playwright E2E 5 page flow** (`login → dashboard → tutor → wrong-book → review`) | 1 commit + screenshots | 🟡 中 |
| 2.6 | **service `tutor.getMastery()`** | 1 commit + 1 mock | 🟢 低 |
| 2.7 | **CLAUDE.md Shell Adapter 表格更新** (Immersive Shell ✅) | docs | 🟢 |

### Phase 3: 产品闭环 (Path to v1.0)

**目标**: 真实可用 + Lighthouse 90+ + a11y + cross-browser + 移动端 UX

**估计**: 10-15 commits, 5-7 工作日

| # | 内容 | 改动 | 风险 |
|---|------|------|------|
| 3.1 | **F6.1-F6.4 Cutover** (server.js 静态根改 + frontend/ 冻结 + 归档 ai-tutor-redesign) | server.js + git mv | 🟡 中 (需前端用户 1-2 周观察期) |
| 3.2 | **Lighthouse Performance > 85** | bundle size, lazy load | 🟢 |
| 3.3 | **Accessibility > 90** | ARIA labels, keyboard nav | 🟢 |
| 3.4 | **Visual Regression 10 page** | Playwright 截图 vs baseline | 🟡 |
| 3.5 | **i18n scaffold** (中文 only, 标记未来英文) | locale files | 🟢 |
| 3.6 | **Dark mode / mobile UX polish** | CSS variables | 🟢 |
| 3.7 | **Security audit** (凭证清理 + admin 密码 hash 移 db) | 1 PR | 🟡 中 |
| 3.8 | **tag v1.0** | git | 🟢 |

### 不在 v1.0 范围 (v1.5+)

- AI 模型 fine-tuning (当前用 DashScope qwen-plus)
- 多端同步 (跨 device)
- 教师端 / 家长端
- 商业化 (SaaS / 私有化部署)
- 国际版 (英文 UI)

---

## 第八部分: 给项目负责人的 Onboarding

### 《如果我今天接手这个项目, 我应该如何理解它》

#### 1. 项目现在在哪里

**Backend 用户场景**: 大致完工, 33 handlers + 7 routes + 18 auto-create 表, 跑 PostgreSQL + pgvector + Apache AGE + LLM. 部署后跑在 `aitutor.uibe.online` (UIBE 校园网). Mobile 端 PWA 生产可用.

**Frontend 状态**: **半成品**:
- ✅ `dashboard / mastery / wrong-book / login / register` 已 F3 化 (5 pages)
- 🟡 `tutor` 80% F3 (chat + SSE + Markdown done, 5 dead buttons + persistence 2/5 done)
- ❌ `review / vision / exam-simulation` 完全未迁移 (3 pages)
- ❌ PWA `public/` 跟 F3 `ai-tutor-frontend/` 路径分裂

**当前 HEAD**: `981bbd29` (Slice 4.4 commit 2)
**当前 uncommitted**: 1 file (decision memo, 不是 code)

#### 2. 不应该做什么

1. **不要试图统一 4 个 Shell Adapter** — CLAUDE.md 钉死, 4 shells 是产品 UX 决策
2. **不要改 `client.js` 拆信封** — 9 service 现有调用全部依赖 envelope `{success, data}`
3. **不要 commit 时改 client.js 引入新依赖** — Slice 4.3 字串证明
4. **不要 amend 已 push 的 commit** — 远端 push 保留控制纪律
5. **不要用 React/Vue 引入新状态层** — F3 纪律 = vanilla JS + 单对象 + 闭包 + 事件委托
6. **不要 archive frontend/ 立即** — 观察 2-3 周 (F6 计划)

#### 3. 下一步应该做什么

**最高优先级 (本周)**:
1. **Slice 4.4 commits 3-5** (5 dead buttons + cross-page highlight + retro doc) — 子 agent 决策已出, 3 commits, 1 个工作日
2. **Push 到 3 remote** — 已经做完了, 不要再 push (等 v0.8 tag)

**本季度 (Path to v0.8)**:
1. 后端 `questions.js` 加 PUT/PATCH for markMastered
2. 前端 `wrong.markMastered()` service + mock
3. Contract test 扩展 (3 new methods)
4. 真实 backend smoke test (起 :3002, 走 login → dashboard → tutor → wrong-book)
5. **tag v0.8.0-dev**

**下季度 (Path to v0.9)**:
1. Slice 5 (review.html, Immersive Shell 首次验证)
2. F4 (vision.html, Immersive Shell + OCR)
3. Slice 6 (exam-simulation.html)
4. Playwright 5 page E2E flow
5. **tag v0.9.0-dev**

**Q4 (Path to v1.0)**:
1. F6 Cutover (frontend/ 冻结 + 归档 ai-tutor-redesign)
2. Lighthouse + a11y + cross-browser
3. Security audit + 凭证清理
4. **tag v1.0**

#### 4. 最大风险

**Risk 1 (P0)**: **Browser cache 跨 session 黏住** — 5 attempts 持续, 阻塞所有 frontend slice 端到端验证
- **缓解**: 1) commit 改变 file URL 加 hash; 2) Node.js integration test 替代 browser test; 3) 跳过 e2e, 接受 mock-only 验证

**Risk 2 (P0)**: **Backend endpoint 缺失** — `markMastered` (PUT/PATCH) + 4 个未迁移 page 依赖的 service
- **缓解**: 1) 单文件 backend edit (15-30 行); 2) 6 个 service 补齐 (1-2 工作日)

**Risk 3 (P1)**: **计划跟代码 drift** — PLAN.md 写 6 阶段 10 天, 实际 9 commits 4 天
- **缓解**: 1) 接受 F3 节奏比 plan 更激进; 2) 想清楚再走, 别追 plan 字面

**Risk 4 (P1)**: **多端前端共存** — `frontend/` 老 (生产) + `ai-tutor-frontend/` 新 (F3) + `public/` mobile
- **缓解**: F6 freeze + 2-3 周观察期

**Risk 5 (P2)**: **Mock 跟 backend 字段一致性** — 38 mock JSON 需要 contract test 自动化
- **缓解**: 加 `tests/contract.test.js` 自动 compare mock JSON vs backend response shape

#### 5. F3 模板的可复用价值 (项目核心资产)

**5 个横向 pattern (Slice 1-4 验证)**:
| Pattern | 复杂度 | 适用 |
|---------|--------|------|
| Hybrid Shell Adapter | 🟡 中 | wrong-book + 未来 1-2 page |
| Workspace Shell Adapter | 🟡 中 | tutor + 未来 chat-style page |
| Filter State Contract | 🟢 低 | 5+ 列表 page |
| Event Delegation | 🟢 低 | 任何 dynamic list |
| Mastery Derive (page layer) | 🟢 低 | review / mastery / exam |
| Active Button Toggle | 🟢 低 | 任何 toggle group |
| Matched/Total Display | 🟢 低 | backend filter + client view mode |
| Modal Dialog (confirm) | 🟢 低 | delete + mark mastered |
| SSE imperative state | 🟡 中 | tutor + 未来 streaming page |
| AbortController 3x abort | 🟡 中 | streaming + future abortable |
| rAF throttle + done flush | 🟢 低 | 任何高频 render |
| escape-then-regex | 🟢 低 | 任何 markdown + user input |

**每页 1-3 commits, 0 fix commit 目标** (Slice 2/3 验证, Slice 4 4 commits 验证)

#### 6. 决策资产 (3 个 subagent memo + 5 retro)

| 文档 | 行数 | 价值 |
|------|------|------|
| `F3_SLICE_1_RETROSPECTIVE.md` | 191 | 模板起源, 4 contract |
| `F3_SLICE_2_RETROSPECTIVE.md` | 130 | "可复制" 证明 |
| `F3_SLICE_3_RETROSPECTIVE.md` | 300 | **5 个可复用 pattern** (核心) |
| `F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` | 389 | D52-D55 (SSE 异步模型) |
| `F3_SLICE_4_3_RETROSPECTIVE.md` | 220 | 异步模式扩展能力 |
| `F3_SLICE_4_4_ARCHITECTURE_DECISIONS.md` | 494 | D56-D60 (持久化 + cross-page) |

**新增建议**: **本仓库需要一个 `ARCHITECTURE_DECISIONS.md` 顶层 index**, 汇总 5 个 doc, 列出 9 个 Shell Adapter 决策 + 12 个 pattern, 给未来 contributor 一次看懂"为什么这么设计"。

#### 7. 真实数据 vs 假数据 现状

| 维度 | 状态 |
|------|------|
| 真后端 (PostgreSQL + pgvector) | ✅ 跑得动 (有 18 表 + 47+42 知识点) |
| 真模拟 (USE_MOCK=true) | ✅ 38 mock JSON 覆盖 50 端点 |
| 真实数据流 (page → service → backend) | ⚠️ dashboard / mastery / wrong-book / login / register / tutor 全闭环 |
| 假数据 (hardcoded) | ⚠️ 3 page (review / vision / exam-simulation) |
| Browser 真交互 | ⚠️ 部分 (cache 阻塞端到端) |
| 真实学生数据 | ❌ 不知道 (生产环境 :3002 跑过没有? 不知道) |

**关键发现**: 我**没法审计生产环境** (你 CLI 是 dev, 不是 :3002 prod). 报告基于 git tree + 代码 + mock. **真实环境状态 unverified**.

#### 8. 给"未来自己"的一句话

> **F3 路径选对了** — Slice 1/2/3 验证 Dashboard / Hybrid Shell 都 0 fix commit, 模板稳定. **tutor 是最大单页面 (1395 行, 587 行 module)**, 风险最高, 当前 80% done. **3 个 page 完全未迁移** (review / vision / exam-simulation) 是 v1.0 必做. **不要重写 backend** — backend 95% 完整, 唯一缺是 markMastered PUT/PATCH. **不要引入新框架** — vanilla JS + 5 个 pattern 够 7 页用. **不要相信 mock** — mock 静态, 真实后端可能更严苛. **解决 Browser cache 问题** 是 P0 — 阻塞所有 frontend 验证. **做 v1.0 路径 = Slice 4.4 完成 + 3 page F3 + tag v0.8.0-dev + tag v0.9.0-dev + freeze + tag v1.0**.

---

## 附录 A: 引用文档索引

- `CLAUDE.md` (285 行) — 项目指南 + F3 Migration Rules + Shell Adapter 表格
- `MILESTONES.md` (172 行) — Version history (v0.5 → v0.7.0-dev)
- `docs/frontend-migration/PLAN.md` (376 行) — 原 6 阶段 User Journey 计划
- `docs/frontend-migration/F3_SLICE_*.md` — 5 个 slice retro + 2 个 architecture decision memo
- `README.md` (252 行) — 公开 README (架构总览 + 快速开始)
- `server.js` (未审计) — Express 入口
- `api/core/db.js` (31.9K) — PostgreSQL 18 表 auto-create
- `api/routes/tutor-agent.js` (27.5K) — 749 行 askTutorAgent + SSE 流

## 附录 B: 9 commits 链 (Phase A-D 完成)

```
981bbd29  Slice 4.4 c2: sendMessage done 持久化 + sidebar 切换 + URL sync  
f73b6529  Slice 4.4 c1: localStorage session store + ?sid=X 解析
62b8a8d7  docs: F3 Slice 4.3 retrospective
79dcc0de  Slice 4.3 c3: inline markdown regex (bold/code/latex)
e4c57f6d  Slice 4.3 c2: streaming chat UI + rAF throttle + AbortController
997f5446  Slice 4.3 c1: SSE parser + askStream service skeleton
43193f12  Slice 3.2: deleteQuestion + createQuestion + cross-page
61dc24ad  F3.1: login + register wired to auth service
94e0a2a1  Slice 4 Phase 3: non-streaming chat MVP
142f1252  Slice 4 Phase 2: tutor Workspace Shell Adapter
460e8449  Slice 4 Phase 1: tutor service + mock contract
```

## 附录 C: 文件统计

| 目录 | 文件数 | 代码行数 |
|------|-------|---------|
| `ai-tutor-frontend/pages/` | 10 | 9,472 |
| `ai-tutor-frontend/assets/js/api/services/` | 10 | 14.6K |
| `ai-tutor-frontend/assets/js/api/mock/` | 38 | ~40K |
| `api/handlers/` | 33 | ~231K |
| `api/routes/` | 7 | ~107K |
| `api/services/` | 6 | ~70K |
| `api/core/` | 5 | ~53K |
| `api/utils/` | 10 | ~93K |
| `tests/` | 17 | 1,328 |
| **Backend 总计** | **75 文件** | **~554K** |
| **Frontend F3 totals** | **10 pages + 19 src + 38 mock** | **~64K** |

---

**审计完成时间**: 2026-08-10
**审计签字**: Principal Engineer (Tech Lead roleplay)
**审计结论**: 项目位置清晰, Phase A-D (9 commits) 全部 delivered, Phase E 2/5 done, Phase F-I roadmap re-planned. **3 个 P0 阻塞项**: Browser cache / 3 un-migrated pages / 5 dead buttons. **Path to v1.0 已重新规划**: 3 phases, ~33-45 commits, ~14-19 工作日.
