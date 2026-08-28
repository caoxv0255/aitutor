# D081 — Sprint 2: Today v1 (v3 冻结, 待启动指令)

> **类型**: Sprint 2 设计冻结 (Scope Freeze, **APPROVED — 等待启动指令**)
> **触发**: Sprint 1 已完成 (D078 + D080), Learning Loop 真实验证通过
> **状态**: ✅ **APPROVED** — 3 个 implementation clarification 已落地, 等你/开发代理明确启动 D082 后开始 coding
> **配合**: D078 (战略冻结) + D079 (架构边界) + D080 (R-AGE 修复)
> **v1 → v2**: 修复 P0 (重新生成 + complete 伪造 feedback), 采纳 P1 (时区/排序/started_at/UI 展开/空态)
> **v2 → v3**: Review 反馈 3 点 (atomic idempotency / Shanghai 时区 / started_at 纳入 DoD 3)

---

## 0. Sprint 2 核心命题

**从 "Remember me" → "Guide me"**

Sprint 1 解决: 学生行为 → 系统持久记忆 (mastery + srs_review_log 真写入)
Sprint 2 解决: 系统 → 学生任务入口 (登录后 30 秒内知道"现在该做什么")

---

## 1. Sprint 2 5 个 DoD (5 项, 闭合, v3 修订)

| DoD | 验收 | 数据来源 |
|-----|------|---------|
| **1** | 登录后 **30 秒内可见 Today 入口** | dashboard 顶部 (默认展开) + index 入口 |
| **2** | 首次访问 Today: **deterministic 规则生成 1–3 个任务** (atomic idempotent) | `GET /api/user/today` 首次插入 today_task_log |
| **3** | 每个任务含 `knowledge_point / reason / estimated_minutes / start_url`, **点击开始后记录 `started_at`** | 任务卡片 UI + POST /:id/start |
| **4** | 完成真实学习活动后: `feedback → mastery → SRS` 真实变化 | `submitFeedback` API (Sprint 1 已证明) |
| **5** | 回到 Today: `completed / skipped / pending` 状态保留, **当天不重新生成** | today_task_log 不重写 |

**核心闭环**: Today → Do → Feedback (真实) → Mastery → Today 更新 (状态)

**三阶段生命周期** (v3 强调):
```
GENERATED (generated_at)
    │ student clicks [开始] → POST /today/:id/start
    ▼
STARTED (started_at, status 仍 pending)
    │ student 真实学习 → POST /loop/feedback
    ▼
COMPLETED (completed_at, status='completed')
```

---

## 2. 范围 (硬约束)

### 允许
- ✅ 新增 `GET /api/user/today` endpoint (deterministic + atomic idempotent)
- ✅ 新增 `POST /api/user/today/:task_id/start` (记录 started_at)
- ✅ 新增 `POST /api/user/today/:task_id/complete` (只改 status, **不直接调 feedback**)
- ✅ 新增 `POST /api/user/today/:task_id/skip` (只改 status)
- ✅ 新建表 `today_task_log`
- ✅ 复用已有 mastery + srs_review_log 表
- ✅ dashboard.html 顶部加 Today widget (默认展开, 不替换现有统计)
- ✅ index.html 已登录用户看 Today 入口 (跳转 today.html)
- ✅ 新增 today.html (任务中心)
- ✅ 5 个 DoD 验证 + 必要 mock + 必要 test

### 禁止
- ❌ LLM / Agent / Planner
- ❌ GraphRAG 新能力
- ❌ 新 RAG / 新模型
- ❌ 学习路径 state machine (Sprint 3)
- ❌ 大改 dashboard / 首页 (只加 widget + 入口)
- ❌ 新增 npm 依赖
- ❌ PWA 重构
- ❌ 改 .ai/decisions/ (除撤销 D078 / D079 / D080 / D081)
- ❌ 改 frontend/ (legacy 冻结)
- ❌ 修 graphrag workspace 等预先存在的失败测试
- ❌ 取消 D079 架构边界 (Hermes/DSH/AI OS 不进 aitutor)

---

## 3. P0 修复 (v1 → v2 关键变更)

### 3.1 P0-1: 当天任务不重新生成 + 并发原子性 (v3 强化)

**v1 bug**: `pending = 0` 时 generate_today() 再次跑 → 一天无限刷新任务。

**v2 修复**: GET /api/user/today 首次访问时插入 `today_task_log` (当天) → 后续 GET 只读。

