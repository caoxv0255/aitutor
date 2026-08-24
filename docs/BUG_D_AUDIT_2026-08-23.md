# Bug D 审计报告 — 旧 `/api/*` 路径与 modulesRouter 不兼容 (2026-08-23)

## 1. 现状概览

| 项 | 数量 |
|----|------|
| **前端调用 `/api/*` 的页面** | 24 个文件 (frontend/ × 16 + public/ × 7 + frontend-legacy/ × 1) |
| **前端使用的旧路径 (去重)** | 17 个 |
| **后端 modulesRouter 挂载的模块** | 9 个 (auth/user/review/knowledge/exam/srs/vision/rag/tutor) |
| **空 modulesRouter (import 不挂载)** | 3 个 (analytics/gamification/trends) |
| **未实现的旧路径 (前端用了但后端没)** | 8 个 (见 §3) |
| **不匹配旧→新映射** | 9 个 (见 §3) |

---

## 2. 完整对照表

### ✅ F3 (ai-tutor-frontend/) — 已正确对齐 modulesRouter

| F3 调用 | 后端实际路径 | 状态 |
|---------|--------------|------|
| `POST /api/auth/login` | `modules/auth` → `/login` | ✅ |
| `POST /api/auth/register` | `modules/auth` → `/register` | ✅ |
| `POST /api/auth/guest-login` | `modules/auth` → `/guest-login` | ✅ |
| `POST /api/auth/logout` | `modules/auth` → `/logout` | ✅ |
| `GET /api/auth/me` | `modules/auth` → `/me` | ✅ |
| `GET/POST /api/auth/prefs/province` | `modules/auth` → `/prefs/province` | ✅ |
| `GET /api/user/dashboard` | `modules/user` | ✅ |
| `GET /api/user/profile` | `modules/user` | ✅ |
| `GET /api/user/subjects` | `modules/user` | ✅ |
| `GET /api/user/knowledge-profile` | `modules/user` | ✅ |
| `GET /api/user/learning-suggestions` | `modules/user` | ✅ |
| `GET/POST /api/user/wrong-questions` | `modules/user` | ✅ |
| `DELETE /api/user/wrong-questions/:id` | `modules/user` (但只 mounted GET/POST, **DELETE 未实现** ⚠️) |
| `POST /api/exam/session/start` | `modules/exam` | ✅ |
| `POST /api/exam/session/submit` | `modules/exam` | ✅ |
| `POST /api/exam/pdf/generate/:paperId` | `modules/exam` | ✅ |
| `POST /api/vision/parse` | `routes/vision-parse` → `/parse` | ✅ |
| `POST /api/tutor/ask` | `routes/tutor-agent` → `/ask` | ✅ |
| `POST /api/tutor/ask/stream` | `routes/tutor-agent` → `/ask/stream` | ✅ |
| `POST /api/rag/search` | `routes/rag-search` → `/search` | ✅ |
| `POST /api/rag/multi/search` | `routes/rag-search` → `/multi/search` | ✅ |
| `POST /api/rag/explain` | **❌ 不存在** (modules/rag/use '/', 但 rag-search 只有 /search /ingest /stats) |
| `POST /api/rag/ask` | **❌ 不存在** (同上) |
| `POST /api/rag/ingest` | `routes/rag-search` → `/ingest` | ✅ |
| `GET /api/rag/stats` | `routes/rag-search` → `/stats` | ✅ |

**F3 ↔ 后端不对齐**: 2 个 (`rag/explain`, `rag/ask`)

---

### ❌ frontend/ (旧 PC 端) — 全部不匹配

| 旧路径 (frontend/) | 调用方 | 新路径 (modulesRouter) | 状态 |
|---------------------|--------|----------------------|------|
| `POST /api/login` | login.html:158 | `POST /api/auth/login` | ❌ 不匹配 |
| `POST /api/guest-login` | login.html:181 | `POST /api/auth/guest-login` | ❌ 不匹配 |
| `POST /api/register` | register.html:110 | `POST /api/auth/register` | ❌ 不匹配 |
| `GET/POST /api/user-province` | province-selector.js, math-exam.html, dashboard.html | `GET/POST /api/auth/prefs/province` | ❌ 不匹配 |
| `GET/POST /api/questions` | wrong-book.html:72/120, dashboard.html:215, exam-mode.js:410 | `GET/POST /api/user/wrong-questions` | ❌ 不匹配 |
| `GET/POST /api/tasks` | context.js (PWA) | `GET /api/user/tasks` (新接口?) | ❌ 不匹配 |
| `GET/POST /api/reports` | dashboard.html:220, context.js (PWA) | `GET /api/review/reports` | ❌ 不匹配 |
| `GET /api/weak-points` | dashboard.html:228, my-weak-points.html:106 | `GET /api/review/weak-points` | ❌ 不匹配 |
| `POST /api/generate-paper` | personalized-paper.html:307, my-weak-points.html:188 | **❌ 后端无此路由** (handlers/generate-paper.js 未挂载) |
| `POST /api/explain-question` | personalized-paper.html:190, question-explainer.html:151 | **❌ 后端无此路由** |
| `GET /api/learning-path` | learning-path.html:108 | **❌ 后端无此路由** (handlers/learning-path.js 未挂载, analytics 模块空) |
| `POST /api/proxy` | dashboard.html:366 | `POST /api/proxy` (server.js 直接挂载) | ✅ **唯一匹配** |
| `GET /api/provinces/:code` | pages/province-page.js:61 | `GET /api/provinces/:code` (server.js) | ✅ **匹配** |
| `GET /api/stats/visits[/increment]` | public/src/app.js:1395,1402 | **❌ 后端无此路由** |
| `GET /api/tutor/ask/stream` | public/src/js/tutor-stream.js:54 | `POST /api/tutor/ask/stream` (注意: GET vs POST) | ⚠️ 方法错 |
| `GET /api/loop/graph` | public/src/js/mastery-graph.js:366 | `GET /api/tutor/loop/graph` (在 modules/tutor 下) | ⚠️ 路径前缀 |
| `POST /api/reset-password` | public/src/utils/context.js:143 | `POST /api/auth/reset-password` | ❌ 不匹配 |

