#!/usr/bin/env bash
# scripts/release-gate.sh — v1.0 发布质量门禁 (Phase 4, 2026-08-15)
#
# 用法:
#   npm run gate                 # 全部门禁 (自起临时后端跑 BCT)
#   SKIP_BCT=1 npm run gate      # 跳过 Backend Contract Test (无后端时)
#   SKIP_DOCKER=1 npm run gate   # 跳过 docker build (CI 无 docker 时)
#   BCT_URL=https://staging.… npm run gate  # 显式外部后端; 此时不自起临时实例
#
# 门禁项:
#   1. npm test          — Vitest 单元测试
#   2. contract test     — 前端 service×mock contract (node tests/contract.test.js)
#   3. Backend Contract  — 真后端 envelope/契约测试 (临时实例, 独立限流桶)
#   4. docker build      — 镜像可构建 (app)
#   5. health check      — 后端 /api/health dbReady=true
#   6. repo consistency  — tracked 引用完整性 + .dockerignore 的 D079 边界 + nginx 部署模板
#                          + 无硬编码凭据 + SSRF/缩放/路由/视觉/AI-innerHTML 静态闸门
#   7. frontend behavior — 前端行为测试 (jsdom, tests/frontend/*)
#   8. api.js contract   — api.js 契约回归闸门 (170 项, tests/frontend/api-contract.test.mjs)
#   9. SSE 断连检测      — 流式响应禁 req.on('close') (scripts/check-no-sse-req-close.mjs)
#  10. GraphRAG settings — settings.yaml 字段名对 graphrag 模型字段 (禁被 extra=allow 静默吞,
#                         如 base_url vs 真字段 api_base) + api_base/api_key/model 非空
#                         (scripts/check-graphrag-settings-fields.mjs; 需 .venv, 缺则判红)
#  11. 错误回显收口      — err.message 禁入客户端响应体 (只进日志/状态码/抛出/服务层返回)
#                         (scripts/check-no-err-message-echo.mjs; AST 判据 + ALLOW 豁免)
#  12. 日志详情收口      — logger.<m>(…, { error }) 必须传 Error 对象 (禁 e.message/模板串)
#                         (scripts/check-logger-error-meta.mjs; AST 判据 + ALLOW 豁免)
#
# 2026-09-23 (限流×门禁冲突, 测试侧修复, 不动生产限流语义):
#   - 第 1 项旧写法 `VITEST_OUT=$(npx vitest …)` 在 `set -e` 下, 首个失败即整脚本
#     提前退出, 后续项根本不跑。现已改为逐项捕获退出码并聚合。
#   - BCT 不再打主实例 (会消耗其 authLimiter 20/15min 桶): 自起
#     PORT=3999 SKIP_TASK_WORKER=1 的临时实例, 进程内 MemoryStore 限流桶为鲜桶。
#   - BCT 专用退出码 0=全绿 / 1=契约失败 / 2=无 token / 3=RATE_LIMITED;
#     门禁把 3 诚实报为「限流污染, 本次未验证 BCT (非契约失败)」并计入失败,
#     绝不静默当通过。
#
# 说明: lint 基线未清 (2445 项既有债务), 不作为硬门禁;
#       lighthouse / security scan 为人工门禁 (见 docs/v1.0_RELEASE_GATE.md).

# 注意: 这里刻意不用 `set -e` —— 门禁要跑完所有项再汇总, 单项失败即退出会
# 掩盖后续项的真实状态。每项显式捕获退出码。
set -uo pipefail
cd "$(dirname "$0")/.."

FAILED=0
FAILED_ITEMS=()
step() { echo; echo "═══════════ $1 ═══════════"; }
# fail "<详情>" ["<汇总用短标签>"]
fail() { echo "  ✗ $1"; FAILED=1; FAILED_ITEMS+=("${2:-$1}"); }
ok()   { echo "  ✓ $1"; }

