#!/usr/bin/env python3
"""
文档转换流水线：扫描 database/ 目录，用 MarkItDown 转换所有文档为 Markdown，
再生成带元数据的 JSONL，供 GraphRAG 索引使用。

支持断点续跑、hash 去重、状态持久化到 PostgreSQL。
"""
import os
import sys
import json
import hashlib
import re
import asyncio
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
BASE_DIR = Path(__file__).parent.parent
DATABASE_DIR = BASE_DIR / "database"
CONVERTED_DIR = BASE_DIR / "graphrag_workspace" / "converted_markdown"
JSONL_DIR = BASE_DIR / "graphrag_workspace" / "normalized_jsonl"
MANIFEST_DIR = BASE_DIR / "graphrag_workspace" / "raw_manifest"

CONVERTED_DIR.mkdir(parents=True, exist_ok=True)
JSONL_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST_DIR.mkdir(parents=True, exist_ok=True)

# 支持的扩展名
SUPPORTED_EXTS = {".doc", ".docx", ".pdf", ".xlsx", ".xls", ".pptx"}


def get_db_conn():
    return psycopg2.connect(DATABASE_URL)


def file_hash(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class DocMetadata:
    stage: str          # 高中 / 初中
    exam_type: str      # 高考 / 中考
    province: str       # 省份 / 北京
    subject: str        # 学科
    year: int           # 年份 (0 表示未知)
    doc_kind: str       # 原卷 / 解析版 / 知识点
    source_file: str    # 原始文件名
    relative_path: str  # 相对路径
    file_hash: str
    file_size: int


def parse_metadata_from_path(rel_path: str, filename: str) -> DocMetadata:
    """从文件路径和文件名提取元数据"""
    parts = Path(rel_path).parts
    stage = "未知"
    exam_type = "未知"
    province = "未知"
    subject = "未知"
    year = 0
    doc_kind = "未知"

    # 判断阶段和考试类型
    if "高考" in rel_path or "gaokao" in rel_path.lower():
        stage = "高中"
        exam_type = "高考"
    elif "中考" in rel_path or "zhongkao" in rel_path.lower():
        stage = "初中"
        exam_type = "中考"

    if "知识点" in rel_path or "知识点" in filename:
        doc_kind = "知识点"
        stage = "高中" if "高中" in rel_path else stage
    elif "解析" in filename or "解析版" in filename or "答案" in filename:
        doc_kind = "解析版"
    elif "空白" in filename or "原卷" in filename:
        doc_kind = "原卷"
    else:
        doc_kind = "真题"

    # 提取省份
    province_match = re.search(r'(北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆)', rel_path)
    if province_match:
        province = province_match.group(1)
    elif "北京" in rel_path:
        province = "北京"

    # 提取学科
    subject_keywords = {
        "语文": "语文", "数学": "数学", "英语": "英语", "物理": "物理",
        "化学": "化学", "生物": "生物", "历史": "历史", "地理": "地理",
        "政治": "政治", "道德与法治": "政治", "文综": "文综", "理综": "理综"
    }
    for kw, subj in subject_keywords.items():
        if kw in rel_path or kw in filename:
            subject = subj
            break

    # 提取年份
    year_match = re.search(r'(19|20)\d{2}', filename)
    if year_match:
        year = int(year_match.group(0))

    return DocMetadata(
        stage=stage,
        exam_type=exam_type,
        province=province,
        subject=subject,
        year=year,
        doc_kind=doc_kind,
        source_file=filename,
        relative_path=rel_path,
        file_hash="",
        file_size=0,
    )


async def convert_with_markitdown(filepath: Path) -> Optional[str]:
    """使用 MarkItDown 转换文档为 Markdown"""
    try:
        from markitdown import MarkItDown
        md = MarkItDown()
        result = md.convert(str(filepath))
        return result.markdown if result else None
    except Exception as e:
        print(f"  MarkItDown 转换失败: {filepath.name} - {e}")
        return None


async def convert_document(doc_id: int, filepath: Path, rel_path: str, conn) -> bool:
    """转换单个文档，更新数据库状态"""
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE graphrag_documents SET status = 'converting', updated_at = NOW() WHERE id = %s",
            (doc_id,)
        )
        conn.commit()

        markdown = await convert_with_markitdown(filepath)
        if markdown is None:
            cursor.execute(
                "UPDATE graphrag_documents SET status = 'failed_convert', updated_at = NOW() WHERE id = %s",
                (doc_id,)
            )
            conn.commit()
            return False

        # 保存 markdown 文件
        md_filename = f"{doc_id}_{filepath.stem}.md"
        md_path = CONVERTED_DIR / md_filename
        md_path.write_text(markdown, encoding="utf-8")

        cursor.execute(
            """UPDATE graphrag_documents
               SET status = 'converted',
                   converted_path = %s,
                   updated_at = NOW()
               WHERE id = %s""",
            (str(md_path.relative_to(BASE_DIR)), doc_id)
        )
        conn.commit()
        return True

    except Exception as e:
        cursor.execute(
            "UPDATE graphrag_documents SET status = 'failed_convert', updated_at = NOW() WHERE id = %s",
            (doc_id,)
        )
        conn.commit()
        print(f"  转换异常: {filepath.name} - {e}")
        return False
    finally:
        cursor.close()


