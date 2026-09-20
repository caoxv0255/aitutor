# aitutor V1.0 · Staging 压测 Runbook

> 目标：在连接真实 Staging 数据库（与生产同阶：100 万级错题 / 50 万 mastery 记录）环境下，验证 `/api/learning-path/current` 与 `/api/home/today` SLA。
> 关联：tests/load/learning-path-load.js · docs/api/learning-path-perf-notes.md

---

## 0. 前置检查（5 min）

```bash
# 检查 k6 安装
k6 version  # 期望 v0.49+

# 检查 Staging DB 可达
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "SELECT count(*) FROM wrong_questions;"
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "SELECT count(*) FROM student_knowledge_mastery;"

# 检查后端进程
curl -fsS https://staging.aitutor.uibe.online/api/health | jq .
```

---

## 1. 数据准备（30 min）

### 1.1 确认 Staging 数据量级

```sql
-- 期望值（若不到，则执行 1.2 补齐）
SELECT
  (SELECT count(*) FROM users)                              AS users,
  (SELECT count(*) FROM wrong_questions WHERE timestamp > NOW() - INTERVAL '30 days')  AS recent_wrong,
  (SELECT count(*) FROM student_knowledge_mastery)          AS mastery_total,
  (SELECT count(*) FROM srs_review_log)                     AS srs_total,
  (SELECT count(*) FROM knowledge_points WHERE subject='math') AS math_kp;
```

### 1.2 灌入 Mock 数据（若不足）

执行 `tests/load/data-prep.sql`：

```bash
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME \
  -f tests/load/data-prep.sql
```

灌入规模：
- `users` 1000 个 mock 用户（每个 mock 邮箱 + bcrypt 密码 "loadtest"）
- `wrong_questions` 100 万条（每用户 1000 条，30 天内分布）
- `student_knowledge_mastery` 50 万条
- `srs_review_log` 200 万条

---

## 2. 索引应用（5 min）

```bash
# 1. 应用 3 个高优先级索引
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME \
  -c "$(cat tests/load/index-recommendations.sql)"

# 2. 验证索引创建成功
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME \
  -c "\di+ idx_mastery_user_priority"
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME \
  -c "\di+ idx_srs_user_next"

# 3. 验证查询计划（应走索引，非 Seq Scan）
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME \
  -c "EXPLAIN SELECT knowledge_point_id FROM student_knowledge_mastery
      WHERE user_email='loadtest_1@e2e.local' LIMIT 20;"
# 期望：Index Scan using idx_mastery_user_priority
```

---

## 3. k6 压测执行（依序 3 档）

### 3.1 Baseline（10 VUs / 1 min）

```bash
k6 run \
  --vus 10 --duration 1m \
  --env BASE_URL=https://staging.aitutor.uibe.online \
  tests/load/learning-path-load.js
```

**期望输出**：
- P50 < 80ms
- P95 < 200ms
- P99 < 250ms
- Error Rate < 0.1%

### 3.2 Load（100 VUs / 3 min）

```bash
k6 run \
  --vus 100 --duration 3m \
  --env BASE_URL=https://staging.aitutor.uibe.online \
  tests/load/learning-path-load.js
```

**SLA 验收**：
- ✅ P95 < 200ms
- ✅ P99 < 300ms
- ✅ Error Rate < 0.1%

### 3.3 Stress（100→500→1000 VUs / 3 min）

```bash
k6 run \
  --stage 30s:100,1m:500,1m:1000,30s:0 \
  --env BASE_URL=https://staging.aitutor.uibe.online \
  tests/load/learning-path-load.js
```

**找系统拐点**：
- Node.js CPU 80% 时对应 VUs
- PostgreSQL 连接池使用率 80% 时对应 VUs
- 期望拐点 ≥ 500 VUs

---

## 4. 监控采集（压测期间）

### 4.1 后端资源（node exporter + Prometheus）

```bash
# 在压测期间另起一个 terminal
watch -n 5 'curl -s http://staging-backend:9090/metrics | grep -E "node_cpu|node_memory|pg_stat"'
```

### 4.2 PostgreSQL 慢查询

```sql
-- 压测期间实时查
SELECT pid, query, state, age(clock_timestamp(), query_start) AS duration
FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '200ms'
ORDER BY query_start;
```

### 4.3 Redis 命中率（如已启用）

```bash
redis-cli -h $STAGING_REDIS_HOST INFO stats | grep -E "keyspace_hits|keyspace_misses"
```

---

## 5. SLA 验收 + 报告归档

### 5.1 SLA 验收 Checklist

- [ ] Load 档 P95 < 200ms ✅/❌
- [ ] Load 档 P99 < 300ms ✅/❌
- [ ] Load 档 Error Rate < 0.1% ✅/❌
- [ ] Stress 档 ≥ 500 VUs 仍能服务 ✅/❌
- [ ] DB 连接池峰值 < 80% ✅/❌
- [ ] Redis 命中率 > 60%（若启用）✅/❌
- [ ] 无死锁 / 无连接超时 ✅/❌

### 5.2 报告归档

```bash
# 自动归档
mkdir -p load-test-results/staging-$(date +%Y%m%d)
k6 run --out json=load-test-results/staging-$(date +%Y%m%d)/load.json \
  --vus 100 --duration 3m \
  --env BASE_URL=https://staging.aitutor.uibe.online \
  tests/load/learning-path-load.js

# 复制 SLA 报告模板
cp tests/load/sla-report-template.md load-test-results/staging-$(date +%Y%m%d)/REPORT.md
# 填入实际 P95/P99/VUs/ErrorRate
```

### 5.3 决策点

| SLA 状态 | 决策 |
|---|---|
| 全部达标 | 进入 D070 灰度（Phase 1 内部）|
| Load P95 ≥ 200ms | 加 Redis 缓存层（5 min TTL），重测 |
| Stress 拐点 < 500 VUs | 水平扩展 Node 实例（2 个）重测 |
| Error Rate ≥ 0.1% | 检查后端日志 / DB 死锁 |

---

## 6. 清理（压测结束后）

```bash
# 1. 删除 mock 数据
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
DELETE FROM srs_review_log WHERE user_email LIKE 'loadtest_%@e2e.local';
DELETE FROM student_knowledge_mastery WHERE user_email LIKE 'loadtest_%@e2e.local';
DELETE FROM wrong_questions WHERE user_email LIKE 'loadtest_%@e2e.local';
DELETE FROM users WHERE email LIKE 'loadtest_%@e2e.local';
"

# 2. 索引保留（生产也会用）
# 索引 1/2/3 应保留在生产 schema
```