---

### ❌ frontend-legacy/ (redesign 子目录)

| 路径 | 后端状态 |
|------|---------|
| `/api/user/knowledge-profile` | ✅ modules/user 存在 |
| `/api/user/learning-suggestions` | ✅ modules/user 存在 |
| `/api/user/profile` | ✅ modules/user 存在 |
| `/api/user/study-plan/daily-tasks` | **❌ 后端无** |
| `/api/user/study-plan/plans` | **❌ 后端无** |
| `/api/user/study-plan/tasks/:id` | **❌ 后端无** |
| `/api/user/study-plan/generate` | **❌ 后端无** |
| `/api/user/study-plan/mock-exam` | **❌ 后端无** |
| `/api/user/wrong-questions/stats` | ✅ modules/user 存在 |

注: frontend-legacy/redesign/ 是 isolated 探索目录，无 server.js mount，未上线。

---

## 3. 修复方案 3 选 1

### 方案 A: 加 legacy alias 兼容层（推荐用于快速止血）

在 `server.js` 加 `legacyCompatRouter`，挂载在 modulesRouter **之前**，把旧路径转发到新路径。

**改动量**: ~50 行 (一个 `api/legacy-compat.js` + server.js 加 1 行)

**优点**:
- 立即修复 frontend/ 和 PWA 的登录、错题、报告、薄弱点
- 零代码侵入（不改前端）
- 与 D070 legacy frontend 301 → /f3 共存过渡（30 天兼容期）

**缺点**:
- 长期是技术债（alias 越多越难维护）
- 仅覆盖"新后端已有等价接口"的路径（9 个映射）；后端完全没的（generate-paper/learning-path/explain-question/stats/visits/study-plan/*）仍要新增 handler 或接受 404

**预计 30 分钟**

### 方案 B: 批量迁前端 (frontend/ + public/) 调用路径

修改 frontend/login.html, register.html, dashboard.html, wrong-book.html, my-weak-points.html, learning-path.html, personalized-paper.html, question-explainer.html, public/src/utils/context.js 等 ~15 个文件的 fetch URL。

**优点**:
- 一次性消除 alias 债
- 前端代码更清晰

**缺点**:
- 文件多、跨项目（frontend/ + public/ + frontend-legacy/），改动量大
- 有些路径后端没等价接口（如 `/api/learning-path`、`/api/generate-paper`）必须同时新增后端 handler 或前端降级
- 与 D070 "冻结 frontend 301 → /f3" 决策冲突——既然已冻结，为什么还要修 frontend？

**预计 2-3 小时**

### 方案 C: 保持现状，把 frontend/ 当 legacy 冻结

按 D070 (2026-08-17) 决策，frontend/* 301 → /f3/pages/*，所有旧路径随页面一同冻结。

public/ (PWA) 是**生产在用**的（参见 CLAUDE.md: "public/: PWA 移动端 ✅ 生产在用"），**PWA 必须修**——它直接面向用户。

**优点**:
- 减少改动面
- 与 D070 决策一致

**缺点**:
- PWA 不能冻结（生产环境），所以方案 C 实质是"修 PWA，不修 frontend"
- 也就是方案 A 的子集

---

## 4. 我的建议

**混合方案 = A(legacy alias) + 显式冻结 frontend/**

理由:
1. PWA 是生产在用，立即修
2. frontend/ 已 301 → /f3，再修意义不大（alias 让 301 之前的旧 fetch 还能用即可，30 天兼容期后废弃）
3. alias 改动最小、风险最低

具体步骤:
1. 创建 `api/legacy-compat.js`（独立 router，不挂 authMiddleware 让速率限制更灵活）
2. 实现 9 个映射 + 4 个 410 (gone) 标记（学习路径 / 个性化卷 / 题目讲解 / 统计访问，这些前端调但后端没等价品）
3. server.js 在 modulesRouter **之前** `app.use('/api', legacyCompatRouter)`
4. 给 frontend/ 静态资源加 `Cache-Control: max-age=300` 缩短缓存，配合 alias 切换
5. 不动 F3（已对齐）

预计 **1 小时** 内完成，含 e2e 验证。

---

## 5. 不在本次范围

- `learning-path.js` / `generate-paper.js` / `explain-question.js` 等 handler 未挂载 → 属于"模块级修复"，应独立 ticket
- frontend-legacy/redesign/ 是设计探索目录，未上线，不动
- F3 内 `rag/explain` `rag/ask` 缺失 → 不影响主流程（F3 mock 兜底），下次重构时补