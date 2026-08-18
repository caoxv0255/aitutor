# D070: 生产环境部署 + CI/CD + 测试修复

**日期**: 2026-08-18
**状态**: 已实施
**相关**: D068 (RAG), D069 (exam_questions), P3 全部任务

## 背景

P0/P1/P2 完成后, 项目核心功能已就绪:
- 19,813 题, 426 知识点, 50 RAG, 9 学科
- F3 10 页全切真后端
- BCT 19/19, Production Smoke 17/17
- gate 5/5 全绿 (除 Docker build WSL 限制)

缺少:
1. 生产环境变量模板 (`.env.example` 过期)
2. 生产 Docker Compose 配置
3. CI/CD 自动化 (GitHub Actions)
4. 一键部署脚本
5. 测试文件引用已删除的代码 (D070 cleanup)

## 决策

### 1. .env.example (P3-1)
完整文档化所有环境变量:
- 必填: `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`
- 可选: `DASHSCOPE_API_KEY`, `DEEPSEEK_API_KEY`, `REDIS_URL`, `GRAPHRAG_API_URL`
- 强制 `NODE_ENV=production` + `SERVE_F3=true`

### 2. docker-compose.prod.yml (P3-2)
生产环境差异:
- `NODE_ENV=production` 强制
- 移除 `.:/app` 卷挂载 (代码在镜像内, 防运行时修改)
- `restart: always` + 强健康检查 (retries: 5, start_period: 30s)
- 资源限制: app(cpu 2.0/mem 2G), db(cpu 1.0/mem 1G), redis(cpu 0.5/mem 256M)
- JSON-file 日志轮转 (max-size 10m × 5 files)
- `nginx` profile (启用 TLS 反代)

### 3. .github/workflows/release-gate.yml (P3-3)
CI 自动化:
- push/PR main → 自动跑 5/5 gate
- pgvector + Redis services (docker)
- npm ci → 后端 init/seed → gate → smoke
- 上传 test-results artifact (7 天保留)
- concurrency 限制 (同一 branch cancel-in-progress)

### 4. deploy/setup-prod.sh (P3-4)
一键部署:
- 自动生成强随机 JWT_SECRET (openssl rand -hex 32)
- 构建镜像 → up -d → 健康检查 → 数据灌入 → gate
- 8 步流程, 友好输出

### 5. 测试修复 (P3-6)
删除引用已删除 `knowledge-points.js` 的测试:
- `tests/api/db-and-json.test.js`: 1 个 it
- `tests/api/p1-business-logic.test.js`: 1 个 it
- `tests/api/p2-ai-capability.test.js`: 1 个 it
- `tests/production-smoke.test.js` → `tests/contract/production-smoke.cjs` (避免 vitest 误加载)

## 影响

- **生产部署**: 一行命令 `sudo bash deploy/setup-prod.sh` 完成
- **CI**: push 自动跑 5/5 gate, PR 阻止 merge if fail
- **可观测性**: 强健康检查 + JSON 日志轮转
- **安全**: 生产环境无 `.:/app` 卷挂载, 代码防运行时篡改
- **测试**: 238/238 vitest 全绿 (从 241 减 3 因 D070 删文件)

## 验证

```
vitest:           238/238 ✓
gate (SKIP_DOCKER=1):  5/5 ✓
BCT:               19/19 ✓
Production Smoke:  17/17 ✓
docker-compose.prod.yml: config --quiet valid
```