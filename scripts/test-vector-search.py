"""
测试向量检索效果
"""
import os
import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("shibing624/text2vec-base-chinese")

conn = psycopg2.connect(
    os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:cxclementine102365@localhost:5432/aitutor"
    )
)
cur = conn.cursor()


def search(query, subject=None, top_k=5):
    emb = model.encode(query)
    emb_str = "[" + ",".join(f"{v:.8f}" for v in emb.tolist()) + "]"

    sql = """
        SELECT 
            content,
            subject_code,
            metadata->>'source_file' as source_file,
            metadata->>'year' as year,
            1 - (embedding <=> %s::vector) as similarity
        FROM rag_questions
    """
    params = [emb_str]

    if subject:
        sql += " WHERE subject_code = %s"
        params.append(subject)

    sql += " ORDER BY embedding <=> %s::vector LIMIT %s"
    params.append(emb_str)
    params.append(top_k)

    cur.execute(sql, params)
    results = cur.fetchall()

    print(f"\n查询: '{query}'")
    if subject:
        print(f"学科过滤: {subject}")
    print("-" * 60)
    for i, (content, subj, src, year, sim) in enumerate(results):
        content_preview = content[:80].replace("\n", " ")
        print(f"[{i+1}] 相似度: {sim:.4f} | {subj} | {year or '?'}年")
        print(f"    文件: {src}")
        print(f"    内容: {content_preview}...")
        print()


# 测试几个查询
search("牛顿第二定律", subject="physics")
search("光合作用", subject="biology")
search("函数导数", subject="math")
search("古诗文默写")
search("北京高考物理实验题")

cur.close()
conn.close()
