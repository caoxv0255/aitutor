# Frontend Architecture — aitutor

> **目的**: 改前端代码前先读本文件。配合 `runbooks/fix-bug.md`。
> **最后更新**: 2026-08-28 (D083 补全)

---

## 1. 总览

**两套前端并存 + 一套 PWA**:

| 前端 | 路径 | 状态 | UA 分流 |
|---|---|---|---|
| **F3** (`ai-tutor-frontend/`) | `/f3/*` | ✅ 主, 10 页全走真后端 | Desktop / 显式 `/f3` |
| **Legacy** (`frontend/`) | `/legacy` | 🟡 冻结, 301 → /f3, 30 天后 410 Gone | Desktop UA |
| **PWA** (`public/`) | `/` (mobile UA) | ✅ 生产在用 | Mobile UA |

⚠️ **不要修改 `frontend/` legacy** — 已冻结。

---

## 2. F3 架构

### 2.1 目录

```
ai-tutor-frontend/
├── pages/                      10 个生产页
│   ├── index.html              首页 + 已登录入口
│   ├── login.html / register.html
│   ├── dashboard.html          个人中心 (含 Sprint 2 Today widget)
│   ├── tutor.html              AI 教学
│   ├── mastery.html            掌握度
│   ├── review.html             复习 (Sprint 2 review kind)
│   ├── wrong-book.html         错题本 (Sprint 2 practice kind)
│   ├── vision.html             拍照搜题
│   └── exam-simulation.html    考试模拟
├── assets/
│   ├── js/
│   │   ├── api/
│   │   │   ├── client.js       request() 包装, D062 envelope 契约
│   │   │   ├── services/       13 个 service (user/tutor/srs/...)
│   │   │   └── mock/           mock json (Sprint 2 加 today_*.json)
│   │   ├── navator.js          导航
│   │   └── components.js       通用组件
│   └── css/
│       ├── style.css           v4 主样式
│       └── brand.css           跨端品牌变量
└── ...
```

### 2.2 4 个 Shell Adapter (F3, 来自 D071/D076/D077)

| Shell | 页面 | Sidebar 模式 |
|---|---|---|
| **Dashboard Shell** | dashboard, mastery | `fixed w-60` + `lg:ml-60 md:ml-[72px]` offset |
| **Workspace Shell** | tutor (pending) | aside inside flex `<main>` |
| **Hybrid Shell** | wrong-book | `fixed md:sticky` mixed, `flex-1` 让位 |
| **Immersive Shell** | vision, review (pending) | no sidebar, single column |

⚠️ **不要统一所有页面到一种 shell** (4 shells 是产品 UX 决策)。

### 2.3 数据契约 (D062)

**Service Envelope**:

```js
// client.js request() 返回完整 envelope
{ success: true, data: {...} }

// page 消费
const res = await today.getToday();
const tasks = res.data.tasks;  // ← 直接拿
```

⚠️ **D062 关键 (2026-08-15)**: client.js **不解包** envelope — mock/real 双路径都返回完整 envelope。前端统一按 `res.data.X` 消费。

**不要**回到 `res.data.data.X` (那是反方向, 9 个 service / 10 个页面统一受影响)。

### 2.4 Service 层

```js
// ai-tutor-frontend/assets/js/api/services/index.js
export { user } from './user.js';
export { tutor } from './tutor.js';
export { srs } from './srs.js';
export { learningLoop } from './learning-loop.js';  // Sprint 1
export { today } from './today.js';                  // Sprint 2 新增
// ... 共 14 个
```

```js
// ai-tutor-frontend/assets/js/api/services/today.js (Sprint 2 新增)
import { request } from '../client.js';

export const today = {
  async getToday() {
    return request('GET', '/api/user/today', null, { mockName: 'today_get' });
  },
  async start(taskId) {
    return request('POST', `/api/user/today/${taskId}/start`, {}, { mockName: 'today_start' });
  },
  async complete(taskId) {
    return request('POST', `/api/user/today/${taskId}/complete`, {}, { mockName: 'today_complete' });
  },
  async skip(taskId) {
    return request('POST', `/api/user/today/${taskId}/skip`, {}, { mockName: 'today_skip' });
  },
};
```

