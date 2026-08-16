#!/usr/bin/env bash
# scripts/install-hooks.sh — 安装 .git/hooks/pre-commit (D065)
#
# 用法: bash scripts/install-hooks.sh

set -e
cd "$(dirname "$0")/.."

HOOK_SRC=".git/hooks/pre-commit"
HOOK_PERM=".git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "❌ $HOOK_SRC 不存在, 应与本脚本一起提交"
  exit 1
fi

chmod +x "$HOOK_PERM"
echo "✓ $HOOK_PERM 已设为可执行"
echo "  → 下次 git commit 自动跑 npm run gate"
echo "  → 跳过: git commit --no-verify"