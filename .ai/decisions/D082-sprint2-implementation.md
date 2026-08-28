# D082 — Sprint 2 Implementation ADR (Today v1)

> **类型**: Implementation ADR (执行冻结, 待启动指令)
> **触发**: D081 v3 APPROVED — 用户审查通过 + 3 项 implementation clarification 已落地
> **状态**: ⏸️ **APPROVED FOR IMPLEMENTATION** — 等启动指令
> **配合**: D078 (战略冻结) + D079 (架构边界) + D080 (R-AGE) + D081 v3 (产品设计)
> **目标**: 实现 D081 v3 5 个 DoD, **不扩大 scope**

---

## 0. 实施目标

实现 D081 v3 Sprint 2 的 **5 个 DoD**:
1. 登录后 30 秒内可见 Today 入口
2. 首次访问 Today: deterministic + atomic idempotent 生成 1-3 个任务
3. 任务含 `kp / reason / minutes / start_url`, **点击开始后记录 started_at**
4. 完成真实学习活动后: feedback → mastery → SRS 真实变化
5. 回到 Today: 状态保留, 当天不重新生成

**D081 v3 三阶段生命周期**:
```
GENERATED (generated_at)
    │ [开始] POST /today/:id/start
    ▼
STARTED (started_at, status=pending)
    │ 真实学习 POST /loop/feedback
    ▼
COMPLETED (completed_at, status=completed)
```

---

## 1. 现状扫描 (基于真实代码)

### 1.1 后端 — 已存在的端点 (Sprint 1 / 既有)

| 端点 | 用途 | D081 复用? |
|------|------|----------|
| `GET /api/srs/engine/daily-tasks` | SRS 过期复习列表 (含 mastery_score + days_overdue) | ✅ data source for "review" kind |
| `GET /api/user/dashboard` | dashboard 聚合数据 | ✅ |
| `POST /api/tutor/loop/feedback` | 答题反馈 → mastery + srs_review_log | ✅ DoD 4 + 需扩 today_task_id (D081 §7.5) |
| `POST /api/srs/engine/complete` | SRS 复习完成 | ⚠️ 暂不用 (用 /loop/feedback) |

### 1.2 后端 — **需要新建**

| 端点 | 来源 |
|------|------|
| `GET /api/user/today` | D081 §7.1 (无) |
| `POST /api/user/today/:task_id/start` | D081 §7.2 (无) |
| `POST /api/user/today/:task_id/complete` | D081 §7.3 (无) |
| `POST /api/user/today/:task_id/skip` | D081 §7.4 (无) |

**挂载位置**: `api/modules/user/routes.js` (user 模块已挂载在 `/api/user/` via `api/modules/index.js`)

### 1.3 前端 — 已存在 (Sprint 1)

| 文件 | 状态 | D081 复用? |
|------|------|----------|
| `ai-tutor-frontend/assets/js/api/services/srs.js` | ✅ 完整 | ✅ SRS review 数据来源 |
| `ai-tutor-frontend/assets/js/api/services/learning-loop.js` | ✅ 完整 (Sprint 1) | ✅ DoD 4 路径, **需扩 today_task_id 字段透传** |
| `ai-tutor-frontend/assets/js/api/client.js` | ✅ D062 envelope | ✅ |
| `ai-tutor-frontend/assets/js/api/mock/` | ✅ mock 模式 | ✅ 需要新增 today_*.json |

### 1.4 前端 — **需要新建/改动**

| 文件 | 操作 |
|------|------|
| `ai-tutor-frontend/assets/js/api/services/today.js` | **新建** (D081 §7) |
| `ai-tutor-frontend/assets/js/api/services/index.js` | **+1 行** (export today) |
| `ai-tutor-frontend/assets/js/api/mock/today_get.json` | **新建** mock |
| `ai-tutor-frontend/assets/js/api/mock/today_start.json` | **新建** mock |
| `ai-tutor-frontend/assets/js/api/mock/today_complete.json` | **新建** mock |
| `ai-tutor-frontend/assets/js/api/mock/today_skip.json` | **新建** mock |
| `ai-tutor-frontend/pages/dashboard.html` | **+1 段** (Today widget, 默认展开, 顶部第一视觉层) |
| `ai-tutor-frontend/pages/index.html` | **+1 段** (已登录用户今日入口) |
| `ai-tutor-frontend/pages/today.html` | **新建** (任务中心) |