# ── 临时实例 (BCT 用) 生命周期 ──
# 必须保证任何退出路径 (含失败/中断) 都能回收, 不留僵尸进程。
BCT_TMP_PID=""
BCT_TMP_LOG=""
cleanup_bct_tmp() {
  if [ -n "$BCT_TMP_PID" ] && kill -0 "$BCT_TMP_PID" 2>/dev/null; then
    kill "$BCT_TMP_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$BCT_TMP_PID" 2>/dev/null || break
      sleep 0.2
    done
    if kill -0 "$BCT_TMP_PID" 2>/dev/null; then
      kill -9 "$BCT_TMP_PID" 2>/dev/null || true
    fi
    wait "$BCT_TMP_PID" 2>/dev/null || true
  fi
  BCT_TMP_PID=""
  if [ -n "$BCT_TMP_LOG" ]; then
    rm -f "$BCT_TMP_LOG"
    BCT_TMP_LOG=""
  fi
}
trap cleanup_bct_tmp EXIT

# 把 BCT 退出码翻译成门禁结论 —— 严格区分「验证通过」「契约失败」「没验证成」。
bct_verdict() {
  local rc="$1" out="$2" url="$3"
  case "$rc" in
    0)
      if echo "$out" | tail -1 | grep -qE "0 failed"; then
        ok "BCT 全绿 ($url)"
      else
        fail "BCT 退出码 0 但汇总行非 '0 failed' ($url): $(echo "$out" | tail -1)" "BCT 汇总异常"
      fi
      ;;
    1)
      fail "BCT 契约失败 (exit 1, $url): $(echo "$out" | tail -1)" "BCT 契约失败"
      ;;
    2)
      fail "BCT 未取到 token (exit 2) — 本次未验证 BCT ($url)" "BCT 未验证(无 token)"
      ;;
    3)
      fail "BCT 限流污染 RATE_LIMITED (exit 3) — 本次未验证 BCT (非契约失败) ($url)" "BCT 未验证(限流污染)"
      ;;
    *)
      fail "BCT 异常退出码 $rc ($url): $(echo "$out" | tail -1)" "BCT 异常(rc=$rc)"
      ;;
  esac
}

# ── BCT URL 解析 (auto-detect, 仅供 health check) ──
# 优先级: $BCT_URL (显式) > localhost:3002 (容器) > localhost:3999 (本地) > fail
# CI/CD: BCT_URL=https://staging.example.com npm run gate
#   → EXTERNAL_BCT_URL 非空, BCT 项直接用该地址 (不自起临时实例); 其余同理。
EXTERNAL_BCT_URL="${BCT_URL:-}"
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
# 2026-09-21 修复: 退出码才是权威判据 (会漏掉 "No test suite found" 一类错误)。
# 2026-09-23 修复: 加 `|| VITEST_RC=$?` —— 否则 set -e 下首项失败即整脚本退出。
step "1/12 单元测试 (vitest)"
VITEST_RC=0
VITEST_OUT=$(npx vitest run --reporter=dot 2>&1) || VITEST_RC=$?
if [ "$VITEST_RC" -ne 0 ]; then
  fail "vitest 退出码 $VITEST_RC: $(echo "$VITEST_OUT" | grep -E "× |Failed Tests|No test suite|Error:" | head -3 | tr '\n' ' ')" "vitest"
else
  ok "vitest 全绿"
fi

# ── 2. contract test (mock) ──
step "2/12 前端 contract test (mock)"
CT_RC=0
CT_OUT=$(node tests/contract.test.js 2>&1) || CT_RC=$?
if [ "$CT_RC" -eq 0 ] && echo "$CT_OUT" | tail -1 | grep -qE "0 failed"; then
  ok "contract test 全绿"
else
  fail "contract test 退出码 $CT_RC: $(echo "$CT_OUT" | tail -1)" "前端 contract (mock)"
fi

# ── 3. Backend Contract Test (真后端, 临时实例 / 独立限流桶) ──
step "3/12 Backend Contract Test (真后端)"
if [ "${SKIP_BCT:-0}" = "1" ]; then
  echo "  (跳过: SKIP_BCT=1)"
elif [ -n "$EXTERNAL_BCT_URL" ]; then
  # 显式外部后端 (CI/CD staging) — 尊重调用方, 不自起临时实例。
  echo "  (使用显式外部 BCT_URL=$EXTERNAL_BCT_URL, 不自起临时实例)"
  BCT_RC=0
  BCT_OUT=$(BCT_URL="$EXTERNAL_BCT_URL" node tests/backend-contract.test.js 2>&1) || BCT_RC=$?
  bct_verdict "$BCT_RC" "$BCT_OUT" "$EXTERNAL_BCT_URL"
