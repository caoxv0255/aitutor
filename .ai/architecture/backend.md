# Backend Architecture — aitutor

> **目的**: 改后端代码前先读本文件。配合 `runbooks/add-api.md`。
> **最后更新**: 2026-08-28 (D083 补全)
> **状态**: 反映 2026-08 真实代码

---

## 1. 总览

**技术栈**: Node.js 22 (ESM) + Express + PostgreSQL 16 + Apache AGE + pgvector

**入口**: `server.js` (Express app + 中间件 + 路由挂载)

```
server.js
├── /api/*              → middleware + modulesRouter
│   ├── auditMiddleware
│   ├── authMiddleware (D067, 有 public-routes 白名单)
│   ├── apiLimiter
│   └── api/modules/index.js
└── /* (静态文件)
    ├── /               → PWA (public/index.html) on mobile UA
    └── /               → frontend/index.html on desktop UA
```

---

## 2. 目录结构（真实代码）

### 2.1 `api/handlers/` — 旧业务 handler（33 个）

```
api/handlers/
├── login.js                    POST /api/login
├── register.js                 POST /api/register (含 admin 硬编码)
├── guest-login.js              POST /api/guest-login
├── reset-password.js
├── questions.js                错题 CRUD
├── reports.js                  诊断报告 CRUD
├── generate-paper.js           个性化试卷生成 (Sprint 4+)
├── explain-question.js         AI 题目讲解 (调 LLM)
├── learning-path.js            学习路径规划
├── knowledge-points.js         知识点 + 薄弱点分析 (含 seed_zhongkao dead code)
├── tasks.js                    异步任务管理
├── proxy.js                    LLM API 代理
├── learning-dashboard.js       GET /api/user/dashboard
├── knowledge-profile.js
├── user-{profile,subjects,province,initialize}.js
├── wrong-questions.js
├── exam-{papers,pdf,questions,session}.js
├── province-trends.js
├── subject-trends.js
├── trend-summary.js
├── class-analysis.js
├── gamification.js
├── ai-feedback.js              POST /api/ai-feedback (LLM 反馈)
├── study-plan.js
├── subjects.js
├── user-province.js
├── seed-provinces.js           ⚠️ ensureSeeds() 未调用 (P0-3)
├── seed-zhongkao.js            ⚠️ 未挂载 (dead code)
└── adaptive-difficulty.js
```

**挂载**: 直接在 `server.js` 中 `app.use('/api/xxx', handler)` 或类似。

### 2.2 `api/modules/` — 新模块化路由（12 个）

```
api/modules/
├── index.js                   模块注册表
├── auth/                      /api/auth/* (JWT 签发/验证)
├── user/                      /api/user/* (profile/dashboard/today/wrong-questions)
├── tutor/                     /api/tutor/* (TBD)
├── exam/                      /api/exam/*
├── rag/                       /api/rag/*
├── srs/                       /api/srs/*
├── review/                    /api/review/*
├── vision/                    /api/vision/*
├── analytics/                 /api/analytics/*
├── gamification/              /api/gamification/*
├── knowledge/                 /api/knowledge/*
└── feedback/                  /api/feedback/* (Sprint 1+ 学生反馈)
```

**挂载**:

```js
// api/modules/index.js
import express from 'express';
import userRoutes from './user/routes.js';
import srsRoutes from './srs/routes.js';
// ...

const router = express.Router();
router.use('/user', userRoutes);
router.use('/srs', srsRoutes);
// ...

export default router;
// server.js: app.use('/api/', auditMiddleware, authMiddleware, apiLimiter, modulesRouter);
```

### 2.3 `api/routes/` — 高级业务路由（7 个）

```
api/routes/
├── graphrag.js                GET /api/graphrag/* (Apache AGE 图查询)
├── knowledge-graph.js         知识图谱
├── learning-loop.js           数据飞轮: feedback / batch / mastery (Sprint 1 核心)
├── rag-search.js              RAG 向量搜索
├── srs-engine.js              SM-2 间隔重复算法
├── tutor-agent.js             AI Tutor 对话代理 (DashScope)
└── vision-parse.js            图片 OCR + 题目解析
```

**注意**: 这 7 个文件**没有**在 `api/modules/index.js` 注册。它们**直接**被 `server.js` 挂载 (例: `app.use('/api/loop', learningLoopRouter)`)。

⚠️ 这是一个**架构混淆点**: `api/handlers/` 和 `api/modules/` 和 `api/routes/` 三层共存。新代码应优先放 `api/modules/<新模块>/routes.js`。

### 2.4 `api/core/` — 核心基础设施（7 个）

