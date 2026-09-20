#!/usr/bin/env bash
# scripts/release-gate.sh — v1.0 发布质量门禁 (Phase 4, 2026-08-15)
#
# 用法:
#   npm run gate                 # 全部门禁 (需要后端 :3002 或 BCT_URL 指定)
#   SKIP_BCT=1 npm run gate      # 跳过 Backend Contract Test (无后端时)
#   SKIP_DOCKER=1 npm run gate   # 跳过 docker build (CI 无 docker 时)
#
# 门禁项:
#   1. npm test          — Vitest 单元测试 (241 用例)
#   2. contract test     — 前端 service×mock contract (38 项, node tests/contract.test.js)
#   3. Backend Contract  — 真后端 envelope/契约测试 (19 项, 需运行中的后端)
#   4. docker build      — 镜像可构建 (app)
#   5. health check      — 后端 /api/health dbReady=true
#   6. repo consistency  — tracked 引用完整性 + .dockerignore 的 D079 边界 + nginx 部署模板
#
# 说明: lint 基线未清 (2445 项既有债务), 不作为硬门禁;
#       lighthouse / security scan 为人工门禁 (见 docs/v1.0_RELEASE_GATE.md).

set -euo pipefail
cd "$(dirname "$0")/.."

FAILED=0
step() { echo; echo "═══════════ $1 ═══════════"; }
fail() { echo "  ✗ $1"; FAILED=1; }
ok()   { echo "  ✓ $1"; }

# ── BCT URL 解析 (auto-detect, P0 v1.0 RC1 稳定化) ──
# 优先级: $BCT_URL (显式) > localhost:3002 (容器) > localhost:3999 (本地) > fail
# CI/CD: BCT_URL=https://staging.example.com npm run gate  (最高优先级, 不被 auto 覆盖)
resolve_bct_url() {
  if [ -n "${BCT_URL:-}" ]; then
    echo "$BCT_URL"
    return
  fi
  for url in "http://localhost:3002" "http://localhost:3999"; do
    if curl -sf -o /dev/null -m 3 "$url/api/health"; then
      echo "$url"
      return
    fi
  done
  echo ""
}

BCT_URL=$(resolve_bct_url || true)

# ── 1. npm test (Vitest) ──
# Audit-2026-08-24 Fix-1: 严格判断 vitest 全绿
# 旧逻辑 grep "Test Files .+ passed" 会误判 — vitest 失败时也输出 "passed" 字符串 (如 "1 failed | 12 passed")
# 新逻辑: 检查 vitest 输出没有 "failed" 标记 (失败时 vitest 会输出 "×" + "Failed Tests N" + "Tests  N failed")
step "1/6 单元测试 (vitest)"
VITEST_OUT=$(npx vitest run --reporter=dot 2>&1 || true)
if echo "$VITEST_OUT" | grep -qE "Failed Tests|× |failed "; then
  fail "vitest 失败: $(echo "$VITEST_OUT" | grep -E "× |Failed Tests" | head -3 | tr '\n' ' ')"
else
  ok "vitest 全绿"
fi

# ── 2. contract test (mock) ──
step "2/6 前端 contract test (mock)"
CT_OUT=$(node tests/contract.test.js 2>&1 || true)
if echo "$CT_OUT" | tail -1 | grep -qE "0 failed"; then
  ok "contract test 全绿"
else
  fail "contract test 失败: $(echo "$CT_OUT" | tail -1)"
fi

# ── 3. Backend Contract Test (真后端) ──
step "3/6 Backend Contract Test (真后端)"
if [ "${SKIP_BCT:-0}" = "1" ]; then
  echo "  (跳过: SKIP_BCT=1)"
elif [ -z "$BCT_URL" ]; then
  echo "  (跳过: 无 BCT_URL, 也无 3002/3999 活后端, 设 SKIP_BCT=1 或起后端)"
  fail "无后端可测"
else
  echo "  (使用: BCT_URL=$BCT_URL)"
  BCT_OUT=$(BCT_URL="$BCT_URL" node tests/backend-contract.test.js 2>&1 || true)
  if echo "$BCT_OUT" | tail -1 | grep -qE "0 failed"; then
    ok "BCT 全绿 ($BCT_URL)"
  else
    fail "BCT 失败 ($BCT_URL): $(echo "$BCT_OUT" | tail -1)"
  fi
