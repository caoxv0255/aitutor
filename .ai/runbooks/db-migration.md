# Runbook: DB Migration

> **触发**: 加新表 / 加字段 / 加索引 / 数据回填
> **配合**: `agents/migration.md` (Migration Agent 协议) + `agents/coding.md` §7 (DB Rules)
> **本仓库特殊**: 无专门 migration 工具, schema 创建分 `database/init/*.sql` (容器首次启动) 和 `api/core/db.js` (应用启动 initTables)

---

## 0. 前置条件

DB Migration **必须**先有:
- ✅ Product Decision (`.ai/decisions/D0NN-product.md`) — 描述数据模型变化
- ✅ Implementation ADR (`.ai/decisions/D0NN-implementation.md`) — 描述 SQL + 回滚路径

---

## 1. 路径选择

来自 `agents/migration.md` §7:

| 场景 | 路径 | 例子 |
|---|---|---|
| 容器冷启动必备 | `database/init/*.sql` | extensions / partitions / pgvector |
| Sprint 加新表 (不想重建镜像) | `api/core/db.js` `initTables()` | Sprint 2 `today_task_log` |
| 历史 decision 要求 | `database/migrations/*.sql` (并从 initTables 移除重复) | 已迁移的表 |
| 数据回填 | `scripts/*.js` 或 `database/migrations/*.sql` | D063 `backfill-question-uid.js` |

---

## 2. 完整流程

### Step 1: 读 ADR

```bash
cat .ai/decisions/D0NN-product.md      # 数据模型 + 业务逻辑
cat .ai/decisions/D0NN-implementation.md # SQL + 测试
```

理解:
- 新表 / 新字段 / 新索引 / 新约束
- 字段类型 (VARCHAR(20) / TIMESTAMPTZ / JSONB)
- 唯一约束 (UNIQUE / FK / CHECK)
- 索引策略 (哪些列需要索引)
- 数据回填 (是否需要)
- 不可逆风险

### Step 2: SCAN 现有 schema

```bash
# 1. 已存在的 init SQL
ls database/init/

# 2. 已存在的 migration SQL
ls database/migrations/

# 3. 当前 initTables 函数
grep -n "CREATE TABLE" api/core/db.js | head -30

# 4. 当前真实 schema (真 DB)
PGPASSWORD=... psql -c "\dt"
PGPASSWORD=... psql -c "\d+ existing_table"
```

### Step 3: 选择路径

按路径:

#### 路径 A: `database/init/*.sql`

```bash
# 创建文件, 命名: NN-descriptor.sql
touch database/init/04-today-task-log.sql
```

#### 路径 B: `api/core/db.js` `initTables()`

```js
// 找到 initTables 函数, 在末尾追加
await client.query(`
  CREATE TABLE IF NOT EXISTS today_task_log (
    id SERIAL PRIMARY KEY,
    ...
  );
`);
```

#### 路径 C: `database/migrations/NNN-descriptor.sql`

```bash
# 命名: 3 位序号 + 下划线 + 描述
touch database/migrations/017_today_task_log.sql
```

**Sprint 2 (D082 B4) 默认用路径 B**, 因为不想重建 docker 镜像。

### Step 4: 写 migration

按 `agents/migration.md` §2 模板, 必须包含:
- 注释 (Sprint / ADR / 测试位置)
- `IF NOT EXISTS` / `IF EXISTS` 保证 idempotent
- 索引
- 约束
- 字段类型注释

### Step 5: 验证全新 DB

```bash
# 清空 DB, 跑全部 init
docker compose down -v
docker compose up -d db
# 等待 init 完成
PGPASSWORD=... psql -c "\dt" | grep today_task_log
# 期望: 表存在
```

### Step 6: 验证已存在 DB (idempotent)

```bash
# 不清空, 跑新 migration / 重启应用
psql -c "\dt today_task_log"
# 期望: 旧 DB 没有这张表, 跑 migration 后存在

# 重复跑 (idempotent test)
psql -f 017_today_task_log.sql
psql -f 017_today_task_log.sql
# 期望: 不报错

# 应用层
node server.js  # 重启
psql -c "\dt today_task_log"
# 期望: 存在, 多次重启 idempotent
```

### Step 7: 数据回填 (如有)

```bash
# 编写 backfill 脚本
cat scripts/backfill-xxx.js | head -50

# Dry-run (默认)
node scripts/backfill-xxx.js
# 期望: 输出"will update N rows", 不真改

# Apply
node scripts/backfill-xxx.js --apply
# 期望: 真正更新, 输出 count
```

### Step 8: 测试

#### Unit Test

