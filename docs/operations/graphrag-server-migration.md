# GraphRAG 服务服务器迁移指南

> **目的**: 将 aitutor 的 GraphRAG Python 微服务 (`graphrag_service/`) 从当前开发机迁移到生产服务器并稳定运行。
> **适用**: 运维 / 有服务器 sudo 权限的开发者。
> **最后更新**: 2026-08-23
> **状态**: 迁移指南(本机未部署, 供服务器执行)

---

## 0. 迁移前必读(3 个真实问题)

**⚠️ 部署前必须先解决这 3 个问题, 否则服务起来也会 404 / 503:**

### P1. `index_exists()` 路径 bug (必须修)
`graphrag_service/main.py:38`:
```python
def index_exists(index_name: str) -> bool:
    root = get_index_root(index_name)
    return (root / "output" / "artifacts").exists()   # ← 找 output/artifacts/
```
但实际构建的索引把 parquet **直接放在 `output/`**, 没有 `artifacts/` 子目录:
```
graphrag_workspace/indexes/gaokao_all/output/
├── communities.parquet   ← 这里, 不在 artifacts/
├── context.json
├── documents.parquet
├── entities.parquet
└── ...
```
**后果**: 索引明明构建完成, 但 `index_exists()` 返回 False → 所有查询 404。

**修复**: 改成兼容两种结构:
```python
def index_exists(index_name: str) -> bool:
    root = get_index_root(index_name)
    return (root / "output" / "artifacts").exists() or \
           ((root / "output").exists() and any((root / "output").glob("*.parquet")))
```

### P2. `.venv` 是 Windows 创建的 (跨平台损坏)
当前 `/home/cx/aitutor/.venv/pyvenv.cfg`:
```ini
home = C:\Python311
executable = C:\Python311\python.exe
command = C:\Python311\python.exe -m venv ...
```
`bin/python` 是 0 字节。**服务器上不要用这个 venv**, 必须重建。

### P3. `GRAPHRAG_API_KEY` / `GRAPHRAG_API_URL` 为空
`.env` 里:
```bash
GRAPHRAG_API_KEY=      # ← 空
GRAPHRAG_API_URL=      # ← 空
```
GraphRAG 查询/构建**都依赖** LLM key。必须在服务器填真实值(见 §4)。

---

## 1. 架构总览

```
浏览器 / F3 / PWA
   ↓  HTTPS
Nginx (443, deploy/uibe.conf)
   ↓  /api/*
Docker: aitutor-prod-app (Node, PORT=3002)
   ↓  /api/rag/graphrag/*   转发 (api/routes/graphrag.js)
   ↓  HTTP axios  →  GRAPHRAG_SERVICE_URL
host:127.0.0.1:8100  ←── systemd: uibe-graphrag.service (本机, 非 Docker)
   ↓  subprocess: graphrag CLI
graphrag_workspace/indexes/{name}/output/*.parquet
   ↓
Docker: aitutor-db (PostgreSQL, graphrag_documents 表)
```

**为什么 GraphRAG 不用 Docker?**
- 依赖 `graphrag` Python CLI(3.0.9), 索引构建期间大量文件 I/O + LLM 调用
- 与 Node 主 app 隔离, 放宿主机更稳
- systemd 自动重启 + 日志, 运维心智与 `uibe-tutor.service` 一致

---

## 2. 迁移步骤

### Step 1: 在服务器克隆代码 + 安装依赖

```bash
# 服务器 (Ubuntu 22.04+ / Python 3.11+)
git clone <repo-url> /home/flaskappuser/aitutor
cd /home/flaskappuser/aitutor

# 重建 venv (不要用仓库里的 .venv! 它是 Windows 的)
python3 -m venv .venv
source .venv/bin/activate

# 安装 GraphRAG 服务依赖
pip install "graphrag==3.0.9" fastapi uvicorn psycopg2-binary \
            pydantic python-dotenv httpx openai tenacity

# 验证
python -c "import graphrag, fastapi, uvicorn, psycopg2, pydantic; print('OK')"
```

> 如果装 `graphrag` 遇到依赖冲突, 用 `pip install "graphrag[all]"` 或参考 `graphrag 3.0.9` 的官方安装。

### Step 2: 创建并配置 `.env`

```bash
cp .env.example .env
```