**v3 强化 (Review 反馈)**: **不能仅依赖 UNIQUE constraint 当并发幂等**。必须用以下任一方法保证 atomic/idempotent:

#### 方案 A: INSERT ... ON CONFLICT DO NOTHING + 重新 SELECT

```sql
-- Step 1: SELECT 已有
SELECT * FROM today_task_log
WHERE user_email = $1 AND task_date = $2
ORDER BY generated_at ASC;

-- Step 2a: 如果有结果 → 直接返回

-- Step 2b: 如果无 → generate 候选任务
-- Step 3: 用 ON CONFLICT DO NOTHING 写 (同一事务)
BEGIN;
INSERT INTO today_task_log (...) VALUES (...), (...), (...)
ON CONFLICT (user_email, task_date, knowledge_point_id, kind) DO NOTHING;
COMMIT;

-- Step 4: 重新 SELECT (拿到所有行, 含并发 winner)
SELECT * FROM today_task_log
WHERE user_email = $1 AND task_date = $2
ORDER BY generated_at ASC;
```

#### 方案 B: PostgreSQL advisory lock

```js
// 在 generate 前获取 user 级 advisory lock
await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.email]);
// ... SELECT + INSERT
// COMMIT 后锁自动释放
```

**v3 要求**: 实施方案 A (更简单) 或 B。**不允许** "UNIQUE 已存在" 作为并发安全证明。

### 3.2 P0-2: complete 不伪造 feedback

**v1 bug**: `complete(task_id)` 自动调 `/tutor/loop/feedback` → 学生没答题但 mastery 上升 = **伪造学习数据**。

**v2/v3 修复**: complete 只改 status。**真实学习页面**继续调 `/api/tutor/loop/feedback`。

**关联方式**: `feedback` body 可选 `today_task_id` (optional, 不破坏 Sprint 1 兼容性), 后端成功 commit 后自动 UPDATE today_task_log.status = 'completed'。

```
Today UI (pending)
    ↓ [开始] → POST /today/:id/start → status 仍 pending, started_at = NOW()
    ↓ 进入学习页面
    ↓ 学生真实答题
POST /api/tutor/loop/feedback { today_task_id?, is_correct, ... }
    ↓ 后端同一事务内
    ├─ 写入 mastery / SRS log (Sprint 1 路径)
    └─ if today_task_id 存在 → UPDATE today_task_log SET status='completed', completed_at=NOW()
```

**v3 关键约束**: `today_task_id` 在 feedback body 是**可选**。Sprint 1 的 tutor/wrong-book/review 页面**不需要修改** feedback 调用即可继续工作。

后端实现 (D080 范围内, `processSingleFeedbackSql` 加一段):

```js
async function processSingleFeedbackSql(client, feedback) {
  const { userEmail, knowledge_point_id, is_correct, time_spent_ms, hint_requested, today_task_id } = feedback;
  // ... 现有 mastery / SRS 写入 ...

  // v3: 可选关联 today_task_log (不破坏 Sprint 1 兼容性)
  if (today_task_id) {
    await client.query(
      `UPDATE today_task_log SET status='completed', completed_at=NOW()
       WHERE id=$1 AND user_email=$2 AND status='pending'`,
      [today_task_id, userEmail]
    );
  }

  return { old_score, new_score, delta };
}
```

---

## 4. 新表 schema (v2 + v3 强化)

```sql
CREATE TABLE today_task_log (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  task_date DATE NOT NULL,                    -- Asia/Shanghai business date (NOT server CURRENT_DATE)
  knowledge_point_id VARCHAR(20) NOT NULL,
  kind VARCHAR(20) NOT NULL,                  -- 'review' | 'practice' | 'explore'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'skipped'
  reason TEXT,                                -- 推荐理由 (学生可见)
  estimated_minutes INTEGER DEFAULT 10,
  start_url TEXT,                             -- 点击进入的页面 URL
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,                    -- 学生第一次点 [开始]
  completed_at TIMESTAMPTZ,                  -- status → completed
  UNIQUE(user_email, task_date, knowledge_point_id, kind)
);

-- 时间序列索引 (Sprint 4 真人分析用)
CREATE INDEX idx_today_task_log_user_date ON today_task_log (user_email, task_date DESC);
```

