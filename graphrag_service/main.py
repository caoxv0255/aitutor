"""GraphRAG 内部查询服务 (FastAPI)
监听 127.0.0.1:8100，仅对内网暴露。
"""
import os
import sys
import json
import time
import subprocess
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

# 添加项目根目录
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graphrag_service.config import (
    WORKSPACE, SERVICE_HOST, SERVICE_PORT, INDEXES,
    GRAPHRAG_API_KEY, GRAPHRAG_API_BASE, GRAPHRAG_MODEL,
    MAX_REQUESTS_PER_MINUTE,
)
from graphrag_service.db import (
    init_graphrag_tables, log_query, get_doc_stats,
    get_pending_jobs, get_docs_for_indexing,
)


def get_index_root(index_name: str) -> Path:
    return WORKSPACE / "indexes" / index_name


def index_exists(index_name: str) -> bool:
    root = get_index_root(index_name)
    return (root / "output" / "artifacts").exists()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务启动/关闭生命周期"""
    print("初始化 GraphRAG 服务...")
    init_graphrag_tables()
    yield
    print("GraphRAG 服务关闭")


app = FastAPI(
    title="AI Tutor GraphRAG Service",
    description="知识图谱索引与查询服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: 只允许本机和内网
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3001", "http://127.0.0.1:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Pydantic 模型 =====

class QueryRequest(BaseModel):
    query: str
    index_name: str = "gaokao_all"
    method: str = "local"  # local / global / drift / basic
    top_k: int = 10
    user_email: Optional[str] = None


class ExplainRequest(BaseModel):
    question: str
    subject: str
    index_name: str = "gaokao_all"
    user_email: Optional[str] = None


class SimilarQuestionsRequest(BaseModel):
    question_text: str
    subject: Optional[str] = None
    province: Optional[str] = None
    year_range: Optional[List[int]] = None
    top_k: int = 5


class ReindexRequest(BaseModel):
    index_name: str


# ===== 工具函数 =====

def run_graphrag_query(index_name: str, query: str, method: str = "local") -> dict:
    """调用 GraphRAG CLI 进行查询"""
    index_root = get_index_root(index_name)

    if not index_exists(index_name):
        raise HTTPException(status_code=404, detail=f"索引 {index_name} 不存在或未构建完成")

    cmd = [
        "graphrag", "query",
        "--root", str(index_root),
        "--method", method,
        "--community_level", "2",
        query,
    ]

    env = os.environ.copy()
    env["GRAPHRAG_API_KEY"] = GRAPHRAG_API_KEY
    env["GRAPHRAG_API_BASE"] = GRAPHRAG_API_BASE

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
            cwd=str(BASE_DIR),
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="查询超时")

    if result.returncode != 0:
        error = result.stderr[-1000:] if result.stderr else "未知错误"
        raise HTTPException(status_code=500, detail=f"GraphRAG 查询失败: {error[:500]}")

    # 解析输出
    output = result.stdout

    # 提取引用和实体
    citations = []
    entities = []
    relations = []

    # 简单解析：查找引用标记 [^N^]
    import re
    citation_pattern = r'\[\^(\d+)\^\]'
    citations = list(set(re.findall(citation_pattern, output)))

    # 查找实体引用
    entity_pattern = r'\*\*(.*?)\*\*'
    entities = list(set(re.findall(entity_pattern, output)))

    return {
        "answer": output,
        "citations": citations,
        "entities": entities[:20],
        "relations": relations,
        "method": method,
        "index_name": index_name,
    }


def select_index_for_query(subject: Optional[str], province: Optional[str],
                           exam_level: Optional[str]) -> str:
    """根据查询条件智能选择索引"""
    if exam_level == "中考" and province == "北京":
        return "zhongkao_beijing"
    if subject == "数学":
        return "subject_math"
    if subject == "语文":
        return "subject_chinese"
    if province == "北京" and exam_level == "高考":
        return "province_beijing"
    if exam_level == "中考":
        return "zhongkao_beijing"
    return "gaokao_all"


# ===== API 端点 =====

@app.get("/health")
async def health_check():
    """健康检查"""
    stats = get_doc_stats()
    available_indexes = [name for name in INDEXES.keys() if index_exists(name)]
    return {
        "status": "ok",
        "indexes_available": available_indexes,
        "indexes_total": len(INDEXES),
        "document_stats": stats,
    }


@app.post("/api/graphrag/query")
async def query_graphrag(req: QueryRequest):
    """GraphRAG 查询 - 通用问答"""
    start_time = time.time()

    if req.index_name not in INDEXES:
        raise HTTPException(status_code=400, detail=f"未知索引: {req.index_name}")

    try:
        result = run_graphrag_query(req.index_name, req.query, req.method)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    duration_ms = int((time.time() - start_time) * 1000)

    # 记录查询日志
    log_query(
        query_text=req.query,
        index_name=req.index_name,
        method=req.method,
        response_summary=result["answer"][:500] if result["answer"] else None,
        citations=result.get("citations"),
        duration_ms=duration_ms,
        user_email=req.user_email,
    )

    return {
        "success": True,
        "query": req.query,
        **result,
        "duration_ms": duration_ms,
    }


@app.post("/api/graphrag/explain")
async def explain_question(req: ExplainRequest):
    """题目讲解 - 调用 GraphRAG 查找相关知识点和真题"""
    start_time = time.time()

    # 选择索引
    index_name = req.index_name
    if not index_exists(index_name):
        index_name = select_index_for_query(req.subject, None, None)

    # 构造查询
    query = f"""请详细讲解以下{req.subject}题目的解题思路和关键知识点：

