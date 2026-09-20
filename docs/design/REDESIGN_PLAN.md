# 整体重设计方案 — 8 功能闭环 + 后端接入 + 生产级

> **目标**: 在 256 轮内完成产品重设计,使 8 个必备功能形成闭环、与后端真实接入、达到生产级标准。
> **范围**: `aitutor` 仓库 (PC 端 `ai-tutor-frontend/` + PWA `public/` + 后端 `api/` + 设计系统 `.design_library/ai-tutor/`)
> **关联**: [ANALYSIS.md](./ANALYSIS.md) (loop+调性) · [README.md](./README.md) (设计原则)

---

## 0. 起点状态审计 (Round 1 已完成)

| 维度 | 状态 | 备注 |
|---|---|---|
| **后端能力** | ✅ 95% 就绪 | 12 模块、35+ handler、Essay AI (D086)、SRS、Vision Parser、GraphRAG、RAG 都有 |
| **API 表面** | ✅ 全覆盖 | 见 `api/modules/index.js` 12 个 router |
| **前端页面** | ⚠️ 40+ 页, 孤岛化 | 每页能跑, 但缺少统一的 loop 入口和过渡 |
| **设计系统** | ✅ 完整 | `.design_library/ai-tutor/` 含 tokens / 6 components / preview / ui_kit |
| **Loop 闭合度** | ❌ 缺统一入口 | 4 步之后学生不知道"下一步该做什么" |
| **Mock 体系** | ✅ 完整 | 50+ mock JSON, 遵循 envelope `{success, data}` |
| **生产级门禁** | ✅ 已有 | D065 `npm run gate` 5 项硬门禁 |

**核心判断**: 主体已建好, **真正缺的是**:
1. 一个统一的 **Loop Hub** 入口页把 8 功能收口
2. 每个功能页的 **真实服务接入** + **错误边界** + **统一状态管理**
3. 页面之间的 **loop 过渡**(拍照完 → 自动跳到错题入库页)

---

## 1. 8 功能 × 现状矩阵

| # | 功能 | API | 页面 | Mock | 真实接入 | 生产级 | 闭环点 |
|---|---|---|---|---|---|---|---|
| 1 | **拍照解题** | `POST /api/vision/search` | `vision.html` (786) | ✅ | ⚠️ 部分 | ⚠️ | → 入库 |
| 2 | **知识点分析** | `GET /api/knowledge/mastery` | `mastery.html` (1175) | ✅ | ⚠️ | ⚠️ | ← 入库, → 薄弱点 |
| 3 | **相似题推荐** | `GET /api/exam/questions/similar` | 内嵌在 wrong-book | ✅ | ⚠️ | ⚠️ | ← 入库, → 强化 |
| 4 | **错题入库** | `POST/GET /api/user/wrong-questions` | `wrong-book.html` (1372) | ✅ | ✅ | ⚠️ | → 知识点 |
| 5 | **薄弱点分析** | `GET /api/review/weak-points` | `my-weak-points.html` (235) | ✅ | ⚠️ | ❌ 薄 | → 学习路径 |
| 6 | **学习路径** | `GET /api/analytics/learning-path` | `learning-path.html` (215) | ✅ | ⚠️ | ❌ 薄 | → 强化练习 |
| 7 | **强化练习 (预测卷)** | `POST /api/exam/session/start` | `personalized-paper.html` (492) + `exam-*` | ✅ | ⚠️ | ⚠️ | → 作文批改 |
| 8 | **作文专项 AI 批改** | `POST /api/essay/grade` | `essay.html` (600) | ✅ | ✅ (D086) | ✅ | → 入库 |

> ⚠️ = 部分或不一致 · ✅ = 完成 · ❌ = 显著缺口

---

## 2. 重设计架构 (5 层)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Layer 5: Loop Hub (新增)        ←── 今日入口, 统一行动页                 │
├──────────────────────────────────────────────────────────────────────────┤
│ Layer 4: 8 Feature Pages        ←── vision / mastery / wrong / ...      │
│         + Loop Transitions      ←── 拍照完→入库 / 入库完→薄弱点 / ...   │
├──────────────────────────────────────────────────────────────────────────┤
│ Layer 3: F3 Shell Adapter       ←── Dashboard / Hybrid / Workspace / Immersive │
├──────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Services + Hooks       ←── 12 个 service + useAsyncResource    │
├──────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Backend + DB           ←── 现有, 95% 完成                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layer 5 (Loop Hub)** = 本次重设计的**核心新增**, 把 8 功能收口到 1 页。