填写关键项:

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | 指向 PostgreSQL (docker 内: `db:5432`) | `postgresql://aitutor:PASSWORD@localhost:5433/aitutor_db` |
| `JWT_SECRET` | 强随机 32+ 字符 | `openssl rand -hex 32` |
| `GRAPHRAG_API_KEY` | **必填** LLM key | `sk-xxx` |
| `GRAPHRAG_API_BASE` | GraphRAG 用 LLM API base | `https://mydamoxing.cn/v1` |
| `GRAPHRAG_MODEL` | 索引/查询主模型 | `kimi-k2.6` |
| `GRAPHRAG_CODING_MODEL` | 编码模型 | `K2.6-code-preview` |
| `GRAPHRAG_RATE_LIMIT_PER_HOUR` | 每小时上限 | `420` |
| `GRAPHRAG_SERVICE_URL` | 主 app 转发目标 (见 §3) | `http://host.docker.internal:8100` |
| `GRAPHRAG_SERVICE_HOST` / `PORT` | 服务监听 | `127.0.0.1` / `8100` |
| `OLLAMA_URL` | 向量模型 (嵌入) | `http://localhost:11434` |

### Step 3: 拷贝 `graphrag_workspace` 数据 (含已建索引)

```bash
# 从开发机迁移 (如果已有索引)
rsync -avz --progress /home/cx/aitutor/graphrag_workspace/ \
      flaskappuser@SERVER:/home/flaskappuser/aitutor/graphrag_workspace/

# 或首次全新构建 (更慢, 见 §5)
mkdir -p graphrag_workspace/{input,indexes,logs}
```

**磁盘**: `graphrag_workspace` 当前 397M, 索引完整构建后可能 **1-2GB**。确保分区够。

### Step 4: 修 `index_exists()` bug

```bash
# 按 §0 P1 修 /home/flaskappuser/aitutor/graphrag_service/main.py
```

### Step 5: 装 systemd service

```bash
sudo cp deploy/uibe-graphrag.service /etc/systemd/system/
# 编辑路径匹配实际部署目录 (见 §6 模板)
sudo systemctl daemon-reload
sudo systemctl enable uibe-graphrag
sudo systemctl start uibe-graphrag

# 验证
curl -s http://127.0.0.1:8100/health | python3 -m json.tool
# 期望: { "status": "ok", "indexes_available": [...], "indexes_total": 6 }
```

### Step 6: 主 app 指向 GraphRAG

`api/routes/graphrag.js:13`:
```js
const GRAPHRAG_SERVICE_URL = process.env.GRAPHRAG_SERVICE_URL || 'http://127.0.0.1:8100';
```
主 app 在 Docker 内, 需配置 `GRAPHRAG_SERVICE_URL`(见 §3), 并给 app 容器加 `extra_hosts`:
```yaml
# docker-compose.prod.yml
services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

重启主 app:
```bash
docker compose -f docker-compose.prod.yml restart app
```

### Step 7: 端到端验证

```bash
# 1. GraphRAG 健康
curl http://127.0.0.1:8100/health

# 2. 主 app 转发 (需登录 token)
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@uibe.edu.cn","password":"XXX"}' | jq -r .data.token)
curl -s "http://localhost:3002/api/rag/graphrag/knowledge-map?subject=math" \
  -H "Authorization: Bearer $TOKEN"

