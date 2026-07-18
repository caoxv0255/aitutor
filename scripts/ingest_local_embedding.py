"""
用本地 sentence-transformers 模型将北京高考真题向量化并存入 pgvector
"""
import os
import sys
import json
import re
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer

MD_DIR = Path(__file__).parent.parent / "graphrag_workspace" / "converted_markdown"

SUBJECT_MAP = {
    "语文": "chinese",
    "数学": "math",
    "英语": "english",
    "物理": "physics",
    "化学": "chemistry",
    "生物": "biology",
    "政治": "politics",
    "历史": "history",
    "地理": "geography",
}


def parse_filename(filename):
    name = filename.replace(".md", "")
    parts = name.split("_")

    year = None
    subject = None
    paper_type = "原卷"

    for part in parts:
        m = re.search(r"(\d{4})年", part)
        if m:
            year = m.group(1)

        for cn, en in SUBJECT_MAP.items():
            if cn in part:
                subject = en
                break

        if "解析" in part or "答案" in part:
            paper_type = "解析"

    return {"year": year, "subject": subject, "paper_type": paper_type, "original_name": filename}


def chunk_text(text, max_chars=800, overlap=100):
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + max_chars, len(text))

        if end < len(text):
            break_points = ["\n\n", "\n", "。", "；", "，"]
            for bp in break_points:
                idx = text.rfind(bp, start, end)
                if idx > start + max_chars * 0.5:
                    end = idx + len(bp)
                    break

        chunk = text[start:end].strip()
        if len(chunk) > 50:
            chunks.append(chunk)

        start = end - overlap
        if end >= len(text):
            break

    return chunks


def get_db_connection():
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:cxclementine102365@localhost:5432/aitutor"
    )
    return psycopg2.connect(db_url)


def main():
    model_name = os.environ.get("EMBEDDING_MODEL", "shibing624/text2vec-base-chinese")
    print(f"加载 embedding 模型: {model_name} ...")
    model = SentenceTransformer(model_name)
    dim = model.get_sentence_embedding_dimension()
    print(f"模型加载完成，向量维度: {dim}\n")

    files = sorted([
        f for f in os.listdir(MD_DIR)
        if "北京" in f and "高考" in f and f.endswith(".md")
    ])
    print(f"找到 {len(files)} 个北京高考文件\n")

    conn = get_db_connection()
    cur = conn.cursor()

    total_chunks = 0
    success_count = 0
    fail_count = 0

    for i, file in enumerate(files):
        meta = parse_filename(file)
        print(f"[{i + 1}/{len(files)}] {file}")
        print(f"  学科: {meta['subject'] or '未知'}, 年份: {meta['year'] or '未知'}, 类型: {meta['paper_type']}")

        try:
            with open(MD_DIR / file, "r", encoding="utf-8") as f:
                content = f.read()

            chunks = chunk_text(content)
            print(f"  分块数: {len(chunks)}")

            if not chunks:
                print("  ⚠️  无有效分块，跳过")
                continue

            embeddings = model.encode(chunks, show_progress_bar=False)

            rows = []
            for j, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                metadata = json.dumps({
                    "source_file": file,
                    "year": meta["year"],
                    "paper_type": meta["paper_type"],
                    "chunk_index": j,
                    "chunk_total": len(chunks),
                    "province": "北京",
                    "exam_type": "gaokao",
                }, ensure_ascii=False)

                emb_str = "[" + ",".join(f"{v:.8f}" for v in emb.tolist()) + "]"
                rows.append((
                    chunk,
                    emb_str,
                    meta["subject"] or "unknown",
                    metadata,
                ))

            sql = """
                INSERT INTO rag_questions (content, embedding, subject_code, metadata)
                VALUES %s
            """
            execute_values(cur, sql, rows)
            conn.commit()

            success_count += len(chunks)
            total_chunks += len(chunks)
            print(f"  ✅ 完成 (成功 {len(chunks)} 块)")

        except Exception as e:
            fail_count += 1
            conn.rollback()
            print(f"  ❌ 失败: {e}")

        print()

    print("=" * 60)
    print("索引完成!")
    print(f"  总文件: {len(files)}")
    print(f"  总块数: {total_chunks}")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
