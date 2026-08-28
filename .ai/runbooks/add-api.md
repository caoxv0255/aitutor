# Runbook: 加 API

> **触发**: 新增 endpoint / 修改现有 endpoint / 加新 service
> **配合**: `agents/coding.md` §8 (API Rules) + `agents/testing.md` (L3 BCT)
> **本仓库特殊**: D062 envelope + D067 auth + D082 Sprint 2 example

---

## 0. 前置条件

加 API **必须**先有:
- ✅ Product Decision (`.ai/decisions/D0NN-product.md`) — 描述 endpoint 用途 / 输入 / 输出 / 错误
- ✅ Implementation ADR (`.ai/decisions/D0NN-implementation.md`) — 描述代码改动 / SQL / 测试

**没有 ADR 不得写代码**。DSH Operating Protocol §3 强制。

---

## 1. 完整流程

### Step 1: 读 ADR

```bash
cat .ai/decisions/D0NN-product.md
cat .ai/decisions/D0NN-implementation.md
```

**必须理解**:
- METHOD + PATH
- AUTH 要求 (public? 需要登录? 需要 ownership?)
- Request body schema
- Response schema (success + error envelope)
- 副作用 (哪些表被改)
- Transaction 边界

### Step 2: SCAN 现有代码

```bash
# 1. 找挂载点
ls api/modules/           # 新模块化
ls api/handlers/          # 旧 handler
cat api/modules/index.js  # 模块注册

# 2. 找类似 endpoint 模板
# 例如加 GET /api/user/today → 参考 GET /api/user/dashboard
grep -rn "router.get\|router.post" api/modules/user/routes.js

# 3. 找数据源
grep -rn "TABLE_NAME" --include="*.js" | head -20

# 4. 找 auth 要求
cat api/core/auth.js      # 看 isPublicRoute 白名单
```

### Step 3: 设计 endpoint (按 ADR)

按 DSH Operating Protocol §8 API Rules 必须报告:

```
METHOD:    GET / POST / PUT / DELETE
PATH:      /api/user/today
AUTH:      authMiddleware (非 public)
REQUEST:   { body?: ..., params?: ..., query?: ... }
RESPONSE:  successResponse({...}) 或 errorResponse({...})
ERROR:     401 (no token) / 404 (not found) / 409 (conflict)
SIDE EFFECT: 读 / 写 / 改 哪些表
TRANSACTION: BEGIN / COMMIT / ROLLBACK 边界
```

### Step 4: 实现 (按 ADR Block 顺序)

每个 block:

1. 写代码
2. 写对应 test
3. 跑 test 验证
4. `git diff --stat` 检查
5. 报告 block 完成

### Step 5: Envelope 契约 (D062)

**所有**成功响应:

```js
res.json(successResponse({...}, '描述消息'));
// { success: true, message: '...', data: {...} }
```

**所有**失败响应:

```js
res.status(400).json(errorResponse('INVALID_INPUT', '描述', requestId));
// { success: false, message: '...', errorCode: 'INVALID_INPUT', requestId: '...' }
```

⚠️ **D062 关键**: client.js **不**解包 envelope, 前端统一 `res.data.X` 消费。

### Step 6: Auth 契约 (D067)

```js
import { authMiddleware } from '../core/auth.js';

// 默认受保护
router.get('/endpoint', authMiddleware, async (req, res) => {...});

// 如果是 public endpoint
// 1. 在 api/core/auth.js 的 PUBLIC_ROUTES 白名单加路径
// 2. 注释清楚为什么 public
```

### Step 7: 数据库访问

