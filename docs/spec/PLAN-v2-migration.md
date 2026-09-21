# PLAN · v2 升格为新主前端树（可执行计划）

**用途**：把"用 v2 替换旧前端、可复用部分迁移"这条指令拆成**可机械执行、可机械验收**的任务卡。
每张卡片含：输入 → 动作（含命令）→ 验收命令 → 出口判据。执行者（人或 agent）按顺序刷卡即可。

**前置文档**：`docs/spec/SPEC-ROUTES.md`（页面×接口×状态）、`docs/spec/SPEC-DATA.md`（接口盘点与缺口）
**判据原则**：每条验收必须能"跑一条命令看输出"，不允许"看起来好了"。

---

## 0. 已完成基线（2026-09-21）

| 阶段 | 内容 | 证据 |
|---|---|---|
| 0 收口 | 24 页迁入 `frontend-v2/` 入库；`server.js` 与 `server-design-v2.js` 改指新树；两服务已重启 | commit `7edc3bb`；`/v2` 与 `:8090` 均 200，线上 `hero.html` md5 与本地一致 |
| 1 薄 spec | `SPEC-ROUTES.md` + `SPEC-DATA.md` | 页面总表、接口对照、DoD、5 个缺口（G1 已关闭） |
| 2 切片 | `photo-solve.html` 拍照→解析→存错题本 | `tests/frontend/photo-solve-states.test.mjs` 28 项通过 |
| 3 横向（部分） | `wrong-book.html` 列表+筛选+分页+标记复习/删除 | `tests/frontend/wrong-book-states.test.mjs` 44 项通过 |
| 工程 | 共享层 `ui.js`（六态机）+ `api.js`（数据层）+ `app.css`（token）；`npm run test:frontend` | eslint 0 error；4 套测试全绿 |

**三件套**（横向复制的核心资产，新页一律复用，不得重写）：

```
frontend-v2/assets/js/ui.js       createStateMachine / mapError / el
frontend-v2/assets/js/api.js      request / 各端点方法 / 401·403·network 分类
frontend-v2/assets/css/app.css    clay token + .card .state .q-card .btn .tag …
```

---

## 1. 决策点（阻塞项，必须先有答案）

### 已拍板（2026-09-21）

| # | 决策 | 采纳值 | 直接后果 |
|---|---|---|---|
| **Q1** | 移动端 | **一套响应式** | 每页必须同时过桌面与移动断点；移动不再单独维护 PWA 页面；`public/sw.js` 的 allow-list 在旧树下线时同步收窄 |
| **Q2** | 后端接口 | **缺口即补，允许新开** | SPEC-DATA 的缺口从"登记"升级为"后端待办"；新增接口必须同时过 BCT 契约测试与门禁 |
| **Q3** | 下线窗口 | **立刻切默认，旧树只留回滚** | 见下方 §1.1 —— 采用"新树优先 + 旧树兜底"，不是一刀切 |

### 1.1 Q3 的落地方式（已实施 2026-09-21）

**机制**（`server.js` 的 `NEW-TREE` 区块）：

- **新树优先**：`NEW_TREE_PAGES` 列表内的页面由根路径 canonical URL 接管
  （`/login.html`、`/login`），旧树同名页被**优先遮蔽** —— 同一路径只有一个版本
- **旧树兜底**：列表外的路径（`/f3/*`、legacy、PWA `/`、`/hero.html` 等）继续由旧树服务，
  因此不会出现"切了之后功能页消失"
- **资源零碰撞**：新树资源走独立命名空间 `/assets/v2/`。**不能**直接挂 `/assets`
  —— 实测 legacy 的 `frontend/assets/js/auth-nav.js` 与新树同名，前置会静默改掉旧页行为
- **一键回滚**：`NEW_TREE=off` → 全部路径回旧树（新页仍可经 `/v2/` 访问）；
  `NEW_TREE_PAGES=a.html,b.html` → 缩小接管射程。均改环境变量 + 重启，不动代码

**为什么不硬切 `/`**：`/` 现在分别服务 F3（桌面）与 PWA（移动）的**真实应用**，
新树目前只有 6 个重建页；硬切会让用户丢掉 dashboard/练习/作文等页面。
硬切须待批次 1-3 完成，且需同步更新门禁与本节。

