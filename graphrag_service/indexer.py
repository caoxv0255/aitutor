"""GraphRAG 索引调度器
支持限速、断点续跑、失败重试
"""
import os
import sys
import json
import time
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential

# 添加项目根目录到路径
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from graphrag_service.config import (
    WORKSPACE, GRAPHRAG_API_KEY, GRAPHRAG_API_BASE,
    GRAPHRAG_MODEL, MAX_REQUESTS_PER_MINUTE, INDEXES
)
from graphrag_service.db import (
    get_db, create_job, update_job_status, get_docs_for_indexing, init_graphrag_tables
)


class RateLimiter:
    """基于令牌桶的限速器"""
    def __init__(self, max_per_minute: int):
        self.max_per_minute = max_per_minute
        self.tokens = max_per_minute
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.max_per_minute,
                              self.tokens + elapsed * (self.max_per_minute / 60))
            self.last_update = now
            if self.tokens < 1:
                wait_time = (1 - self.tokens) * (60 / self.max_per_minute)
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


rate_limiter = RateLimiter(MAX_REQUESTS_PER_MINUTE)


def get_index_root(index_name: str) -> Path:
    return WORKSPACE / "indexes" / index_name


def create_settings_yaml(index_root: Path, index_name: str):
    """为指定索引创建 GraphRAG 3.0.9 兼容的 settings.yaml"""
    settings = {
        "completion_models": {
            "default_completion_model": {
                "model_provider": "openai",
                "model": GRAPHRAG_MODEL,
                "auth_method": "api_key",
                "api_key": "${GRAPHRAG_API_KEY}",
                "base_url": GRAPHRAG_API_BASE,
                "retry": {"type": "exponential_backoff"},
            }
        },
        "embedding_models": {
            "default_embedding_model": {
                "model_provider": "openai",
                "model": "text-embedding-3-small",
                "auth_method": "api_key",
                "api_key": "${GRAPHRAG_API_KEY}",
                "base_url": GRAPHRAG_API_BASE,
                "retry": {"type": "exponential_backoff"},
            }
        },
        "input": {"type": "text"},
        "chunking": {
            "type": "tokens",
            "size": 1200,
            "overlap": 100,
            "encoding_model": "o200k_base",
        },
        "input_storage": {
            "type": "file",
            "base_dir": "input",
        },
        "output_storage": {
            "type": "file",
            "base_dir": "output",
        },
        "reporting": {
            "type": "file",
            "base_dir": "logs",
        },
        "cache": {
            "type": "json",
            "storage": {
                "type": "file",
                "base_dir": "cache",
            },
        },
        "vector_store": {
            "type": "lancedb",
            "db_uri": "output/lancedb",
        },
        "embed_text": {
            "embedding_model_id": "default_embedding_model",
        },
        "extract_graph": {
            "completion_model_id": "default_completion_model",
            "entity_types": ["知识点", "题型", "学科", "省份", "年份", "考试", "概念", "方法", "公式", "定理"],
            "max_gleanings": 1,
        },
        "summarize_descriptions": {
            "completion_model_id": "default_completion_model",
            "max_length": 500,
        },
        "cluster_graph": {
            "max_cluster_size": 10,
        },
        "extract_claims": {
            "enabled": False,
        },
        "community_reports": {
            "completion_model_id": "default_completion_model",
            "max_length": 2000,
            "max_input_length": 8000,
        },
        "snapshots": {
            "graphml": False,
            "embeddings": False,
        },
        "local_search": {
            "completion_model_id": "default_completion_model",
            "embedding_model_id": "default_embedding_model",
        },
        "global_search": {
            "completion_model_id": "default_completion_model",
        },
    }

    import yaml
    settings_path = index_root / "settings.yaml"
    with open(settings_path, "w", encoding="utf-8") as f:
        yaml.dump(settings, f, allow_unicode=True, default_flow_style=False)
    return settings_path


def init_index(index_name: str) -> Path:
    """初始化 GraphRAG 索引目录结构"""
    index_root = get_index_root(index_name)
    index_root.mkdir(parents=True, exist_ok=True)

    # 创建子目录
    for subdir in ["input", "output", "cache", "reports", "prompts"]:
        (index_root / subdir).mkdir(exist_ok=True)

    # 创建 settings.yaml
    create_settings_yaml(index_root, index_name)

    # 创建 .env 文件（GraphRAG CLI 需要）
    env_path = index_root / ".env"
    env_content = f"""GRAPHRAG_API_KEY={GRAPHRAG_API_KEY}
GRAPHRAG_API_BASE={GRAPHRAG_API_BASE}
GRAPHRAG_LLM_MODEL={GRAPHRAG_MODEL}
"""
    env_path.write_text(env_content, encoding="utf-8")

    print(f"索引 {index_name} 初始化完成: {index_root}")
    return index_root


