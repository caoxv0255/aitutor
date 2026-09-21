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
| **G6-b** | **API 输出层标度也不统一**：`/api/knowledge/mastery` 的 `overall` / `by_topic[].mastery` 按 **0..1** 返回（F3 `mastery.html:311` 用 `overall * 100` 显示），而 `/api/knowledge/map` 的 `nodes[].mastery` 与 `/api/srs/engine/queue` 的 `mastery_score` 按 **0..100** 返回 | `api/modules/knowledge/routes.js:48,54` vs `:402`；消费者 `ai-tutor-frontend/pages/mastery.html:310-311` | mastery / 复习 / 图谱 | **P1，需决策**（统一需同时改 F3 消费方） |
| ~~**G6**~~ | ~~`mastery_score` 两套标度（会导致 SRS 复习把 60 覆写成 1）~~ | **代码已修 2026-09-21**：活路径统一 0..100 —— `srs-engine` review 4 处 + route A 3 处、`learning-loop` 活路径(`/100` 多余)与涟漪阈值、`knowledge/routes:403` 的 `is_weak`；schema `NUMERIC(4,2)→(5,2)`；新增静态闸门 `tests/api/mastery-scale-guard.test.js` 并接入门禁 6/7（它首跑又抓出 2 处真实违规） | ~~全局~~ | ⚠️ **代码已修，历史数据回填待执行**（`037_mastery_scale_unify.sql`） |
| ~~**G1**~~ | ~~无法标记已复习 / 删除错题~~ | **已于 2026-09-21 关闭**：`api/modules/user/routes.js` 新增 `PUT/DELETE /wrong-questions/:id`（handler 早已实现，只差挂载）。契约测试 `tests/api/wrong-questions-crud.test.js` 8/8；前端 `wrong-book.html` 已接上行级操作，验收 44/44 | ~~wrong-book~~ | ✅ 已关闭 |
| **G2** | 错题列表不返回 `question_type` / `correct_answer` 的稳定性保证 | SQL 是 `SELECT wq.*`，字段取决于表结构；新页面已做 `content \|\| question` 兼容 | wrong-book | P1 |
| **G3** | vision 解析结果字段名不稳定 | `api/services/visionSearchService.js:679` 用 `{success, pageIndex, duration_ms, ...parsed}` spread，具体字段随 LLM 输出漂移 | photo-solve | P1 —— 建议后端固化为稳定 schema |
| **G4** | 无 token 刷新机制 | 只有 `POST /api/auth/login`，无 refresh；过期即登出 | 全站 | P1 |
| **G5** | `legacy-compat` 层仍在响应旧路径 | `api/legacy-compat.js` 有 `/tasks` `/questions` 等兼容路由 | 无（新树不依赖） | P2 —— 建议随旧树下线一并移除 |

---

## 2.5 G6 证据链（2026-09-21 建 mastery 页时发现）

**同一个列 `student_knowledge_mastery.mastery_score` 被两套标度读写，差 100 倍。**

| 位置 | 用法 | 隐含标度 |
|---|---|---|
| `api/core/db.js:452` | `NUMERIC(5,2) CHECK (mastery_score BETWEEN 0 AND 100)` | **0..100**（schema 意图） |
| `api/routes/learning-loop.js:200` | `LEAST(100, mastery_score + $3)` | **0..100** ✓ |
| `api/routes/learning-loop.js:664` | `LEAST(1.0, mastery_score + 0.02)` | **0..1** ✗ |
| `api/routes/learning-loop.js:679` | `GREATEST(0.0, mastery_score - 0.05)` | **0..1** ✗ |
| `api/routes/srs-engine.js:264` | 写入 `newMastery`（clamp 到 0..1） | **0..1** ✗ |
| `api/routes/srs-engine.js:523` | `is_weak: mastery_score < 0.5` | **0..1** ✗ |
| `api/modules/knowledge/routes.js:42` | `Number(mastery_score) / 100` | **0..100** ✓ |
| `api/handlers/study-plan.js:91,173` | `mastery_score < 70` / `< 80` | **0..100** ✓ |

### 为什么这是 P0 而不是"显示不准"

`api/routes/srs-engine.js` 的 review 流程会**读旧值再写新值**：

```js
const oldMastery = cur.rows[0] ? parseFloat(cur.rows[0].mastery_score) : 0.5;
const newMastery = Math.max(0, Math.min(1, oldMastery + totalDelta));
```

若某知识点由 learning-loop 按 0..100 写成 `60`，用户在复习页提交一次自评：

```
newMastery = max(0, min(1, 60 + 0.08)) = 1
```

**60 → 1**：掌握度被覆写为 1（等同"1%"），且 `srs_review_log` 会记下 `old_mastery=60, new_mastery=1` 这条不可逆的日志。反向亦然：SRS 写入的 `0.3` 会被掌握度页读成 `0.3/100 = 0.3%`，并在学习计划里永远命中 `< 70` 的薄弱阈值。

### 待决策（不自行选择）

| 方案 | 动作 | 代价 |
|---|---|---|
| **A 统一到 0..100**（与 schema 及 3 处读取一致） | 改 `srs-engine` 4 处 + `learning-loop` 2 处；已有 0..1 历史数据需 ×100 回填 | 需数据回填 migration |
| **B 统一到 0..1**（与 SRS 自洽） | 改 `knowledge/routes` + `study-plan` + schema CHECK + 索引；已有 0..100 历史数据需 ÷100 回填 | 改动面更大，且与 `NUMERIC(5,2)` 精度设计冲突 |

在决策落地前，`mastery.html` 的掌握度百分比**无法保证正确**，因此该页暂缓实施（页面骨架与验收模板已就绪）。

---

## 3. 前端侧已固化的约定

- **统一数据层**：`frontend-v2/assets/js/api.js` —— 页面不得直接 `fetch`
- **错误分类**：`401/403 → auth`、`网络失败 → offline`、其余 → `error`（`assets/js/ui.js` 的 `mapError`，两页共用同一判据）
- **响应解包**：统一剥离 `{ success, data, message }`，页面只拿 `data`

---

## 4. 出口判据

~~G1 关闭之前，错题本只能做"只读沉淀"，不算完成 DoD。~~ 已于 2026-09-21 关闭：后端挂载 PUT/DELETE，前端接上行级操作，错题本形成"进 → 看 → 复习/删除"闭环。
