# SPEC-ROUTES · 新主前端树（frontend-v2）页面 × 接口 × 状态

**状态**：草稿（待批准）
**日期**：2026-09-21
**前置**：`docs/audits/frontend-review-2026-09-20.md`（现状评审）、2026-09-20 线上一致性核实（288 文件零实质漂移）
**定位**：阶段 1 的"薄 spec"第一张表。只回答**要写几页、每页接哪些接口、具备什么算完成**。

---

## 0. 已定 / 待定

### 已定

1. **新主树 = `frontend-v2/`**（2026-09-21 从 `docs/design/` 迁入，已入库，不再被 `.dockerignore` 排除）
2. 旧树（F3 `ai-tutor-frontend/`、legacy `frontend/`、PWA `public/`）**冻结**，只保留可迁移的资产，不再新增功能
3. 后端**不动**：`api/modules/` 16 模块 142 handler 是资产，前端是消耗品

### 待你拍板（下表按"默认假设"推进，可推翻）

| # | 决策 | 我的默认假设 | 推翻后的影响 |
|---|---|---|---|
| **Q1** | 移动端是否并入同一套响应式 | ✅ **已定：一套响应式**（2026-09-21） | ~~若维持两棵树，SPEC-UI 组件表翻倍~~ |
| **Q2** | 是否允许为 v2 新开后端接口 | ✅ **已定：允许，缺口即补**（2026-09-21） | 新增接口须同时过 BCT 契约测试与门禁 |
| **Q3** | 旧树下线窗口 | ✅ **已定：立刻切默认，旧树只留回滚**（2026-09-21） | 落地为"新树优先 + 旧树兜底"，硬切须待批次 1-3 完成 |

> 三项决策的落地方式与执行卡片见 `docs/spec/PLAN-v2-migration.md`。

---

## 1. 页面总表

图例：**来源** = 新写 / 迁移（沿用旧树逻辑）/ 模板（一套多实例）/ 废弃
**状态集** = 该页必须实现的 6 态：`成功 / 加载 / 空 / 错误 / 未登录(401·403) / 离线`

### 1.1 两树都有 —— 直接对齐（8 页）

