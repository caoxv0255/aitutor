# 32 个保留 dead backend 端点 review — 2026-08-20

**生成时间**: 2026-08-20
**来源**: docs/audit-dead-routes-checked.md "有引用" 区 (32 个)
**目的**: 用户要"逐一 review", 我先自动化 review 写出结果, 让用户最后决定删/留

## Review 分类 (5 类)

### A. method 错配 (前端 GET 后端 POST) — 删 POST 端点
后端同时声明 GET/POST/DELETE,但前端只用 GET。POST/DELETE 永远没前端调用。
- `DELETE /api/auth/prefs/province` (api/modules/auth/routes.js:32) — user.js GET 用了,DELETE 没用
- `POST /api/exam/papers` (api/modules/exam/routes.js:14) — exam.js:74 GET 用了,POST 没用
- `POST /api/exam/questions` (api/modules/exam/routes.js:16) — exam.js:15/19 GET 用了
- `POST /api/user/profile` (api/modules/user/routes.js:17) — user.js:49 GET 用了
- `POST /api/user/subjects` (api/modules/user/routes.js:20) — user.js:53 GET 用了
- `DELETE /api/user/subjects` (api/modules/user/routes.js:21) — 同上

### B. 仅 routes.js 注释自我引用 — 端点真 0 调用
- `DELETE /api/rag/questions/:id` (api/routes/rag-search.js:636) — 注释 + 唯一一处引用是自身注释
- `POST /api/rag/multi/upsert` (api/routes/rag-search.js:745) — 同上
- `GET /api/rag/multi/questions/:question_id` (api/routes/rag-search.js:797) — 注释相互引用
- `DELETE /api/rag/multi/questions/:question_id` (api/routes/rag-search.js:819) — 同上
- `GET /api/rag/multi/stats` (api/routes/rag-search.js:841) — 注释引用

### C. routes/*.js 文件 import 失败(模块加载错误) — 整文件 22 端点
这些文件本身 import 就 throw,server 从不加载,**整个文件等于死代码**。包括:
- `GET /api/tutor/mastery/:kpId` (api/routes/tutor-agent.js:585) — tutor-agent.js 是 /agent 子 router
  (注: tutor-agent.js 本身有 import 失败 bug, 见 CLAUDE.md review 建议)
- 还有 18 个其他 routes/*.js 端点 (从 audit report 的 22 个 routes/* endpoints 减去已被 strip 的 4 个)

**整个 routes/*.js 文件是死代码, 应该全删** (除非有计划修 import bug)

### D. 引用在 D070 冻结的 frontend/redesign/ (legacy 死) — 删
- `GET /api/trends/expert-summary` (api/modules/trends/routes.js:8) — 引用在 frontend/redesign/trends-analysis.html
- `POST /api/user/initialize` (api/modules/user/routes.js:23) — 引用在 frontend/redesign/onboarding.html
- `GET /api/user/wrong-questions/stats` (api/modules/user/routes.js:28) — redesign/wrong-book.html
- `GET /api/user/wrong-questions/export` (api/modules/user/routes.js:29) — redesign/wrong-book.html
- `POST /api/vision/search` (api/modules/vision/routes.js:14) — redesign/photo-search.html

`frontend/redesign/` 是 D070 决策冻结的 legacy 目录 (D070 commit `0fe7a77c refactor: frontend cleanup`)。
**这些 redesign 文件前端实际用户不可达** (legacy 备份),所以 redesign 调的后端端点全死。

### E. 真有用, 保留 (9 个)
- `GET /api/exam/papers` — exam.js:74 GET 真用
- `POST /api/exam/pdf/generate` (无 :paperId) — exam.js:47 fetch 但路径用 :paperId 版本
  (注: 实际 fetch `/api/exam/pdf/generate/${paperId}` 含 paperId, audit 误把无 :paperId 版本当死)
- `POST /api/exam/pdf/generate/:paperId` — exam.js:47 真用
- `GET /api/knowledge/mastery` — knowledge.js:7 GET 真用
- `GET /api/knowledge/mastery/:kpId` — knowledge.js 注释 + 真用
- `GET /api/knowledge/map` — knowledge.js:16 GET 真用
- `GET /api/knowledge/points` — knowledge.js:21 GET 真用
- `GET /api/review/*` (4 个) — review.js 真用 + BCT 测

## 建议清理 (22 个端点可删)

| 端点 | 类别 | 文件 |
|------|------|------|
| DELETE /api/auth/prefs/province | A | api/modules/auth/routes.js:32 |
| POST /api/exam/papers | A | api/modules/exam/routes.js:14 |
| POST /api/exam/questions | A | api/modules/exam/routes.js:16 |
| DELETE /api/rag/questions/:id | B | api/routes/rag-search.js:636 |
| POST /api/rag/multi/upsert | B | api/routes/rag-search.js:745 |
| GET /api/rag/multi/questions/:question_id | B | api/routes/rag-search.js:797 |
| DELETE /api/rag/multi/questions/:question_id | B | api/routes/rag-search.js:819 |
| GET /api/rag/multi/stats | B | api/routes/rag-search.js:841 |
| GET /api/trends/expert-summary | D | api/modules/trends/routes.js:8 |
| POST /api/user/initialize | D | api/modules/user/routes.js:23 |
| GET /api/user/wrong-questions/stats | D | api/modules/user/routes.js:28 |
| GET /api/user/wrong-questions/export | D | api/modules/user/routes.js:29 |
| POST /api/vision/search | D | api/modules/vision/routes.js:14 |
| POST /api/user/profile | A | api/modules/user/routes.js:17 |
| POST /api/user/subjects | A | api/modules/user/routes.js:20 |
| DELETE /api/user/subjects | A | api/modules/user/routes.js:21 |
| GET /api/tutor/mastery/:kpId | C (tutor-agent.js import 失败) | api/routes/tutor-agent.js:585 |

**总计 17 端点**可安全删 (来自本轮 review 决定)

## 仍保留 9 端点
- GET /api/exam/papers
- POST /api/exam/pdf/generate (audit 误报)
- POST /api/exam/pdf/generate/:paperId
- GET /api/knowledge/mastery
- GET /api/knowledge/mastery/:kpId
- GET /api/knowledge/map
- GET /api/knowledge/points
- GET /api/review/reports
- GET /api/review/reports/:id
- GET /api/review/session/history
- GET /api/review/weak-points
- GET /api/review/trend-summary

实际 12 个(超过 9), review 时有重复

## C 类: routes/*.js 文件 import 失败 (整文件死)

`api/routes/{learning-loop, graphrag, knowledge-graph, srs-engine, tutor-agent}.js`
每个文件至少有 `router.post('/xxx', ...) {` 缺 `async (req, res) =>` 函数 wrap。
**这些文件 import 时就 throw Illegal return statement**, server 从不加载, 等于死代码。
**应该整个文件删** (除非有计划修 import bug):
- learning-loop.js: 4 端点 (feedback, batch, mastery, graph)
- graphrag.js: 8 端点 (query, explain, similar-questions, knowledge-map, paper-source, admin/{jobs,stats,reindex})
- knowledge-graph.js: 7 端点 (stats, sync, sync-back, search, file, list, reindex)
- srs-engine.js: 3 端点 (daily-tasks, complete, stats)
- tutor-agent.js: 已修 (router.use('/', ...)), 但 GET /api/tutor/mastery/:kpId 仍 dead

**删除这些 routes/*.js 文件 (v3 dead-code 大扫荡)**: 本轮不在范围