```js
import { getDb } from '../core/db.js';

const pool = await getDb();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // 查询 / INSERT / UPDATE
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

⚠️ **不要**省略 try/finally — connection 必须 release。

### Step 8: 测试

#### Unit Test (vitest)

```js
// tests/api/today-endpoint.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('GET /api/user/today', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/user/today');
    expect(res.status).toBe(401);
  });

  it('returns today tasks for authenticated user', async () => {
    // 假设已有 test JWT
    const res = await request(app)
      .get('/api/user/today')
      .set('Authorization', `Bearer ${testJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tasks).toBeInstanceOf(Array);
  });
});
```

#### Contract Test (前端 mock 契约)

```js
// tests/contract.test.js
// 验证 mock 文件与 service 调用路径一致
```

#### Backend Contract Test (真后端)

```bash
BCT_URL=http://localhost:3002 node tests/backend-contract.test.js
```

### Step 9: DB 验证 (Product DoD)

按 ADR §10 验收脚本跑真实 DB 验证:

```bash
PGPASSWORD=... psql -c "SELECT COUNT(*) FROM today_task_log WHERE user_email='test_user';"
# 期望: 1-3 行
```

### Step 10: 报告

按 `agents/coding.md` §14 DSH EXECUTION REPORT 模板。

---

## 2. Sprint 2 (D082) 示例

以 `GET /api/user/today` 为例:

### B1: api/routes/today.js 新建

```js
import express from 'express';
import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';

const router = express.Router();

function todayDateShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const today = todayDateShanghai();
    const tasks = await getOrGenerateToday(req.user.email, today);
    res.json(successResponse({
      date: today,
      tasks,
      summary: { total: tasks.length, completed: tasks.filter(t=>t.status==='completed').length }
    }, '今日任务已生成'));
  } catch (e) {
    console.error('[/api/user/today]', e);
    res.status(500).json(errorResponse('INTERNAL', '获取今日任务失败'));
  }
});

export default router;
```

### B2: api/modules/user/routes.js 挂载

```diff
+ import todayRouter from '../../routes/today.js';
...
+ router.use('/today', todayRouter);
```

### B3: 前端 service 新建

```js
// ai-tutor-frontend/assets/js/api/services/today.js
import { request } from '../client.js';

export const today = {
  async getToday() {
    return request('GET', '/api/user/today', null, { mockName: 'today_get' });
  },
  async start(taskId) {
    return request('POST', `/api/user/today/${taskId}/start`, {}, { mockName: 'today_start' });
  },
  // ... complete / skip
};
```

### B4: service index 导出

```diff
// ai-tutor-frontend/assets/js/api/services/index.js
+ export { today } from './today.js';
```

### B5: mock 文件

```json
// ai-tutor-frontend/assets/js/api/mock/today_get.json
{
  "success": true,
  "data": {
    "date": "2026-08-28",
    "tasks": [...3],
    "summary": {...}
  }
}
```

### B6: 测试

```js
// tests/api/today-endpoint.test.js (新建)
import { describe, it, expect } from 'vitest';
// ... 见 Step 8
```

---

## 3. 常见陷阱

### 3.1 ❌ 不要直接连接数据库

不要 `new pg.Client(...)`, **必须**用 `getDb()` pool。

### 3.2 ❌ 不要忘记 `client.release()`

每次 `pool.connect()` 必须配对 `client.release()`, 用 try/finally。

### 3.3 ❌ 不要在 handler 里写 SQL 字符串拼接

**所有**SQL 必须参数化 (`$1`, `$2`), 防止 injection。

### 3.4 ❌ 不要绕过 authMiddleware

**所有**非 public endpoint 必须 `authMiddleware`, 否则 D067 会误报。

### 3.5 ❌ 不要忘记 transaction

写多表 (例: feedback → mastery + srs + today_task_log) 必须同事务。

### 3.6 ❌ 不要用 `CURRENT_DATE`

业务日期必须 `todayDateShanghai()`, 见 D081 §5。

### 3.7 ❌ 不要把 mock 写到 production 路径

mock 文件在 `assets/js/api/mock/`, **不**进入 backend。

---

## 4. Sprint 1 → Sprint 2 兼容性 (D081 §7.5)

如果新 API 要被 Sprint 1 路径调用:

- Sprint 1 的 `feedback` 调用是 `POST /api/tutor/loop/feedback { is_correct, knowledge_point_id, ... }`
- Sprint 2 加 `today_task_id` 是 **optional**, Sprint 1 调用不传也正常工作
- 后端只在 `today_task_id` 存在时 UPDATE `today_task_log`

**不要破坏 Sprint 1 兼容性** (D081 明确约束)。

---

## 5. 输出 checklist

加完 API, EXECUTION REPORT 必须:

- [ ] §0 STATUS: COMPLETE
- [ ] §1 SOURCE OF TRUTH: ADR 引用
- [ ] §3 PLAN: 按 block 列出
- [ ] §4 IMPLEMENTATION: 每个 block 完成
- [ ] §5 VALIDATION: vitest + contract + BCT + DB 四层
- [ ] §6 EVIDENCE: test 输出 + curl 输出 + DB 输出 + git diff
- [ ] §7 SCOPE AUDIT: NO 或明确列出
- [ ] §8 REGRESSION AUDIT: 现有 API 不受影响
- [ ] §11 NEXT ACTION: STOP FOR REVIEW

---

**文档结束 — add-api runbook v1.0 (2026-08-28)**