**三个时间点含义** (v3 强调):
- `generated_at`: 系统推荐时间
- `started_at`: 学生点击 [开始] (决定性: 学生有没有行动) — **v3 纳入 DoD 3**
- `completed_at`: status → completed (任务闭环)

**核心教育产品指标**: `started_at - generated_at` = "学生看到推荐后多久行动"。

---

## 5. 时区 (v2 + v3 强化)

**业务日期统一使用 `Asia/Shanghai`** (学校服务器所在地)。

```js
// 后端 helper (后端唯一权威)
function todayDateShanghai() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());  // "2026-08-28"
}
```

**v3 验收硬规则**:
- ❌ 验收 SQL **不**使用 `WHERE task_date = CURRENT_DATE` (依赖 DB timezone, 不可移植)
- ✅ 验收 SQL 必须用 `WHERE task_date = '2026-08-28'` (shell 注入 Shanghai 日期)
- ✅ 应用层所有 task_date 来源 = `todayDateShanghai()`
- ✅ 不依赖 PostgreSQL session timezone 设置

后端 INSERT/SQL 强制 WHERE `task_date = $2` (`$2 = todayDateShanghai()`), 不调用 CURRENT_DATE。

---

## 6. 推荐规则 (v2 + v3 强化: deterministic 排序 + atomic 生成)

```python
# pseudocode (纯 SQL + 已有 srs-engine / mastery 表)
def generate_today(user, today):
    tasks = []

    # 1. 优先: SRS 过期复习 (强信号: 时间到了)
    # v3 排序: priority DESC, next_review_at ASC NULLS LAST, kp_id ASC
    overdue_srs = query("""
        SELECT kp.id, kp.name, kp.subject, srs.priority, srs.days_overdue, srs.interval_days
        FROM srs_engine_daily_tasks_for_user($1) srs
        JOIN knowledge_points kp ON kp.id = srs.knowledge_point_id
        ORDER BY srs.priority DESC, srs.next_review_at ASC NULLS LAST, kp.id ASC
        LIMIT 3
    """, [user.email])
    for kp in overdue_srs:
        tasks.append({
            'kind': 'review',
            'knowledge_point_id': kp.id,
            'reason': f'已过期 {kp.days_overdue} 天, 间隔 {kp.interval_days} 天',
            'estimated_minutes': 8,
            'start_url': f'/f3/pages/review.html?kp={kp.id}',
        })

    # 2. 次: 薄弱点强化 (mastery < 0.5)
    # v3 排序: mastery ASC NULLS FIRST, last_practice_at ASC NULLS FIRST, kp_id ASC
    if len(tasks) < 3:
        weak_kps = query("""
            SELECT kp.id, kp.name, kp.subject, skm.mastery_score, skm.last_practice_at
            FROM student_knowledge_mastery skm
            JOIN knowledge_points kp ON kp.id = skm.knowledge_point_id
            WHERE skm.user_email = $1 AND skm.mastery_score < 0.5
            ORDER BY skm.mastery_score ASC NULLS FIRST, skm.last_practice_at ASC NULLS FIRST, kp.id ASC
            LIMIT $2
        """, [user.email, 3 - len(tasks)])
        for kp in weak_kps:
            tasks.append({
                'kind': 'practice',
                'knowledge_point_id': kp.id,
                'reason': f'掌握度 {(kp.mastery_score*100):.0f}%, 需要练习',
                'estimated_minutes': 10,
                'start_url': f'/f3/pages/wrong-book.html?kp={kp.id}',
            })

    # 3. 兜底: 新单元推荐 (用户未接触过的 KP)
    # v3 排序: kp_id ASC
    if len(tasks) == 0:
        next_kp = query("""
            SELECT kp.id, kp.name, kp.subject
            FROM knowledge_points kp
            WHERE kp.id NOT IN (
                SELECT knowledge_point_id FROM student_knowledge_mastery WHERE user_email = $1
            )
            AND kp.level = $2  -- 默认 gaokao
            ORDER BY kp.id ASC
            LIMIT 1
        """, [user.email, user.grade_level])
        if next_kp:
            tasks.append({
                'kind': 'explore',
                'knowledge_point_id': next_kp.id,
                'reason': '新单元, 开始学习',
                'estimated_minutes': 12,
                'start_url': f'/f3/pages/tutor.html?kp={next_kp.id}',
            })

    return tasks[:3]
```