题目：{req.question}

要求：
1. 分析题目涉及的核心知识点
2. 提供解题步骤和思路
3. 引用相关的历年真题作为参考
4. 指出常见的易错点
"""

    try:
        result = run_graphrag_query(index_name, query, "local")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    duration_ms = int((time.time() - start_time) * 1000)

    log_query(
        query_text=req.question,
        index_name=index_name,
        method="explain",
        response_summary=result["answer"][:500] if result["answer"] else None,
        duration_ms=duration_ms,
        user_email=req.user_email,
    )

    return {
        "success": True,
        "question": req.question,
        "subject": req.subject,
        **result,
        "duration_ms": duration_ms,
    }


@app.post("/api/graphrag/similar-questions")
async def find_similar_questions(req: SimilarQuestionsRequest):
    """查找相似真题"""
    start_time = time.time()

    # 构建查询
    filters = []
    if req.subject:
        filters.append(f"学科：{req.subject}")
    if req.province:
        filters.append(f"省份：{req.province}")
    if req.year_range and len(req.year_range) == 2:
        filters.append(f"年份范围：{req.year_range[0]}-{req.year_range[1]}")

    filter_str = "，".join(filters) if filters else "全国范围"

    query = f"""请查找与以下题目相似的{filter_str}历年真题：

题目：{req.question_text}

要求返回 {req.top_k} 道最相似的真题，每道题包含：
1. 题目内容
2. 所属年份和省份
3. 涉及的知识点
4. 难度评估
5. 与原题的相似性说明
"""

    index_name = select_index_for_query(req.subject, req.province, None)

    try:
        result = run_graphrag_query(index_name, query, "local")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    duration_ms = int((time.time() - start_time) * 1000)

    log_query(
        query_text=req.question_text,
        index_name=index_name,
        method="similar",
        duration_ms=duration_ms,
    )

    return {
        "success": True,
        "question": req.question_text,
        "filters": filters,
        **result,
        "duration_ms": duration_ms,
    }


@app.get("/api/graphrag/knowledge-map")
async def get_knowledge_map(
    subject: str = Query(..., description="学科"),
    exam_level: str = Query("gaokao", description="考试级别"),
    province: Optional[str] = Query(None, description="省份"),
):
    """获取知识图谱关系图"""
    index_name = select_index_for_query(subject, province, exam_level)

    query = f"""请分析{subject}学科的知识体系结构：

1. 列出核心知识模块及其关系
2. 各模块之间的依赖关系
3. 历年高考/中考中各模块的考查频次
4. 建议的学习顺序
"""

    try:
        result = run_graphrag_query(index_name, query, "global")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        "subject": subject,
        "exam_level": exam_level,
        **result,
    }


@app.get("/api/graphrag/paper-source")
async def get_paper_source(
    province: str = Query(..., description="省份"),
    year: int = Query(..., description="年份"),
    subject: str = Query(..., description="学科"),
):
    """试卷溯源 - 查找原始试卷信息"""
    query = f"""请查找 {province} {year}年 {subject} 科目的真题信息：

1. 试卷整体结构（题型分布、分值）
2. 难度评估
3. 重点考查的知识点
4. 与往年相比的变化趋势
"""

    index_name = select_index_for_query(subject, province, "高考")

    try:
        result = run_graphrag_query(index_name, query, "local")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        "province": province,
        "year": year,
        "subject": subject,
        **result,
    }


@app.get("/api/admin/graphrag/jobs")
async def get_index_jobs(index_name: Optional[str] = None):
    """获取索引任务状态"""
    jobs = get_pending_jobs(index_name)
    return {
        "success": True,
        "jobs": [dict(j) for j in jobs],
    }


@app.get("/api/admin/graphrag/stats")
async def get_stats():
    """获取统计信息"""
    stats = get_doc_stats()
    available = [name for name in INDEXES.keys() if index_exists(name)]
    return {
        "success": True,
        "documents": stats,
        "indexes": {
            "available": available,
            "total": len(INDEXES),
            "all": {k: v["name"] for k, v in INDEXES.items()},
        },
    }


@app.post("/api/admin/graphrag/reindex")
async def trigger_reindex(req: ReindexRequest):
    """触发重新索引（异步）"""
    if req.index_name not in INDEXES:
        raise HTTPException(status_code=400, detail=f"未知索引: {req.index_name}")

    # 启动后台索引进程
    import subprocess
    cmd = [
        sys.executable,
        str(BASE_DIR / "graphrag_service" / "indexer.py"),
        "index",
        "--index", req.index_name,
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(BASE_DIR),
        )
        return {
            "success": True,
            "message": f"索引任务 {req.index_name} 已启动",
            "pid": proc.pid,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=SERVICE_HOST,
        port=SERVICE_PORT,
        reload=False,
        log_level="info",
    )
