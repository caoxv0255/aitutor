#!/bin/bash
# AI导师 (aitutor) 部署脚本 - 需要 sudo 执行
# 用法: sudo bash setup.sh

set -e

echo "=== AI导师部署 ==="

# 1. 创建数据库
echo "[1/3] 创建 ai_tutor 数据库..."
su - postgres -c "psql -c \"CREATE DATABASE ai_tutor;\"" 2>/dev/null && echo "  ✓ 数据库创建完成" || echo "  - 数据库可能已存在"

# 2. 应用 Nginx 配置
echo "[2/3] 应用 Nginx 配置..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/uibe.conf" /etc/nginx/sites-available/aitutor.conf
# 确保配置被启用
if [ ! -L /etc/nginx/sites-enabled/aitutor.conf ]; then
  ln -s /etc/nginx/sites-available/aitutor.conf /etc/nginx/sites-enabled/aitutor.conf
fi
nginx -t && systemctl reload nginx && echo "  ✓ Nginx 配置更新完成"

# 3. 安装并启动 systemd 服务
echo "[3/3] 安装 systemd 服务..."
cp "$SCRIPT_DIR/uibe-tutor.service" /etc/systemd/system/uibe-tutor.service
systemctl daemon-reload
systemctl enable uibe-tutor
systemctl start uibe-tutor
echo "  ✓ 服务已启动"

echo ""
echo "=== 部署完成 ==="
echo "访问地址: https://aitutor.uibe.online/"
echo "兼容地址: https://lab.uibe.edu.cn/aitutor"
echo "查看状态: sudo systemctl status uibe-tutor"
echo "查看日志: sudo journalctl -u uibe-tutor -f"