# 3. e2e 真实 GraphRAG
SKIP_GRAPHRAG=0 npm run e2e:legacy
# 期望: 之前 [SKIP] 的 RAG: knowledge-map 现在 [PASS], 56 → 57 PASS
```

---

## 3. 主 app 如何连 GraphRAG(两个选项)

### 选项 A: GraphRAG 在宿主机(systemd) — 推荐
主 app 在 Docker 内, 用 `host.docker.internal` 访问宿主机:
```bash
# .env
GRAPHRAG_SERVICE_URL=http://host.docker.internal:8100
```
需要 docker-compose 加 `extra_hosts`(见 Step 6)。

### 选项 B: GraphRAG 也用 Docker
如果坚持全 Docker, 写 `Dockerfile.graphrag` + 加 service。**不推荐**(索引文件 mount + CLI 复杂性)。

---

## 4. LLM key 说明

GraphRAG **查询和构建都调 LLM**。`config.py`:
```python
GRAPHRAG_API_KEY = os.getenv("GRAPHRAG_API_KEY", "")
GRAPHRAG_API_BASE = os.getenv("GRAPHRAG_API_BASE", "https://mydamoxing.cn/v1")
GRAPHRAG_MODEL = os.getenv("GRAPHRAG_MODEL", "kimi-k2.6")
```
- 不填 key → 索引无法构建, 查询报错
- `mydamoxing.cn` 是可选 provider, 也支持 DashScope/OpenAI 兼容端点
- 若用 DashScope, 设 `GRAPHRAG_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1`

---

## 5. 索引构建(首次一次性)

### 5.1 如果从开发机迁移了 workspace
索引已在 `graphrag_workspace/indexes/*/output/`, 无需重建。

### 5.2 全新构建
```bash
# 触发 (通过 GraphRAG 服务 admin 端点)
curl -X POST http://127.0.0.1:8100/api/admin/graphrag/reindex \
  -H "Content-Type: application/json" \
  -d '{"index_name": "gaokao_all"}'
# → { success: true, pid: 123 }

# 查进度
curl -s http://127.0.0.1:8100/api/admin/graphrag/jobs | python3 -m json.tool

# 或直接跑 indexer
cd /home/flaskappuser/aitutor
source .venv/bin/activate
python graphrag_service/indexer.py index --index gaokao_all
```

**索引构建耗时**: 30-60 分钟/索引, 烧 LLM token(按 rate limit 420/小时走)。**不要在高峰期跑**。

### 5.3 需要构建哪些索引
| 索引 | 用途 | 数据源 |
|------|------|--------|
| `gaokao_all` | 全国高考趋势/跨省 | `exam_type='高考'` |
| `zhongkao_beijing` | 北京中考问答 | `exam_type='中考' AND province='北京'` |
| `highschool_knowledge` | 高中知识点 | `doc_kind='知识点'` |
| `subject_math` / `subject_chinese` | 数学/语文深度索引 | `subject='数学'/'语文'` |
| `province_beijing` | 北京高考专项 | `province='北京' AND exam_type='高考'` |

---

## 6. systemd unit 模板

```ini
# /etc/systemd/system/uibe-graphrag.service
[Unit]
Description=AI Tutor GraphRAG Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=flaskappuser
WorkingDirectory=/home/flaskappuser/aitutor
EnvironmentFile=/home/flaskappuser/aitutor/.env
ExecStart=/home/flaskappuser/aitutor/.venv/bin/uvicorn graphrag_service.main:app --host 127.0.0.1 --port 8100
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/flaskappuser/aitutor/logs/graphrag.log
StandardError=append:/home/flaskappuser/aitutor/logs/graphrag_error.log

# 资源限制 (LLM 调用内存峰值高)
MemoryMax=4G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

---

## 7. 运维 Runbook

```bash
# 健康检查
curl -s http://127.0.0.1:8100/health | python3 -m json.tool

# 日志 (实时)
sudo journalctl -u uibe-graphrag -f --tail 100

# 重启
sudo systemctl restart uibe-graphrag

# 查看系统资源占用
systemctl status uibe-graphrag

# 触发索引重建
curl -X POST http://127.0.0.1:8100/api/admin/graphrag/reindex \
  -d '{"index_name":"gaokao_all"}' -H 'Content-Type: application/json'

# 临时关闭 (主 app 图谱查询返回 503, 其余不受影响)
sudo systemctl stop uibe-graphrag
```

---

## 8. 常见故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `curl :8100/health` 超时 | systemd 没起 / venv 坏 | `systemctl status uibe-graphrag`, 重建 venv |
| health 返回 `indexes_available: []` | `index_exists()` bug 未修 | 按 §0 P1 修 main.py |
| 查询返回 404 "索引不存在" | 同上 | 同上 |
| 查询返回 503 (主 app 侧) | `GRAPHRAG_SERVICE_URL` 指向错 / extra_hosts 缺 | 核对 §3 |
| 查询返回 504 "超时" | LLM key 无效 / 索引太大 | 看 graphrag_error.log, 验 key |
| 索引构建卡住 | LLM rate limit | 等 rate limit 窗口过, 或调 `GRAPHRAG_RATE_LIMIT_PER_HOUR` |
| `ModuleNotFoundError` | venv 不全 | `pip install` 补依赖 (§2 Step1) |

---

## 9. 验证清单(迁移完成)

- [ ] `curl http://127.0.0.1:8100/health` 返回 `status: ok`
- [ ] `indexes_available` 含目标索引 (修 P1 后)
- [ ] 主 app `GET /api/rag/graphrag/knowledge-map?subject=math` 返回 200
- [ ] `SKIP_GRAPHRAG=0 npm run e2e:legacy` → 57/57 PASS
- [ ] `systemctl restart uibe-graphrag` 自动恢复
- [ ] `.env` 里 `GRAPHRAG_API_KEY` 非空

---

## 10. 相关文件

| 文件 | 用途 |
|------|------|
| `graphrag_service/main.py` | FastAPI 服务入口 (需修 P1) |
| `graphrag_service/config.py` | env 配置读取 |
| `graphrag_service/db.py` | PostgreSQL 连接 + graphrag_documents 表 |
| `graphrag_service/indexer.py` | 索引构建调度 |
| `graphrag_workspace/` | 索引数据 + 中间产物 (397M+) |
| `deploy/uibe-graphrag.service` | systemd unit 模板 |
| `api/routes/graphrag.js` | 主 app 转发 (已实现鉴权+限流) |