else
  BCT_TMP_PORT="${BCT_TMP_PORT:-3999}"
  BCT_TMP_URL="http://localhost:${BCT_TMP_PORT}"
  # 端口占用预检: 已有服务在响应 → 如实报错, 绝不回退打主实例 (会污染其限流桶)。
  if curl -sf -o /dev/null -m 2 "$BCT_TMP_URL/api/health"; then
    fail "临时实例端口 $BCT_TMP_PORT 已被占用 (疑似残留实例); 请清理后重跑。不回退打主实例。" "BCT 临时实例端口占用"
  else
    BCT_TMP_LOG="$(mktemp -t bct-tmp.XXXXXX.log)"
    echo "  (启动临时实例: PORT=$BCT_TMP_PORT SKIP_TASK_WORKER=1 node server.js)"
    PORT="$BCT_TMP_PORT" SKIP_TASK_WORKER=1 node server.js >"$BCT_TMP_LOG" 2>&1 &
    BCT_TMP_PID=$!
    BCT_READY=0
    for _ in $(seq 1 30); do
      # 进程若中途死掉, 提前结束轮询并以未就绪处理 (日志会暴露原因)。
      kill -0 "$BCT_TMP_PID" 2>/dev/null || break
      if curl -sf -o /dev/null -m 2 "$BCT_TMP_URL/api/health"; then
        BCT_READY=1
        break
      fi
      sleep 1
    done
    if [ "$BCT_READY" != "1" ]; then
      fail "临时实例未就绪 (PORT=$BCT_TMP_PORT, 上限 30s) — 不回退打主实例。日志尾: $(tail -3 "$BCT_TMP_LOG" | tr '\n' ' ')" "BCT 临时实例未就绪"
    else
      echo "  (临时实例就绪, BCT_URL=$BCT_TMP_URL — 独立进程内存限流桶)"
      BCT_RC=0
      BCT_OUT=$(BCT_URL="$BCT_TMP_URL" node tests/backend-contract.test.js 2>&1) || BCT_RC=$?
      bct_verdict "$BCT_RC" "$BCT_OUT" "$BCT_TMP_URL"
    fi
    cleanup_bct_tmp
  fi
fi

# ── 4. docker build ──
step "4/12 docker build (app 镜像)"
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
    fail "镜像构建失败 (5 分钟 timeout)" "docker build"
  fi

# Audit-2026-08-24 Fix-4: server.js 直挂端点守门
# 当前基线 7 个直挂 endpoint (provinces + province-trends + exam-pdf + adaptive-difficulty +
# class-detail + proxy + cache/clear-provinces + provinces/seed). 任何新增必须走 api/modules/*.
# 非 API 的前端/重定向路由不算 (/, /index.html, /app, /frontend, /api-docs, /api/health)
DIRECT=$(grep -cE "^app\.(get|post|put|delete)\('/api/" server.js || true)
if [ "$DIRECT" -le 12 ]; then
  ok "server.js 直挂 endpoint 数: $DIRECT (基线 ≤ 12, 避免绕过 modules)"
else
  fail "server.js 直挂 endpoint 过多 ($DIRECT), 新增请走 api/modules/*" "直挂端点超基线"
fi
else
  echo "  (跳过: docker 不可用)"
fi

# ── 5. health check (使用 auto-detect 的 BCT_URL) ──
step "5/12 health check"
if [ -z "$BCT_URL" ]; then
  echo "  (跳过: 无 BCT_URL)"
  fail "/api/health 未通过 (无后端)" "health check"
else
  H=$(curl -s -m 5 "$BCT_URL/api/health" 2>/dev/null || echo "")
  if echo "$H" | grep -q '"dbReady":true'; then
    ok "/api/health dbReady=true ($BCT_URL)"
  else
    fail "/api/health 未通过 ($BCT_URL): ${H:-无响应}" "health check"
  fi
fi

