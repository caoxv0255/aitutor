#!/usr/bin/env bash
# scripts/audit/probe-routes.sh
# 真 404 验证 + 区分 audit 误报 vs 真 bug
set -uo pipefail
TOKEN=$(curl -sS -X POST http://localhost:3002/api/auth/guest-login \
  -H 'Content-Type: application/json' -d '{}' \
  | grep -oP '"token":"[^"]+' | cut -d'"' -f4)

# 真 bug 候选 (audit 标 missing, 实际也 404)
REAL_BUGS=(
  "/api/exam-pdf/"
  "/api/rag/search/search"
  "/api/rag/search/multi/search"
  "/api/rag/search/multi/questions"
  "/api/rag/explain"
  "/api/rag/ask"
  "/api/rag/search/ingest"
  "/api/rag/search/stats"
  "/api/tutor/sessions"
  "/api/user/user-province"
)
echo "=== 真 404 bug (audit + curl 双重确认) ==="
for p in "${REAL_BUGS[@]}"; do
  s_g=$(curl -sS -o /dev/null -w "%{http_code}" -X GET "http://localhost:3002$p" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
  s_p=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://localhost:3002$p" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
  if [ "$s_g" = "404" ] && [ "$s_p" = "404" ]; then
    echo "  ❌ $p  GET=$s_g POST=$s_p  (真 404)"
  fi
done