### 1.5 数据库 — **需要新建**

| 表 | 来源 |
|----|------|
| `today_task_log` | D081 §4 schema |

### 1.6 learning-loop 改动 (D081 §7.5 扩展)

`api/routes/learning-loop.js` 的 `processSingleFeedbackSql` 函数:
- **+1 行解构**: `const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested, today_task_id } = feedback;`
- **+6 行 UPDATE**: `if (today_task_id) { UPDATE today_task_log SET status='completed' ... }`
- **Sprint 1 兼容性**: `today_task_id` 是 optional, Sprint 1 调用无影响

---

## 2. 最小实现方案

### 2.1 数据流 (与 D081 §3 一致)

```
1. 用户登录 → 跳 dashboard
2. dashboard.html 加载 → 调 today.getToday()
3. GET /api/user/today:
   - SELECT today_task_log WHERE user_email + task_date=todayShanghai
   - 有 → 返回 (含 completed/pending/skipped)
   - 无 → generate → INSERT ON CONFLICT DO NOTHING → 重新 SELECT → 返回
4. dashboard.html 渲染 Today widget (默认展开, 顶部)
5. 用户点 [开始]:
   - POST /today/:id/start → UPDATE started_at
   - 跳转到 start_url (review/wrong-book/tutor)
6. 真实学习页面答题:
   - POST /loop/feedback { today_task_id, knowledge_point_id, is_correct, ... }
   - 后端同事务: 写 mastery + srs_review_log + UPDATE today_task_log.status='completed'
7. 用户回到 dashboard / today.html:
   - GET /today → 看到 status=completed (任务不再 pending)
```

### 2.2 atomic idempotent 实现 (D081 §3.1 v3 强化)

