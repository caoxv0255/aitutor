# Deploy — 部署文档

> **最后更新**: 2026-08-28 (D083 补全)
> **配合**: D070 生产部署决策 + CLAUDE.md §部署

---

## 1. 环境

| 环境 | 端口 | 启动方式 | 用途 |
|---|---|---|---|
| **本地 dev** | 3001 | `node server.js` | 开发调试 |
| **Docker dev** | 3002→3000 | `docker compose up` | 容器化 dev |
| **生产 (D070)** | 3002→443(Nginx) | `sudo bash deploy/setup-prod.sh` | 生产部署 |

---

## 2. 本地开发

```bash
# 必须 Node.js 18+ (项目 ESM)
node --version

# 装依赖
npm install

# 起服务 (默认 3001)
node server.js
```

⚠️ `.env` 在 `.gitignore`, 第一次需要从 `.env.example` 复制。

---

## 3. Docker 开发环境

```bash
# 起 app + db + redis
docker compose up -d --build app

# 端口:
#   app  → :3002 (容器 3000)
#   db   → :5433 (容器 5432)
#   redis→ :6379
```

**关键文件**:
- `docker-compose.yml` — dev 环境
- `Dockerfile` — 镜像构建
- `.env` — 环境变量 (DATABASE_URL / JWT_SECRET / ALLOWED_ORIGINS)

---

## 4. 生产部署 (D069 + D070)

```bash
# 1. 准备 .env.prod (强随机 JWT_SECRET)
cp .env.example .env.prod
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env.prod
vim .env.prod  # 填入 DASHSCOPE_API_KEY / OLLAMA_URL / POSTGRES_PASSWORD

# 2. 一键部署 (Docker Compose 生产版)
sudo bash deploy/setup-prod.sh
# → build images, up -d, health check, ingest data, run gate

# 3. 查看服务状态
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app

# 4. 升级
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d
```

### 4.1 生产环境关键差异 (D070)

| 差异 | 说明 |
|---|---|
| `NODE_ENV=production` | 启动时检查 JWT_SECRET 强度 |
| 移除 `.:/app` 卷挂载 | 代码在镜像内, 防运行时修改 |
| `restart: always` | 异常自动重启 |
| 强健康检查 | retries: 5, start_period: 30s |
| 资源限制 | cpu 2.0 / memory 2G (app) |
| JSON-file 日志 | max-size 10m × 5 files |
| nginx profile | 启用 TLS, `--profile with-nginx` |

### 4.2 Nginx (生产)

文件: `deploy/nginx.conf`

⚠️ **必须**配置:
```nginx
proxy_buffering off;        # SSE 流式 (known-bugs.md §2026-04)
proxy_cache off;
proxy_read_timeout 300s;
```

### 4.3 systemd 旧版 (D069 之前)

```bash
# 旧版用 systemd (port 3002)
sudo systemctl status uibe-tutor
sudo systemctl restart uibe-tutor
sudo journalctl -u uibe-tutor -f
```

⚠️ 新部署**优先**用 Docker Compose 生产版 (D070)。

---

## 5. CI/CD (.github/workflows/release-gate.yml)

```yaml
# push/PR main → 自动跑 5/5 gate
# pgvector 服务 (Docker) + Redis 服务
# npm ci → 后端 init/seed → gate → production-smoke
# 失败阻止 merge
```

**手动跑**:

```bash
# 触发完整 gate
npm run gate

# 跳过某项 (debug 用)
SKIP_BCT=1 npm run gate
SKIP_DOCKER=1 npm run gate   # WSL buildx 失败时
```

---

## 6. 部署前 checklist

- [ ] `.env.prod` 已配置 (JWT_SECRET 强随机, 至少 32 字节)
- [ ] `DASHSCOPE_API_KEY` 已填
- [ ] `POSTGRES_PASSWORD` 已改默认
- [ ] Nginx 配置 (proxy_buffering off)
- [ ] `npm run gate` 全绿 (本地)
- [ ] docker 镜像构建成功 (`docker compose build app`)
- [ ] DB migration 验证 (全新 DB + 已存在 DB)
- [ ] 健康检查可达 (`curl /api/health`)

---

## 7. 回滚

```bash
# Docker 镜像回滚
docker compose -f docker-compose.prod.yml down
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d

# DB 回滚 (慎用, 见 backup-recovery.md)
```

---

## 8. 部署后验证

```bash
# 1. 健康检查
curl http://localhost:3002/api/health
# 期望: { dbReady: true, ... }

# 2. LLM 成本
SELECT * FROM ai_trace_daily_summary;
# (D069 接入后才有数据)

# 3. RAG 状态
curl http://localhost:3002/api/rag/stats

# 4. 容器日志
docker logs aitutor-prod-app --tail 100 -f
```

---

## 9. 已知部署问题

| 问题 | 修法 |
|---|---|
| WSL buildx activity 只读 | `BUILDX_CONFIG=./.docker-buildx` 或 `docker build` 替代 `docker buildx build` |
| nginx SSE 截断 | `proxy_buffering off` |
| DEV_AUTH_BYPASS 残留 | D067 检测 + 生产 `NODE_ENV=production` |
| 默认密钥泄露 | `.env.prod` 强制改 |

---

## 10. 不在 deploy scope

- ❌ Code 修改 → 见 `runbooks/`
- ❌ DB schema 设计 → 见 `architecture/database.md`
- ❌ 备份策略 → 见 `backup-recovery.md`

---

**文档结束 — deploy v1.0 (2026-08-28)**