async def scan_and_register(conn):
    """扫描 database/ 目录，注册所有文档到数据库"""
    cursor = conn.cursor()
    registered = 0
    skipped = 0

    print(f"扫描目录: {DATABASE_DIR}")

    for root, dirs, files in os.walk(DATABASE_DIR):
        for filename in files:
            ext = Path(filename).suffix.lower()
            if ext not in SUPPORTED_EXTS:
                continue

            filepath = Path(root) / filename
            rel_path = str(filepath.relative_to(DATABASE_DIR))
            fhash = file_hash(filepath)
            fsize = filepath.stat().st_size

            # 检查是否已注册（按 hash 去重）
            cursor.execute(
                "SELECT id, status FROM graphrag_documents WHERE file_hash = %s",
                (fhash,)
            )
            existing = cursor.fetchone()
            if existing:
                skipped += 1
                continue

            meta = parse_metadata_from_path(rel_path, filename)
            meta.file_hash = fhash
            meta.file_size = fsize

            cursor.execute("""
                INSERT INTO graphrag_documents
                (relative_path, filename, file_hash, file_size, file_ext,
                 stage, exam_type, province, subject, year, doc_kind, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (
                rel_path, filename, fhash, fsize, ext,
                meta.stage, meta.exam_type, meta.province,
                meta.subject, meta.year, meta.doc_kind
            ))
            registered += 1

            if registered % 100 == 0:
                conn.commit()
                print(f"  已注册 {registered} 个文件...")

    conn.commit()
    cursor.close()
    print(f"注册完成: 新增 {registered}, 跳过(已存在) {skipped}")
    return registered


async def run_conversion(batch_size: int = 100, max_concurrent: int = 3):
    """运行转换流水线"""
    conn = get_db_conn()
    cursor = conn.cursor()

    # 获取待转换的文件
    cursor.execute("""
        SELECT id, relative_path, filename FROM graphrag_documents
        WHERE status = 'pending' ORDER BY id LIMIT %s
    """, (batch_size,))
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        print("没有待转换的文件")
        conn.close()
        return

    print(f"开始转换 {len(rows)} 个文件...")

    semaphore = asyncio.Semaphore(max_concurrent)

    async def convert_one(doc_id, rel_path, filename):
        async with semaphore:
            filepath = DATABASE_DIR / rel_path
            if not filepath.exists():
                c = conn.cursor()
                c.execute("UPDATE graphrag_documents SET status = 'failed_convert' WHERE id = %s", (doc_id,))
                conn.commit()
                c.close()
                return False
            result = await convert_document(doc_id, filepath, rel_path, conn)
            if result:
                print(f"  [OK] {filename}")
            return result

    tasks = [convert_one(r[0], r[1], r[2]) for r in rows]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    success = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is False)
    print(f"转换完成: 成功 {success}, 失败 {failed}")
    conn.close()


async def generate_jsonl(index_name: str = "gaokao_all", filter_sql: str = ""):
    """将已转换的 markdown 生成 JSONL 供 GraphRAG 索引"""
    conn = get_db_conn()
    cursor = conn.cursor()

    where_clause = "status = 'converted'"
    if filter_sql:
        where_clause += f" AND {filter_sql}"

    cursor.execute(f"""
        SELECT id, relative_path, filename, stage, exam_type, province, subject, year, doc_kind, converted_path
        FROM graphrag_documents WHERE {where_clause} ORDER BY id
    """)
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        print(f"没有符合条件的文档用于 {index_name}")
        conn.close()
        return

    jsonl_path = JSONL_DIR / f"{index_name}.jsonl"
    count = 0

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for row in rows:
            doc_id, rel_path, filename, stage, exam_type, province, subject, year, doc_kind, conv_path = row

            if not conv_path:
                continue

            md_path = BASE_DIR / conv_path
            if not md_path.exists():
                continue

            text = md_path.read_text(encoding="utf-8")
            if not text or len(text.strip()) < 50:
                continue

            # 将长文档分块（简单策略：按标题分割）
            chunks = chunk_markdown(text, max_chars=3000)

            for chunk_idx, chunk_text in enumerate(chunks):
                record = {
                    "id": f"{index_name}_{doc_id}_{chunk_idx}",
                    "text": chunk_text,
                    "metadata": {
                        "stage": stage,
                        "exam_type": exam_type,
                        "province": province,
                        "subject": subject,
                        "year": year,
                        "doc_kind": doc_kind,
                        "source_file": filename,
                        "chunk_idx": chunk_idx,
                        "total_chunks": len(chunks),
                        "doc_id": doc_id,
                    }
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                count += 1

    print(f"生成 JSONL: {jsonl_path} ({count} 条记录)")
    conn.close()
    return str(jsonl_path)


def chunk_markdown(text: str, max_chars: int = 3000) -> list:
    """将 markdown 文本分块"""
    # 按二级标题分割
    sections = re.split(r'\n##+\s+', text)
    chunks = []
    current = ""

    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(current) + len(section) < max_chars:
            current += "\n\n" + section if current else section
        else:
            if current:
                chunks.append(current.strip())
            current = section

    if current:
        chunks.append(current.strip())

    # 如果单个块还是太长，按字符切分
    final_chunks = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final_chunks.append(chunk)
        else:
            for i in range(0, len(chunk), max_chars):
                final_chunks.append(chunk[i:i + max_chars])

    return final_chunks if final_chunks else [text[:max_chars]]


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="GraphRAG 文档转换流水线")
    parser.add_argument("action", choices=["scan", "convert", "jsonl", "all"])
    parser.add_argument("--index", default="gaokao_all", help="索引名称")
    parser.add_argument("--filter", default="", help="SQL WHERE 条件")
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    if args.action == "scan" or args.action == "all":
        conn = get_db_conn()
        await scan_and_register(conn)
        conn.close()

    if args.action == "convert" or args.action == "all":
        await run_conversion(batch_size=args.batch_size)

    if args.action == "jsonl" or args.action == "all":
        await generate_jsonl(index_name=args.index, filter_sql=args.filter)


if __name__ == "__main__":
    asyncio.run(main())
