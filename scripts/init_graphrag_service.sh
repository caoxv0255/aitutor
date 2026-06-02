#!/bin/bash
# GraphRAG 服务初始化脚本
# 一键设置环境、初始化索引、启动服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "====================================="
echo "AI Tutor GraphRAG 服务初始化"
echo "====================================="

# 检查 Python 环境
if [ ! -d ".venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv .venv
fi

source .venv/bin/activate

echo "安装/更新依赖..."
pip install -q markitdown[all] graphrag fastapi uvicorn psycopg2-binary aiohttp python-dotenv tenacity asyncio-throttle pyyaml

# 检查环境变量
if [ -z "$GRAPHRAG_API_KEY" ]; then
    echo "警告: GRAPHRAG_API_KEY 未设置"
    echo "请在 .env 文件中添加:"
    echo "  GRAPHRAG_API_KEY=your_key_here"
    echo "  GRAPHRAG_API_BASE=https://mydamoxing.cn/v1"
    echo "  GRAPHRAG_MODEL=kimi-k2.6"
fi

# 初始化数据库表
echo "初始化 GraphRAG 数据库表..."
python3 -c "
import sys
sys.path.insert(0, '.')
from graphrag_service.db import init_graphrag_tables
init_graphrag_tables()
"

# 扫描文档
echo "扫描 database/ 目录文档..."
python3 scripts/convert_documents.py scan

# 提示后续步骤
echo ""
echo "====================================="
echo "初始化完成！后续步骤:"
echo "====================================="
echo ""
echo "1. 转换文档（建议分批次）:"
echo "   python3 scripts/convert_documents.py convert --batch-size 50"
echo ""
echo "2. 生成 JSONL:"
echo "   python3 scripts/convert_documents.py jsonl --index gaokao_all"
echo ""
echo "3. 初始化索引:"
echo "   python3 graphrag_service/indexer.py init --index gaokao_all"
echo ""
echo "4. 运行索引（耗时较长）:"
echo "   python3 graphrag_service/indexer.py index --index gaokao_all"
echo ""
echo "5. 启动查询服务:"
echo "   python3 -m uvicorn graphrag_service.main:app --host 127.0.0.1 --port 8100"
echo ""
echo "或使用 systemd:"
echo "   sudo systemctl start uibe-graphrag"
echo ""