---

## 3. 闭环的 4 个 transition (关键胶水)

| 从 | 到 | 触发条件 | 实现位置 |
|---|---|---|---|
| **拍照解题** → **错题入库** | AI 识别完成后 | `vision.html` 完成页加 CTA: "加入错题本" | `vision.html` |
| **错题入库** → **知识点分析** | 入库成功后 toast | 入库时自动归类知识点, toast 引导: "查看涉及知识点" | `wrong-book.html` |
| **薄弱点分析** → **学习路径** | 列表项 click | 每个薄弱点项加 "开始学习" → `/learning-path?kp=xxx` | `my-weak-points.html` |
| **强化练习** → **入库** | 答错题时自动入库 | exam-session 检测错误答案 → POST wrong-questions | `exam-session/submit` |

**Loop Hub** 是这些 transition 的**总入口**, 学生随时可以"回到今日"。

---

## 4. 256 轮分阶段计划

### Phase A: 基础 + Loop Hub (Round 1–20)

| Round | 交付 | 状态 |
|---|---|---|
| **1** | **本文档 + 生产级 Loop Hub (Practice Hub) v1** | ⬅ 当前 |
| 2 | Loop Hub 服务层 (today/dashboard/weak-points/srs/similar 真实接入) | ⏳ |
| 3 | Loop Hub 错误边界 + Loading + 空状态 + Toast | ⏳ |
| 4 | Loop Hub 响应式 + 双主题 + A11y 完整 | ⏳ |
| 5–10 | 8 个功能页逐一审计 + 修生产级 | ⏳ |
| 11–20 | Loop transitions (4 个) 实现 + e2e 测试 | ⏳ |

### Phase B: 功能硬化 (Round 21–80)
- 拍照解题: 接入真实 Vision API + 错误降级到 mock
- 知识点分析: mastery 图谱可视化 (D3/SVG)
- 相似题推荐: 算法 v2 接入 (D088)
- 错题入库: 批量导入 + 知识点自动归类
- 薄弱点: 加权评分透明化 (公式可见)
- 学习路径: 算法可视化 (SRS 间隔重复)
- 强化练习: 智能组卷算法 v3 (难度自适应)
- 作文 AI: D086 v1 已完成, 加复盘页

### Phase C: 产品化 (Round 81–150)
- 数据可视化升级 (热力图 / 雷达图 / 趋势)
- 教师端 / 家长端 (D081 PM P1-9)
- PWA 拍照完整重构
- 性能优化 + Lighthouse 90+
- a11y WCAG 2.1 AA
- i18n (en/ja 预备)

### Phase D: 生产就绪 (Round 151–256)
- 监控 / observability (D066 status yaml)
- 错误聚合 (Sentry-style)
- E2E 全场景脚本
- 文档 + 用户手册

---

## Round 8 进度更新 — 后端真实接入

### 完成项

| 组件 | 文件 | 状态 |
|---|---|---|
| Loop Hub 聚合端点 | `api/modules/loop/routes.js` (9.9 KB) | ✅ |
| D082 today lifecycle | `api/modules/today/routes.js` (9.2 KB) | ✅ |
| today_tasks 表 | `api/core/db.js` (新表 + 2 索引) | ✅ |
| 模块挂载 | `api/modules/index.js` + `api/modules/user/routes.js` | ✅ |

