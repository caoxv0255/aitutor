#!/bin/bash
# GraphRAG 一键部署脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "====================================="
echo "AI Tutor GraphRAG 部署脚本"
echo "====================================="

# 1. 安装 Node.js 依赖（axios 用于转发）
echo "检查 Node.js 依赖..."
if ! npm list axios >/dev/null 2>&1; then
    echo "安装 axios..."
    npm install axios
fi

# 2. 安装 Python 依赖
echo "安装 Python 依赖..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q markitdown[all] graphrag fastapi uvicorn psycopg2-binary aiohttp python-dotenv tenacity asyncio-throttle pyyaml

# 3. 检查环境变量
echo "检查环境变量..."
if [ ! -f ".env" ]; then
    echo "错误: .env 文件不存在"
    exit 1
fi

if ! grep -q "GRAPHRAG_API_KEY" .env; then
    echo "在 .env 中添加 GraphRAG 配置..."
    cat >> .env << 'EOF'

# GraphRAG 配置
GRAPHRAG_API_KEY=sk-df8Z1pBQemztkHgcwnttSoVuWz1cjNfGmDAkU4nlpTvQH9jd
GRAPHRAG_API_BASE=https://mydamoxing.cn/v1
GRAPHRAG_MODEL=kimi-k2.6
GRAPHRAG_CODING_MODEL=K2.6-code-preview
GRAPHRAG_RATE_LIMIT_PER_HOUR=420
GRAPHRAG_SERVICE_HOST=127.0.0.1
GRAPHRAG_SERVICE_PORT=8100
EOF
fi

# 4. 初始化数据库
echo "初始化数据库表..."
python3 -c "
import sys
sys.path.insert(0, '.')
from graphrag_service.db import init_graphrag_tables
init_graphrag_tables()
"

# 5. 安装 systemd 服务
echo "安装 systemd 服务..."
sudo cp deploy/uibe-graphrag.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable uibe-graphrag

# 6. 启动服务
echo "启动 GraphRAG 服务..."
sudo systemctl restart uibe-graphrag
sleep 2
sudo systemctl status uibe-graphrag --no-pager

# 7. 重启主服务以加载新路由
echo "重启主服务..."
sudo systemctl restart uibe-tutor

echo ""
echo "====================================="
echo "部署完成！"
echo "====================================="
echo ""
echo "GraphRAG 服务状态:"
echo "  sudo systemctl status uibe-graphrag"
echo ""
echo "查看日志:"
echo "  sudo journalctl -u uibe-graphrag -f"
echo ""
echo "下一步（文档转换和索引）:"
echo "  1. 扫描文档:   python3 scripts/convert_documents.py scan"
echo "  2. 转换文档:   python3 scripts/convert_documents.py convert"
echo "  3. 生成 JSONL: python3 scripts/convert_documents.py jsonl --index gaokao_all"
echo "  4. 初始化索引: python3 graphrag_service/indexer.py init --index gaokao_all"
echo "  5. 运行索引:   python3 graphrag_service/indexer.py index --index gaokao_all"
echo ""