# ── 6. 仓库一致性 (引用完整性 + D079 构建边界 + nginx 部署模板) ──
# 2026-09-20 架构评审 R1/R4 (docs/audits/architecture-review-2026-09-20.md):
#   R1 — tracked 文件引用的本地资源必须也在 git 里, 否则干净 clone 跑不起来;
#   R4 — .dockerignore 必须排除 AI Agent 元数据 (D079 §2.4/§9).
# 2026-09-20 追加: deploy/*.conf 是模板, 不参与构建, 坏了没有任何地方会暴露
#   (实例: uibe.conf 重复 upstream, nginx -t 报错但无人发现) → 在此拦截。
step "6/12 仓库一致性 (引用完整性 + D079 边界 + nginx 模板 + 凭据)"
if node scripts/check-tracked-refs.mjs; then
  ok "tracked 引用完整性 (无未入库的运行时依赖)"
else
  fail "存在被 tracked 引用但未入库的本地资源 (清单见上)" "tracked 引用完整性"
fi

D079_ABSENT=""
for p in '.ai/' 'openwiki/'; do
  grep -qF -- "$p" .dockerignore || D079_ABSENT="$D079_ABSENT $p"
done
if [ -z "$D079_ABSENT" ]; then
  ok ".dockerignore 已排除 .ai/ + openwiki/ (D079 §2.4/§9)"
else
  fail ".dockerignore 缺 D079 要求的排除项:$D079_ABSENT" "D079 构建边界"
fi

if node scripts/check-nginx-conf.mjs; then
  ok "nginx 部署模板语法 (deploy/*.conf)"
else
  fail "nginx 部署模板校验失败 (见上; 无 nginx/openssl 时会降级为仅静态检查)" "nginx 模板"
fi

# 2026-09-21: 增量安全扫描只扫 diff, scripts/ 下 13 处硬编码 postgres 口令
# 长期无人发现 —— 人工发现必须落成永久闸门, 否则同类问题会复现。
if node scripts/check-no-hardcoded-secrets.mjs; then
  ok "无硬编码凭据 (连接串内联 / 明文口令赋值)"
else
  fail "存在硬编码凭据 (清单见上; 请改为环境变量读取, 缺失即报错)" "硬编码凭据"
fi

# 2026-09-22 全仓安全扫描 (批次 project-fast-20260922132755) F1–F3:
# api/handlers/essay 三处用 req.get('host') + req.protocol 拼内部自调用地址,
# 并把调用方 JWT 转发过去 —— Host 头客户端可控即 SSRF, 且 /api/auth/guest-login
# 是公开路由, 无需凭证即可拿 7 天 JWT 触发。三处同一模式, 只靠人工会漏。
# 判据: 外发调用地址不得由请求头派生 (命中输出 file:line)。
if node scripts/check-no-host-header-ssrf.mjs; then
  ok "内部自调用地址未取自请求头 (无 Host/protocol 拼接 SSRF)"
else
  fail "内部自调用地址由请求头拼出 (见上; 请用 SELF_BASE_URL 或 127.0.0.1:\$PORT)" "Host 头 SSRF"
fi

# 2026-09-21 (G6): mastery_score 曾被两套标度读写(差 100 倍), 导致 SRS 复习把
# 掌握度 60 覆写成 1 —— 两边各自自洽, 单测发现不了, 只能靠静态判据拦。
if node tests/api/mastery-scale-guard.test.js; then
  ok "mastery 标度一致 (0..100)"
else
  fail "mastery 标度疑似分裂 (见上; 例外须写进 tests/api/mastery-scale-guard.test.js 的 ALLOW 并注明理由)" "mastery 标度"
fi

# 2026-09-21 (G6-c): 线上实际约束(0..1) 与 db.js 声明(0..100) 曾长期不一致 ——
# 仓库 schema 说一套、线上跑另一套, 任何按 db.js 新建的库都会得到不同的约束。
# 比对射程: 声明表是否存在 + 数值列精度 + CHECK 约束定义(语义归一化)。
if node scripts/check-schema-drift.mjs; then
  ok "仓库 schema 与线上一致 (数值精度 + CHECK)"
else
  fail "schema drift (见上; 有意差异须登记到 scripts/check-schema-drift.mjs 的 ALLOW 并注明理由)" "schema drift"
fi

