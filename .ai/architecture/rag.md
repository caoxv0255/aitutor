# RAG / Knowledge Architecture — aitutor

> **目的**: 改 RAG / GraphRAG / Knowledge 代码前先读本文件。配合 `runbooks/add-api.md`。
> **最后更新**: 2026-08-28 (D083 补全)

---

## 1. 总览

**RAG 体系** = 三个独立但协同的检索通道:

| 通道 | 技术 | 用途 | 状态 |
|---|---|---|---|
| **Vector RAG** | pgvector + BGE-M3 | 题目语义相似度 | ✅ 索引建, ⚠️ 表空 (P1-1) |
| **Graph RAG** | Apache AGE + Cypher | 知识点前置/后置关系 | ✅ 部署, 涟漪效应 |
| **Keyword RAG** | PG full-text | 兜底 | ✅ |

**LLM 推理**:
- DashScope Maas (`/compatible-mode/v1/chat/completions`)
- 模型: `qwen-max` / `qwen-plus` / `qwen-turbo` (D073 修正 model name)
- Embedding: Ollama BGE-M3 (本地, ⚠️ host.docker.internal:11434 不可达)

---

## 2. 目录与组件

### 2.1 后端 RAG 模块

```
api/routes/
├── rag-search.js              849 行, 9 路由 (PG full-text + pgvector)
├── graphrag.js                223 行, 8 路由 (Apache AGE Cypher)
├── knowledge-graph.js         150 行, 7 路由 (图查询)
└── vision-parse.js            367 行, 2 路由 (OCR + 解析)

api/modules/rag/
└── routes.js                  模块化 RAG 入口 (新)
```

### 2.2 服务层

```
services/
├── llm.js                     DashScope Maas 客户端 (URL 路径处理: /compatible-mode/v1/chat/completions)
├── embedding.js               Ollama BGE-M3 客户端
├── aiTrace.js                 LLM 调用追踪 (D069)
├── cache.js                   Redis 缓存
└── subject-parser.js          学科解析
```

### 2.3 数据库 RAG 表

```
rag_questions              题目向量 (768/1024 维 BGE-M3) — ⚠️ 空表
knowledge_points           知识点 (D064 auto-seed, 426 行: gaokao 381 + zhongkao 45)
student_knowledge_mastery  学生掌握度 (Sprint 1 写入)
srs_review_log             SRS 复习日志 (Sprint 1 写入)
```

### 2.4 Python GraphRAG 微服务 (独立部署)

```
graphrag_service/           ⚠️ 独立部署, 与 Node.js 主项目分离
├── Dockerfile
└── ...
```

---

## 3. 关键 ADR

| ADR | 内容 |
|---|---|
| **D062** | client.js envelope-only (前端契约) |
| **D063** | question_uid 唯一来源 (questionUid.js) |
| **D064** | 知识点 auto-seed (ensureSeeds.js) |
| **D068** | RAG ingest Ollama bridge |
| **D068** (zhongkao) | 中考知识点 seed (45 个) |
| **D069** | ai_trace 表 (LLM 观测) |
| **D073** | LLM model name 修正 (qwen-* 正确名称) |
| **D078** | Learning Loop v1 (Sprint 1 真实验证通过) |
| **D080** | mastery 解耦 R-AGE ripple (Sprint 1 必修) |

---

## 4. 混合检索流程

```
学生提问
   ↓
前端 ai-tutor-frontend/assets/js/api/services/{tutor,rag}.js
   ↓
后端 api/routes/{tutor-agent,rag-search,graphrag}.js
   ↓
三路并发:
   ├─ pgvector (BGE-M3 向量相似度)  → rag-search.js
   ├─ Apache AGE (前置/后置 KP)    → graphrag.js
   └─ PG full-text (兜底)          → rag-search.js
   ↓
合并 + rerank → LLM (qwen-max) 生成答案
   ↓
返回前端
```

---

## 5. Hybrid RAG 一致性问题 ⚠️

**已知坑** (`.ai/known-bugs.md` §2026-04):

```
pgvector 索引更新了, 但 AGE 图谱节点迟迟不更新 (或反之)。
根因: scripts/sync-obsidian-to-age.js 跟 services/embedding.js 是两个独立 pipeline, 没原子性。
```

**短期修法** (D078 + D080):
- `/api/loop/feedback` 先 embedding 再 AGE 串联
- 改 RAG 前先 grep 两处一致性

**长期修法** (Day-3+ 决策):
- 合并成一个 Python 微服务 + outbox 模式
- 等 Langfuse 数据后再评估代价

---

## 6. Sprint 2 (D082) 与 RAG 的关系

**Sprint 2 不直接做 RAG**，但**复用 RAG 数据**:

| 用途 | 数据源 |
|---|---|
| Today 任务"review" kind | `srs_review_log` + `srs_engine_daily_tasks_for_user()` |
| Today 任务"practice" kind | `student_knowledge_mastery` (mastery < 0.5) |
| Today 任务"explore" kind | `knowledge_points` (用户未接触过的) |

⚠️ **不要新增 RAG 能力** (D081 §2 禁令)。

---

## 7. LLM 调用追踪 (D069)

`ai_trace` 表已建但**未接入** (audit 2026-08-17 P0-1)。

**接入位置** (待补):
- `services/llm.js` DashScope 调用后 `INSERT INTO ai_trace`
- `api/handlers/proxy.js`
- `api/routes/vision-parse.js`
- `api/core/taskWorker.js`

**字段**:
```
request_id, user_email, endpoint, model,
input_tokens, output_tokens, cost_cny,
latency_ms, status, error_message, created_at
```

⚠️ **Sprint 2 范围内不接入 ai_trace** (D081 §2 禁令, 等 Sprint 4+)。

---

## 8. 已知 RAG 问题 (deferred)

| 问题 | 状态 | 来源 |
|---|---|---|
| `rag_questions` 空表 | P1-1 | audit 2026-08-17 |
| `ai_trace` 表空壳 | P0-1 | audit 2026-08-17 |
| Ollama host.docker.internal 不可达 | medium | rag-components.yaml |
| Hybrid RAG 不一致 | 短期串联 | known-bugs.md |
| AGE 不支持 multi-graph | Cypher 拆分 | known-bugs.md |
| pgvector HNSW vs IVFFlat | < 1K 用 IVFFlat | known-bugs.md |

---

## 9. 修改 RAG 的流程

1. 读 ADR (`.ai/decisions/D0NN-rag.md`)
2. 评估 Sprint 范围 (D081 §2 禁: 新能力)
3. 检查 Hybrid RAG 一致性 (上面 §5)
4. 不要碰 ai_trace (P0-1 但 Sprint 范围外)
5. 跑 `tests/contract.test.js` + BCT
6. 跑 `bash test_integration.sh` (Hybrid RAG 验证)

---

## 10. 不在 RAG scope

- ❌ 新 RAG 能力 (Sprint 范围外)
- ❌ 新模型 / 新 embedding
- ❌ ai_trace 接入 (Sprint 4+)
- ❌ Hybrid RAG 重构 (Python 微服务 + outbox, Day-3+)

---

**文档结束 — RAG architecture v1.0 (2026-08-28)**