async def prepare_input_files(index_name: str, job_id: int) -> int:
    """准备 GraphRAG 输入文件，返回文档数"""
    index_root = get_index_root(index_name)
    input_dir = index_root / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    # 清空旧输入
    for f in input_dir.glob("*"):
        f.unlink()

    # 获取符合条件的已转换文档
    docs = get_docs_for_indexing(index_name)
    if not docs:
        print(f"索引 {index_name}: 没有符合条件的文档")
        return 0

    # 将 JSONL 复制到 input 目录
    jsonl_path = BASE_DIR / "graphrag_workspace" / "normalized_jsonl" / f"{index_name}.jsonl"

    if not jsonl_path.exists():
        print(f"JSONL 文件不存在: {jsonl_path}")
        # 尝试生成
        import subprocess
        result = subprocess.run(
            [sys.executable, str(BASE_DIR / "scripts" / "convert_documents.py"),
             "jsonl", "--index", index_name],
            capture_output=True, text=True, cwd=str(BASE_DIR)
        )
        print(result.stdout)
        if result.returncode != 0:
            print(f"生成 JSONL 失败: {result.stderr}")
            return 0

    if jsonl_path.exists():
        # 复制到 input 目录
        import shutil
        dest = input_dir / f"{index_name}.txt"
        # GraphRAG 需要文本文件，将 JSONL 转为纯文本
        with open(jsonl_path, "r", encoding="utf-8") as src, \
             open(dest, "w", encoding="utf-8") as dst:
            for line in src:
                try:
                    record = json.loads(line)
                    text = record.get("text", "")
                    meta = record.get("metadata", {})
                    # 添加元数据头
                    header = f"\n---\nSource: {meta.get('source_file', 'unknown')}\n"
                    header += f"Subject: {meta.get('subject', 'unknown')}\n"
                    header += f"Province: {meta.get('province', 'unknown')}\n"
                    header += f"Year: {meta.get('year', 0)}\n"
                    header += f"Type: {meta.get('doc_kind', 'unknown')}\n"
                    header += "---\n\n"
                    dst.write(header + text + "\n\n")
                except json.JSONDecodeError:
                    continue

    # 统计文本文件数
    text_files = list(input_dir.glob("*.txt"))
    doc_count = len(text_files)

    # 更新任务
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE graphrag_index_jobs SET total_docs = %s WHERE id = %s",
            (doc_count, job_id)
        )
        conn.commit()
        cursor.close()

    print(f"索引 {index_name}: 准备了 {doc_count} 个输入文件")
    return doc_count


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=60))
async def run_graphrag_index(index_name: str, job_id: int):
    """运行 GraphRAG 索引命令"""
    index_root = get_index_root(index_name)

    # 限速
    await rate_limiter.acquire()

    update_job_status(job_id, "running")

    # 使用 GraphRAG CLI
    cmd = [
        "graphrag", "index",
        "--root", str(index_root),
        "--verbose"
    ]

    print(f"运行: {' '.join(cmd)}")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode("utf-8", errors="replace")[-2000:]
        print(f"索引失败: {error_msg}")
        update_job_status(job_id, "failed", error=error_msg)
        raise RuntimeError(f"GraphRAG index failed: {error_msg[:500]}")

    update_job_status(job_id, "completed")
    print(f"索引 {index_name} 完成")
    return True


async def run_index_job(index_name: str) -> int:
    """运行完整的索引任务"""
    print(f"\n{'='*60}")
    print(f"开始索引任务: {index_name}")
    print(f"{'='*60}")

    # 1. 初始化索引目录
    init_index(index_name)

    # 2. 创建任务记录
    job_id = create_job(index_name, 0, {"index_name": index_name})

    # 3. 准备输入文件
    doc_count = await prepare_input_files(index_name, job_id)
    if doc_count == 0:
        update_job_status(job_id, "failed", error="没有可用文档")
        return job_id

    # 4. 运行索引
    try:
        await run_graphrag_index(index_name, job_id)
    except Exception as e:
        print(f"索引任务异常: {e}")
        return job_id

    return job_id


async def run_all_indexes():
    """按顺序运行所有索引"""
    for index_name in INDEXES.keys():
        await run_index_job(index_name)
        # 索引之间休息，避免 API 限制
        print(f"等待 60 秒再开始下一个索引...")
        await asyncio.sleep(60)


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="GraphRAG 索引调度器")
    parser.add_argument("action", choices=["init", "index", "all", "status"])
    parser.add_argument("--index", default="gaokao_all", help="索引名称")
    args = parser.parse_args()

    # 初始化表
    init_graphrag_tables()

    if args.action == "init":
        init_index(args.index)

    elif args.action == "index":
        await run_index_job(args.index)

    elif args.action == "all":
        await run_all_indexes()

    elif args.action == "status":
        from graphrag_service.db import get_pending_jobs
        jobs = get_pending_jobs()
        print(f"{'ID':<5} {'Index':<20} {'Status':<12} {'Progress':<15} {'Updated'}")
        print("-" * 80)
        for j in jobs:
            progress = f"{j['processed_docs']}/{j['total_docs']}"
            print(f"{j['id']:<5} {j['index_name']:<20} {j['status']:<12} {progress:<15} {j['updated_at']}")


if __name__ == "__main__":
    asyncio.run(main())
