#!/usr/bin/env bash
# scripts/dev/push-github.sh — 一键把本地 commit 推到 GitHub
#
# 用法:
#   ./scripts/dev/push-github.sh                    # push 当前 branch 到同名远端 branch
#   ./scripts/dev/push-github.sh <local-branch>:<remote-branch>
#   ./scripts/dev/push-github.sh --tags            # push 当前 branch + 所有 tags
#   ./scripts/dev/push-github.sh --dry-run         # 只检查, 不真推
#
# 行为:
#   - 自动启动 ssh-agent (sub-shell-safe: 整次 push 在一个 session 里完成)
#   - 自动加载 ~/.ssh/id_rsa
#   - 推送前 sanity check: working tree clean, 当前 branch ahead of remote
#   - 推送成功后立即 ssh-agent -k
#   - 推送失败立即停, ssh-agent 仍清理
#
# 凭证: 用 ~/.ssh/id_rsa (deploy key with write access on caoxv0255/aitutor)

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# --- arg parse ---
DRY_RUN=false
PUSH_TAGS=false
REFSPEC=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --tags) PUSH_TAGS=true ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) REFSPEC="$arg" ;;
  esac
done

# default refspec = 当前 branch -> 同名
if [ -z "$REFSPEC" ]; then
  current=$(git rev-parse --abbrev-ref HEAD)
  if [ "$current" = "HEAD" ]; then
    echo "✗ 当前是 detached HEAD, 必须显式给 refspec (e.g. main:main)" >&2
    exit 1
  fi
  REFSPEC="$current:$current"
fi

echo "━━━ push-github.sh START ━━━"
echo "  refspec: $REFSPEC"
echo "  dry-run: $DRY_RUN"
echo "  push-tags: $PUSH_TAGS"
echo ""

# --- pre-flight ---
echo "▶ Pre-flight checks..."

# working tree (除 untracked) 必须 clean
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "✗ Working tree has tracked modifications:" >&2
  git diff --name-only HEAD | sed 's/^/    /' >&2
  echo "  → 请先 git commit 或 git stash" >&2
  exit 1
fi

# 当前 branch 必须 ahead of remote
local_branch="${REFSPEC%%:*}"
remote_branch="${REFSPEC##*:}"
local_sha=$(git rev-parse "refs/heads/$local_branch" 2>/dev/null || git rev-parse HEAD)
remote_sha=$(git rev-parse "refs/remotes/github/$remote_branch" 2>/dev/null || echo "")

if [ -z "$remote_sha" ]; then
  echo "  → Remote branch 'github/$remote_branch' 不存在 (will create on push)"
elif [ "$local_sha" = "$remote_sha" ]; then
  echo "✗ Local and remote HEAD are identical (nothing to push)" >&2
  echo "  local:  $local_sha" >&2
  echo "  remote: $remote_sha" >&2
  exit 1
else
  ahead=$(git rev-list --count "github/$remote_branch..refs/heads/$local_branch" 2>/dev/null || echo 0)
  echo "  local ahead of github/$remote_branch by: $ahead commits"
fi

# --- start ssh-agent in this session ---
echo ""
echo "▶ Starting ssh-agent..."

eval $(ssh-agent -s) > /dev/null
trap 'ssh-agent -k > /dev/null 2>&1 || true' EXIT

if ! ssh-add ~/.ssh/id_rsa 2>&1 | head -1; then
  echo "✗ ssh-add failed" >&2
  exit 1
fi

echo ""
echo "▶ Authentication check..."
ssh -T -o StrictHostKeyChecking=no -o ConnectTimeout=10 git@github.com 2>&1 \
  | grep -v 'hostfile_replace_entries' \
  | grep -v 'update_known_hosts' \
  | grep -v 'Read-only file system' \
  || true
echo ""

# --- actual push ---
SSH_GREP="grep -v hostfile_replace_entries | grep -v update_known_hosts | grep -v 'Read-only file system'"

if [ "$DRY_RUN" = true ]; then
  echo "▶ DRY-RUN push:"
  git push --dry-run git@github.com:caoxv0255/aitutor.git "$REFSPEC" 2>&1 \
    | grep -v 'hostfile_replace_entries' \
    | grep -v 'update_known_hosts' \
    | grep -v 'Read-only file system'
  echo ""
  echo "  (dry-run complete; not pushed)"
elif [ "$PUSH_TAGS" = true ]; then
  echo "▶ Pushing branch + tags..."
  git push git@github.com:caoxv0255/aitutor.git "$REFSPEC" 2>&1 \
    | grep -v 'hostfile_replace_entries' \
    | grep -v 'update_known_hosts' \
    | grep -v 'Read-only file system'
  git push --tags git@github.com:caoxv0255/aitutor.git 2>&1 \
    | grep -v 'hostfile_replace_entries' \
    | grep -v 'update_known_hosts' \
    | grep -v 'Read-only file system'
else
  echo "▶ Pushing branch..."
  git push git@github.com:caoxv0255/aitutor.git "$REFSPEC" 2>&1 \
    | grep -v 'hostfile_replace_entries' \
    | grep -v 'update_known_hosts' \
    | grep -v 'Read-only file system'
fi

echo ""
echo "▶ Post-verify..."
git fetch github --prune 2>&1 \
  | grep -v 'hostfile_replace_entries' \
  | grep -v 'update_known_hosts' \
  | grep -v 'Read-only file system' \
  || true

echo ""
echo "━━━ push-github.sh DONE ━━━"
echo "  local $local_branch:  $(git rev-parse refs/heads/$local_branch | head -c 7)"
echo "  github/$remote_branch: $(git rev-parse github/$remote_branch 2>/dev/null | head -c 7 || echo 'unknown')"