```js
async function getOrGenerateToday(userEmail, todayDate) {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. SELECT existing
    const existing = await client.query(
      `SELECT * FROM today_task_log
       WHERE user_email=$1 AND task_date=$2
       ORDER BY generated_at ASC`,
      [userEmail, todayDate]
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return existing.rows;
    }

    // 2. Generate 3 candidates
    const candidates = await generateTodayTasks(client, userEmail, todayDate);

    // 3. INSERT ON CONFLICT DO NOTHING (atomic)
    for (const c of candidates) {
      await client.query(
        `INSERT INTO today_task_log
          (user_email, task_date, knowledge_point_id, kind, status, reason, estimated_minutes, start_url)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
         ON CONFLICT (user_email, task_date, knowledge_point_id, kind) DO NOTHING`,
        [userEmail, todayDate, c.knowledge_point_id, c.kind, c.reason, c.estimated_minutes, c.start_url]
      );
    }

    // 4. 重新 SELECT (拿到所有行, 含并发 winner)
    const final = await client.query(
      `SELECT * FROM today_task_log
       WHERE user_email=$1 AND task_date=$2
       ORDER BY generated_at ASC`,
      [userEmail, todayDate]
    );

    await client.query('COMMIT');
    return final.rows;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

### 2.3 推荐规则 (复用 srs-engine + mastery, 无新依赖)

```js
async function generateTodayTasks(client, userEmail, todayDate) {
  const tasks = [];

  // 1. SRS 过期复习 (复用 srs-engine 的逻辑简化版 — 直接查表)
  // D081 v3 排序: priority DESC, next_review_at ASC NULLS LAST, kp.id ASC
  const srsRows = await client.query(`
    SELECT kp.id AS knowledge_point_id,
           'review' AS kind,
           '已过期 ' || COALESCE(skl.days_overdue, 0) || ' 天' AS reason,
           8 AS estimated_minutes,
           '/f3/pages/review.html?kp=' || kp.id AS start_url
    FROM srs_review_log skl
    JOIN knowledge_points kp ON kp.id = skl.knowledge_point_id
    WHERE skl.user_email = $1
      AND skl.next_review_at <= $2::date + INTERVAL '1 day'
      AND skl.id IN (
        SELECT MAX(id) FROM srs_review_log
        WHERE user_email = $1 GROUP BY knowledge_point_id
      )
    ORDER BY skl.next_review_at ASC NULLS LAST, kp.id ASC
    LIMIT 3
  `, [userEmail, todayDate]);

  // 简化: 如果上面查不出, 用 srs-engine daily-tasks 的逻辑 (但 GET /api/srs/engine/daily-tasks 已经存在)
  // —— 这里直接复用: 取 srs_engine_daily_tasks_for_user 的结果
  // (实际实现可调 srs-engine 的查询函数, 避免重复逻辑)

  tasks.push(...srsRows.rows);

  // 2. 薄弱点强化 (mastery < 0.5)
  if (tasks.length < 3) {
    const weakRows = await client.query(`
      SELECT kp.id AS knowledge_point_id,
             'practice' AS kind,
             '掌握度 ' || ROUND(skm.mastery_score * 100) || '%, 需要练习' AS reason,
             10 AS estimated_minutes,
             '/f3/pages/wrong-book.html?kp=' || kp.id AS start_url
      FROM student_knowledge_mastery skm
      JOIN knowledge_points kp ON kp.id = skm.knowledge_point_id
      WHERE skm.user_email = $1
        AND skm.mastery_score < 0.5
      ORDER BY skm.mastery_score ASC NULLS FIRST, skm.last_practice_at ASC NULLS FIRST, kp.id ASC
      LIMIT $2
    `, [userEmail, 3 - tasks.length]);
    tasks.push(...weakRows.rows);
  }

  // 3. 兜底: 新单元
  if (tasks.length === 0) {
    const exploreRow = await client.query(`
      SELECT kp.id AS knowledge_point_id,
             'explore' AS kind,
             '新单元, 开始学习' AS reason,
             12 AS estimated_minutes,
             '/f3/pages/tutor.html?kp=' || kp.id AS start_url
      FROM knowledge_points kp
      WHERE kp.id NOT IN (
        SELECT knowledge_point_id FROM student_knowledge_mastery WHERE user_email = $1
      )
      AND kp.level = 'gaokao'
      ORDER BY kp.id ASC
      LIMIT 1
    `, [userEmail]);
    tasks.push(...exploreRow.rows);
  }

  return tasks.slice(0, 3);
}
```

**注**: SRS 部分的查询可以**直接调** srs-engine 的内部函数 (`srsEngine.dailyTasksForUser`) 或复制它的 SQL。D081 §6 的 pseudocode 提到 `srs_engine_daily_tasks_for_user` — 这是 srs-engine 暴露的查询函数, **可复用不重复实现**。

### 2.4 时区 helper (D081 §5 + v3 强化)

```js
// 唯一权威
function todayDateShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
```

**调用规则**:
- GET /today handler 第一行: `const today = todayDateShanghai();`
- INSERT / SELECT 全部用 `$2 = today` 参数化
- **禁止** `WHERE task_date = CURRENT_DATE`
- 验收脚本: `TODAY_SH=$(TZ=Asia/Shanghai date +%Y-%m-%d)`

---

## 3. 精确文件变更清单

### 3.1 后端 — 新建/改动

| # | 文件 | 操作 | 行数预估 | 依赖 |
|---|------|------|---------|------|
| B1 | `api/routes/today.js` | **新建** (handler: GET / POST :id/start / :id/complete / :id/skip) | ~180 | D081 §7 + todayDateShanghai + generateTodayTasks |
| B2 | `api/modules/user/routes.js` | **+4 行** (import + mount router.use('/today', todayRouter)) | ~4 | B1 |
| B3 | `api/routes/learning-loop.js` | **+7 行** (解构 today_task_id + UPDATE today_task_log) | ~7 | D081 §7.5, table schema |
| B4 | `api/core/db.js` | **+12 行** (CREATE TABLE today_task_log) | ~12 | D081 §4 |

### 3.2 前端 service — 新建

| # | 文件 | 操作 | 行数预估 |
|---|------|------|---------|
| F1 | `ai-tutor-frontend/assets/js/api/services/today.js` | **新建** (4 methods: getToday / start / complete / skip) | ~60 |
| F2 | `ai-tutor-frontend/assets/js/api/services/index.js` | **+1 行** (export today) | ~1 |

### 3.3 前端 mock — 新建

| # | 文件 | 操作 | 内容 |
|---|------|------|------|
| M1 | `ai-tutor-frontend/assets/js/api/mock/today_get.json` | **新建** | { date, tasks: [...3], summary } |
| M2 | `ai-tutor-frontend/assets/js/api/mock/today_start.json` | **新建** | { task_id, started_at } |
| M3 | `ai-tutor-frontend/assets/js/api/mock/today_complete.json` | **新建** | { task_id, status, completed_at } |
| M4 | `ai-tutor-frontend/assets/js/api/mock/today_skip.json` | **新建** | { task_id, status } |

### 3.4 前端页面 — 改动/新建

| # | 文件 | 操作 | 行数预估 | 备注 |
|---|------|------|---------|------|
| P1 | `ai-tutor-frontend/pages/dashboard.html` | **+1 段** (Today widget 顶部) | ~60 | 默认展开, 不替换统计卡 |
| P2 | `ai-tutor-frontend/pages/index.html` | **+1 段** (已登录用户 today 入口) | ~15 | 仅入口跳转 |
| P3 | `ai-tutor-frontend/pages/today.html` | **新建** (任务中心) | ~200 | 复用 dashboard Hybrid Shell |

### 3.5 测试

| # | 文件 | 操作 | 行数预估 |
|---|------|------|---------|
| T1 | `tests/learning-loop-service.test.js` | **+3 cases** (today_task_id 透传) | ~25 |
| T2 | `tests/contract.test.js` | **+8 cases** (today 4 endpoints) | ~30 |
| T3 | `tests/api/today-endpoint.test.js` | **新建** (vitest) | ~80 |
| T4 | `tests/api/today-task-log.test.js` | **新建** (SQL atomic idempotent) | ~60 |

### 3.6 文件级 diff 描述 (精确)

#### B1: `api/routes/today.js` (新建)

```js
// api/routes/today.js — Sprint 2 Today endpoint (D081 v3)
// 单一职责: GET /api/user/today + POST /:task_id/{start,complete,skip}
// 复用 srs-engine + mastery + knowledge_points (无新依赖)
import express from 'express';
import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';

