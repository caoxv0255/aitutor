#!/usr/bin/env bash
# push_to_uibe.sh — 按 UIBE-Git-服务器操作手册 推到 UIBE Git 服务器
# markdown 推荐优先: 本机路径 > 局域网 IP > 公网域名
#
# 用法: 在 aitutor repo 根目录跑
#   bash scripts/push_to_uibe.sh
#
# 前提: 已连 VPN/tailscale 到 UIBE 校园网 (WSL 当前无法直连)

set -euo pipefail

# === 1) 本机路径 (最快, 零网络) ===
# 如果你能直接读写 /home/git/repos/, 用这个:
LOCAL_REPO="/home/git/repos/aitutor.git"

# === 2) 局域网 HTTP IP (适合校园网内其他机器) ===
LAN_HTTP="http://main:Uibeliu60%21@219.224.5.250:8081/aitutor.git"

# === 3) 局域网 SSH 免密 (推荐校园网内用) ===
LAN_SSH="flaskappuser@219.224.5.250:/home/git/repos/aitutor.git"

# === 4) 公网 HTTPS 域名 ===
PUB_HTTPS="https://main:Uibeliu60%21@git.uibe.online/aitutor.git"

# 检测连通性, 按优先级尝试
if [[ -d "$LOCAL_REPO" ]]; then
    echo "[1] 使用本机路径: $LOCAL_REPO"
    REMOTE_URL="$LOCAL_REPO"
elif ping -c 1 -W 2 219.224.5.250 &>/dev/null; then
    echo "[2] 使用局域网 IP"
    REMOTE_URL="$LAN_HTTP"
elif ping -c 1 -W 2 git.uibe.online &>/dev/null; then
    echo "[3] 使用公网域名"
    REMOTE_URL="$PUB_HTTPS"
else
    echo "ERROR: 无法访问 UIBE Git 服务器任何端点"
    echo "  - 本机路径: $LOCAL_REPO (不存在)"
    echo "  - 局域网 IP: 219.224.5.250 (无法 ping)"
    echo "  - 公网域名: git.uibe.online (无法 ping)"
    echo ""
    echo "请先连 VPN/tailscale, 或在能访问 UIBE Git 的机器跑此脚本"
    exit 1
fi

# 确认 uibe remote URL
git remote set-url uibe "$REMOTE_URL"

# 推送 (我的 Phase 2 三 commits 已在本地, ahead uibe 3)
echo ""
echo "[4] git push uibe main ..."
git push uibe main

# 也推 origin (GitHub mirror)
echo ""
echo "[5] git push origin main ..."
git push origin main 2>/dev/null || echo "  (origin 推送跳过 — 网络不通?)"

echo ""
echo "✅ push 完成"
echo ""
echo "如果之前 stash 了 dirty, 现在还原:"
echo "  git stash pop 0   # untracked files (image mappings, new docs)"
echo "  git stash pop 1   # modified (question-bank/*, scripts/*, services/*)"