**验证证据**（2026-09-21 实测）：

| 检查 | 结果 |
|---|---|
| 6 页根路径接管 | 全部 200，且 md5 == `frontend-v2/<page>`（证明不是旧树同名页） |
| canonical 无扩展名 | `/login`、`/mastery` → 200 |
| 资源命名空间 | `/assets/v2/css/app.css`、`/assets/v2/js/ui.js` → 200 |
| 旧树兜底 | `/f3/pages/index.html` 200；`/` 桌面 = F3 index、移动 = PWA index（md5 一致） |
| `/v2` 仍可用 | `/v2/login.html`、`/v2/mastery.html` → 200 |
| **回滚** | 临时实例 `NEW_TREE=off` 下 `/login.html` 的 md5 == `frontend/login.html`（旧树页） |
| 门禁 | 新增 `scripts/check-new-tree-routing.mjs` 接入 6/7；受控实验（把未接管页塞进列表）能被报出 |

---

## 2. 页面批次（按依赖排序，不是按数量排序）

### 批次 1 · 打通登录闭环（auth 态现在没有落点）

| 页 | 依赖接口 | 状态集 |
|---|---|---|
| `login.html` | `POST /api/auth/login`、`POST /api/auth/register`、`POST /api/guest-login` | 表单 / 加载中 / 失败 / 离线 / 成功跳转 |
| `register.html` | `POST /api/auth/register`、`GET /api/provinces` | 同上 |

**为什么先做**：photo-solve 与 wrong-book 的 `auth` 态都链到 `login.html?next=...`，现在是一个不存在的页面。

### 批次 2 · 关闭学习回路

| 页 | 依赖接口 |
|---|---|
| `review-session.html` | `/api/srs/engine/queue`、`/daily-tasks`、`POST /complete`、`POST /review`、`GET /stats` |
| `mastery.html` | `/api/knowledge/mastery`、`/map`、`/:kpId/practice` |

### 批次 3 · 主路径补齐

| 页 | 依赖接口 |
|---|---|
| `dashboard.html`（含 301 收编 `index.html`） | `/api/user/dashboard`、`/api/today/`、`/api/gamification/*` |
| `practice-hub.html` | `/api/exam/session/start`、`/questions`、`/session/submit` |
| `essay.html` | `/api/essay/grade`、`/api/essay/upload` |
| `learning-path.html` | `/api/learning-path/current`、`/api/analytics/learning-path` |

### 批次 4 · 增量页与模板化

| 页 | 说明 |
|---|---|
| `onboarding` `notifications` `settings` `state-library` `vision-result` `subject-picker` `subject-detail` `knowledge-star` `predictive-paper` `learning-journey` | v2 独有，逐个接接口（见 SPEC-ROUTES §1.2） |
| `subject-exam` **模板**（1 份承载 6 学科） | 取代 F3 的 `math/physics/chemistry/chinese/english/politics-exam` + `-report` 共 12 页 |

### 批次 5 · 收编与下线

| 动作 | 说明 |
|---|---|
| `pwa-photo.html` `vision-result.html` | 被 `photo-solve.html` 取代后删除或 301 |
| 旧树 301 | 桌面 `/index.html` → `/f3/pages/index.html` → 最终指向新树；legacy 按白名单 301 |
| 删树 | `frontend/`、`ai-tutor-frontend/`、`public/` 的页面在切换完成后移除；`public/sw.js` 的 allow-list 相应收窄 |

---

## 3. 单页任务卡（每页照抄执行）

以 `X.html` 为例，命令在工作区根目录执行。

### 3.1 生成骨架

```bash
cp frontend-v2/wrong-book.html frontend-v2/X.html          # 复制六态骨架与共享层引用
cp tests/frontend/wrong-book-states.test.mjs tests/frontend/X-states.test.mjs
# 修改 X.html：标题、lede、筛选项 → 本页的差异部分
# 修改 X-states.test.mjs：把 WB 换成 X 的全局对象名，按本页接口补用例
```

