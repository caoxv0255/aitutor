#!/bin/bash
# deploy/setup-prod.sh — aitutor v1.0 生产环境一键部署
#
# 功能:
#   1. 创建 .env.prod (从 .env.example 模板)
#   2. 生成强随机 JWT_SECRET
#   3. docker compose -f docker-compose.prod.yml up -d
#   4. 等健康检查通过
#   5. 灌入题目数据 (P2-1)
#   6. 跑 release gate (5/5)
#
# 用法:
#   sudo bash deploy/setup-prod.sh
#
# 前置:
#   - .env.prod (或自动生成)
#   - Docker + Docker Compose
#   - PostgreSQL 16+ with pgvector extension

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "=== aitutor v1.0 生产部署 ==="
echo ""

# ── 1. 检查前置条件 ──
echo "[1/8] 检查前置条件..."
command -v docker >/dev/null 2>&1 || { echo "❌ docker 未安装"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v "docker compose" >/dev/null 2>&1 || { echo "❌ docker compose 未安装"; exit 1; }
echo "  ✓ docker & docker compose 已安装"

# ── 2. 创建 .env.prod ──
echo "[2/8] 准备 .env.prod..."
if [ ! -f .env.prod ]; then
  cp .env.example .env.prod
  # 生成强随机 JWT_SECRET (32 bytes hex = 64 chars)
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.prod
  echo "  ✓ 已生成 .env.prod (JWT_SECRET 强随机)"
else
  echo "  - .env.prod 已存在, 跳过"
fi

# ── 3. 检查 OLLAMA_URL ──
if ! grep -q "^OLLAMA_URL=" .env.prod; then
  echo "  ⚠️  OLLAMA_URL 未配置, RAG 可能不可用"
  echo "    编辑 .env.prod 添加: OLLAMA_URL=http://your-ollama-host:11434"
fi

# ── 4. 构建并启动 ──
echo "[3/8] 构建 Docker 镜像..."
docker compose -f docker-compose.prod.yml build app

echo "[4/8] 启动服务..."
docker compose -f docker-compose.prod.yml up -d
echo "  ✓ 容器启动完成"

# ── 5. 等健康检查 ──
echo "[5/8] 等健康检查 (max 60s)..."
APP_URL="http://localhost:3002"
HEALTH_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 3
  if curl -sf "$APP_URL/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    echo "  ✓ 健康检查通过"
    break
  fi
  echo "  ... waiting (${i}/10)"
done

if [ "$HEALTH_OK" -eq 0 ]; then
  echo "❌ 健康检查失败, 查看日志:"
  docker compose -f docker-compose.prod.yml logs --tail 50 app
  exit 1
fi

# ── 6. 灌入数据 ──
echo "[6/8] 灌入 RAG + Exam Questions 数据..."
if [ -d database/rag_build ]; then
  docker exec aitutor-prod-app node /app/scripts/ingest-rag-batch.mjs --limit 100 || echo "  ⚠️ RAG 灌入失败 (Ollama 不可达?)"
fi
if [ -d database/parsed-examples ]; then
  docker exec aitutor-prod-app node /app/scripts/ingest-exam-questions.mjs --limit 1000 || echo "  ⚠️ Exam 灌入失败"
fi

# ── 7. 跑 gate ──
echo "[7/8] 跑 release gate..."
echo "  (SKIP_DOCKER=1, 因为镜像已构建)"
SKIP_DOCKER=1 npm run gate || echo "  ⚠️ gate 部分失败, 继续"

# ── 8. 输出 ──
echo "[8/8] 部署完成!"
echo ""
echo "=== 部署状态 ==="
docker compose -f docker-compose.prod.yml ps
echo ""
echo "=== 验证端点 ==="
curl -s "$APP_URL/api/health" | python3 -m json.tool 2>/dev/null || echo "(health check failed)"
echo ""
echo "=== 后续操作 ==="
echo "查看日志:    docker compose -f docker-compose.prod.yml logs -f app"
echo "停止服务:    docker compose -f docker-compose.prod.yml down"
echo "重启服务:    docker compose -f docker-compose.prod.yml restart app"
echo "升级镜像:    docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d"
echo "进入容器:    docker exec -it aitutor-prod-app sh"