const router = express.Router();

// 时区 helper (D081 §5)
function todayDateShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// 推荐规则 (D081 §6)
async function generateTodayTasks(client, userEmail, todayDate) {
  const tasks = [];
  // 1. SRS 过期复习 (复用 srs-engine daily_tasks_for_user 的 SQL)
  // 2. 薄弱点强化 (mastery < 0.5)
  // 3. 兜底: 新单元
  return tasks.slice(0, 3);
}

// atomic idempotent (D081 §3.1)
async function getOrGenerateToday(userEmail, todayDate) {
  // SELECT → 有返回 / 无 generate + INSERT ON CONFLICT DO NOTHING + 重新 SELECT
}

// GET /api/user/today
router.get('/', authMiddleware, async (req, res) => {
  const today = todayDateShanghai();
  const tasks = await getOrGenerateToday(req.user.email, today);
  res.json(successResponse({
    date: today,
    tasks: tasks.map(t => ({ id: t.id, kind: t.kind, knowledge_point_id: t.knowledge_point_id, reason: t.reason, estimated_minutes: t.estimated_minutes, start_url: t.start_url, status: t.status, started_at: t.started_at, completed_at: t.completed_at })),
    summary: { total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length, pending: tasks.filter(t => t.status === 'pending').length, skipped: tasks.filter(t => t.status === 'skipped').length }
  }, '今日任务已生成'));
});

// POST /:task_id/start
router.post('/:task_id/start', authMiddleware, async (req, res) => {
  // UPDATE started_at = NOW() WHERE status='pending' AND started_at IS NULL
});

