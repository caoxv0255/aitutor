# D069: ai_trace LLM 调用追踪表

**日期**: 2026-08-17
**状态**: 已实施
**相关**: D066 (gate 体系), AGENTS.md (P2-2)

## 背景

生产环境中所有 LLM 调用（DashScope qwen-max / ollama bge-m3 / vision-parse）
缺乏追踪和成本监控。需要建立基础架构来记录每次调用的 token 消耗、延迟和成本。

## 决策

### 1. 表结构 (`database/migrations/009_ai_trace.sql` + `db.js` initTables)
```
ai_trace:
  id BIGSERIAL PK
  user_email VARCHAR(255) — 可选，关联用户
  session_id VARCHAR(100) — 会话关联
  provider VARCHAR(50) — 'dashscope' | 'openai' | 'ollama'
  model VARCHAR(100) — 'qwen-max' | 'bge-m3' | ...
  task_type VARCHAR(50) — 'chat' | 'embedding' | 'vision_parse' | 'diagnosis_report'
  prompt_tokens / completion_tokens / total_tokens INTEGER
  latency_ms INTEGER
  cost_cny NUMERIC(10,6)
  success BOOLEAN DEFAULT true
  error_message TEXT
  created_at TIMESTAMPTZ
```

### 2. 索引
- `idx_ai_trace_created_at` (查询最新调用)
- `idx_ai_trace_user` (按用户查询)
- `idx_ai_trace_model` (cost analysis by model)
- `idx_ai_trace_task` (按任务类型聚合)

### 3. 视图 `ai_trace_daily_summary`
- 按 (date, provider, model, task_type) 聚合
- 统计: call_count, tokens, cost, avg_latency, error_count

### 4. 后续接入点
- `services/llm.js` (chat/completion) — 记录 prompt/completion tokens + cost
- `services/embedding.js` (bge-m3) — 记录 embedding 调用
- `api/handlers/vision-parse.js` — 记录 vision 解析
- `api/handlers/diagnosis-report.js` — 记录学情诊断

## 影响

- 零运行时开销（INSERT 在调用完成后异步写入）
- 支持成本审计（按天/月/用户/模型聚合）
- 支持质量分析（latency percentiles, error rates）
- 为未来 Langfuse/observability 集成预留接口
