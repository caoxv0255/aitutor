"""GraphRAG 服务配置"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
WORKSPACE = BASE_DIR / "graphrag_workspace"

# LLM 配置（从环境变量读取，不硬编码）
GRAPHRAG_API_KEY = os.getenv("GRAPHRAG_API_KEY", "")
GRAPHRAG_API_BASE = os.getenv("GRAPHRAG_API_BASE", "https://mydamoxing.cn/v1")
GRAPHRAG_MODEL = os.getenv("GRAPHRAG_MODEL", "kimi-k2.6")
GRAPHRAG_CODING_MODEL = os.getenv("GRAPHRAG_CODING_MODEL", "K2.6-code-preview")
GRAPHRAG_RATE_LIMIT_PER_HOUR = int(os.getenv("GRAPHRAG_RATE_LIMIT_PER_HOUR", "420"))

# 服务配置
SERVICE_HOST = os.getenv("GRAPHRAG_SERVICE_HOST", "127.0.0.1")
SERVICE_PORT = int(os.getenv("GRAPHRAG_SERVICE_PORT", "8100"))

# 数据库
DATABASE_URL = os.getenv("DATABASE_URL", "")

# 索引配置
INDEXES = {
    "gaokao_all": {
        "name": "全国高考真题综合索引",
        "filter": "exam_type = '高考'",
        "description": "31省高考真题，用于全国趋势分析和跨省对比",
    },
    "zhongkao_beijing": {
        "name": "北京中考真题索引",
        "filter": "exam_type = '中考' AND province = '北京'",
        "description": "北京中考9科真题，用于北京中考专项问答",
    },
    "highschool_knowledge": {
        "name": "高中知识点索引",
        "filter": "doc_kind = '知识点'",
        "description": "高中各学科知识点归纳汇总",
    },
    "subject_math": {
        "name": "数学学科深度索引",
        "filter": "subject = '数学'",
        "description": "数学学科专属索引",
    },
    "subject_chinese": {
        "name": "语文学科深度索引",
        "filter": "subject = '语文'",
        "description": "语文学科专属索引",
    },
    "province_beijing": {
        "name": "北京高考专项索引",
        "filter": "province = '北京' AND exam_type = '高考'",
        "description": "北京高考真题专项分析",
    },
}

# 限速配置（安全值：420/小时 = 7/分钟）
MAX_REQUESTS_PER_MINUTE = 7
MAX_REQUESTS_PER_HOUR = 420
