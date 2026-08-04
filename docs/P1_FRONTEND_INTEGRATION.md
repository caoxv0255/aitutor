# P1 Frontend 联调真后端 — 使用指南

> **2026-08-04** | frontend demo 走真后端 (RAG 28,580 题) + dev mode auth bypass

---

## 启动 (3 步, 30s)

```bash
# Step 1: 启 pgvector 容器 (后台)
make start-pgvector

# Step 2: 启后端 server (port 3002, NODE_ENV=development 自动 bypass auth)
NODE_ENV=development EMBEDDING_PROVIDER=ollama node server.js &
# 输出: Server running at http://localhost:3002

# Step 3: 启 frontend demo (新 terminal)
cd ai-tutor-frontend
python3 -m http.server 8000 --bind 0.0.0.0
```

**浏览器**:
- Frontend demo: `http://localhost:8000/pages/index.html`
- Backend API: `http://localhost:3002/api/rag/search/stats`
- (Backend 默认 dev mode, 不需 token, 也不需 x-dev-bypass header)

---

## 4 个测试场景

### 1. 加载 dashboard (mock, F2 验证)

点 "加载 dashboard (Mock)" 按钮 → 4 个 stat 卡片显示 248 / 76.2% / 3 / 15 (来自 mock JSON).
- 走 mock (USE_MOCK=true) → 不打 backend
- 验证: 39 contract test 跑过

### 2. RAG 语义检索 (真后端, P3 验证)

搜索框输入 `软锰矿制备高锰酸钾` → 点搜索 → 显示 5 hits, sim 0.85-0.97, 60-90ms.
- 走真后端 (RAG 临时关 mock)
- 验证: pgvector cosine similarity
- 学科过滤: 选 "化学" → 只看化学题

### 3. 学科过滤验证

搜索 `导数的几何意义` + 选 "数学" → top 5 sim 0.65-0.97 全是数学题 (抛物线/方程/函数定义域).
- 验证: subject_code 过滤生效

### 4. 暗色主题切换

点 "切换暗色主题" → 整页 dark, LS 持久化 (刷新保留).

---

## 架构图

```
[Browser: localhost:8000]
       │
       ▼
[ai-tutor-frontend/index.html]
       │
       │ (mock=true)                    (mock=false, RAG 默认)
       │                                │
       ▼                                ▼
[ai-tutor-frontend/assets/js/api/mock/*.json]    [localhost:3002]
       │                                │
       │ 4 stat 卡片 (248, 76%, etc)     │ /api/rag/search/search
       │                                │ /api/rag/search/stats
       │                                │ /api/rag/search/ingest
       │                                ▼
       │                         [server.js:3002]
       │                                │
       │                                │ auth bypass (NODE_ENV=development)
       │                                │
       │                                ▼
       │                         [services/embedding.js: Ollama]
       │                                │
       │                                ▼
       │                         [api/routes/rag-search.js]
       │                                │
       │                                ▼
       │                         [pgvector/pgvector:pg15 :5433]
       │                                │
       │                                ▼
       │                         [rag_questions (28,580 题, vector(768))]
       │
       └── (RAG 临时 setUseMock(false), 走真后端)
```

---

## 关键改动 (P1)

### 1. `api/core/auth.js` (改)
- Dev bypass: `NODE_ENV !== 'production'` → 自动跳过 verify (不再需要 `x-dev-bypass: 1` header)
- Production 强 verify (必须显式设 `NODE_ENV=production`)

### 2. `ai-tutor-frontend/assets/js/api/services/rag.js` (改)
- 路径对齐 backend: `/api/rag/search` → `/api/rag/search/search` (因为 backend modules/rag 嵌套)
- 6 个端点路径修正: search, multiSearch, similarQuestions, ingestQuestion, getStats

### 3. `ai-tutor-frontend/pages/index.html` (改)
- 新增 RAG 搜索 card: input + 学科 filter + 搜索按钮 + 结果区
- 搜索时临时关 mock (setUseMock(false)), 走真后端
- 启动时 RAG health check (调 getStats 显示在 service log)

---

## 验证清单

| 测试 | 命令 / 操作 | 期望 |
|---|---|---|
| Backend health | `curl localhost:3002/api/rag/search/stats` | 200 + 28,580 题 |
| Auth bypass | 同上, 不带任何 header | 200 (NODE_ENV=development) |
| Auth verify | `NODE_ENV=production node server.js`, curl 无 token | 401 |
| Frontend paths | 浏览器 console: `await AIT.rag.search({query: 'test', topK: 3})` | 200 + 命中 |
| Contract Test | `make contract` | 39/39 (mock 不破) |
| Lint | `make lint` | 0 错 |
| E2E | `make e2e` | 2/2 |

---

## 故障排除

| 现象 | 修法 |
|---|---|
| `404 Not Found /api/rag/search` | 服务路径对齐了, 刷新浏览器 (cache) |
| `401 Unauthorized` | NODE_ENV 不是 development, 重启 `NODE_ENV=development node server.js` |
| `500 vector dimension mismatch` | 旧 schema 是 1536, 跑 `make start-pgvector` 用新镜像 + migration 005 |
| RAG 搜返回空 | 阈值太高 (默认 0.5), 降到 0.3 或换 query |
| Ollama 500 | 单题失败, 重试或换 query |

---

## 下一步 (P1 完成后)

| | 任务 | 工作量 |
|---|---|---|
| **P2** | F3 (10 page User Journey 迁移) | 5-7天 |
| **P3** | v0.2 gaokao_paper_mapping (联网修) | 1-2h |
| **P4** | AGE+pgvector 自定义镜像 | 15-20 min build + 1h ingest |
| **P5** | RAG↔GraphRAG 双向引用 | 半天 |

---

**Generated**: 2026-08-04 | v0.6.0-dev P1 联调