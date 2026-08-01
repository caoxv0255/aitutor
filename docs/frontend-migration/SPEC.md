# aitutor 前端迁移 SPEC — `ai-tutor-frontend/` 作主

> **版本**: v0.2 (整合 8 月 1 日用户反馈)
> **状态**: Draft v0.2 (待用户拍板)
> **作者**: Hermes (基于用户 v0.1 反馈重构)
> **日期**: 2026-08-01
> **关键变更**: Tailwind 保留 + Service Layer + Mock + Contract Test + Vision Epic 拆分 + Freeze 不归档

---

## 1. 背景

### 1.1 现状混乱

`/home/cx/aitutor/` 下 5 套前端:

| 目录 | 状态 | 调 API | 备注 |
|------|------|--------|------|
| `frontend/` (31 html) | ✅ `server.js` 服务 | **16 个** 完整 | 跟后端已接, 但配色陈旧 |
| `ai-tutor-frontend/` (10 html) | ❌ 未服务 | **0 个** | **新设计, Tailwind 4, 美观, 但完全没接后端** |
| `ai-tutor-redesign/` (13 html) | ✅ `/redesign` | 3 个 | 部分接, 跟 `frontend/` 重复 |
| `frontend/redesign/` (17 html) | ❌ 未服务 | ? | 草稿 |
| `aitutor-demo/` (1 html) | ❌ 未服务 | ? | demo |

### 1.2 后端 (完整, 不动)

`/home/cx/aitutor/server.js` + `api/routes/*` + `api/modules/*/routes.js`:
- 24 个 handler + 7 个 route module
- 完整 RAG (pgvector) — `/api/rag/*`, `/api/rag/multi/*`
- 完整 tutor (ask/explain/mastery)
- 完整 exam / user / srs / vision / analytics / gamification / auth / trends

### 1.3 项目阶段判断 (用户反馈)

已经进入"**第二阶段**" — 平台, 不是单页面 demo:
- Python (exam-extract-v5) + Node/Express + PostgreSQL+pgvector + Apache AGE + LiteLLM + GraphRAG + OCR
- 到了"第一次正式重构"的时候
- **第一次重构是为了让以后还能继续开发**
- 不重 UI (已经 80 分), 重架构

---

## 2. 目标

### 2.1 一句话目标

将 `ai-tutor-frontend/` 设为 aitutor 的**唯一主前端**, 完整接入后端, 配色 + 组件 + Service Layer 统一, 为长期维护铺路.

### 2.2 核心目标 (8 项)

| ID | 目标 | 度量 |
|----|------|------|
| G1 | `ai-tutor-frontend/` 接入后端全部核心 API | 10 page 全部 fetch API, 0 静态 mock |
| G2 | **Design Token 统一** (CSS vars) | 1 套 token, 1 套 theme, 暗色主题 |
| G3 | **Tailwind 保留**, tokens 注入 Tailwind theme | 不做"去 Tailwind"重写, 减少风险 |
| G4 | **Service Layer 抽象** (按模块) | `services/{auth,user,exam,rag,vision,...}.js`, 10 page 改用 |
| G5 | **Mock Layer** | `assets/js/mock/*.json`, `USE_MOCK=true` toggle |
| G6 | **API Contract Test** | schema 验证 + 后端字段变更保护 |
| G7 | **按 User Journey 迁移** (非按 HTML 排) | Auth → Dashboard → Question → Tutor → WrongBook → Review |
| G8 | **Vision 拆独立 Epic** | 8 page 接 API + Vision 并联, 互不阻塞 |

---

## 3. 范围 (In/Out)

### 3.1 In Scope

1. **ai-tutor-frontend/ 10 个 page 接入后端** (按 User Journey 顺序)
2. **Design Token 统一** (CSS vars, 注入 Tailwind theme)
3. **Service Layer** 抽象 (`services/*.js`)
4. **Mock Layer** (`assets/js/mock/*.json` + `USE_MOCK` flag)
5. **API Contract Test** (基于 schema, 防后端字段变更)
6. **server.js 静态根重配** (只服务 `ai-tutor-frontend/`)
7. **`frontend/` 冻结 (不归档)** + `ai-tutor-redesign` 归档
8. **Playwright E2E** (10 page 关键 flow)
9. **DoD (Definition of Done) 统一标准**
10. **README 更新**

### 3.2 Out of Scope (明确不做)

