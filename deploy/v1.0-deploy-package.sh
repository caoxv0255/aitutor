#!/bin/bash
# aitutor V1.0 完整部署包（自包含）
# 跑法：bash deploy/v1.0-deploy-package.sh
# 输出：.tmp/v1.0-deploy-package.tar.gz
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="$ROOT/.tmp/v1.0-deploy-package.tar.gz"
mkdir -p "$ROOT/.tmp"

echo "=== 打包 V1.0 全部源码 ==="
tar -czf "$OUT" \
  --exclude=node_modules --exclude=.git --exclude=test-results \
  --exclude=playwright-report --exclude='*.log' --exclude='.DS_Store' \
  --exclude='.tmp' \
  frontend/ ai-tutor-frontend/ api/ deploy/ tests/ docs/ \
  2>/dev/null

echo "✓ 部署包生成: $OUT"
ls -lh "$OUT"
echo
echo "=== 包内容 ==="
echo "  文件数: $(tar tzf "$OUT" | grep -v '/$' | wc -l)"
echo "  目录数: $(tar tzf "$OUT" | grep '/$' | wc -l)"
echo
echo "=== 部署步骤（在能写服务器的机器上执行）==="
echo "  1. scp /mnt/c/.../aitutor/.tmp/v1.0-deploy-package.tar.gz flaskappuser@<server>:/tmp/"
echo "  2. ssh flaskappuser@<server>"
echo "  3. cd /home/flaskappuser/Desktop/NewDisk_2T  # 或服务器 V0.9 根目录"
echo "  4. tar xzf /tmp/v1.0-deploy-package.tar.gz --backup=numbered"
echo "  5. sudo systemctl restart uibe-tutor"
echo "  6. curl -sI -H 'User-Agent: Mozilla/5.0' https://aitutor.uibe.online/"