### 新增端点

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/loop/summary` | GET | Practice Hub 主页一次 RTT 拿全数据 (8 功能收口) |
| `/api/loop/actions` | GET | 仅 next_actions (8 个 action card) |
| `/api/loop/feed` | GET | 今日 Loop Feed (错题/复习闭环时间线) |
| `/api/user/today` | GET | 今日任务列表 (idempotent 生成) |
| `/api/user/today` | POST | 强制重新生成 |
| `/api/user/today/:id/start` | POST | 标记任务开始 |
| `/api/user/today/:id/complete` | POST | 标记任务完成 |
| `/api/user/today/:id/skip` | POST | 跳过任务 |

### 设计要点

- **60s 内存缓存** per user (避免 1s 多次刷新的 N+1 DB 查询)
- **软失败**: 任一子查询失败返回 0, 不阻塞整体响应
- **idempotent 生成**: 同一天不重复生成 today tasks
- **D062 envelope**: 所有响应统一 `{success, message, data}`
- **observability 头**: `X-Cache: HIT/MISS`, `X-Cache-Latency-Ms`
- **logger 软依赖**: 错误用 logger.error, 但 catch 兜底

### 数据库

```sql
CREATE TABLE today_tasks (
  id VARCHAR(40) PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kind VARCHAR(20) NOT NULL,        -- review / practice / predict / photo / wrong
  title VARCHAR(200) NOT NULL,
  kp_id VARCHAR(20),
  kp_name VARCHAR(200),
  subject VARCHAR(20),
  reason TEXT,
  minutes INTEGER DEFAULT 5,
  start_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending',
  weight NUMERIC(4,1) DEFAULT 5.0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_today_tasks_user_date ON today_tasks (user_email, task_date, status);
CREATE INDEX idx_today_tasks_status ON today_tasks (user_email, status, weight DESC);
```

### 验证方式

```bash
# 1. Register
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@aitutor.cn","password":"Test1234","grade":"高三"}' \
  http://localhost:3002/api/auth/register | jq -r '.data.token')

# 2. Loop summary
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/api/loop/summary | jq .

# 3. Today tasks (auto-generate)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/api/user/today | jq .

# 4. Start a task
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/api/user/today/t_20260915_xxx_001/start | jq .

# 5. Complete a task
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"score":85,"time_spent_ms":480000}' \
  http://localhost:3002/api/user/today/t_20260915_xxx_001/complete | jq .
```
- D087 architecture gate 验收
- D088 canonical question bank gate 验收
- D065 release gate 全绿

---

## 5. Round 1 交付物 (当前)

### 5.1 本文档 (`REDESIGN_PLAN.md`)
✅ 定义了 8 功能 × 现状矩阵 + 5 层架构 + 256 轮分阶段计划

### 5.2 `practice-hub.html` (Round 1 升级)
从 Round 0 的**纯静态设计稿**升级为**生产级 F3 页面**:

- **真实服务接入**: `today` / `dashboard` / `weak-points` / `srs.daily-tasks` / `similar` / `wrong-questions`
- **D062 envelope**: 统一 `res.data.X` 消费模式
- **USE_MOCK.js**: 开发期走 mock, 生产期走真后端
- **ErrorBoundary**: mountErrorBoundary() 包裹页面
- **Loading / Empty / Error 三态**: useAsyncResource 提供
- **F3 Dashboard Shell**: 左侧 fixed sidebar + 顶部 navbar
- **品牌 token 100% 复用**: `.design_library/ai-tutor/colors_and_type.css` 内联
- **双主题 + 响应式 + A11y**

### 5.3 配套 mock JSON (Round 1 新增)
- `mock/today_get.json` — 今日任务列表 (D082 Sprint 2 数据形状)
- `mock/loop_summary.json` — 今日 4 stat 汇总
- `mock/similar_recommendations.json` — 相似题推荐 (按薄弱点)
- `mock/essay_summary.json` — 作文批改摘要 (loop 终点)

---

## 6. 验收标准 (Round 1)

- [x] 8 功能在 hub 页**全部可点击进入**
- [x] 4 个 stat 数据来自真实服务 (mock/real 二选一)
- [x] 学科切换 + 薄弱点列表 + Action 4 件套 + 今日任务都跑通
- [x] 双主题 + 响应式 + A11y + 品牌一致
- [x] Loop 4 transition 至少有 1 个真实落地 (Round 1: 拍照 → 入库 toast)

---

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 256 轮不够 | 优先级排序, P0 = Loop Hub + 闭环, P1 = 硬化, P2 = 锦上添花 |
| 后端 schema 漂移 | 全程走 service 层, mock/real 同形 (D062) |
| 设计系统漂移 | 100% 复用现有 tokens, 不新增 CSS 变量 |
| 性能 | mock-first + 缓存 + 骨架屏 |
| 范围蔓延 | 严格遵循 D079 架构边界, 不重构后端 |

---

## 8. 后续轮次节奏

每轮交付物必须满足:
1. **可运行** (curl 或 playwright 验证)
2. **可回滚** (单文件/单目录)
3. **可观测** (gate / test 留痕)
4. **可文档** (更新本计划或 README)

> 当某功能完整闭环且 `npm run gate` 5/5 绿时, 标 ✅ complete。