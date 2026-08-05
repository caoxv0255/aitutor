#!/usr/bin/env python3
"""ingest_rag_to_pgvector.py — schema v5 → rag_questions (Ollama nomic-embed-text + pgvector)

Usage:
  python3 scripts/ingest_rag_to_pgvector.py --limit 100        # dry-run 100 文件
  python3 scripts/ingest_rag_to_pgvector.py --file "xxx.json"  # 单文件 (调试)
  python3 scripts/ingest_rag_to_pgvector.py                    # 全量

Schema v5 路径: /home/cx/aitutor/database/rag_build/*.json
Embedding: Ollama http://localhost:11434 nomic-embed-text (768 dim)
DB: postgresql://zhiqui:***@localhost:5433/zhiqui_review
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import psycopg2
import requests

# ===== config =====
SCHEMA_DIR = Path("/home/cx/aitutor/database/rag_build")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-large-zh")  # v0.7 默认改 bge (1024 dim, 中文 better)
EMBED_DIM = 1024  # bge-large-zh 固定 (跟 migration 006 vector(1024) 配)
DB_DSN = os.environ.get("DATABASE_URL", "postgresql://zhiqui:***@localhost:5433/zhiqui_review")

# 学科中文 → 英文代码 (用于 schema v5)
SUBJECT_CODE_MAP = {
    "语文": "chinese", "数学": "math", "英语": "english",
    "物理": "physics", "化学": "chemistry", "生物": "biology",
    "历史": "history", "地理": "geography", "政治": "politics",
    "思想政治": "politics", "文综": "liberal_composite", "理综": "science_composite",
}

INSERT_SQL = """
INSERT INTO rag_questions
  (content, content_hash, embedding, knowledge_point_id, subject_code, difficulty,
   question_type, source_paper_id, source_year, source_region, source_subject, metadata)