```js
// tests/api/today-task-log.test.js
import { describe, it, expect } from 'vitest';
import { getDb } from '../../api/core/db.js';

describe('today_task_log schema', () => {
  it('has all required columns', async () => {
    const pool = await getDb();
    const res = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'today_task_log'
    `);
    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('task_date');
    expect(cols).toContain('status');
    // ...
  });

  it('UNIQUE constraint exists', async () => {
    const pool = await getDb();
    await pool.query(`
      INSERT INTO today_task_log (user_email, task_date, knowledge_point_id, kind)
      VALUES ('test@x.com', '2026-08-28', 'math_001', 'review')
    `);
    // 第二次插入应失败 (UNIQUE)
    await expect(pool.query(`
      INSERT INTO today_task_log (user_email, task_date, knowledge_point_id, kind)
      VALUES ('test@x.com', '2026-08-28', 'math_001', 'review')
    `)).rejects.toThrow();
  });
});
```

#### Atomic Idempotent Test (D081 §3.1 方案 A)

```js
it('GET /today atomic idempotent (并发安全)', async () => {
  const user = 'concurrent@test.com';
  // 5 个并发 GET
  const promises = Array(5).fill().map(() => 
    request(app).get('/api/user/today').set('Authorization', `Bearer ${jwt}`)
  );
  const results = await Promise.all(promises);
  // 期望: 都 200
  for (const r of results) expect(r.status).toBe(200);
  
  // DB 验证: 仅生成 1-3 行 (没重复)
  const count = await pool.query(
    "SELECT COUNT(*) FROM today_task_log WHERE user_email=$1 AND task_date='$TODAY_SH'",
    [user]
  );
  expect(count.rows[0].count).toBeLessThanOrEqual(3);
});
```

### Step 9: 报告

按 `agents/migration.md` §9 模板。

---

## 3. Backward Compatibility 检查

来自 `agents/migration.md` §5:

| 维度 | 检查 |
|---|---|
| 新增字段 | 老代码 `SELECT *` 不出错, DEFAULT 值合理 |
| 新增表 | 不影响现有 transaction / view / trigger |
| 删除字段 | 确认无应用代码引用 (`grep`) |
| 类型变更 | 有 casting / migration path |
| 约束变更 | 已有数据满足新约束 (否则 backfill 先) |

---

## 4. Rollback

每个 migration **必须**有 rollback 路径, 见 `agents/migration.md` §8。

### 4.1 Schema Rollback (示例)

```sql
-- 017_today_task_log.sql 的回滚
DROP TABLE IF EXISTS today_task_log;
```

### 4.2 应用层 Rollback

如果走路径 B (initTables), 回滚需要:
1. 从 `api/core/db.js` 移除 CREATE TABLE 段
2. (可选) DROP TABLE
3. 重启服务

---

## 5. 时区一致性 (D081 §5)

- ❌ **不要**用 `WHERE task_date = CURRENT_DATE` (依赖 DB timezone)
- ✅ **必须**用 `WHERE task_date = '$TODAY_SH'` (shell 注入 Asia/Shanghai 日期)
- ✅ 应用层 `todayDateShanghai()` helper 唯一权威

```js
// 后端 helper (Sprint 2 D082 §2.4)
function todayDateShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
```

---

## 6. 本仓库已知坑 (`.ai/known-bugs.md`)

| 坑 | 修法 |
|---|---|
| pgvector HNSW vs IVFFlat | < 1K 用 IVFFlat, >= 1K 用 HNSW |
| AGE 不支持 multi-graph | 拆分 Cypher, app 层 join |
| Hybrid RAG 不同步 | embedding + AGE 串联 (短期) |
| question_uid 必须 NOT NULL | 已有 D016 migration (016_question_uid_notnull.sql) |

---

## 7. 常见陷阱

### 7.1 ❌ 不要改字段类型不兼容

例: `VARCHAR(20) → TEXT` 在某些 PG 版本会有 lock, 需要 `ALTER COLUMN ... TYPE TEXT USING column::TEXT`。

### 7.2 ❌ 不要忘记 GRANT

如果表被新模块访问, 确认应用 DB user 有 SELECT / INSERT / UPDATE 权限 (默认有, 但生产环境可能有差异)。

### 7.3 ❌ 不要在 migration 里写应用代码

migration 文件只放 SQL, 不放 JS 逻辑。逻辑放 `api/core/db.js` 或 service。

### 7.4 ❌ 不要"修复" pre-existing migration

如果发现历史 migration 有问题, 写新 migration 修复, **不**改旧文件。

### 7.5 ❌ 不要用 `addColumn` 在已有表加 NOT NULL 字段

必须先 `ALTER TABLE ADD COLUMN x TYPE;` 然后 backfill 再 `SET NOT NULL`, 否则已有数据 fail。

---

## 8. 输出 checklist

完成 migration, MIGRATION REPORT 必须:

- [ ] §0 上下文: 关联 ADR
- [ ] §1 SQL 完整内容
- [ ] §2 类型分类 (SCHEMA / DATA / LOGIC)
- [ ] §3 两种场景验证 (全新 DB + 已存在 DB)
- [ ] §4 Idempotent 重跑验证
- [ ] §5 Backward Compatibility 检查
- [ ] §6 Backfill (如有)
- [ ] §7 Rollback 路径
- [ ] §8 风险列表
- [ ] §9 应用层接入位置

---

**文档结束 — db-migration runbook v1.0 (2026-08-28)**