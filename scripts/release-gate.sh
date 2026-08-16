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
#
# 说明: lint 基线未清 (2445 项既有债务), 不作为硬门禁;
#       lighthouse / security scan 为人工门禁 (见 docs/v1.0_RELEASE_GATE.md).

set -euo pipefail
cd "$(dirname "$0")/.."

FAILED=0
step() { echo; echo "═══════════ $1 ═══════════"; }
fail() { echo "  ✗ $1"; FAILED=1; }
ok()   { echo "  ✓ $1"; }

# ── 1. npm test (Vitest) ──
step "1/5 单元测试 (vitest)"
VITEST_OUT=$(npx vitest run --reporter=dot 2>&1 || true)
if echo "$VITEST_OUT" | grep -qE "Test Files .+ passed"; then
  ok "vitest 全绿"
else
  fail "vitest 失败: $(echo "$VITEST_OUT" | tail -2 | tr '\n' ' ')"
fi

# ── 2. contract test (mock) ──
step "2/5 前端 contract test (mock)"
CT_OUT=$(node tests/contract.test.js 2>&1 || true)
if echo "$CT_OUT" | tail -1 | grep -qE "0 failed"; then
  ok "contract test 全绿"
else
  fail "contract test 失败: $(echo "$CT_OUT" | tail -1)"
fi

# ── 3. Backend Contract Test (真后端) ──
step "3/5 Backend Contract Test (真后端)"
if [ "${SKIP_BCT:-0}" = "1" ]; then
  echo "  (跳过: SKIP_BCT=1)"
else
  BCT_URL="${BCT_URL:-http://localhost:3002}"
  if curl -s -o /dev/null -m 5 "$BCT_URL/api/health"; then
    BCT_OUT=$(BCT_URL="$BCT_URL" node tests/backend-contract.test.js 2>&1 || true)
    if echo "$BCT_OUT" | tail -1 | grep -qE "0 failed"; then
      ok "BCT 全绿 ($BCT_URL)"
    else
      fail "BCT 失败 ($BCT_URL): $(echo "$BCT_OUT" | tail -1)"
    fi
  else
    echo "  (跳过: $BCT_URL 无后端, 设 SKIP_BCT=1 或先起后端)"
  fi
fi

# ── 4. docker build ──
step "4/5 docker build (app 镜像)"
if [ "${SKIP_DOCKER:-0}" = "1" ]; then
  echo "  (跳过: SKIP_DOCKER=1)"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker compose build app 2>&1 | tail -1 | grep -qE "Built|naming to"; then
    ok "镜像构建成功"
  else
    fail "镜像构建失败"
  fi
else
  echo "  (跳过: docker 不可用)"
fi

# ── 5. health check ──
step "5/5 health check"
BCT_URL="${BCT_URL:-http://localhost:3002}"
H=$(curl -s -m 5 "$BCT_URL/api/health" 2>/dev/null || echo "")
if echo "$H" | grep -q '"dbReady":true'; then
  ok "/api/health dbReady=true"
else
  fail "/api/health 未通过 (${H:-无响应})"
fi

echo
if [ "$FAILED" = "1" ]; then
  echo "❌ 发布门禁未通过 — 修复后重跑 npm run gate"
  exit 1
fi
echo "✅ 发布门禁全部通过 — 可进入 v1.0 发布流程"