// POST /:task_id/complete (不调 feedback!)
router.post('/:task_id/complete', authMiddleware, async (req, res) => {
  // UPDATE status='completed', completed_at=NOW() WHERE status='pending'
});

// POST /:task_id/skip
router.post('/:task_id/skip', authMiddleware, async (req, res) => {
  // UPDATE status='skipped' WHERE status='pending'
});

export default router;
```

#### B2: `api/modules/user/routes.js` 改动

```diff
 import userProfileHandler from '../../handlers/user-profile.js';
 import userSubjectsHandler from '../../handlers/user-subjects.js';
+import todayRouter from '../../routes/today.js';
 ...
 router.get('/dashboard', getLearningDashboard);
+router.use('/today', todayRouter);
```

#### B3: `api/routes/learning-loop.js` 改动

```diff
 async function processSingleFeedbackSql(client, feedback) {
-  const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested } = feedback;
+  const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested, today_task_id } = feedback;
   ...
   await client.query(`INSERT INTO srs_review_log ...`, [...]);
+
+  // v3 扩展: 可选关联 today_task_log (D081 §7.5, 不破坏 Sprint 1 兼容性)
+  if (today_task_id) {
+    await client.query(
+      `UPDATE today_task_log SET status='completed', completed_at=NOW()
+       WHERE id=$1 AND user_email=$2 AND status='pending'`,
+      [today_task_id, userEmail]
+    );
+  }
   return { old_score, new_score, delta };
 }