1. **后端不重写** (24 handler 现状 OK)
2. **RAG ingest 流水线** (另 Epic, 不阻塞)
3. **新增业务功能** (只迁移现有, 不加新)
4. **i18n** (保持中文)
5. **SSR / 静态生成**
6. **PWA / 离线**
7. **AI Tutor Chat 重写** (现有 tutor.html 保持)
8. **完全去除 Tailwind** (保留, 改 token 注入)
9. **重新设计 UI** (不改视觉, 80 分够了)

---

## 4. 设计原则

### 4.1 配色: CSS Tokens + Tailwind Theme (v0.2 关键变更)

**v0.1 选 A (CSS tokens, 改写去 Tailwind) ❌**
**v0.2 改 A+: CSS tokens + Tailwind theme 注入**

```css
/* assets/css/tokens.css */
:root {
  --aitutor-primary-50: ...;  /* 5 色阶 × 9 调 */
  --aitutor-primary-500: #d71920;  /* @primary */
  ...
}

/* assets/css/tailwind-theme.css (Tailwind 4 theme 注入) */
@theme {
  --color-primary: var(--aitutor-primary-500);
  --color-primary-hover: var(--aitutor-primary-600);
  --color-success: var(--aitutor-success-600);
  --font-display: 'DM Sans', 'Noto Sans SC', sans-serif;
  --shadow-1: var(--aitutor-shadow-1);
  --radius-sm: 8px;
}
```

**Tailwind 继续负责**:
- layout (`flex`, `grid`, `gap-x-4`)
- spacing (`p-4`, `m-2`)
- responsive (`md:`, `lg:`)

**Tokens 负责**:
- 颜色 (`bg-primary`, `text-success`)
- 字体 (`font-display`)
- 阴影 (`shadow-1`)
- 圆角 (`rounded-sm`)

**收益**: 1000 行 class 替换 → 50 行 token 注入, 风险 10x 降低.

### 4.2 Service Layer 抽象 (新增)

**v0.1 ❌**: 10 page 各写 fetch, 重复
**v0.2 ✅**: 公共层抽象

```
assets/js/
├── api/
│   ├── client.js          # fetch wrapper + token + 401 重定向
│   ├── services/
│   │   ├── auth.js        # login, register, guest-login
│   │   ├── user.js        # dashboard, profile, province
│   │   ├── exam.js        # session, questions, exam-pdf
│   │   ├── rag.js         # /api/rag/* + /api/rag/multi/*
│   │   ├── vision.js      # parse, ingest
│   │   ├── knowledge.js   # mastery, knowledge-points
│   │   └── review.js      # reports, session/history
│   └── mock/
│       ├── dashboard.json
│       ├── mastery.json
│       ├── review.json
│       ├── rag-search.json
│       └── ... (10 个 mock)
└── USE_MOCK flag
```

**Page 调用**:
```js
import { auth } from '../api/services/auth.js';
const { token, user } = await auth.login(email, password);
```

**不再**:
```js
const res = await fetch('/api/login', ...);
```

### 4.3 Mock Layer (新增)

```
USE_MOCK=true  → 所有 service 读 assets/js/mock/*.json
USE_MOCK=false → 真实 fetch 后端
```

**触发场景**:
- 后端没起来 → 仍可前端开发
- 离线开发
- E2E 测试 (Playwright)
- 演示

### 4.4 路由

`server.js` 改造:
```js
// 旧 (5 套静态)
app.use(express.static('public'));
app.use(express.static('frontend'));
app.use('/redesign', express.static('ai-tutor-redesign'));

// 新 (1 套 + legacy)
app.use(express.static('ai-tutor-frontend'));  // 主
app.use('/legacy', express.static('frontend'));   // 冻结
// ai-tutor-redesign 归档, 删 /redesign 配
```

### 4.5 错误处理

- 全局 toast (复用 `frontend/assets/css/router.css` 样式)
- 401 → 跳 `/login.html`
- 5xx → "服务异常" toast
- 网络断开 → "网络错误" toast

### 4.6 状态管理

10 page 共享: token / 省份 / 学科
- 方案: `localStorage` + `assets/js/auth.js` 暴露事件
- 不用 Vue/React (保持原生)

---

## 5. API Compatibility Matrix (新增 v0.2)

> **关键**: 避免开发 Day 7 突然发现"API 没实现"