# 2026-09-21 (Q3): 新主树路由是"静默失效"的典型 —— 中间件顺序被调、或某页从
# NEW_TREE_PAGES 漏掉, 用户会在不知不觉中回到旧页面而无处报警(同审计 R1 一类)。
# 判据: 列表内每页 200 且 md5 == frontend-v2 本地文件 + 资源命名空间可用 + 旧树兜底完好。
if node scripts/check-new-tree-routing.mjs; then
  ok "新主树路由正常 (接管页 md5 校验 + 旧树兜底)"
else
  fail "新主树路由异常 (见上; 可能是中间件顺序或 NEW_TREE_PAGES 与 frontend-v2 不一致)" "新主树路由"
fi

# 2026-09-21: 用户指定 hero.html 为新树的风格与规格基准。已把 hero 内联样式原样
# 抽成 system.css 并用本门禁保证"标准被真正用起来"（分级：接管页强制 / 原型页记欠账）。
if node scripts/check-ui-standard.mjs; then
  ok "前端视觉标准达标 (标准件 + 骨架 + 无境外请求)"
else
  fail "前端视觉标准未达标 (见上; 视觉只改 system.css，页面差异放 app.css)" "视觉标准"
fi

# 2026-09-23 全仓安全评审 M-4: public/src/js/tutor-stream.js:208 把 LLM SSE delta
# 未消毒拼进 innerHTML (`container.innerHTML += pending`) —— 当前死代码, 但接线即
# Critical, 且 token 存 localStorage。人工发现必须落成永久闸门, 否则同类问题会反复。
# 判据: 非静态 innerHTML 赋值/拼接、insertAdjacentHTML、document.write 均须登记到
# scripts/check-no-ai-innerhtml.mjs 的 ALLOW (含理由+日期), 否则命中即非零退出。
if node scripts/check-no-ai-innerhtml.mjs; then
  ok "AI 输出未消毒进入 innerHTML (非静态 innerHTML / insertAdjacentHTML / document.write)"
else
  fail "存在未登记的 AI/LLM 数据进入 innerHTML 风险 (见上; 请改用 textContent/createTextNode, 公式用 KaTeX(trust:false), 或登记到 ALLOW)" "AI innerHTML"
fi

# ── 7. 前端行为测试 (jsdom) ──
# 2026-09-21: 新主树 frontend-v2/ 的每页都以"六态机 + 错误分类"验收,
# 测试落在 tests/frontend/ 里独立跑, 无人守门 —— 改动共享层(ui.js/api.js/app.css)
# 可以悄悄破坏所有页面而不被发现。接入门禁即为这条回归兜底。
step "7/12 前端行为测试 (jsdom)"
FE_RC=0
FE_OUT=$(npm run --silent test:frontend 2>&1) || FE_RC=$?
if [ "$FE_RC" -ne 0 ] || echo "$FE_OUT" | grep -qE "FAIL|❌"; then
  fail "前端行为测试失败 (rc=$FE_RC): $(echo "$FE_OUT" | grep -E "FAIL|❌" | head -3 | tr '\n' ' ')" "前端行为测试"
else
  ok "前端行为测试全绿 (tests/frontend/*)"
fi

# ── 8. api.js 契约回归闸门 (jsdom) ──
# tests/frontend/api-contract.test.mjs 早已存在 (170 项) 却未挂任何链 —— api.js 是
# 所有页面的共享层, 改动必须再过本闸门。package.json 改动会被供应链 hook 拒绝,
# 故在 shell 侧挂接。
step "8/12 api.js 契约闸门 (jsdom, 170 项)"
APIC_RC=0
APIC_OUT=$(node tests/frontend/api-contract.test.mjs 2>&1) || APIC_RC=$?
if [ "$APIC_RC" -eq 0 ]; then
  ok "api.js 契约全绿 (tests/frontend/api-contract.test.mjs)"
else
  fail "api.js 契约失败 (rc=$APIC_RC): $(echo "$APIC_OUT" | grep -E '^FAIL' | head -3 | tr '\n' ' ') | $(echo "$APIC_OUT" | tail -1)" "api.js 契约"
fi