```
api/core/
├── auth.js                    JWT 签发 + authMiddleware + isPublicRoute (D067)
├── db.js                      PostgreSQL pool + initTables() 自动建表
├── ensureSeeds.js             知识点 / 题目 seed (D064 auto-seed)
├── logger.js                  日志
├── questionUid.js             question_uid 生成 (D063 uid single source)
├── swagger.js                 API 文档
└── taskWorker.js              后台异步任务消费者
```

### 2.5 `api/middleware/` — 中间件

```
api/middleware/
└── security.js                安全中间件 (rate limit, helmet 等)
```

### 2.6 `api/utils/` — 工具

```
api/utils/
├── response.js                successResponse / errorResponse (D062 envelope)
└── ...
```

---

## 3. 中间件链 (server.js)

```
请求 /api/*
  ↓
auditMiddleware       记录 API 调用
  ↓
authMiddleware        JWT 验证 (D067, 含 public-routes 白名单)
  ↓
apiLimiter           速率限制 (auth 20/15min, proxy 10/min, api 通用)
  ↓
modulesRouter         api/modules/index.js
  ↓
具体 handler
```

---

## 4. 响应格式 (D062 Envelope)

**所有**成功响应:

```js
{ success: true, message: '...', data: {...} }
```

**所有**失败响应:

```js
{ success: false, message: '...', errorCode: 'INVALID_INPUT', requestId: '...' }
```

**实现**: `api/utils/response.js` 的 `successResponse(data, message)` 和 `errorResponse(code, message, requestId)`。

**客户端契约 (D062)**:
- `client.js` (前端) **不**解包 envelope, 返回完整 `{success, data}`
- 前端消费 `res.data.X` (统一, mock/real 同构)

---

## 5. 认证 (D067)

```
api/core/auth.js
├── signToken(payload)         签发 JWT
├── verifyToken(token)         验证 JWT
├── authMiddleware             Express 中间件
│   ├── 检查 Authorization: Bearer
│   ├── 跳过白名单 (public-routes)
│   └── ⚠️ DEV_AUTH_BYPASS 检测 (启动时 + 每次请求警告)
└── PUBLIC_ROUTES              公开路由白名单
```

**白名单示例**: `/api/login`, `/api/register`, `/api/health`, `/api/provinces`, etc.

**`req.user`**: 验证后挂载 `{email, grade, ...}`, handler 通过 `req.user.email` 访问。

---

## 6. 数据库访问 (D063/D064)

### 6.1 连接池

```js
// api/core/db.js
import { getDb } from '../core/db.js';
const pool = await getDb();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // SQL 操作
  await client.query('COMMIT');
} finally {
  client.release();  // 必须
}
```

### 6.2 UID 生成 (D063)

```js
import { generateQuestionUid } from '../core/questionUid.js';
const uid = generateQuestionUid(subject, source, externalId);
// 格式: q-{subject}-{hash}-{short}
```

⚠️ **不要**手写 uid 拼接。

### 6.3 Auto-seed (D064)

```js
// api/core/ensureSeeds.js
// 启动时自动 seed knowledge_points (空表才 seed)
await ensureKnowledgePointsSeeded();
```

---

## 7. 数据库 Schema

见 [`architecture/database.md`](./database.md) — 36 表详细列表。

---

## 8. 添加新 endpoint 的标准流程

1. 读 ADR (`decisions/D0NN-implementation.md`)
2. 决定挂载点:
   - 已有模块 → `api/modules/<module>/routes.js`
   - 新模块 → 创建 `api/modules/<new>/routes.js` + 在 `api/modules/index.js` 注册
3. 实现 handler
4. 加 `authMiddleware` (除非 public)
5. 用 `successResponse / errorResponse` 包响应
6. 加 contract test + BCT
7. 跑 `npm run gate`

详细步骤: [`runbooks/add-api.md`](../runbooks/add-api.md)

---

## 9. 已知架构问题 (deferred)

| 问题 | 状态 |
|---|---|
| `api/handlers/` 与 `api/modules/` 与 `api/routes/` 三层共存 | 接受 (历史包袱) |
| `api/handlers/knowledge-points.js` 死代码 | P1-3 (audit 2026-08-17) |
| `api/handlers/seed-provinces.js` 未调用 | P0-3 |
| `api/handlers/seed-zhongkao.js` 未挂载 | dead code |
| `api/routes/today.js` 不存在 (Sprint 2 待建) | D082 B1 |

---

## 10. 不在 backend scope

- ❌ 前端 UI (F3) → 见 [`architecture/frontend.md`](./frontend.md)
- ❌ RAG / GraphRAG → 见 [`architecture/rag.md`](./rag.md)
- ❌ 数据库 schema → 见 [`architecture/database.md`](./database.md)
- ❌ 部署 / 运维 → 见 `operations/`

---

**文档结束 — backend architecture v1.0 (2026-08-28)**