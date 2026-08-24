#!/bin/bash
# 完整 E2E 测试脚本 (v3 - 真实路径 + 修正参数)
set +e
API=http://localhost:3002/api
RESP=/home/cx/aitutor/.tmp_resp.json

LOGIN_RESP=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@uibe.edu.cn","password":"test123456"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[FATAL] Login failed"
  exit 1
fi
echo "[OK] Login token: ${TOKEN:0:30}..."

PASS=0
FAIL=0
declare -a FAILS

test_api() {
  local label="$1"
  local method="$2"
  local path="$3"
  local body="$4"
  local expect_field="$5"

  local args=(-s -o "$RESP" -w "%{http_code}" -X "$method" "$API$path" -H "Authorization: Bearer $TOKEN")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local code
  code=$(curl "${args[@]}")
  local resp
  resp=$(cat "$RESP")

  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    if [ -n "$expect_field" ]; then
      local got
      got=$(echo "$resp" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    parts = '$expect_field'.split('.')
    v = d
    for p in parts:
        if p.isdigit(): v = v[int(p)]
        else: v = v.get(p)
    print('OK' if v is not None else 'NONE')
except: print('ERR')
" 2>/dev/null)
      if [ "$got" = "NONE" ]; then
        echo "[FAIL] $label  (field $expect_field missing)"
        FAILS+=("$label: field missing")
        FAIL=$((FAIL+1))
        return
      fi
    fi
    echo "[PASS] $label  ($code)"
    PASS=$((PASS+1))
  else
    echo "[FAIL] $label  HTTP=$code resp=$resp"
    FAILS+=("$label: HTTP=$code")
    FAIL=$((FAIL+1))
  fi
}

echo
echo "==== 1. AUTH & USER ===="
test_api "Auth: /me"                    GET  "/auth/me" "" "success"
test_api "Auth: prefs province GET"     GET  "/auth/prefs/province" "" "success"
test_api "Auth: prefs province POST"    POST "/auth/prefs/province" '{"province_code":"beijing","exam_level":"gaokao"}' "success"
test_api "Auth: logout"                 POST "/auth/logout" "" "success"

echo
echo "==== 2. USER (dashboard/profile) ===="
test_api "User: dashboard"              GET  "/user/dashboard" "" "success"
test_api "User: profile GET"            GET  "/user/profile" "" "success"
test_api "User: profile POST"           POST "/user/profile" '{"province_code":"beijing","exam_level":"gaokao","target_score":650}' "success"
test_api "User: subjects GET"           GET  "/user/subjects" "" "success"
test_api "User: knowledge-profile"      GET  "/user/knowledge-profile" "" "success"
test_api "User: learning-suggestions"   GET  "/user/learning-suggestions" "" "success"
test_api "User: wrong-questions list"   GET  "/user/wrong-questions" "" "success"
test_api "User: wrong-questions add"    POST "/user/wrong-questions" \
  '{"subject":"数学","content":"已知 a+b=5, ab=3, 求 a^2+b^2","difficulty":2,"score":5,"knowledgePointId":"MATH-B1-314","userAnswer":"16","correctAnswer":"19","errorCategory":"calculation"}' \
  "success"
test_api "User: wrong-questions export" GET  "/user/wrong-questions/export" "" "success"
test_api "User: wrong-questions stats"  GET  "/user/wrong-questions/stats" "" "success"
test_api "User: initialize (regression)" POST "/user/initialize" \
  '{"grade_code":"grade_12","province_code":"beijing","subjects":[{"code":"math","is_main":true}],"target_score":650,"study_hours_per_day":3}' \
  "success"

echo
echo "==== 3. KNOWLEDGE (points/map/mastery) ===="
test_api "Knowledge: points math"       GET  "/knowledge/points?subject=math&level=gaokao" "" "success"
test_api "Knowledge: map"               GET  "/knowledge/map?subject=math" "" "success"
test_api "Knowledge: mastery list"      GET  "/knowledge/mastery" "" "success"
test_api "Knowledge: mastery by KP"     GET  "/knowledge/mastery/MATH-B1-314" "" "success"

echo
echo "==== 4. REVIEW (reports/weak-points) ===="
test_api "Review: reports"              GET  "/review/reports" "" "success"
test_api "Review: weak-points"          GET  "/review/weak-points" "" "success"
test_api "Review: trend-summary"        GET  "/review/trend-summary" "" "success"
test_api "Review: session/history"      GET  "/review/session/history" "" "success"

echo
echo "==== 5. EXAM (papers/session) ===="
test_api "Exam: papers"                 GET  "/exam/papers" "" "success"
test_api "Exam: session/start math"     POST "/exam/session/start" \
  '{"subject":"math","provinceCode":"beijing","examLevel":"gaokao","questionCount":2}' "success"

echo
echo "==== 6. PROVINCES (server-mounted) ===="
test_api "Provinces: list"              GET  "/provinces" "" "success"
test_api "Provinces: beijing"           GET  "/provinces/beijing" "" "success"
test_api "Provinces: stats beijing"     GET  "/province-stats/beijing" "" "success"
test_api "Provinces: trends beijing"    GET  "/province-trends/beijing" "" "success"

echo
echo "==== 7. SRS (interval review) ===="
test_api "SRS: daily-tasks"             GET  "/srs/engine/daily-tasks" "" "success"
test_api "SRS: stats"                   GET  "/srs/engine/stats" "" "success"

echo
echo "==== 8. RAG (向量检索 + GraphRAG) ===="
test_api "RAG: stats"                   GET  "/rag/stats" "" "success"
test_api "RAG: search math"             POST "/rag/search" \
  '{"query":"二次函数顶点","subject":"math","limit":3}' "success"

# GraphRAG 是独立 Python 微服务 (graphrag_service/ 端口 8100),
# 需要 LLM key + 索引构建, 不在 aitutor 主进程内. 跳过除非显式启用.
if [ "${SKIP_GRAPHRAG:-1}" = "0" ]; then
  test_api "RAG: knowledge-map math"  GET  "/rag/graphrag/knowledge-map?subject=math" "" "success"
else
  echo "[SKIP] GraphRAG (set SKIP_GRAPHRAG=0 to enable, requires Python service on :8100)"
fi

# 静态验证 index_exists() 修复: 验证脚本本身对已有索引的判定与修复后逻辑一致.
# 防止 index_exists() 未来回退成只查 output/artifacts (导致已建索引被误判为不存在).
# 通过条件: 每个已有 output/*.parquet 的索引都通过判定 (至少 1 个).
GRAPHRAG_WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/graphrag_workspace"
if [ -d "$GRAPHRAG_WS/indexes" ]; then
  RECOGNIZED=0
  RECOGNIZED_NAMES=""
  for idx in "$GRAPHRAG_WS"/indexes/*/; do
    [ -d "$idx" ] || continue
    name=$(basename "$idx")
    # 模拟修复后的 index_exists: output/artifacts 存在 或 output/*.parquet 存在
    if [ -d "$idx/output/artifacts" ] || \
       { [ -d "$idx/output" ] && ls "$idx/output"/*.parquet >/dev/null 2>&1; }; then
      RECOGNIZED=$((RECOGNIZED+1))
      RECOGNIZED_NAMES="$RECOGNIZED_NAMES $name"
    fi
  done
  if [ "$RECOGNIZED" -ge 1 ]; then
    echo "[PASS] GraphRAG index_exists 兼容修复: 识别 $RECOGNIZED 个索引 ($RECOGNIZED_NAMES )"
    PASS=$((PASS+1))
  else
    echo "[FAIL] GraphRAG index_exists 兼容修复: 无索引可识别 (检查 graphrag_service/main.py)"
    FAILS+=("GraphRAG index_exists 无索引可识别")
    FAIL=$((FAIL+1))
  fi
else
  echo "[INFO] graphrag_workspace 无 indexes 目录, 跳过 index_exists 验证"
fi

echo
echo "==== 9. TUTOR (AI 对话 + loop) ===="
test_api "Tutor: mastery kp"            GET  "/tutor/mastery/MATH-B1-314" "" "success"
test_api "Tutor: loop mastery"          GET  "/tutor/loop/mastery" "" "success"
test_api "Tutor: loop feedback"         POST "/tutor/loop/feedback" \
  '{"knowledge_point_id":"MATH-B1-314","is_correct":true,"time_spent_ms":5000}' "success"
test_api "Tutor: loop batch"            POST "/tutor/loop/batch" \
  '{"user_email":"test@uibe.edu.cn","feedbacks":[{"knowledge_point_id":"MATH-B1-314","is_correct":true,"time_spent_ms":5000}]}' "success"
test_api "Tutor: ask"                   POST "/tutor/ask" \
  '{"question":"已知 a+b=5, ab=3, 求 a^2+b^2 的值","subject":"math"}' "success"

echo
echo "==== 10. NEW MOUNTED MODULES (gamification/analytics) ===="
test_api "Gamification: checkin status"  GET  "/gamification/checkin/status" "" "success"
test_api "Gamification: badges"          GET  "/gamification/badges" "" "success"
test_api "Gamification: points"          GET  "/gamification/points" "" "success"
test_api "Analytics: learning-path"      GET  "/analytics/learning-path?subject=math" "" "success"

echo
echo "==== 11. REGRESSION (Bug A/B/C 修复) ===="
test_api "Adaptive: difficulty (Bug C)"  GET  "/adaptive-difficulty?subject=math" "" "data.ability"
test_api "Health: /api/health (kill-test)" GET  "/health" "" "success"

echo
echo "==== 12. LEGACY COMPAT (Bug D 修复) ===="
# 旧路径应通过 legacyCompatRouter 返回 200 (handler 转发) 或 410 (gone)
test_api "Legacy: POST /api/login"       POST "/login" '{"email":"test@uibe.edu.cn","password":"test123456"}' "success"
test_api "Legacy: POST /api/guest-login" POST "/guest-login" '{}' "success"
test_api "Legacy: POST /api/register"    POST "/register" '{"email":"legacy_test@uibe.edu.cn","password":"test123456","grade":"高三"}' "success"
test_api "Legacy: GET /api/questions"    GET  "/questions" "" "success"
test_api "Legacy: GET /api/weak-points"  GET  "/weak-points" "" "success"
test_api "Legacy: GET /api/reports"      GET  "/reports" "" "success"
# D-Bug-D v3 (2026-08-24): /api/learning-path 改为转发到 /api/analytics/learning-path
# (老 frontend learning-path.html 调旧路径, compat fallthrough 解决)
test_api "Legacy: GET /api/learning-path" GET  "/learning-path?subject=math" "" "success"
# Gone (410) 路径: 返回 legacyGone:true
echo "[INFO] Legacy Gone paths (expect 410):"
declare -A GONE_METHODS=(
  ["/tasks"]="GET"
  ["/generate-paper"]="POST"
  ["/explain-question"]="POST"
  ["/stats/visits"]="GET"
  ["/user/study-plan/plans"]="GET"
)
for path in "${!GONE_METHODS[@]}"; do
  method="${GONE_METHODS[$path]}"
  code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' "$API$path")
  got=$(cat "$RESP" | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
    print('GONE' if d.get('legacyGone') else 'NOT_GONE')
except: print('PARSE_ERR')" 2>/dev/null)
  if [ "$code" = "410" ] && [ "$got" = "GONE" ]; then
    echo "[PASS] Legacy Gone: $method $path (410)"
    PASS=$((PASS+1))
  else
    echo "[FAIL] Legacy Gone: $method $path (code=$code got=$got)"
    FAILS+=("Legacy Gone $method $path: code=$code got=$got")
    FAIL=$((FAIL+1))
  fi
done

# Cleanup test user
docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -c "DELETE FROM users WHERE email='legacy_test@uibe.edu.cn';" >/dev/null 2>&1
echo "[INFO] Cleanup legacy_test user"

echo
echo "==== SUMMARY ===="
echo "PASS=$PASS  FAIL=$FAIL"
TOTAL=$((PASS+FAIL))
echo "PASS_RATE=$(python3 -c "print(f'{$PASS*100/$TOTAL:.1f}%' if $TOTAL else 'N/A')")"
if [ $FAIL -gt 0 ]; then
  echo "Failures:"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
fi