| API 端点 | 后端状态 | Mock 数据 | 备注 |
|----------|----------|----------|------|
| `POST /api/login` | ✅ Ready | ✅ `mock/auth-login.json` | 已有 |
| `POST /api/register` | ✅ Ready | ✅ | 已有 |
| `POST /api/guest-login` | ✅ Ready | ✅ | 已有 |
| `GET /api/dashboard` | ✅ Ready | ✅ `mock/dashboard.json` | 已有 (handler) |
| `GET /api/provinces` | ✅ Ready | ✅ | 已有 |
| `GET /api/user-province` | ✅ Ready | ✅ | 已有 |
| `GET /api/knowledge-mastery` | ⚠️ Partial | ✅ `mock/mastery.json` | 端点存在, 返回字段需对齐 |
| `GET /api/mastery/:kpId` | ⚠️ Partial | ✅ | 需 Contract Test 验 |
| `POST /api/explain` | ✅ Ready | ✅ `mock/tutor-explain.json` | 已有 |
| `POST /api/ask` | ✅ Ready | ✅ | 已有 |
| `GET /api/reports` | ✅ Ready | ✅ `mock/review-reports.json` | 已有 |
| `GET /api/session/history` | ❌ Missing | ✅ `mock/session-history.json` | **需后端补** |
| `POST /api/session/start` | ✅ Ready | ✅ | 已有 |
| `POST /api/session/submit` | ✅ Ready | ✅ | 已有 |
| `GET /api/exam-pdf/:paperId` | ✅ Ready | ✅ | 已有 |
| `POST /api/parse` | ✅ Ready | ✅ | 已有 (vision) |
| `POST /api/ingest` | ✅ Ready | ✅ | 已有 (vision) |
| `GET /api/questions` | ✅ Ready | ✅ `mock/wrongbook-questions.json` | 已有 |
| `POST /api/similar-questions` | ✅ Ready | ✅ | 已有 |
| `GET /api/weak-points` | ✅ Ready | ✅ | 已有 |

**风险标注**:
- ❌ Missing: **后端必须先补**
- ⚠️ Partial: **需 Contract Test 验证字段**
- ✅ Ready: 可直接接入

---

## 6. 页面功能 (10 page × User Journey)

按 **User Journey** 而非 HTML 顺序:

```
Auth (login/register)
   ↓
Dashboard (主页入口)
   ↓
Province Picker (选省)
   ↓
Question (题目浏览/搜索)
   ↓
Tutor (AI 答疑)
   ↓
WrongBook (错题本)
   ↓
Review (复习报告)
   ↓
Exam Simulation (考试模拟)
   ↓
Mastery (掌握度)
   ↓
Vision (图片上传)  ← 独立 Epic
```

| Journey | Page | 现有 frontend/ 映射 | API 端点 (按 service) |
|---------|------|----------------------|----------------------|
| Auth | `login.html` | ✅ | `auth.login`, `auth.guestLogin` |
| Auth | `register.html` | ✅ | `auth.register` |
| Dashboard | `dashboard.html` | ✅ | `user.dashboard`, `user.provinces`, `user.userProvince` |
| Province | (in dashboard) | ✅ | `user.userProvince` POST |
| Question | (in exam-view.html) | ✅ | `exam.questions` |
| Tutor | `tutor.html` | ❌ (用 question-explainer) | `rag.explain`, `rag.ask` |
| WrongBook | `wrong-book.html` | ✅ | `exam.questions`, `rag.similarQuestions` |
| Review | `review.html` | ❌ (用 my-reports) | `review.reports`, `review.sessionHistory` |
| Exam | `exam-simulation.html` | ❌ (用 math-exam 等) | `exam.startSession`, `exam.submitSession`, `exam.examPdf` |
| Mastery | `mastery.html` | ❌ (用 my-weak-points) | `knowledge.mastery`, `knowledge.kpDetail` |
| **Vision (独立 Epic)** | `vision.html` | ❌ | `vision.parse`, `vision.ingest` |

**注意**: 4 个 page (mastery / review / exam-simulation / vision) 是新功能, 需迁移 `frontend/` 的弱对应 + 调 API.

---

## 7. DoD (Definition of Done) — 统一标准 (新增 v0.2)

每个 Task 完成必须满足:

```
DoD:
☐ code 写完
☐ lint 0 error (ESLint, frontend 红线 = 0)
☐ console 0 error (浏览器 F12)
☐ mobile 320px 起可看 (DevTools responsive)
☐ Playwright 1 个 happy path pass
☐ API Contract Test pass (字段对齐)
☐ docs 更新 (本文件 + JSDoc)
☐ git commit clean (no TODO)
```

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 10 page 全部 fetch 后端 API, 0 静态 mock (USE_MOCK=false)
- [ ] login → 拿 token → 存 localStorage → 跳 dashboard
- [ ] register / guestLogin 同
- [ ] dashboard 显示 user data
- [ ] mastery 显示 knowledge point mastery
- [ ] tutor 提交问题 → AI 流式回答
- [ ] review 显示历史报告
- [ ] exam 启动 → 提交 → 拿分数
- [ ] vision 上传 → 解析 → 入库
- [ ] wrong-book 显示错题 + 相似题