# ── 9. SSE/流式响应的断连检测 (禁 req.on('close')) ──
# 2026-09-23 (实测复现): api/routes/tutor-agent.js 的 /ask/stream 原用
# req.on('close') 判断客户端断连。Node 22 下请求体被 express.json 读完即触发
# req 'close' → closed 在任何事件写出前被置 true → 整条 SSE 流是空的。
# 这类回归 review 看不出来 (写法"看起来很对"), 必须机械化: 命中 req 的 'close'
# 监听且处于 SSE/流式 handler 内即判红; 非流式请求的清理逻辑如实放行不误杀。
step "9/12 SSE 断连检测 (流式响应禁 req.on('close'))"
if node scripts/check-no-sse-req-close.mjs; then
  ok "无 SSE/流式响应使用 req.on('close')"
else
  fail "SSE/流式响应用了 req.on('close') (见上; 请改 res.on('close'), 例外登记到 scripts/check-no-sse-req-close.mjs 的 ALLOW)" "SSE req.on('close')"
fi

# ── 10. GraphRAG settings.yaml 字段名闸门 (禁被 extra=allow 静默吞) ──
# 2026-09-23 真实事故 (修复 f06fbc8): indexer.py 把 LLM/embedding 的 base URL 写成
# `base_url`, 而 graphrag_llm.ModelConfig 真字段名是 `api_base`。该模型 extra="allow" ——
# 写错的字段被静默忽略、api_base=None, litellm 退回默认 https://api.openai.com/v1;
# 本机 DNS 又把该域名指向黑洞 IP → 整个索引卡死, 表面"配置都在、进程也在"。
# 这类错 review 看不出 (因为不报错), 必须机械拦: 字段集从 .venv 里 import graphrag 的
# pydantic 模型取得 (不硬编码), 并校验 api_base/api_key/model 非空 + vector_size。
# 缺 .venv / graphrag 导入失败时, 脚本判红 (不静默 pass —— 否则即复现该事故)。
step "10/12 GraphRAG settings.yaml 字段名 (禁 extra=allow 静默吞字段)"
if node scripts/check-graphrag-settings-fields.mjs; then
  ok "GraphRAG settings 字段名与 graphrag 模型一致 (api_base/api_key/model 非空)"
else
  fail "GraphRAG settings.yaml 字段名/取值异常 (见上; 写错字段会被 ModelConfig(extra=allow) 静默吞 → 打默认端点卡死; 缺 .venv 亦判红)" "GraphRAG settings 字段"
fi

step "11/12 错误回显收口 (err.message 禁入响应体)"
if node scripts/check-no-err-message-echo.mjs; then
  ok "无错误对象 message 进入响应体 (err.message 只进日志)"
else
  fail "错误对象 message 被拼进响应体 (见上; 请改固定文案, err.message 只留给日志, 例外登记到 scripts/check-no-err-message-echo.mjs 的 ALLOW)" "错误回显"
fi

# ── 12. 日志详情收口 (logger meta.error 必须传 Error 对象) ──
# 2026-09-24 (M-2b 余波): 多处 logger.<m>(msg, { error: e.message }) 传的是字符串, 而
# logger.js:70 按 meta.error.message 取详情、:113 按 meta.error?.stack 取堆栈 ——
# 字符串两者皆 undefined, 日志里 err.message 静默丢失 (响应体已改固定文案, 详情无处可查)。
# 与第 11 段是**不同关切**: 第 11 段防"详情泄露进响应体"(安全), 本段防"详情丢出日志"
# (可观测性)。故独立成段, 失败标签与 ALLOW 各自独立。
step "12/12 日志详情收口 (logger meta.error 必须传 Error 对象)"
if node scripts/check-logger-error-meta.mjs; then
  ok "logger meta.error 均传 Error 对象 (err.message 未丢失)"
else
  fail "logger meta.error 传了字符串 (见上; 请改 { error: e }, 例外登记到 scripts/check-logger-error-meta.mjs 的 ALLOW)" "日志详情"
fi

echo
if [ "$FAILED" = "1" ]; then
  echo "❌ 发布门禁未通过 — 失败项汇总:"
  i=1
  for item in "${FAILED_ITEMS[@]}"; do
    echo "   $i) $item"
    i=$((i + 1))
  done
  echo "   修复后重跑 npm run gate"
  exit 1
fi
echo "✅ 发布门禁全部通过 — 可进入 v1.0 发布流程"