**关键不变性**:
- 同一学生 + 同一天 (Shanghai) + 同一数据 → 生成同一组任务 (deterministic)
- 测试可重现
- INSERT 用 ON CONFLICT DO NOTHING 防止并发重复 (v3)
- 学生当天不会被无限刷新

**v3 关键 SQL 细节** (不能依赖 PG 默认 NULL 排序):
- `ORDER BY ... NULLS FIRST` / `NULLS LAST` **必须显式声明**
- 决定产品规则的应是 D081, 不是 PostgreSQL 默认

---

## 7. API 设计 (v3 增强)

### 7.1 `GET /api/user/today`

**行为** (v3 原子化):
1. 计算 `today = todayDateShanghai()`
2. `BEGIN`
3. **方案 A**: SELECT existing → 如果有 → 直接返回
4. 如果无 → generate 3 candidates → `INSERT ... ON CONFLICT DO NOTHING`
5. COMMIT
6. **重新 SELECT** (拿到所有行, 含并发 winner)
7. 返回 schema 见 §3.1

**Response schema** (不变):
```json
{
  "date": "2026-08-28",
  "tasks": [...],
  "summary": { "total": 3, "completed": 1, "pending": 1, "skipped": 1 }
}
```

**幂等性**: 同一天多次 GET, 返回同一组任务 (并发也安全, 方案 A 保证)

### 7.2 `POST /api/user/today/:task_id/start` (v3 强化)

**行为**: UPDATE `started_at = NOW()` WHERE id=$1 AND user_email=$2 AND status='pending'

**幂等**: 已 started 再 start 只设一次 (检查 started_at IS NULL)

**DoD 3 必须**: 每次 [开始] 按钮调用此 endpoint, 不能跳过

### 7.3 `POST /api/user/today/:task_id/complete`

**行为**: UPDATE `status='completed', completed_at=NOW()` WHERE id=$1 AND user_email=$2 AND status='pending'

**不调 feedback** (避免 P0-2 伪造)

**何时调用**:
- 用户主动标记 "今天就到这里" (explore 任务, 看完无答题)
- 后端 `feedback` 成功后, **后端自动** UPDATE (关联方式, §3.2)

### 7.4 `POST /api/user/today/:task_id/skip`

**行为**: UPDATE `status='skipped'` WHERE id=$1 AND user_email=$2 AND status='pending'

**幂等**: 已 skipped 再 skip 报错

### 7.5 `POST /api/tutor/loop/feedback` (Sprint 1, v3 增强)

**v3 增强**: body 可选 `today_task_id` (向后兼容 Sprint 1)

后端 `processSingleFeedbackSql` 末尾 (commit 前) 加:
```js
if (feedback.today_task_id) {
  await client.query(
    `UPDATE today_task_log SET status='completed', completed_at=NOW()
     WHERE id=$1 AND user_email=$2 AND status='pending'`,
    [feedback.today_task_id, userEmail]
  );
}
```

**v3 关键约束**:
- `today_task_id` 是 optional
- Sprint 1 的 tutor / wrong-book / review 调用 feedback 不传 `today_task_id` 也正常工作
- Today 页面 / dashboard 调 feedback 时**必须**传 `today_task_id`

---

## 8. UI 改动

### 8.1 dashboard.html (Today widget)

**位置**: 顶部"今日摘要横条"**上方** (第一视觉层, 默认展开, 不折叠)

**结构**:
```html
<div id="today-widget">
  <h3>今天先做这 3 件事</h3>
  <ul id="today-tasks">
    <li data-task-id="1" data-status="pending">
      <span class="kind-badge">复习</span>
      <span class="kp-name">三角函数</span>
      <span class="reason">已过期 3 天</span>
      <span class="minutes">8 min</span>
      <a href="/f3/pages/review.html?kp=math_007&today_task_id=1" class="start-btn"
         onclick="todayApi.start(1)">开始</a>
      <button class="skip-btn" data-id="1">跳过</button>
    </li>
    ...
  </ul>
  <div class="today-progress">1/3 完成</div>
</div>
```

**点击开始**: 调 `POST /api/user/today/:task_id/start` (记录 started_at), 然后跳转到 start_url

### 8.2 today.html (新页, 任务中心)

**复用 dashboard Hybrid Shell**

**结构**:
- 顶部 progress bar (X/3 完成)
- 3 个任务卡片 (kind / kp / reason / minutes / [开始] / [跳过])
- 已完成任务: 灰底 + ✓ + completed_at
- 已跳过任务: 灰底 + ✗
- 底部空态 (§9)