VALUES (%s, %s, %s::vector, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
ON CONFLICT (content_hash) DO UPDATE SET
  embedding = EXCLUDED.embedding,
  updated_at = NOW();
"""


def get_embedding(text: str, timeout: int = 30) -> list:
    """调 Ollama /api/embeddings, 返 768 维向量."""
    r = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text[:8000]},  # Ollama 8K context
        timeout=timeout,
    )
    r.raise_for_status()
    emb = r.json().get("embedding") or []
    if not emb:
        raise RuntimeError(f"Ollama 返空: {r.json()}")
    if len(emb) != EMBED_DIM:
        raise RuntimeError(f"dim mismatch: {len(emb)} != {EMBED_DIM}")
    return emb


def infer_question_type(q: dict) -> str:
    """推断题型: choice / composite / fill_or_answer."""
    if q.get("options") and isinstance(q["options"], list) and len(q["options"]) >= 2:
        return "choice"
    if q.get("sub_questions"):
        return "composite"
    return "fill_or_answer"


def extract_questions_from_schema(schema: dict, file_name: str) -> list:
    """从 schema v5 抽所有题 (主题 + 子题). shared_materials 跳过 (GraphRAG 已存)."""
    paper = schema.get("paper", {})
    metadata = paper.get("metadata", {})
    source_year = metadata.get("year")
    source_region = metadata.get("region") or metadata.get("province")
    source_subject_zh = metadata.get("subject", "")
    subject_code = SUBJECT_CODE_MAP.get(source_subject_zh, source_subject_zh)

    result = []

    for q in paper.get("questions", []):
        stem = q.get("stem", "")
        if not stem or len(stem.strip()) < 5:  # 改 10 → 5 (高考题部分短)
            continue
        # W7: difficulty 从 quality.confidence 推 (0.0-1.0 → 1-5)
        quality_dict = q.get("quality") or {}
        qconf = quality_dict.get("confidence") if isinstance(quality_dict, dict) else None
        difficulty = None
        if isinstance(qconf, (int, float)) and 0 <= qconf <= 1:
            difficulty = max(1, min(5, int(qconf * 5) + 1))  # 0→1, 0.2→2, 0.4→3, 0.6→4, 0.8→5
        result.append({
            "content": stem,
            "knowledge_point_id": None,  # 后续从 KP 关联
            "subject_code": subject_code,
            "difficulty": difficulty,
            "question_type": infer_question_type(q),
            "source_paper_id": file_name,
            "source_year": source_year,
            "source_region": source_region,
            "source_subject": source_subject_zh,
            "metadata": {
                "question_id": q.get("question_id"),
                "options": q.get("options"),
                "answer": q.get("answer"),
                "analysis": q.get("analysis"),
                "source": q.get("source"),
                "quality": quality_dict,
            },
        })
        # 子题: content 加 [parent_id] 前缀避免 dedup 误伤 (sub stem 跟 parent 摘要重复会被 SHA-256 干掉)
        parent_qid = q.get("question_id", "")
        for sq in q.get("sub_questions", []):
            sq_stem = sq.get("stem", "")
            if not sq_stem or len(sq_stem.strip()) < 5:  # 短 stem 改 5
                continue
            # prefix 让 dedup 不误伤 (同一 sub_questions stem 跨文件仍同题, 跨题不同 prefix)
            result.append({
                "content": f"[子题·{parent_qid}] {sq_stem}",
                "knowledge_point_id": None,
                "subject_code": subject_code,
                "difficulty": None,
                "question_type": "sub_question",
                "source_paper_id": file_name,
                "source_year": source_year,
                "source_region": source_region,
                "source_subject": source_subject_zh,
                "metadata": {
                    "sub_question_id": sq.get("sub_question_id"),
                    "sub_no": sq.get("sub_no"),
                    "parent_question_id": parent_qid,
                    "answer": sq.get("answer"),
                    "analysis": sq.get("analysis"),
                },
            })

    # shared_materials: 3,764 段, 入库 (改 type='material' 区分)
    for sm in paper.get("shared_materials", []):
        sm_content = sm.get("content", "") or ""
        if not sm_content or len(sm_content.strip()) < 20:  # 短材料跳过
            continue
        result.append({
            "content": f"[材料·{paper.get('metadata', {}).get('subject', '')}] {sm_content[:1500]}",  # truncate 1.5k 避免超长
            "knowledge_point_id": None,
            "subject_code": subject_code,
            "difficulty": None,
            "question_type": "shared_material",
            "source_paper_id": file_name,
            "source_year": source_year,
            "source_region": source_region,
            "source_subject": source_subject_zh,
            "metadata": {
                "material_id": sm.get("material_id"),
                "type": sm.get("type"),
                "title": sm.get("title"),
            },
        })
    return result


def process_file(file_path: Path, conn) -> dict:
    """处理 1 个 schema v5 文件, 返 stats. 用 content_hash 去重."""
    cur = conn.cursor()
    file_name = file_path.name
    file_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()

    # 已 done 跳过
    cur.execute("SELECT status, questions_count FROM rag_ingest_progress WHERE file_name=%s", (file_name,))
    row = cur.fetchone()
    if row and row[0] == "done":
        return {"file": file_name, "status": "skip_done", "count": row[1]}

    # mark in_progress
    cur.execute("""
        INSERT INTO rag_ingest_progress (file_name, file_hash, status, started_at)
        VALUES (%s, %s, 'in_progress', NOW())
        ON CONFLICT (file_name) DO UPDATE SET status='in_progress', started_at=NOW(), error=NULL
    """, (file_name, file_hash))

    try:
        schema = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        cur.execute("UPDATE rag_ingest_progress SET status='failed', error=%s WHERE file_name=%s", (str(e)[:500], file_name))
        conn.commit()
        return {"file": file_name, "status": "failed_parse", "error": str(e)[:200]}

    questions = extract_questions_from_schema(schema, file_name)
    if not questions:
        cur.execute("UPDATE rag_ingest_progress SET status='done', questions_count=0, completed_at=NOW() WHERE file_name=%s", (file_name,))
        conn.commit()
        return {"file": file_name, "status": "done_empty", "count": 0}

    inserted = 0
    failed = 0
    for q in questions:
        try:
            emb = get_embedding(q["content"])
            content_hash = hashlib.sha256(q["content"].encode("utf-8")).hexdigest()
            # 关键: 显式 JSON 化, 避免 psycopg2 把 dict 当原生类型
            meta_json = json.dumps(q["metadata"], ensure_ascii=False, default=str)
            cur.execute(INSERT_SQL, (
                q["content"], content_hash, emb,
                q["knowledge_point_id"], q["subject_code"], q["difficulty"],
                q["question_type"], q["source_paper_id"], q["source_year"], q["source_region"],
                q["source_subject"], meta_json,
            ))
            inserted += 1
        except Exception as e:
            failed += 1
            if failed <= 3:
                print(f"    ! {file_name} 单题失败: {e}")
            continue

    cur.execute("UPDATE rag_ingest_progress SET status='done', questions_count=%s, completed_at=NOW() WHERE file_name=%s", (inserted, file_name))
    conn.commit()
    return {"file": file_name, "status": "done", "count": inserted}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--file", type=str, default=None)
    p.add_argument("--shuffle", action="store_true")
    args = p.parse_args()

    if args.file:
        files = [Path(args.file)]
    else:
        files = sorted(SCHEMA_DIR.glob("*.json"))
        if args.shuffle:
            import random
            random.shuffle(files)
        if args.limit:
            files = files[:args.limit]

    print(f"=== ingest start ===")
    print(f"  files: {len(files)}")
    print(f"  model: {EMBED_MODEL} ({EMBED_DIM} dim)")
    print(f"  db: {DB_DSN.split('@')[1] if '@' in DB_DSN else DB_DSN}")

    # 测 ollama 一次
    try:
        get_embedding("测连通性")
        print(f"  ✓ Ollama {EMBED_MODEL} OK")
    except Exception as e:
        print(f"  ✗ Ollama fail: {e}")
        print(f"  → 跑 'ollama pull {EMBED_MODEL}' (137MB, 1-2 min)")
        sys.exit(1)

    conn = psycopg2.connect(DB_DSN)
    start = time.time()
    done = 0
    skip = 0
    fail = 0
    total_qs = 0

    for f in files:
        try:
            r = process_file(f, conn)
            if r["status"] == "skip_done":
                skip += 1
            elif r["status"].startswith("failed"):
                fail += 1
            else:
                done += 1
                total_qs += r.get("count", 0)
            processed = done + skip + fail
            if processed % 5 == 0 or r["status"].startswith("failed"):
                elapsed = time.time() - start
                speed = processed / elapsed if elapsed > 0 else 0
                eta_min = (len(files) - processed) / speed / 60 if speed > 0 else 0
                print(f"  [{processed}/{len(files)}] {r['status']:15} {r.get('count', 0):4d}题  speed={speed:.1f}/s  eta={eta_min:.0f}min")
        except KeyboardInterrupt:
            print("\ninterrupt")
            break
        except Exception as e:
            print(f"  ✗ {f.name}: {e}")
            fail += 1

    elapsed = time.time() - start
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM rag_questions;")
    total_db = (cur.fetchone() or [0])[0]
    cur.execute("SELECT count(*) FROM rag_ingest_progress WHERE status='done';")
    done_files = (cur.fetchone() or [0])[0]
    conn.close()

    print(f"\n=== done ===")
    print(f"  files: done={done} skip={skip} fail={fail} / total={len(files)}")
    print(f"  done_files (in DB): {done_files}")
    print(f"  total_qs (in this run): {total_qs}")
    print(f"  rag_questions total in DB: {total_db}")
    print(f"  time: {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()