#!/bin/bash
# scripts/automation/lint.sh — Python + JS 基础 lint
# 用法: bash scripts/automation/lint.sh
set -e

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Python syntax check (scripts/) ==="
PY_ERRORS=0
while IFS= read -r -d '' f; do
  if ! python3 -m py_compile "$f" 2>/dev/null; then
    echo "  FAIL: $f"
    PY_ERRORS=$((PY_ERRORS+1))
  fi
done < <(find scripts -name "*.py" -not -path "*/__pycache__/*" -print0 2>/dev/null)
echo "  Python: $PY_ERRORS 错误"

echo ""
echo "=== JS syntax check (server.js + api/routes + api/modules) ==="
JS_ERRORS=0
for f in server.js api/routes/*.js api/modules/*/routes.js; do
  [ -f "$f" ] || continue
  if ! node --check "$f" 2>/dev/null; then
    echo "  FAIL: $f"
    JS_ERRORS=$((JS_ERRORS+1))
  fi
done
echo "  JS: $JS_ERRORS 错误"

echo ""
TOTAL=$((PY_ERRORS + JS_ERRORS))
if [ "$TOTAL" -gt 0 ]; then
  echo "FAIL: lint 有 $TOTAL 错误"
  exit 1
fi
echo "OK: lint 通过"
