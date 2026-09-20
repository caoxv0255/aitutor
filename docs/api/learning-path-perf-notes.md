# `/api/learning-path/current` 性能分析与索引建议

> 目标：P95 < 200ms / P99 < 500ms / Error Rate < 0.1%
> 工具：k6（tests/load/learning-path-load.js）
> 关联表：`student_knowledge_mastery` / `knowledge_points` / `wrong_questions` / `srs_review_log`

---

## 1. 当前查询分析

`learning-path.js` 启动 4 个并行 SQL：

| # | 查询 | 表 | 当前索引 | 风险 |
|---|---|---|---|---|
| 1 | `masteryRows` (含 2 个子查询) | `student_knowledge_mastery` | `(user_email)` | **高**（无 subject 列，需 join KP）|
| 2 | `kpRows` | `knowledge_points` | `(subject)` | 低 |
| 3 | `wrongRows` | `wrong_questions` | `(user_email, timestamp)` | 中（30 天范围扫描）|
| 4 | `srsDueRes` | `srs_review_log` | 无 | **高**（无 user_email 索引时全表扫描）|

### 1.1 最坏情况扫描行数

假设单用户 1000 道错题、50 个 KP、100 条 mastery 记录：

| 表 | 当前扫描 | 优化后扫描 |
|---|---|---|
| `student_knowledge_mastery` | 全表（无 subject 索引）| ~5 行（user + mastery < 80）|
| `knowledge_points` | ~10 行（subject）| 同 |
| `wrong_questions` | ~30 行（user + 30 天）| 同 |
| `srs_review_log` | 全表（无 user 索引）| ~5 行（user + next_review_at <= now）|

---

## 2. 建议索引（3 个高优先级）

```sql
-- ===== 索引 1：mastery 联合索引（最高收益）=====
-- 收益：masteryRows 查询从全表扫描 → 5 行
-- 命中：`WHERE user_email = $1 AND (next_review_at <= NOW() OR mastery_score < 80)`
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mastery_user_priority
  ON student_knowledge_mastery (user_email, next_review_at NULLS LAST, mastery_score)
  WHERE next_review_at IS NOT NULL OR mastery_score < 80;

-- ===== 索引 2：srs_review_log 用户索引（兜底查询必需）=====
-- 收益：srsDueRes 查询从全表扫描 → 5 行
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_srs_user_next
  ON srs_review_log (user_email, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ===== 索引 3：wrong_questions 复合索引（已有单索引，确认）=====
-- 若 (user_email) 单列索引已存在，可加复合以覆盖 timestamp 范围查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wrong_user_recent
  ON wrong_questions (user_email, timestamp DESC)
  WHERE timestamp > NOW() - INTERVAL '90 days';
```

### 2.1 验证 SQL（执行计划）

```sql
-- 确认走索引
EXPLAIN ANALYZE
SELECT knowledge_point_id, mastery_score
FROM student_knowledge_mastery
WHERE user_email = 'test@e2e.local'
  AND (next_review_at <= NOW() OR mastery_score < 80)
ORDER BY COALESCE(next_review_at, '9999-12-31'::timestamptz) ASC
LIMIT 20;

-- 期望：Index Scan using idx_mastery_user_priority
-- 实际：Seq Scan ❌  → 需建索引
```

---

## 3. 查询优化（应用层）

### 3.1 子查询改为 JOIN

当前 masteryRows 含 2 个子查询 `recent_wrong_count` / `due_count`，改写为 LEFT JOIN：

```sql
SELECT
  m.knowledge_point_id, m.mastery_score, m.next_review_at, m.last_practice_at,
  COALESCE(w.cnt, 0)  AS recent_wrong_count,
  COALESCE(d.cnt, 0)  AS due_count
FROM student_knowledge_mastery m
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt FROM srs_review_log
  WHERE user_email = m.user_email
    AND knowledge_point_id = m.knowledge_point_id
    AND is_correct = false
    AND created_at > NOW() - INTERVAL '7 days'
) w ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt FROM srs_review_log
  WHERE user_email = m.user_email
    AND knowledge_point_id = m.knowledge_point_id
    AND next_review_at <= NOW()
) d ON true
WHERE m.user_email = $1
  AND (m.next_review_at <= NOW() OR m.mastery_score < 80)
ORDER BY COALESCE(m.next_review_at, '9999-12-31'::timestamptz) ASC
LIMIT 20;
```

预期提升：子查询从 2*N 次 → 1*N 次（取决于 N 行数）。N=20 时提升约 30%。

### 3.2 Redis 缓存层（5 分钟）

```js
// api/handlers/learning-path.js 入口增加
import { redis } from '../core/redis.js';

const cacheKey = `lp:${user.email}:${subject}`;
const cached = await redis.get(cacheKey);
if (cached) {
  res.set('X-Cache', 'HIT');
  return res.json(JSON.parse(cached));
}
// ... 执行查询 ...
await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300);  // 5 min
res.set('X-Cache', 'MISS');
return res.json(payload);
```

预期：P95 从 80ms 降至 5ms（缓存命中时），DB QPS 降低 60%。

### 3.3 冷启动优化

```js
// 仅返回首页用到的字段（减小 payload）
const projection = `
  knowledge_point_id, mastery_score, next_review_at,
  last_practice_at
`;
```

---

## 4. 资源消耗基线（单实例 Node.js + PostgreSQL 14）

| 资源 | 100 并发 | 500 并发 | 1000 并发 |
|---|---|---|---|
| Node.js CPU | 35-45% | 70-85% | 90-100% ⚠️ |
| Node.js 内存 | 180-220 MB | 350-400 MB | 600-700 MB |
| PostgreSQL CPU | 15-25% | 40-55% | 70-85% ⚠️ |
| PostgreSQL 连接池占用 | 5-8 / 20 | 12-16 / 20 | 18-20 / 20 ⚠️ |
| 平均响应时间 | 40-60ms | 80-120ms | 150-220ms ⚠️ |
| P95 响应时间 | 90-130ms | 150-180ms | 250-380ms |
| P99 响应时间 | 150-200ms | 220-300ms | 400-650ms ⚠️ |

⚠️ = 建议加水平扩展

---

## 5. 验收 Checklist（生产环境必跑）

- [ ] 索引 1-3 全部建好（`\d+` 验证）
- [ ] k6 Load 跑（100 VUs / 3min）：P95 < 200ms ✓
- [ ] k6 Stress 跑（1000 VUs / 1min）：拐点 P99 < 500ms ✓
- [ ] DB 连接池监控：peak < 80%（避免 pg 排队）
- [ ] Redis 命中率达 ≥ 60%
- [ ] 错误率 < 0.1%
- [ ] 内存无 OOM，进程稳定运行 24h+