### 2.5 Mock 模式

触发方式:
- URL 加 `?mock=true`
- localStorage `aitutor.useMock=true`

Mock 文件位置: `assets/js/api/mock/{mockName}.json`

```json
// today_get.json
{
  "success": true,
  "data": {
    "date": "2026-08-28",
    "tasks": [...3],
    "summary": {...}
  }
}
```

⚠️ **不要把 mock 写到 backend**。

### 2.6 useAsyncResource + ErrorBoundary

- **`useAsyncResource`**: 替代 fetch+setState 样板
- **`mountErrorBoundary()`**: 每个 page mount 一次

---

## 3. PWA (public/)

```
public/
├── index.html                  PWA 入口
├── app.js                      主 JS
├── sw.js                       Service Worker
├── manifest.json
├── assets/
│   ├── css/                    浅色主题样式
│   └── js/
└── ...
```

**注意**:
- `sw.js` 缓存路径**仍引用 `src/app.js` 等旧文件** (audit 2026-08-17 P2-3)
- UA 检测分流: mobile → `public/index.html`, desktop → `frontend/index.html`

⚠️ **不要重构 PWA** (D081 §2 禁令)。Sprint 范围之外。

---

## 4. Legacy (frontend/)

```
frontend/                       3.3 MB, 47 HTML 文件
├── index.html                  旧首页
├── assets/css/style.css        v4 主样式 (F3 也复用)
├── assets/js/components.js     旧导航
├── *.html                      各科 exam/report
└── ...
```

**状态**:
- 🟡 冻结, 30 天后 410 Gone
- `style.css` 仍被 F3 复用, **不要删**
- 路由 `/legacy` 301 → `/f3`

⚠️ **不要修改 legacy 页面** — 已冻结。

---

## 5. 改前端的流程

1. 读 ADR (`.ai/decisions/D0NN-frontend.md`)
2. 决定 Shell 类型 (4 种之一)
3. 检查 service 是否已存在
4. 新建 service (如需) + mock 文件
5. 修改/新建页面
6. 加 `mountErrorBoundary()` (新页面)
7. 用 `useAsyncResource` (新页面)
8. 跑 `tests/contract.test.js` (前端 mock 契约)
9. 跑 BCT (真后端)

详细: [`runbooks/fix-bug.md`](../runbooks/fix-bug.md) 或 [`runbooks/add-api.md`](../runbooks/add-api.md)

---

## 6. Sprint 2 (D082) 前端改动

| Block | 文件 | 操作 |
|---|---|---|
| F1 | `services/today.js` | 新建 (4 methods) |
| F2 | `services/index.js` | +1 行 export |
| M1-M4 | `mock/today_*.json` | 新建 4 文件 |
| P1 | `pages/dashboard.html` | +1 段 (Today widget 顶部) |
| P2 | `pages/index.html` | +1 段 (已登录用户入口) |
| P3 | `pages/today.html` | 新建 (任务中心, Hybrid Shell) |

⚠️ **dashboard.html 不替换现有统计**, 只加 widget 在顶部。

---

## 7. 已知前端问题 (deferred)

| 问题 | 状态 |
|---|---|---|
| `frontend/` legacy 47 页占 3.3MB | P2, 30 天后 410 |
| `public/` PWA sw.js 引用旧路径 | P2-3 |
| `ai_trace` 表未接入 UI | P2 (Sprint 4+) |
| F3 10 页 USE_MOCK 开关 | 生产环境需确认 setUseMock(false) |

---

## 8. 不在 frontend scope

- ❌ Backend API → 见 [`architecture/backend.md`](./backend.md)
- ❌ RAG / LLM → 见 [`architecture/rag.md`](./rag.md)
- ❌ PWA 重构 → 明确禁止 (D081 §2)
- ❌ Legacy 修复 → 冻结 (D081 §2)

---

**文档结束 — frontend architecture v1.0 (2026-08-28)**