### 8.3 index.html (已登录用户)

**位置**: hero 区**下方** (简短入口)

```html
<section id="today-entry" hidden>
  <p>你有 <span id="today-count">3</span> 个推荐任务</p>
  <a href="/f3/pages/today.html">查看今日任务 →</a>
</section>
```

**不做**: 首页不渲染任务列表, 只做入口跳转

---

## 9. 空态

```html
<div class="today-empty">
  <p>🎉 今天没有待完成任务</p>
  <p>你已经完成今天的学习计划</p>
  <a href="/f3/pages/wrong-book.html">[自由练习]</a>
</div>
```

**触发条件**: `tasks[].length === 0`

---

## 10. 验收 (v3 强化验收脚本)

```bash
# ===== 时区准备 (shell 算 Shanghai 日期) =====
TODAY_SH=$(TZ=Asia/Shanghai date +%Y-%m-%d)
echo "Business date (Shanghai): $TODAY_SH"

# ===== DoD 1: UI 验证 (人工 / Playwright) =====
# 登录 → dashboard → 顶部可见 Today widget (默认展开)

# ===== DoD 2: 首次 GET → 写入 today_task_log (atomic idempotent) =====
PGPASSWORD=... psql -c "SELECT COUNT(*) FROM today_task_log WHERE user_email='test_user' AND task_date='$TODAY_SH';"
# 期望: 1-3 行

# 并发测试 (v3 强调):
# 同时发 5 个 GET /today → DB 仍只有 3 行 (ON CONFLICT DO NOTHING 保证)

# ===== DoD 3: 任务信息完整 + start 记录 started_at =====
curl GET /api/user/today | jq '.tasks[0]'
# 期望: {kind, knowledge_point_id, reason, estimated_minutes, start_url, status}

# 调用 start:
curl POST /api/user/today/1/start
PGPASSWORD=... psql -c "SELECT id, status, started_at FROM today_task_log WHERE id=1 AND task_date='$TODAY_SH';"
# 期望: status='pending', started_at != NULL (DoD 3 关键断言)

# ===== DoD 4: 完成真实学习 → mastery / SRS 真实变化 =====
# 走 Sprint 1 的 /loop/feedback 路径, 带 today_task_id
curl POST /api/tutor/loop/feedback -d '{"today_task_id":1,"knowledge_point_id":"math_007","is_correct":true,"time_spent_ms":8000}'
PGPASSWORD=... psql -c "SELECT mastery_score, last_practice_at FROM student_knowledge_mastery WHERE user_email='test_user' AND knowledge_point_id='math_007';"
PGPASSWORD=... psql -c "SELECT status, completed_at FROM today_task_log WHERE id=1 AND task_date='$TODAY_SH';"
# 期望: mastery 变化 + today_task_log.status='completed' + completed_at != NULL

# ===== DoD 5: 回到 Today → 不重新生成 =====
# 二次 GET /today → 应看到 completed 状态而非新任务
curl GET /api/user/today | jq '.tasks[] | select(.id == 1) | .status'
# 期望: "completed"

# 整组验证:
PGPASSWORD=... psql -c "SELECT task_date, status, COUNT(*) FROM today_task_log WHERE user_email='test_user' GROUP BY task_date, status;"
# 期望: 今天 1 completed + 2 pending (不会再生 D / E / F)

# ===== 时区一致性验证 (v3) =====
# 跨时区不能错位
PGPASSWORD=... psql -c "SELECT NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'Asia/Shanghai';"
# 验证业务日期与 NOW() 关系正确
```

---

## 11. 不在 Sprint 2 范围 (defer)

- 学习路径 state machine (Sprint 3)
- LLM 解释为什么推荐 (Sprint 3)
- 多学科 Today 编排 (Sprint 4+)
- 跨学科 Today (Sprint 4+)
- 学生画像可视化 (Sprint 4+)
- 真人 3-5 人测试 (Sprint 4)
- timezone 国际化 (Sprint 4+)

---

## 12. 解冻条件

Sprint 2 通过 → Sprint 3 (Learning Path) → Sprint 4 (真人测试) → v1.1

如果 Sprint 2 暴露新问题 → 改 Sprint 2 规则, 不直接跳到 Sprint 3。

---

## 13. 与 D080 关系