### 3.2 接数据层

在 `frontend-v2/assets/js/api.js` 追加本页需要的端点方法（**不要**在页面里直接 `fetch`）：

```js
/** 说明：动词 + 路径 */
xxxList: function (query, signal) { return request('/api/xxx' + qs(query), { signal: signal }); },
```

### 3.3 写页面逻辑

新建 `frontend-v2/assets/js/X.js`，结构照抄 `wrong-book.js`：

```
STATES 常量 → setState/renderState → render 函数 → 取数函数（失败走 AIUI.mapError）
→ boot() 里 createStateMachine + 事件绑定 → global.X = { STATES, load, setState, getState }
```

### 3.4 验收（四条命令必须全绿）

```bash
# 1) 本页状态机与错误分类
node tests/frontend/X-states.test.mjs

# 2) 全量前端回归（防止改坏共享层）
npm run test:frontend

# 3) lint（新树 JS 必须 0 error）
npx eslint frontend-v2/assets/js/*.js

# 4) 上线冒烟（/v2 即 frontend-v2/）
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 (X11; Linux x86_64)" \
  http://localhost:3002/v2/X.html                       # 期望 200
```

### 3.5 出口判据（DoD，逐条打勾，缺一不可）

- [ ] 六态齐备且互斥：`成功 / 加载 / 空 / 错误 / 未登录(401·403) / 离线`
- [ ] 零境外请求：`grep -c "googleapis\|jsdelivr\|unpkg" X.html assets/js/X.js` 均为 0
- [ ] 无内联 `<style>`：样式全部来自 `assets/css/app.css`
- [ ] a11y：输入有 `label`；状态区 `aria-live="polite"`；图标不用 emoji；`prefers-reduced-motion` 有降级
- [ ] 接口走 `api.js`，错误分类走 `AIUI.mapError`
- [ ] 有对应的 `tests/frontend/X-states.test.mjs` 并通过

---

## 4. 自动化钩子（现状与目标）

| 钩子 | 现状 | 目标 |
|---|---|---|
| `npm run test:frontend` | ✅ 已有（4 套） | 每加一页追加一行 |
| `scripts/check-no-hardcoded-secrets.mjs` | ✅ 已接入 `release-gate.sh` 第 6 节 | 保持 |
| 前端测试接入 `npm run gate` | ❌ 未接 | **建议接**：在 gate 第 2 节后加 `npm run test:frontend` |
| 线上一致性比对脚本（288 文件 md5） | ❌ 还在 `/tmp/fe-audit/live-diff.mjs`，重启即丢 | **建议收进 `scripts/audit/`** 并按需跑 |

---

## 5. 明确不做的事

1. **不重写后端**：`api/modules/` 16 模块 142 handler 是资产，前端是消耗品
2. **不照 F3 的 40 页清单补页**：30 个缺口里 12 个是"6 学科 × (exam+report)"，用 1 个模板承载；`index.html` 与 `dashboard.html` 字节相同（md5 `7d8ffd655802`），合并
3. **不在页面里写 fetch / 内联样式 / 引 CDN**：这三犯一次，后面每页都会跟着犯
4. **不在 Q1 定案前做响应式**：断点会返工
5. **不删除旧树**：未完成灰度切换与回滚验证前，旧树是回滚开关

---

## 6. 进度表（机器可查）

| 批次 | 页面 | 状态 |
|---|---|---|
| 基线 | photo-solve、wrong-book | ✅ |
| 1 | login、register | ✅ 2026-09-21（36 + 35 项验收） |
| 基线 | 响应式（Q1）：四档断点 + SPEC-UI 草稿 | ✅ 2026-09-21（16 项验收；渲染层未验证） |
| 2 | review-session | ✅ 2026-09-21（50 项验收，接 SRS queue/review/stats） |
| 2 | mastery | ✅ 2026-09-21（51 项验收，接 knowledge/mastery；G6 标度问题先行修复） |
| 3 | dashboard、practice-hub、essay、learning-path | ⬜ |
| 4 | 10 个增量页 + subject-exam 模板 | ⬜ |
| 5 | 收编 + 旧树下线 | ⬜ |
