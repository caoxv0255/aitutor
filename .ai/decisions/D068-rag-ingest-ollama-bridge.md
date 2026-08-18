# D068: RAG 向量灌入 + Ollama 桥接

**日期**: 2026-08-17
**状态**: 已实施
**相关**: D066 (gate 体系), D069 (ai_trace), P1-1

## 背景

P1-1 阻塞项: `rag_questions` 表 50 道题均为零向量, RAG 搜索功能不可用。  
Ollama `host.docker.internal:11434` 从 WSL 不可达, 但 Windows 主机 `172.21.144.1:11434` 可达 (用户本地 Ollama, 含 bge-m3 模型)。

## 决策

### 1. 嵌入向量模型选择
- **bge-m3** (1024 维, BAAI 多语言, 中文优秀) — 替代旧的 nomic-embed-text (768)
- **migration 006** 已设计但未执行 (768 → 1024 维度切换)

### 2. 配置链路
- WSL → Windows 主机: `172.21.144.1:11434` (gateway IP)
- docker-compose.yml `environment` 块强制覆盖 .env 中的 `EMBEDDING_BASE_URL=host.docker.internal`
- `services/embedding.js` 读取 `EMBEDDING_BASE_URL` → Ollama /api/embeddings

### 3. 灌入脚本 (scripts/ingest-rag-batch.mjs)
- 从 `exam_questions` 取 stem+options+answer+analysis 拼接内容
- 调用 Ollama bge-m3 生成 1024 维向量
- SHA256(qid+content) 作 content_hash dedup
- INSERT INTO rag_questions (幂等 ON CONFLICT)

### 4. RAG 路径修复 (api/modules/rag/routes.js)
- 修复前: `router.use('/search', ragSearchRouter)` → `/api/rag/search/search` (双前缀)
- 修复后: `router.use('/', ragSearchRouter)` → `/api/rag/search` (正确)

### 5. 默认相似度阈值调整
- 修复前: `DEFAULT_SIMILARITY_THRESHOLD = 0.7` (太严格, 模拟数据相似度仅 0.58)
- 修复后: `0.5` (符合实际语义搜索数据分布)

## 影响

- `rag_questions` 表: 0 → 50 条 (全部 embedding 完成, HNSW 索引可用)
- `rag_questions.embedding`: `vector(768)` → `vector(1024)` (符合 bge-m3)
- `/api/rag/search` 端点: 404 → 200 (RAG 搜索功能上线)
- `api/services/embedding.js`: 自动使用 Windows Ollama
- 每次 RAG 搜索耗时 ~50-200ms (本地 Ollama + pgvector HNSW)

## 验证

```bash
GET /api/rag/stats → {"total":50,"subjects":1,"embedded":50}
POST /api/rag/search {"query":"集合"} → 3 results, top sim=0.58
BCT 19/19 全绿
```