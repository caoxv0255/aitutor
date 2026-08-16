# aitutor Context — AI Agent 入口文件

> **目的**: 任何 AI agent (Hermes / Claude Code / DeepSeek / Cursor) 进入本项目**第一步读这份文件**，建立 5 分钟上下文。
>
> **不要把完整架构写在 context.md**——按需引用 `architecture/` 子目录。

---

## 0. 项目一句话

**aitutor** 是面向北京高考/中考学生的 AI 智能辅导 PWA (aitutor.uibe.online)。核心链路: 拍照搜题 → AI 教学 → 错题诊断 → 间隔复习 → 考试模拟。

技术栈: Node.js 22 (ESM) + Express + PostgreSQL 16 (Apache AGE + pgvector) + DashScope/DeepSeek + Vanilla JS + PWA + Docker Compose。

---

## 1. 我现在在哪里

```
/home/cx/aitutor/  ← 你 (agent) 看到的工作目录
```

**目录速览**:
| 目录 | 用途 | AI agent 关心吗 |
|------|------|----------------|
| `api/` | Express 后端 (核心代码) | ✅ |
| `ai-tutor-frontend/` | F3 主前端 (Tailwind 4) | ✅ |
| `frontend/` | 旧 PC 前端 (已冻结, /legacy) | ⚠️ 只读 |
| `public/` | PWA 移动端 (生产在用) | ✅ |
| `services/` | LLM/Embedding 服务 | ✅ |
| `scripts/` | 数据导入/迁移/seed | ✅ |
| `database/` | 题库/seed/migrations | ✅ |
| `graphrag_service/` | Python GraphRAG 微服务 | ⚠️ 独立部署 |
| `tests/` | Vitest + contract tests | ✅ |
| `.ai/` | **AI 工程层 (你正在读)** | 🤖 |
| `server.js` | Express 入口 | ✅ |
| `Dockerfile` / `docker-compose.yml` | 部署 | ⚠️ 改前必读 .ai/operations/ |

---

## 2. 现在在做什么阶段

**产品化阶段** (从开发期过渡到 v1.0):

| 阶段 | 状态 |
|------|------|
| 功能建设 (Hybrid RAG / SSE / SRS / F3) | ✅ 完成 |
| 工程收敛 (contract / test / docker / auth) | ✅ 完成 (Phase 1-4, 2026-08-15) |
| **产品化 (observability / deployment / data quality)** | 🟡 当前 |
| v1.0 release | ⏳ 待发布 |

**🛑 不要做的事** (项目已够复杂, 动核心会增加风险):
- 重构后端 / 换数据库 / 换模型
- 换前端框架 (React/Vue)
- 大改 RAG 架构
- 多 agent swarm

**✅ 应该做的事**:
- 维护 `.ai/` 工程层让 AI agent 持续维护项目
- 给 Hybrid RAG 加 observability (ai_trace 表)
- 数据质量流水线
- 把 `npm run gate` 焊死成 CI/hook

---

## 3. 关键命令 (5 分钟上手)

```bash
# 开发: 起后端 + DB + Redis
docker compose up -d -build app
# → app 在 :3002, db 在 :5433, redis 在 :6379

# 跑测试 (Vitest 241 + contract 38 + mock-contract 4)
npm test
node tests/contract.test.js

# Backend Contract Test (真后端, 需运行中后端)
BCT_URL=http://localhost:3002 node tests/backend-contract.test.js

# 发布门禁 (Phase 4) — 5 项: vitest / contract / BCT / docker build / health
npm run gate

# seed 知识点 (幂等, 仅空表时自动)
npm run seed:kp

# UID 回填
npm run backfill:uid
```

---

## 4. 5 分钟理解后端架构

读 `architecture/backend.md` (按需).

**双层路由**:
- `api/handlers/` — 旧业务 handler (33 个, server.js 直接挂载部分)
- `api/modules/` — 新模块化路由 (12 个模块, modulesRouter 统一挂载于 `/api/`)

**全局中间件** (`server.js`):
- `app.use('/api/', auditMiddleware, authMiddleware, apiLimiter, modulesRouter)`
- `authMiddleware` **不是全部都 401** —— 公开路由白名单见 `operations/public-routes.md`

**响应格式**:
```js
// 所有成功响应
{ success: true, message: '...', data: ... }
// 所有失败响应
{ success: false, message: '...', errorCode: '...', requestId: '...' }
```

---

## 5. 5 分钟理解前端 (F3)

读 `architecture/frontend.md` (按需).

**两套前端并存**:
| 前端 | 路径 | 状态 |
|------|------|------|
| `ai-tutor-frontend/` | `/f3/*` | ✅ 主, 9 页全走真后端 |
| `frontend/` | `/legacy` | 🟡 冻结, 301 → /f3 |
| `public/` | PWA 移动端 | ✅ 生产在用 |

**F3 核心契约**:
- client.js `request()` 返回**完整 envelope** (mock/real 同构, Phase 2 解包统一)
- Page 层用 `res.data.X` 消费
- Service 层是 wrapper, page 不直接 fetch
- Mock 模式: URL `?mock=true` 或 localStorage `aitutor.useMock=true`

---

## 6. 我要做的任务 → 找对应文件

| 我要... | 读这个 |
|--------|--------|
| 改后端 API | `architecture/backend.md` + `runbooks/add-api.md` |
| 修前端页面 | `architecture/frontend.md` + `runbooks/fix-bug.md` |
| 改数据库 schema | `runbooks/db-migration.md` |
| 跑发布前检查 | `npm run gate` |
| 加新依赖 | `decisions/D002-f3.md` (依赖选型历史) + CLAUDE.md |
| 部署 | `operations/deploy.md` |
| 查已知坑 | `known-bugs.md` |
| 接入 Hermes / AI agent | `INTEGRATION_WITH_HERMES.md` |

---

## 7. 我的"角色"是什么

如果你 (调用方) 指定了我的角色, 读对应文件:
- **coding agent**: `agents/coding.md`
- **review agent**: `agents/review.md`
- **testing agent**: `agents/testing.md`
- **migration agent**: `agents/migration.md`

---

## 8. ⚠️ 我必须遵守的红线

1. **改任何 symbol 前** 先跑 `gitnexus_impact` (如可用) 或读 `architecture/` 找到 callers
2. **改 client.js 后** 必须验证: `npm test` + BCT + `git diff --stat` 看波及页面
3. **改 auth / security 后** 必须重建 docker 镜像验证容器端
4. **改迁移前** 必须验证: 全新 DB + 已存在 DB 两种情况
5. **commit 前** 必须 `npm run gate` 全绿
6. **不要改既有 lint 债务** (基线 2445 项); 新代码必须 lint 干净

---

## 9. 我可以帮你写/维护的文档

按重要性排序 (你之前列的 5 件事):
- `.ai/architecture/` 子目录 (backend / frontend / rag / database)
- `.ai/decisions/D0XX-*.md` (原子决策记录)
- `.ai/operations/` (deploy / backup / recovery)
- `.ai/runbooks/` (修 Bug / 加 API / 数据库迁移)
- `.ai/agents/` (不同角色的引导)
- `.ai/status/*.yaml` (Hermes TUI 数据源)
- `.ai/integrations/INTEGRATION_WITH_HERMES.md`

---

## 10. 反馈给我

如果某件事文档说不清楚, 提出来让我修. 如果架构有错, 也告诉我. 这是**双向的工程层**.