### 8.2 架构验收 (新增 v0.2)

- [ ] **Service Layer 完整**: 7 个 service (auth/user/exam/rag/vision/knowledge/review), 0 page 直接 fetch
- [ ] **Mock Layer 工作**: `USE_MOCK=true` 离线开发 OK
- [ ] **Contract Test pass**: 10 page 调 API 字段对齐后端 schema
- [ ] **Design Token 统一**: 1 套 tokens.css, 暗色主题
- [ ] **Tailwind 保留**: 10 page 仍用 Tailwind utility, 但颜色/字体用 token

### 8.3 视觉验收

- [ ] 配色一致 (1 套 tokens, 暗色主题工作)
- [ ] 移动端 320px 起可看
- [ ] 颜色对比度 WCAG AA
- [ ] 字体 Noto Sans SC + DM Sans
- [ ] Lighthouse Performance > 85

### 8.4 集成验收

- [ ] Playwright 10 page 截图 + API 调用验证
- [ ] `node server.js` 后 `http://localhost:3002/` 显示新首页
- [ ] `/legacy` 仍可访问老 frontend
- [ ] `ai-tutor-redesign` 归档 (server.js 删配)
- [ ] git commit 干净, 可回滚

---

## 9. 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| R9.1 后端 API 缺 | 中 | 高 | §5 Compatibility Matrix + 后端先补 missing |
| R9.2 Contract 字段变更 | 中 | 高 | Contract Test 自动检测 |
| R9.3 Token 注入 Tailwind theme 兼容性 | 中 | 中 | PoC 阶段 1 验证 |
| R9.4 User Journey 顺序有循环依赖 | 中 | 中 | 顺序: Auth → Dashboard → Question → Tutor → WrongBook → Review, 严格单向 |
| R9.5 Vision 拖累主线 | 中 | 中 | **拆独立 Epic**, Day 8-10 并联 |
| R9.6 现有 frontend/ 31 page 有未列出的功能 | 中 | 中 | 阶段 3 端到端测试发现 |
| R9.7 Mock 数据跟真实响应不一致 | 中 | 中 | Contract Test 用真实响应生成 mock |
| R9.8 User 改需求 | 中 | 中 | 拍板后冻结 SPEC, 改动走新 spec |

---

## 10. 非目标

- 后端 RAG ingest (另 Epic)
- 新增业务功能
- i18n 国际化
- PWA / 离线
- 移动 App
- SSR / SSG
- 完全去除 Tailwind
- 重新设计 UI
- Vision 整合 (本次 v0.2 拆出去, 独立 Epic)

---

## 11. 时间估算 (6 阶段)

| 阶段 | 工作量 | 工时 |
|------|--------|------|
| F1 Foundation (基础) | 2-3 天 | 2.5 |
| F2 Service Layer (服务层) | 2-3 天 | 2.5 |
| F3 Feature Migration (User Journey) | 5-7 天 | 6 |
| F4 Vision Epic (独立并联) | 2-3 天 | 2.5 |
| F5 Testing (测试) | 2 天 | 2 |
| F6 Cutover (切换) | 1 天 | 1 |
| **总计** | | **16.5 天** (1 人), 2 人并联 **10 天** |

---

## 12. 用户拍板项 (v0.2 精简)

1. **配色策略**: ✅ CSS tokens + Tailwind theme 注入 (v0.2 默认)
2. **ai-tutor-redesign**: ✅ 归档 (server.js 删 /redesign)
3. **frontend/**: ✅ **Freeze 不归档** (保留 /legacy 入口, 2-3 周稳定后归档)
4. **Vision**: ✅ 拆独立 Epic (F4, 不阻塞主线)
5. **启动时间**: ⏳ 待
6. **2 人并联 / 1 人顺序**: ⏳ 待

---

## 13. 配套文档

- [PLAN.md](./PLAN.md) — 6 阶段任务拆解
- [TODO.md](./TODO.md) — 详细 DoD checklist
- [API_COMPAT.md](./API_COMPAT.md) — §5 完整版
