#!/bin/bash
# 完整 E2E 测试脚本 (v2 - 真实路径)
set +e
API=http://localhost:3002/api
RESP=/home/cx/aitutor/.tmp_resp.json

# 登录拿 token
LOGIN_RESP=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@uibe.edu.cn","password":"test123456"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[FATAL] Login failed, cannot obtain token"
  echo "$LOGIN_RESP"
  exit 1
fi
echo "[OK] Login token obtained: ${TOKEN:0:30}..."

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
except Exception as e:
    print('ERR:' + str(e))
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
test_api "Auth: logout"                 POST "/auth/logout" "" "success"

echo
echo "==== 2. USER (dashboard/profile/subjects/init) ===="
test_api "User: dashboard"              GET  "/user/dashboard" "" "success"
test_api "User: profile GET"            GET  "/user/profile" "" "success"
test_api "User: subjects GET"           GET  "/user/subjects" "" "success"
test_api "User: knowledge-profile"      GET  "/user/knowledge-profile" "" "success"
test_api "User: learning-suggestions"   GET  "/user/learning-suggestions" "" "success"
test_api "User: initialize"             POST "/user/initialize" '{}' "success"

echo
echo "==== 3. KNOWLEDGE (points/map/mastery) ===="
test_api "Knowledge: points math"       GET  "/knowledge/points?subject=%E6%95%B0%E5%AD%A6" "" "success"
test_api "Knowledge: map"               GET  "/knowledge/map?subject=%E6%95%B0%E5%AD%A6" "" "success"
test_api "Knowledge: mastery"           GET  "/knowledge/mastery" "" "success"
test_api "Knowledge: mastery by KP"     GET  "/knowledge/mastery/MATH_GAOKAO_001" "" "success"

echo
echo "==== 4. REVIEW (reports/weak-points) ===="
test_api "Review: reports"              GET  "/review/reports" "" "success"
test_api "Review: weak-points"          GET  "/review/weak-points" "" "success"
test_api "Review: trend-summary"        GET  "/review/trend-summary" "" "success"
test_api "Review: session/history"      GET  "/review/session/history" "" "success"

echo
echo "==== 5. WRONG QUESTIONS (via /user) ===="
test_api "WQ: list"                     GET  "/user/wrong-questions" "" "success"
test_api "WQ: stats"                    GET  "/user/wrong-questions/stats" "" "success"
test_api "WQ: add sample"               POST "/user/wrong-questions" \
  '{"subject":"数学","content":"已知 a+b=5, ab=3, 求 a^2+b^2","difficulty":2,"score":5,"knowledgePointId":"MATH_GAOKAO_001","userAnswer":"16","correctAnswer":"19","errorCategory":"calculation"}' \
  "success"

echo
echo "==== 6. EXAM (papers/session) ===="
test_api "Exam: papers"                 GET  "/exam/papers" "" "success"
test_api "Exam: session/start math"     POST "/exam/session/start" \
  '{"subject":"数学","provinceCode":"beijing","examLevel":"gaokao","questionCount":5}' \
  "success"

echo
echo "==== 7. PROVINCES (server-mounted) ===="
test_api "Provinces: list"              GET  "/provinces" "" "success"
test_api "Provinces: beijing"           GET  "/provinces/beijing" "" "success"
test_api "Provinces: stats beijing"     GET  "/province-stats/beijing" "" "success"

echo
echo "==== 8. SRS (interval review) ===="
test_api "SRS: daily-tasks"             GET  "/srs/engine/daily-tasks" "" "success"
test_api "SRS: stats"                   GET  "/srs/engine/stats" "" "success"

echo
echo "==== 9. RAG (向量检索 + GraphRAG) ===="
test_api "RAG: stats"                   GET  "/rag/stats" "" "success"
test_api "RAG: search math"             POST "/rag/search" \
  '{"query":"二次函数顶点","subject":"数学","limit":3}' "success"
test_api "RAG: graphrag query"          POST "/rag/graphrag/query" \
  '{"query":"二次函数","limit":2}' "success"
test_api "RAG: graphrag knowledge-map"  GET  "/rag/graphrag/knowledge-map" "" "success"

echo
echo "==== 10. TUTOR (AI 对话) ===="
test_api "Tutor: mastery kp"            GET  "/tutor/mastery/MATH_GAOKAO_001" "" "success"
test_api "Tutor: loop mastery"          GET  "/tutor/loop/mastery" "" "success"

echo
echo "==== 11. ADAPTIVE/CLASS (server-mounted) ===="
test_api "Adaptive: difficulty"         GET  "/adaptive-difficulty?subject=%E6%95%B0%E5%AD%A6" "" "success"
test_api "Class: detail"                GET  "/class-detail?classId=test-class" "" "success"

echo
echo "==== 12. HEALTH ===="
test_api "Health: /api/health"          GET  "/health" "" "success"

echo
echo "==== SUMMARY ===="
echo "PASS=$PASS  FAIL=$FAIL"
TOTAL=$((PASS+FAIL))
echo "PASS_RATE=$(python3 -c "print(f'{$PASS*100/$TOTAL:.1f}%' if $TOTAL else 'N/A')")"
if [ $FAIL -gt 0 ]; then
  echo "Failures:"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
fi