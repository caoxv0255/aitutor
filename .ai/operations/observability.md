# Observability — 可观测性

> **最后更新**: 2026-08-28 (D083 补全)
> **配合**: D066 (status YAML track) + D069 (ai_trace) + Hermes TUI

---

## 1. 三层可观测性

| 层 | 数据源 | 工具 |
|---|---|---|
| **应用层** | Express logs / stderr | docker logs |
| **业务层** | DB 表 (ai_trace / metrics) | psql / SQL 查询 |
| **状态层** | `.ai/status/*.yaml` | Hermes TUI |

---

## 2. 应用层 — 日志

### 2.1 输出位置

```bash
# Docker 生产
docker logs aitutor-prod-app --tail 100 -f

# systemd (旧)
sudo journalctl -u uibe-tutor -f

# 本地 dev
node server.js  # stdout
```

### 2.2 JSON-file 日志 (D070 生产)

```yaml
# docker-compose.prod.yml
logging:
  driver: json-file
  options:
    max-size: 10m
    max-file: 5
```

### 2.3 日志级别

仓库用 `api/core/logger.js`, 标准级别:
- error
- warn
- info
- debug

---

## 3. 业务层 — 数据库表

### 3.1 ai_trace (D069)

**用途**: LLM 调用追踪 (输入/输出 token / 成本 / 延迟 / 状态)

**Schema** (简化):
```sql
CREATE TABLE ai_trace (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(64),
  user_email VARCHAR(255),
  endpoint VARCHAR(100),
  model VARCHAR(50),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_cny NUMERIC(10, 4),
  latency_ms INTEGER,
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**当前状态**: ⚠️ 表已建, **未接入** (P0-1, audit 2026-08-17)

**接入位置** (待补):
- `services/llm.js` DashScope 调用后 `INSERT INTO ai_trace`
- `api/handlers/proxy.js`
- `api/routes/vision-parse.js`
- `api/core/taskWorker.js`

**聚合视图** (示例, 待建):
```sql
CREATE MATERIALIZED VIEW ai_trace_daily_summary AS
SELECT
  DATE(created_at) AS day,
  endpoint,
  model,
  COUNT(*) AS call_count,
  SUM(input_tokens + output_tokens) AS total_tokens,
  SUM(cost_cny) AS total_cost_cny,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count
FROM ai_trace
GROUP BY DATE(created_at), endpoint, model;
```

### 3.2 业务表观测

```sql
-- 用户增长
SELECT DATE(created_at), COUNT(*) FROM users GROUP BY DATE(created_at);

-- 学习活跃度
SELECT DATE(last_practice_at), COUNT(DISTINCT user_email) 
FROM student_knowledge_mastery 
WHERE last_practice_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(last_practice_at);

-- Sprint 2 today_task_log (待建)
SELECT task_date, status, COUNT(*) 
FROM today_task_log 
GROUP BY task_date, status;
```

---

## 4. 状态层 — `.ai/status/*.yaml`

### 4.1 Schema 契约

每个 YAML **必须**包含:
```yaml
schema_version: "1.0"
generated_at: "ISO-8601"
# 业务字段
alerts: []
```

### 4.2 7 个 status YAML

| 文件 | 内容 | 谁生成 |
|---|---|---|
| `version.yaml` | git head + commits | `emit-status.sh` |
| `gate-status.yaml` | 最近 gate 结果 | `release-gate.sh` |
| `docker-health.yaml` | 容器健康 | `emit-status.sh` |
| `rag-components.yaml` | RAG 组件 | 自动检测 + 人工 |
| `database.yaml` | DB schema 状态 | `emit-status.sh` |
| `recent-runs.yaml` | agent runs | 人工 |
| `backlog.yaml` | P0/P1/P2 | 人工 |

### 4.3 alert 严重度

- `critical` — 阻塞发布 / 服务不可用
- `medium` — 数据缺失 / 性能降级
- `low` — backlog / 待优化

### 4.4 已知过期 (D083 启动时 audit)

⚠️ 当前 status YAML 部分过期:

| 文件 | 过期项 | 真实值 |
|---|---|---|
| `version.yaml` | head_commit | eb0db181 (实际 1118e97) |
| `gate-status.yaml` | overall | fail (docker build, 已修复? 待验证) |
| `database.yaml` | (一致) | total=426, tables=36 ✅ |
| `backlog.yaml` | items=[] | 空 (TODO 人工) |
| `recent-runs.yaml` | runs=[] | 空 (TODO 人工) |

**修复**: `bash scripts/emit-status.sh` 刷新 (本仓库有此脚本? 待验证)。

---

## 5. 健康检查

```bash
curl http://localhost:3002/api/health
# 期望:
# { status: 'ok', dbReady: true, version: '1.0.0', uptime: ... }
```

⚠️ 这是 **唯一** 的健康检查端点。**不要** 自创 `/api/ping` 之类。

**生产** (`docker-compose.prod.yml`):
```yaml
healthcheck:
  test: ["CMD", "curl", "-sf", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 5
  start_period: 30s
```

---

## 6. Hermes TUI 集成

Hermes 通过 `.ai/status/*.yaml` 渲染 dashboard:

```
╭──── aitutor Agent Console ────╮
│ Release:       v1.0 RC1      │
│ Head:          d7c0205f      │
│ Test:          241/241 ✅     │
│ Contract:      57/57 ✅      │
│ Docker:        healthy        │
│ DB:            34 tables      │
│ RAG:                           │
│ ├─ vision        ✅           │
│ ├─ embedding     ✅           │
│ ├─ pgvector      ✅           │
│ ├─ AGE           ✅           │
│ └─ LLM           ✅           │
╰────────────────────────────────╯
```

**详细**: `INTEGRATION_WITH_HERMES.md` §4

---

## 7. 监控指标 (建议, 待落地)

| 指标 | 数据源 | 阈值 |
|---|---|---|
| `/api/health` 失败率 | docker healthcheck | < 1% |
| LLM 成本/日 | `ai_trace_daily_summary` | < ¥50/天 |
| 错题生成延迟 | `ai_trace.latency_ms` | P95 < 30s |
| Today 接口响应 | 日志 | P95 < 500ms |
| mastery 写入 | `student_knowledge_mastery` row count | 增长 / 周 |

⚠️ 当前**未**配置告警 (Day-3+ 决策)。

---

## 8. 已知观测问题

| 问题 | 来源 |
|---|---|
| `ai_trace` 表空壳 | P0-1 (audit 2026-08-17) |
| 部分 status YAML 过期 | D083 SCAN |
| 无 metrics 聚合视图 | 待建 |
| 无告警机制 | Day-3+ |
| 无日志聚合 (ELK / Loki) | Day-3+ |

---

## 9. 不在 observability scope

- ❌ ai_trace 接入 (P0-1, Sprint 范围外)
- ❌ 日志聚合平台接入 (Day-3+)
- ❌ 告警机制 (Day-3+)
- ❌ Grafana / Prometheus (Day-3+)

---

**文档结束 — observability v1.0 (2026-08-28)**