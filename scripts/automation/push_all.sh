#!/bin/bash
# scripts/automation/push_all.sh — 一键推 uibe + GitHub
# 用法:
#   bash scripts/automation/push_all.sh
#   GH_TOKEN=*** bash scripts/automation/push_all.sh   # 加推 GitHub
#   SKIP_LINT=1 bash scripts/automation/push_all.sh    # 跳过 lint
set -e

BRANCH="${1:-main}"
REMOTE_UIBE="${REMOTE_UIBE:-uibe}"

echo "=== Pre-push checks ==="
if [ -n "$(git status --porcelain)" ]; then
  echo "FAIL: 工作目录有未提交改动"
  git status --short
  exit 1
fi

LOCAL=$(git rev-parse HEAD)
echo "  本地 HEAD: $LOCAL"
echo "  Branch:    $(git branch --show-current)"

if [ -z "$SKIP_LINT" ]; then
  echo ""
  echo "=== Lint ==="
  bash "$(dirname "$0")/lint.sh" || echo "  WARN: lint 有 warning (跳过)"
fi

echo ""
echo "=== Push to uibe ($REMOTE_UIBE) ==="
git push "$REMOTE_UIBE" "$BRANCH" --tags

if [ -n "$GH_TOKEN" ]; then
  echo ""
  echo "=== Push to GitHub (origin) ==="
  GH_URL="https://x-access-token:${GH_TOKEN}@github.com/caoxv0255/aitutor.git"
  git push "$GH_URL" "$BRANCH" --tags
  echo "OK: GitHub push 完成"
  echo "  REMINDER: GH_TOKEN 已用过, 建议立即 revoke (https://github.com/settings/tokens)"
else
  echo ""
  echo "=== Skip GitHub (GH_TOKEN 未设) ==="
  echo "  设 GH_TOKEN=*** 后再跑一次推 GitHub"
fi

echo ""
echo "=== Done ==="
git log --oneline -3