fi

# ── 4. docker build ──
step "4/6 docker build (app 镜像)"
if [ "${SKIP_DOCKER:-0}" = "1" ]; then
  echo "  (跳过: SKIP_DOCKER=1)"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # 2026-09-19: 原来跑 `docker compose build app`, 但 docker-compose.yml (开发) 的 app
  # 只挂源码不构建 (无 build: 段) —— 恒输出 "No services to build", 门禁从未真正构建过.
  # 构建配置在 docker-compose.prod.yml, 改用它.
  # 2026-08-20 DSH: docker build 加 10 分钟 timeout, 避免 DSH 60s shell timeout 截断
  if timeout 600 docker compose -f docker-compose.prod.yml build app 2>&1 | tail -1 | grep -qE "Built|naming to|writing image"; then
    ok "镜像构建成功"
  else
    fail "镜像构建失败 (5 分钟 timeout)"
  fi

# Audit-2026-08-24 Fix-4: server.js 直挂端点守门
# 当前基线 7 个直挂 endpoint (provinces + province-trends + exam-pdf + adaptive-difficulty +
# class-detail + proxy + cache/clear-provinces + provinces/seed). 任何新增必须走 api/modules/*.
# 非 API 的前端/重定向路由不算 (/, /index.html, /app, /frontend, /api-docs, /api/health)
DIRECT=$(grep -cE "^app\.(get|post|put|delete)\('/api/" server.js || true)
if [ "$DIRECT" -le 12 ]; then
  ok "server.js 直挂 endpoint 数: $DIRECT (基线 ≤ 12, 避免绕过 modules)"
else
  fail "server.js 直挂 endpoint 过多 ($DIRECT), 新增请走 api/modules/*"
fi
else
  echo "  (跳过: docker 不可用)"
fi

# ── 5. health check (使用 auto-detect 的 BCT_URL) ──
step "5/6 health check"
if [ -z "$BCT_URL" ]; then
  echo "  (跳过: 无 BCT_URL, 6/6 跳)"
  fail "/api/health 未通过 (无后端)"
else
  H=$(curl -s -m 5 "$BCT_URL/api/health" 2>/dev/null || echo "")
  if echo "$H" | grep -q '"dbReady":true'; then
    ok "/api/health dbReady=true ($BCT_URL)"
  else
    fail "/api/health 未通过 ($BCT_URL): ${H:-无响应}"
  fi
fi

# ── 6. 仓库一致性 (引用完整性 + D079 构建边界 + nginx 部署模板) ──
# 2026-09-20 架构评审 R1/R4 (docs/audits/architecture-review-2026-09-20.md):
#   R1 — tracked 文件引用的本地资源必须也在 git 里, 否则干净 clone 跑不起来;
#   R4 — .dockerignore 必须排除 AI Agent 元数据 (D079 §2.4/§9).
# 2026-09-20 追加: deploy/*.conf 是模板, 不参与构建, 坏了没有任何地方会暴露
#   (实例: uibe.conf 重复 upstream, nginx -t 报错但无人发现) → 在此拦截。
step "6/6 仓库一致性 (引用完整性 + D079 边界 + nginx 模板)"
if node scripts/check-tracked-refs.mjs; then
  ok "tracked 引用完整性 (无未入库的运行时依赖)"
else
  fail "存在被 tracked 引用但未入库的本地资源 (清单见上)"
fi

D079_ABSENT=""
for p in '.ai/' 'openwiki/'; do
  grep -qF -- "$p" .dockerignore || D079_ABSENT="$D079_ABSENT $p"
done
if [ -z "$D079_ABSENT" ]; then
  ok ".dockerignore 已排除 .ai/ + openwiki/ (D079 §2.4/§9)"
else
  fail ".dockerignore 缺 D079 要求的排除项:$D079_ABSENT"
fi

if node scripts/check-nginx-conf.mjs; then
  ok "nginx 部署模板语法 (deploy/*.conf)"
else
  fail "nginx 部署模板校验失败 (见上; 无 nginx/openssl 时会降级为仅静态检查)"
fi

echo
if [ "$FAILED" = "1" ]; then
  echo "❌ 发布门禁未通过 — 修复后重跑 npm run gate"
  exit 1
fi
echo "✅ 发布门禁全部通过 — 可进入 v1.0 发布流程"
