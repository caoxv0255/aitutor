"""GraphRAG 服务配置"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
WORKSPACE = BASE_DIR / "graphrag_workspace"

# 2026-09-23: 必须在读取任何环境变量之前加载项目根 .env。
# 此前 config.py 只做 os.getenv，而 load_dotenv 发生在 db.py 导入时（晚于 config），
# 导致 `GRAPHRAG_API_KEY or MINIMAX_API_KEY` 这条回退链在真实运行时拿到空串 ——
# 静默失败：GRAPHRAG_API_KEY 长度 0，MiniMax 请求会带空 key。
# override=False，保持「shell 已导出的变量优先」的原有语义。
load_dotenv(BASE_DIR / ".env")

# 2026-09-23: graphrag_llm 走 litellm，而 litellm 在 __init__ 时会从
# raw.githubusercontent.com 拉取 model cost map（httpx 未设短超时）。本机到部分
# CDN IP 的 443 被黑洞：connect 永久停在 SYN-SENT/EINPROGRESS，graphrag index
# 还没开始任何 LLM/embedding 调用就卡死（曾误判为 tiktoken 下载）。实测 litellm
# 1.92.0 支持 LITELLM_LOCAL_MODEL_COST_MAP=True 只用包内备份表。用 setdefault，
# 不覆盖外部已设的值；该变量由 indexer/query 子进程继承。
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

# LLM 配置（从环境变量读取，不硬编码）
# 2026-09-23: LLM 换到 MiniMax CN（与 Node 侧 services/llm.js、api/handlers/proxy.js
# 的 MiniMax provider 同一套：base https://api.minimaxi.com/v1，模型 MiniMax-M2.7）。
# GRAPHRAG_API_KEY 未单独配置时回退到 MINIMAX_API_KEY —— 线上已经在 .env 里维护了
# MINIMAX_API_KEY，再抄一份到 GRAPHRAG_API_KEY 等于多一处需要轮换的密钥副本；
# 回退避免复制。这里只做环境变量读取，绝不把 key 值写回任何文件。
GRAPHRAG_API_KEY = os.getenv("GRAPHRAG_API_KEY") or os.getenv("MINIMAX_API_KEY", "")
GRAPHRAG_API_BASE = os.getenv("GRAPHRAG_API_BASE", "https://api.minimaxi.com/v1")
GRAPHRAG_MODEL = os.getenv("GRAPHRAG_MODEL", "MiniMax-M2.7")
GRAPHRAG_CODING_MODEL = os.getenv("GRAPHRAG_CODING_MODEL", "K2.6-code-preview")

# Embedding 配置（与 LLM 分设，2026-09-23）
# embedding 走本机 Ollama 的 bge-m3-cpu（CPU 变体，见 graphrag_service/Modelfile.bge-m3-cpu:
# 两张 1080Ti 已被 llama-server / funasr / qwen3.6-infer 占满，默认 GPU 加载必 OOM，
# 故 num_gpu=0 走 CPU；实测 /v1/embeddings 200、dim=1024、预热后约 0.14s/条）。
GRAPHRAG_EMBEDDING_API_BASE = os.getenv("GRAPHRAG_EMBEDDING_API_BASE", "http://127.0.0.1:11434/v1")
GRAPHRAG_EMBEDDING_MODEL = os.getenv("GRAPHRAG_EMBEDDING_MODEL", "bge-m3-cpu")
# Ollama 不校验 key，但 GraphRAG 的 openai provider 要求 api_key 非空，故给占位值。
GRAPHRAG_EMBEDDING_API_KEY = os.getenv("GRAPHRAG_EMBEDDING_API_KEY", "ollama")
# 2026-09-23: graphrag 3.1.2 的 vector_store 默认 vector_size=3072，与 bge-m3 的 1024 维不符，
# 会在写 lancedb 时抛 ValueError（维度校验）。显式声明维度，避免依赖默认值。
GRAPHRAG_EMBEDDING_DIMS = int(os.getenv("GRAPHRAG_EMBEDDING_DIMS", "1024"))
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