| 目标页 | 现有 | 依赖接口 | 备注 |
|---|---|---|---|
| `login.html` | v2 + F3 + legacy | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/guest-login` | ✅ 已按新架构重建（36 项验收），含 `?next=` 防开放重定向 |
| `register.html` | v2 + F3 | `POST /api/auth/register`、`GET /api/provinces` | ✅ 已按新架构重建（35 项验收），年级枚举与后端 `VALID_GRADES` 逐项对齐 |
| `wrong-book.html` | v2 + F3 | `GET/POST /api/user/wrong-questions`、`GET /api/user/wrong-questions/stats`、`GET /api/user/wrong-questions/export` | 切片链路的终点页 |
| `mastery.html` | v2 + F3 | `GET /api/knowledge/mastery`、`GET /api/knowledge/map`、`GET /api/knowledge/:kpId/practice` | ✅ 已按新架构重建（51 项验收）；标度见 G6-b（本端点 0..1） |
| `essay.html` | v2 + F3 | `POST /api/upload/image`、`POST /api/essay/grade`、`GET /api/essay` | ✅ 已按新架构重建（47 项验收）；两步链路（transcribe 未注册，见 G7）；长耗时防重复提交 |
| `practice-hub.html` | v2 + F3 | `POST /api/exam/session/start`、`POST /api/exam/session/submit`、`GET /api/exam/session/history` | ✅ 已按新架构重建（57 项验收）；accuracy 按得分加权，页面同时给"答对 N/M" |
| `learning-path.html` | v2 + F3 | `GET /api/learning-path/current`、`GET /api/analytics/learning-path` | |
| `teacher-dashboard.html` | v2 + F3 | `GET /api/analytics/class/analysis`、`/api/analytics/class/teacher`、`/api/class-detail` | 需角色校验 |

### 1.2 v2 独有 —— 纯增量（16 页）

| 目标页 | 依赖接口 | 备注 |
|---|---|---|
| `hero.html` / `landing.html` | 无（静态） | 落地页，**不接业务接口** |
| `onboarding.html` | `POST /api/user/initialize`、`GET/PUT /api/user/subjects`、`GET /api/user/provinces` | 首启引导 |
| `subject-picker.html` | `GET/PUT /api/user/subjects` | |
| `subject-detail.html` | `GET /api/knowledge/mastery`、`GET /api/knowledge/points` | |
| `knowledge-star.html` | `GET /api/knowledge/star-map` | |
| `review-session.html` | `GET /api/srs/engine/queue`、`POST /api/srs/engine/review`、`GET /api/srs/engine/stats` | ✅ 已按新架构重建（46 项验收）；原静态稿里的半接线仅作接口样本 |
| `learning-journey.html` | `GET /api/analytics/learning-path`、`GET /api/loop/summary` | |
| `predictive-paper.html` | `GET /api/exam/papers`、`POST /api/exam/pdf/generate` | |
| `pwa-photo.html` | `POST /api/vision/batch-parse` | **切片链路入口**，被 `photo-solve.html` 取代 |
| `vision-result.html` | `POST /api/vision/search`、`POST /api/rag/explain` | **切片链路结果页** |
| `notifications.html` | `GET /api/loop/feed`、`GET /api/loop/actions` | |
| `settings.html` | `GET/PUT /api/user/profile`、`POST /api/auth/prefs/province` | |
| `state-library.html` | 无（静态） | 组件/状态展示页，作为 SPEC-UI 的可执行附录 |
| `error-404.html` | 无 | 已被 `server.js` 用作 `/v2` 的 404 页 |

### 1.3 F3 有、v2 没有 —— **不要照着补**（30 页 → 收敛后更少）

原样补 30 页是最大的浪费。三类处置：

| 处置 | 页面 | 理由 |
|---|---|---|
| **模板化（12 → 1）** | `math/physics/chemistry/chinese/english/politics-exam` + `-report` | 同一数据结构的 6 个学科视图 → **1 模板 + 学科参数** |
| **合并** | `index.html` ≡ `dashboard.html`（md5 `7d8ffd655802` 完全相同，审计 R5） | 保留 `dashboard.html`，`index.html` 301 |
| **保留为独立页** | `tutor` `question-bank` `question-explainer` `exam-simulation` `personalized-paper` `my-weak-points` `methodology` `vision` `sample-report-{parent,student,teacher}` `student-progress` `cross-subject` `province` `2026-policy` `zhongkao` `demo-design-system` | 逐个确认后再决定是否并页 |

**结论**：补齐缺口 ≠ +30 页，实际增量约 **+15 页**，其中 12 个学科页由 1 个模板承担。

---

## 2. 接口对照（模块 → 消费页面）

| 模块 | 接口 | 消费页面 |
|---|---|---|
| `auth` | `/login` `/register` `/me` `/logout` `/prefs/province` | login / register / settings |
| `user` | `/dashboard` `/profile` `/subjects` `/initialize` `/wrong-questions*` `/knowledge-profile` `/learning-suggestions` | dashboard / settings / onboarding / subject-picker / wrong-book |
| `vision` | `/search` `/batch-parse` `/batch-ingest` | pwa-photo / vision-result / **photo-solve（切片）** |
| `exam` | `/papers` `/questions` `/session/*` `/pdf/generate` | practice-hub / predictive-paper |
| `knowledge` | `/mastery` `/map` `/points` `/star-map` `/cross-subject-impact` | mastery / subject-detail / knowledge-star |
| `review` | `/reports` `/session/history` `/weak-points` `/trend-summary` | review-session / my-weak-points |
| `srs` | （挂在 `/api/srs`） | review-session |
| `learning-path` | `/current` | learning-path / learning-journey |
| `loop` | `/summary` `/actions` `/feed` | learning-journey / notifications |
| `analytics` | `/class/*` `/system/stats` | teacher-dashboard |
| `gamification` | `/checkin` `/points` `/badges` | dashboard |
| `essay` | `/api/essay/grade` `/api/essay` `/api/essay/upload` | essay |
| `rag` | `/query` `/explain` `/similar-questions` `/knowledge-map` | question-explainer / vision-result |
| `tutor` | （挂在 `/api/tutor`） | tutor |
| `legacy-compat` | `/guest-login` `/questions` `/tasks` `/reports` … | 兼容层，**新树不新增依赖** |

---

## 3. DoD · 一页算"完成"的判据

每页必须同时满足（阶段 3 横向复制时逐条打勾）：

1. **六态齐备**：成功 / 加载 / 空 / 错误 / 未登录(401·403) / 离线，且六态都可被机械触发（见 §4）

   > **例外（2026-09-21）**：认证页（`login` / `register`）没有"未登录"态 —— 表单态本身即未登录态，故实现为 **5 态**。已在页面注释与 `PLAN-v2-migration.md` 中标注。
2. **零境外请求**：页面不得引用 `fonts.googleapis` / `unpkg` / `jsdelivr`（旧 v2 24 页每页 2 处 Google Fonts + 1–2 处 CDN）
3. **样式不在页内**：不得内联 `<style>` 块，共享样式走 `frontend-v2/assets/css/*`（旧 v2 每页内联 47–65KB）
4. **a11y 底线**：所有输入有 `label`；状态区有 `aria-live="polite"`；图标不用 emoji；`prefers-reduced-motion` 有降级
5. **接口来自统一数据层**：页面不直接 `fetch`，走 `assets/js/api.js`（沿用 PWA `src/services` 的接线方式）
6. **冒烟通过**：页面可加载 + 关键元素存在 + 无 console error（Playwright/jsdom，接入门禁）

---

## 4. 阶段计划

| 阶段 | 产出 | 出口判据 |
|---|---|---|
| **0 收口** | v2 迁入 `frontend-v2/` 并入库；`server.js` 默认目录改指新树 | ✅ 完成 2026-09-21，两服务已重启，桥接副本已删 |
| **1 薄 spec** | 本表 + SPEC-DATA + SPEC-UI | ✅ 本表与 `SPEC-DATA.md` 已出；**SPEC-UI 待**（组件/token 清单，依赖 Q1） |
| **2 垂直切片** | `photo-solve.html`（拍照 → 解析 → 结果 → 存错题本） | ✅ 完成，28 项验收通过 |
| **3 横向铺** | 按 §1 表逐页复制 | 🟡 进行中：`wrong-book.html` 已完成（33 项验收通过）。下一批建议 `login.html`→`review-session.html`→`mastery.html` |
| **4 切换下线** | 灰度 → 默认 → 旧树 301 → 删 | 未开始 |

### 3.1 已按新架构重建的页（三件套：ui.js 六态机 + api.js 数据层 + app.css token）

| 页 | 状态 | 测试 | 备注 |
|---|---|---|---|
| `photo-solve.html` | ✅ | `tests/frontend/photo-solve-states.test.mjs`（28 项） | 原 `pwa-photo.html` / `vision-result.html` 仍是静态稿，待本页收编后废弃 |
| `wrong-book.html` | ✅ | `tests/frontend/wrong-book-states.test.mjs`（44 项） | 覆盖原静态稿；G1 已关闭，支持标记复习/删除 |
| `dashboard.html` | ✅ | `tests/frontend/dashboard-states.test.mjs`（50 项） | 接 `/api/user/dashboard` + `/api/user/today`；今日任务失败不拖垮整页 |

> 批次 1-3 已建页面均已在 `server.js` 的 `NEW_TREE_PAGES` 中接管（根路径可达）；
> 接管清单由门禁 `scripts/check-new-tree-routing.mjs` 从 `server.js` 读取后逐页校验 md5。

> 老对象同样的三件套 —— 每页只写差异部分，代价约 1 小时/页，而不是重写一套样式与状态机。

---

## 5. 切片页为什么选"拍照解题"

`拍照 → AI 解析 → 结果 → 存错题本 → SRS 复习` 是唯一能**一次性压出六个问题**的链路：

| 问题 | 被哪一步逼出 |
|---|---|
| 鉴权与游客态 | `/api/vision/batch-parse` 需 Bearer token（401/403 态） |
| 大载荷与超时 | 单图 ≤10MB、批量 ≤20 张、并发 3 → 加载态必须可中断、有进度 |
| 部分失败 | 接口返回 `questions[] + failed[]`，不是全成功/全失败 |
| 数据契约 | 解析结果要落成错题本字段（`content` / `subject_code` / `difficulty` …） |
| 离线 | 移动端拍照场景必然遇到 |
| 空态 | 无图 / 解析出 0 题 |

落地页（hero）压测不出以上任何一条 —— 这是"先做切片"而不是"先补页面"的核心理由。
