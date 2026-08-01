#!/bin/bash
# scripts/automation/install_hooks.sh — 安装 git pre-commit / pre-push hooks
# 用法: bash scripts/automation/install_hooks.sh
set -e
cd "$(git rev-parse --show-toplevel)"

HOOKS_DIR=".git/hooks"
mkdir -p "$HOOKS_DIR"

# pre-commit: commit 前自动 lint
cat > "$HOOKS_DIR/pre-commit" <<'HOOK'
#!/bin/bash
# Auto-installed by scripts/automation/install_hooks.sh
echo "=== pre-commit: lint ==="
SKIP_LINT=1 bash scripts/automation/lint.sh || {
  echo "FAIL: lint 失败, commit 拒绝"
  exit 1
}
HOOK
chmod +x "$HOOKS_DIR/pre-commit"

# pre-push: push 前打印 ahead 信息
cat > "$HOOKS_DIR/pre-push" <<'HOOK'
#!/bin/bash
# Auto-installed by scripts/automation/install_hooks.sh
echo "=== pre-push: ahead 报告 ==="
REMOTE=$1
URL=$2
if [ -n "$REMOTE" ] && [ -n "$URL" ]; then
  BR=$(git branch --show-current 2>/dev/null)
  REMOTE_HEAD=$(git ls-remote --heads "$REMOTE" "$BR" 2>/dev/null | awk '{print $1}' | head -1)
  if [ -n "$REMOTE_HEAD" ]; then
    AHEAD=$(git rev-list --count "$REMOTE_HEAD..HEAD" 2>/dev/null || echo "?")
    BEHIND=$(git rev-list --count "HEAD..$REMOTE_HEAD" 2>/dev/null || echo "?")
    echo "  ahead:  $AHEAD commits"
    echo "  behind: $BEHIND commits"
  fi
fi
HOOK
chmod +x "$HOOKS_DIR/pre-push"

echo "OK: git hooks 安装完成"
echo "  pre-commit: commit 前自动 lint"
echo "  pre-push:   push 前打印 ahead/behind"