```

#### B4: `api/core/db.js` 改动

在 `initTables` 函数末尾追加:

```sql
CREATE TABLE IF NOT EXISTS today_task_log (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  task_date DATE NOT NULL,
  knowledge_point_id VARCHAR(20) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  estimated_minutes INTEGER DEFAULT 10,
  start_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_email, task_date, knowledge_point_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_today_task_log_user_date ON today_task_log (user_email, task_date DESC);
```

#### F1: `ai-tutor-frontend/assets/js/api/services/today.js` (新建)

```js
// services/today.js — Today endpoint 包装 (Sprint 2, D081 v3)
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

#### F2: `services/index.js` 改动

```diff
+export { today } from './today.js';
```

#### M1-M4: 4 个 mock 文件 (各 ~10 行)

`today_get.json`: `{ "success": true, "data": { "date": "2026-08-28", "tasks": [...3], "summary": {...} } }`
其他 3 个: 类似结构, 字段精简

#### P1: `dashboard.html` 改动

在 line 605 (今日摘要横条 grid) **之前**插入新段:

```html
<!-- ===== D082 Sprint 2: Today Widget (默认展开, 顶部第一视觉层) ===== -->
<div id="today-widget" class="p-5 rounded-2xl bg-surface border border-border-light shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-5">
  <h3>今天先做这 3 件事</h3>
  <ul id="today-tasks"><!-- JS 渲染 --></ul>
  <div class="today-progress">0/3 完成</div>
</div>
<script type="module">
  import { today as todayApi } from '../assets/js/api/services/index.js';
  (async () => {
    const res = await todayApi.getToday();
    // 渲染 3 个任务卡 + 进度条 + start/skip 按钮
  })();
</script>
```

**不改**: 现有统计卡 / SRS widget / 雷达图 / 折线图

#### P2: `index.html` 改动

在 hero (line 92-140) **下方**插入 (仅已登录用户显示):

```html
<!-- D082 Sprint 2: Today 入口 -->
<section id="today-entry" hidden>
  <p>你有 <span id="today-count">3</span> 个推荐任务</p>
  <a href="/f3/pages/today.html">查看今日任务 →</a>
</section>
```

#### P3: `today.html` (新建)

复用 dashboard Hybrid Shell 结构:
- 顶部 progress bar (X/3)
- 3 个任务卡 (kind / kp / reason / minutes / [开始] / [跳过])
- 已完成 / 已跳过: 灰底 + ✓/✗
- 空态 (§9)

#### T1-T4: 测试 (按 D081 §10 验收脚本)

---

## 4. Sprint 2 总改动量估算

| 类别 | 新建 | 改动 | 总行 |
|------|------|------|------|
| 后端 | 1 文件 (today.js ~180) | 3 文件 (~23) | ~200 |
| 前端 service | 1 文件 (~60) | 1 文件 (~1) | ~60 |
| 前端 mock | 4 文件 (~40) | 0 | ~40 |
| 前端页面 | 1 文件 (~200) | 2 文件 (~75) | ~275 |
| 前端测试 | 2 文件 (~140) | 2 文件 (~55) | ~195 |
| **总** | **9 文件** | **8 文件** | **~770 行** |

**与 D081 v3 范围一致, 不扩大 scope.**

---

## 5. 启动条件

**等你明确指令**: "启动 Sprint 2 coding"

执行顺序:
1. B4 (db.js CREATE TABLE today_task_log) — 必须先于其他后端改动
2. B1 (api/routes/today.js 新建)
3. B2 (modules/user/routes.js mount)
4. B3 (learning-loop.js 解构 today_task_id)
5. F1 + F2 (today service + export)
6. M1-M4 (mock 文件)
7. P1 + P2 + P3 (UI 改动)
8. T1-T4 (测试)
9. 跑 contract / vitest / BCT / 5 个 DoD 验收

---

## 6. 边界确认 (严格遵守 D081 + D079 + D078)

- ✅ 不引入 LLM / Agent
- ✅ 不引入 GraphRAG 新能力
- ✅ 不改 dashboard 统计卡 / SRS widget
- ✅ 不改 tutor / wrong-book / review 主流程 (只让 feedback 可选透传 today_task_id)
- ✅ 不改 frontend/ legacy
- ✅ 不修 graphrag workspace 旧测试
- ✅ 不新增 npm 依赖
- ✅ 不改 .ai/decisions/ (除本文件)
- ✅ 不让 Hermes / DSH / AI OS 进入 aitutor (D079)

---

## 7. 启动指令格式

如果你批准启动, 请回复:

```
启动 Sprint 2 (D082):
- /api/user/today 路径: /api/user/today (vs /api/today)
- srs-engine SQL 复用方式: 直接调 srsEngine.dailyTasksForUser() / 复制 SQL
- UI dashboard 插入位置: line 605 之前 (顶部今日摘要横条之上)
- 测试策略: vitest + contract + BCT 全部跑 + 5 DoD SQL 验收
```

或者简化版:

```
启动 Sprint 2 (D082)
```

我会按 D082 §3 顺序执行, 每步完成后 git diff 等你 review。

---

## 8. ⏸️ 状态: APPROVED FOR IMPLEMENTATION, 等启动指令

**当前项目真实状态 (2026-Q4)**:

```
AI Tutor
├── Engineering Foundation    ██████████  9/10
├── Learning State / Memory   ██████████  9/10  ← Sprint 1 ✅
├── RAG / Knowledge           █████████  9/10
├── User Task Entry           ███       3/10
├── Today                      ██        2/10  ← Sprint 2 设计冻结 + 实现冻结
├── Learning Path              ██        2/10
└── Real User Validation       █         1/10
```

**Sprint 1 已交付 (DB 证据)**:
- mastery 真实变化 (3+ 行)
- srs_review_log 真实增长 (5+ 行)
- submitFeedback / submitBatch API 真跑通
- D080 解冻后 mastery 与 AGE ripple 解耦

**Sprint 2 已冻结 (D081 v3 APPROVED + D082 IMPLEMENTATION READY)**:
- 5 DoD (login 30s / deterministic atomic / 三阶段生命周期 / 真实反馈 / 当天不重生成)
- atomic idempotent (INSERT ON CONFLICT DO NOTHING)
- Shanghai 时区全链路一致 (验收 SQL 用 '2026-08-28' 而非 CURRENT_DATE)
- started_at 纳入 DoD 3 测试

**下一步等你**:

| 选项 | 含义 |
|------|------|
| "启动 Sprint 2 (D082)" | 按 §3 顺序执行 |
| "修改 D082 §X" | 改本 ADR |
| "暂停" | 回到 freeze 状态 |

---

**文档结束**
