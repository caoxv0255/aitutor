# Known Bugs — aitutor

**Last Updated:** 2026-07-31
**Maintainer:** human
**Review Frequency:** monthly

> 已知坑。每次踩到了立刻记录，别让人（包括 Agent）重发明 bug。

---

## 2026-08 — DEV_AUTH_BYPASS 环境变量残留

**现象**：所有 API 端点（包括 `/api/user/dashboard`、`/api/review/reports`）在无 token 时返回 200 + 真实数据。  
**根因**：手动启动的 `node server.js` 进程（调试用途）设置了 `DEV_AUTH_BYPASS=1`，调试结束后未杀死旧进程，环境变量残留。`authMiddleware` 检测到 `DEV_AUTH_BYPASS=1` 后跳过所有 JWT 验证。  
**触发条件**：`DEV_AUTH_BYPASS=1` 存在于进程环境（`.env`、shell export、或 docker-compose environment）。  
**影响**：**严重** — 用户数据泄露（所有受保护端点无需认证）。  
**修法（D067, 2026-08-17）**：  
  1. `authMiddleware` 每次触发时输出 `⚠️ DEV_AUTH_BYPASS=1` 警告日志  
  2. `server.js` 启动时检测：生产环境直接 `process.exit(1)`，开发环境输出醒目警告  
**回避**：  
  - 生产环境**绝不设置** `DEV_AUTH_BYPASS`  
  - 调试后**必须杀死** `node server.js` 进程  
  - 使用 Docker 部署时确认容器环境无此变量  

---

## 2026-04 — Hybrid RAG 三层一致性

**现象**：`pgvector` 索引更新了，但 AGE 图谱节点迟迟不更新（或反之）。  
**根因**：`scripts/sync-obsidian-to-age.js` 跟 `services/embedding.js` 是两个独立 pipeline，没原子性。  
**修法（短期）**：`/api/loop/feedback` 先 embedding 再 AGE 串联；aider 改之前先 grep 两处一致性。  
**修法（长期）**：合并成一个 Python 微服务 + outbox 模式，**Day-3+ 决策**（等 Langfuse 数据后再评估代价）。  
**回避**：调 embedding 时**不直接**改 AGE；跑 `bash test_integration.sh` 验。

---

## 2026-04 — SSE 流式 + nginx buffer

**现象**：教学流式回复被截断（只输出前几行就结束）。  
**根因**：nginx 默认 `proxy_buffering on`，会缓冲 SSE。  
**修法**：`deploy/nginx.conf` 加 `proxy_buffering off; proxy_cache off; proxy_read_timeout 300s;`  
**检验**：浏览器手动刷新看到持续流式输出 = 修好。  
**回避**：部署前**必查** `deploy/nginx.conf` 的 proxy_buffering。

---

## 2026-04 — pgvector HNSW 索引 vs IVFFlat

**现象**：1K 向量以内 HNSW 比 IVFFlat 慢，1K 以后反过来。  
**当前**：HNSW。  
**触发问题**：向量规模 < 1K 时召回慢。  
**修法**：< 1K 时切 IVFFlat；>= 1K 时用 HNSW。  
**位置**：`database/init/03-pgvector.sql`。

---

## 2026-04 — AGE Cypher 不支持 multi-graph

**现象**：跨多个 label 的多跳查询有时返回空。  
**根因**：AGE 1.x 不支持在 Cypher 里同时跨多 label。  
**修法**：拆分查询，分 2 次 Cypher 串起来（app 层 join）。  
**回避**：`api/routes/rag-search.js` 用 Cypher 别跨超过 2 个 label。

---

## 2026-04 — Langfuse 同步延迟（未来）

**现象**（装 Langfuse 后会有）：LLM 调用 fire-and-forget 日志有 1-2 秒延迟。  
**当前**：Langfuse 还没接。  
**触发条件**：所有 LLM 调用走 Litellm 后再装，那时才能看到此 bug 的真表现。  
**修法**：用 Langfuse 的 batch ingestion 或 async handler。

---

## 2026-04 — DashScope Maas URL 路径

**现象**：调 `api.openai.com` style URL 错，必须用 `/compatible-mode/v1/chat/completions` 路径。  
**当前**：改 URL 路径的"坑"被 `services/llm.js` 集中处理；其它 codebase 看到 URL 一改也跟改。  
**修法（长期）**：换 LiteLLM，`model="chinese"` 自动路由，business code 不看 URL。  
**回避**：**不要新建 `fetch(...)` 直连 DashScope**，都走 `services/llm.js`。

---

## 待发现

下面是新出现的坑你**第一时间**加到上面来：

| 现象 | 触发条件 | 复现 | 暂绕
|---|---|---|---|
| （待填） | | | |
