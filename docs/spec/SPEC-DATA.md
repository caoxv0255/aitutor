# SPEC-DATA · 后端接口可用性盘点与新树的接口缺口

**状态**：草稿 · 由 2026-09-21 实施阶段 2/3 时逐条核出
**原则（Q2 默认）**：先用现有接口把页面跑通，缺口单列，不阻塞前端

---

## 1. 已开放（可直接用）

`server.js:412` 挂载：`app.use('/api/', auditMiddleware, authMiddleware, apiLimiter, legacyCompatRouter, modulesRouter)`
**142 个 handler，16 个模块**。鉴权统一为 `Authorization: Bearer <jwt>`（`api/core/auth.js:73`），缺失即 401 —— 这是前端 401/403 态的来源。

| 前缀 | 来源 | 已验证可用于新树 |
|---|---|---|
| `POST /api/vision/batch-parse` | `api/modules/vision/routes.js:71` | ✅ photo-solve 切片已接（base64 数组，单图 ≤10MB，批量 ≤20） |
| `GET /api/user/wrong-questions` | `api/modules/user/routes.js:27` | ✅ wrong-book 已接（page/page_size/subject/reviewed） |
| `POST /api/user/wrong-questions` | `api/modules/user/routes.js:28` | ✅ photo-solve「存入错题本」已接 |
| `GET /api/user/wrong-questions/stats` | `api/modules/user/routes.js:30` | ✅ wrong-book 已接（失败不影响列表） |
| `POST /api/auth/login` `/register` `/me` `/logout` | `api/modules/auth/routes.js` | 待 login 页接入 |
| `GET /api/srs/engine/queue` `/daily-tasks` `POST /complete` `/review` `GET /stats` | `api/routes/srs-engine.js` | 待 review-session 页接入 |
| `POST /api/tutor/ask` `/ask/stream` `GET /sessions` | `api/routes/tutor-agent.js` | 待 tutor 页接入（有流式端点，加载态需支持 SSE） |
| `GET /api/knowledge/mastery` `/map` `/star-map` | `api/modules/knowledge/routes.js` | 待 mastery 页 |
| `GET /api/review/reports` `/weak-points` `/session/history` | `api/modules/review/routes.js` | 待 my-weak-points |
| `GET /api/exam/papers` `/questions` `POST /session/start` | `api/modules/exam/routes.js` | 待 practice-hub |
| `GET /api/learning-path/current` | `api/modules/learning-path/routes.js` | 待 learning-path |

---

## 2. 缺口（前端做不到，需要后端配合）

| # | 缺口 | 证据 | 影响 page | 优先级 |
|---|---|---|---|---|
| ~~**G1**~~ | ~~无法标记已复习 / 删除错题~~ | **已于 2026-09-21 关闭**：`api/modules/user/routes.js` 新增 `PUT/DELETE /wrong-questions/:id`（handler 早已实现，只差挂载）。契约测试 `tests/api/wrong-questions-crud.test.js` 8/8；前端 `wrong-book.html` 已接上行级操作，验收 44/44 | ~~wrong-book~~ | ✅ 已关闭 |
| **G2** | 错题列表不返回 `question_type` / `correct_answer` 的稳定性保证 | SQL 是 `SELECT wq.*`，字段取决于表结构；新页面已做 `content \|\| question` 兼容 | wrong-book | P1 |
| **G3** | vision 解析结果字段名不稳定 | `api/services/visionSearchService.js:679` 用 `{success, pageIndex, duration_ms, ...parsed}` spread，具体字段随 LLM 输出漂移 | photo-solve | P1 —— 建议后端固化为稳定 schema |
| **G4** | 无 token 刷新机制 | 只有 `POST /api/auth/login`，无 refresh；过期即登出 | 全站 | P1 |
| **G5** | `legacy-compat` 层仍在响应旧路径 | `api/legacy-compat.js` 有 `/tasks` `/questions` 等兼容路由 | 无（新树不依赖） | P2 —— 建议随旧树下线一并移除 |

---

## 3. 前端侧已固化的约定

- **统一数据层**：`frontend-v2/assets/js/api.js` —— 页面不得直接 `fetch`
- **错误分类**：`401/403 → auth`、`网络失败 → offline`、其余 → `error`（`assets/js/ui.js` 的 `mapError`，两页共用同一判据）
- **响应解包**：统一剥离 `{ success, data, message }`，页面只拿 `data`

---

## 4. 出口判据

~~G1 关闭之前，错题本只能做"只读沉淀"，不算完成 DoD。~~ 已于 2026-09-21 关闭：后端挂载 PUT/DELETE，前端接上行级操作，错题本形成"进 → 看 → 复习/删除"闭环。