D080 修复的 mastery SQL 路径是 Sprint 2 的**前置依赖** (Sprint 1 完成)。
Sprint 2 v3 新增可选 `today_task_id` 字段透传到 `feedback` body, 在同一事务内同时写 mastery + 改 task status。**Sprint 1 tutor/wrong-book/review 调用 feedback 完全不需要修改**。

---

## 14. 反向提议 (Revocation)

如果你认为 Sprint 2 范围过大或过小:

1. 引用 D081 (本版)
2. 明确 DoD 1-5 哪个加/减
3. 我会更新本 ADR

**不接受**的反向提议:
- "Sprint 2 加 LLM 解释" → 违反 §2 禁令, 拒绝
- "Sprint 2 做完整学习路径" → 违反 §11 Sprint 3 边界, 拒绝
- "Sprint 2 同时做 PWA 重构" → 违反 §2 范围, 拒绝
- "complete 自动调 feedback" → **P0-2 修复, 拒绝回滚**
- "today_task_id 必填" → **v3 约束, 拒绝破坏 Sprint 1 兼容性**
- "用 UNIQUE 当并发幂等" → **v3 强制 atomic idempotency, 拒绝**
- "SQL 验收用 CURRENT_DATE" → **v3 时区一致性, 拒绝**

---

## 15. ✅ 状态: APPROVED — 等启动指令

### v2 → v3 Review 修复清单

| 来源 | v2 问题 | v3 修复 | 状态 |
|------|---------|---------|------|
| Review #1 (🔴 必须修) | 仅依赖 UNIQUE 当并发幂等 | INSERT ... ON CONFLICT DO NOTHING + 重新 SELECT (方案 A) 或 advisory lock (方案 B) | ✅ |
| Review #2 (🟠 必须修) | 验收 SQL 用 `CURRENT_DATE` 依赖 DB timezone | 验收 SQL 必须用 `'2026-08-28'` (shell 注入 Shanghai 日期) | ✅ |
| Review #3 (🟡 建议补) | `started_at` 设计了但 DoD 没覆盖 | DoD 3 显式要求 "点击开始后记录 started_at" + 测试断言三阶段生命周期 | ✅ |

### v1 → v2 P0 修复保留

| P# | 修复 | 状态 |
|----|------|------|
| P0-1 | 当天只生成一次 + atomic | ✅ (v3 加并发安全) |
| P0-2 | complete 不伪造 feedback | ✅ |

### v1 → v2 P1 采纳保留

| P# | 修复 | 状态 |
|----|------|------|
| P1-1 | started_at 字段 | ✅ (v3 强化: 纳入 DoD 3) |
| P1-2 | Shanghai 时区 | ✅ (v3 强化: 验收脚本统一) |
| P1-3 | deterministic 排序 | ✅ (v3 强化: NULLS FIRST/LAST 显式) |
| P1-4 | explore 完成不调 feedback | ✅ |
| P1-5 | Today 默认展开 | ✅ |
| P1-6 | 空态 | ✅ |

---

## 16. 启动条件 (按你的工程纪律)

> **D081 v3 批准 ≠ 现在让我直接写代码**

按你 Review Decision 的明确要求:

| 阶段 | 状态 |
|------|------|
| D081 v3 冻结 | ✅ 本 ADR 已落地 |
| D082 implementation ADR (启动 Sprint 2 coding) | ⏸️ **等你明确指令** |
| Sprint 2 coding (Claude Code / Cursor / 新对话 DeepSeek) | ⏸️ 等 D082 |
| Sprint 2 5 DoD 验证 | ⏸️ 等 coding 完成 |
| 真人测试 1-3 人 | ⏸️ 等 Sprint 2 收口 |
| Sprint 3 (Learning Path) | ⏸️ 等 Sprint 4 |

**当前项目状态 (2026-Q4)**:

```
AI Tutor
├── Engineering Foundation    ██████████  9/10
├── Learning State / Memory   ██████████  9/10  ← Sprint 1 ✅
├── RAG / Knowledge           █████████  9/10
├── User Task Entry           ███       3/10
├── Today                      ██        2/10  ← Sprint 2 v3 APPROVED, 待启动
├── Learning Path              ██        2/10
└── Real User Validation       █         1/10
```

**Sprint 1 已交付 (DB 证据)**:
- mastery 真实变化 (3+ 行)
- srs_review_log 真实增长 (5+ 行)
- submitFeedback / submitBatch API 真跑通

---

**文档结束**
