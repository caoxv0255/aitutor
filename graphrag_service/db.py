"""GraphRAG 服务数据库层"""
import os
import hmac
import hashlib
import logging
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

logger = logging.getLogger("graphrag.pii")

# ===== PII 策略（M-5 / P10）=====
# graphrag_query_logs 只用于排查检索质量问题，不做用户级画像。
# 策略：query_text 只落「正则脱敏后的截断预览」+ 全文哈希 + 长度；user_email 不落原文，
# 落 HMAC-SHA256(salt, email) —— 同一邮箱稳定同值，支持按用户去重/聚合，又不暴露原文。
# 保留期默认 30 天，写入时与服务启动时顺带清理超期行。
QUERY_LOG_RETENTION_DAYS = int(os.getenv("GRAPHRAG_QUERY_LOG_RETENTION_DAYS", "30"))
QUERY_TEXT_PREVIEW_CHARS = int(os.getenv("GRAPHRAG_QUERY_TEXT_PREVIEW_CHARS", "60"))

_PII_SALT = os.getenv("GRAPHRAG_PII_SALT", "")
if not _PII_SALT:
    # 不静默：缺盐会让 HMAC 退化为可被字典攻击的弱哈希，必须能被看见。
    logger.warning(
        "[GraphRAG PII] 未配置 GRAPHRAG_PII_SALT，使用内置默认盐；"
        "生产环境建议在 .env 配置独立盐值（本轮不新增/修改 .env）"
    )
    _PII_SALT = "graphrag-default-pii-salt-v1"

_WS_RE = re.compile(r"\s+")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
_ID_CARD_RE = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")


def _redact_pii(text: str) -> str:
    """对文本做常见直接标识符的正则脱敏（邮箱/手机号/身份证）。"""
    out = _EMAIL_RE.sub("[email]", text)
    out = _PHONE_RE.sub("[phone]", out)
    out = _ID_CARD_RE.sub("[id]", out)
    return out


def mask_query_text(query_text) -> tuple:
    """返回 (masked_preview, query_hash, query_length)。

    脱敏流程有意做成「全函数内 try/except + 降级占位」：任何一步异常都不得回退到原文。
    """
    raw = "" if query_text is None else str(query_text)
    try:
        normalized = _WS_RE.sub(" ", raw).strip()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        query_length = len(normalized)
        preview = _redact_pii(normalized)[:QUERY_TEXT_PREVIEW_CHARS]
        return preview, query_hash, query_length
    except Exception:
        # 不静默吞：记录完整堆栈；降级为占位符，绝不落原文。
        logger.exception("[GraphRAG PII] query_text 脱敏失败，降级为占位符（不落原文）")
        try:
            fallback_hash = hashlib.sha256(raw.encode("utf-8", "ignore")).hexdigest() if raw else ""
        except Exception:
            fallback_hash = ""
        return "[mask-failed]", fallback_hash, len(raw)


def hash_user_email(user_email) -> str:
    """把邮箱转成稳定 HMAC-SHA256 令牌；空值返回 None，异常置 None（不落原文）。"""
    if user_email is None:
        return None
    email = str(user_email).strip().lower()
    if not email:
        return None
    try:
        return hmac.new(
            _PII_SALT.encode("utf-8"), email.encode("utf-8"), hashlib.sha256
        ).hexdigest()
    except Exception:
        logger.exception("[GraphRAG PII] user_email 哈希失败，置空（不落原文）")
        return None


@contextmanager
def get_db():
    """获取数据库连接上下文"""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()


def get_cursor(conn):
    return conn.cursor(cursor_factory=RealDictCursor)


def init_graphrag_tables():
    """初始化 GraphRAG 相关表"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS graphrag_documents (
                id SERIAL PRIMARY KEY,
                relative_path TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_hash VARCHAR(64) UNIQUE NOT NULL,
                file_size BIGINT,
                file_ext VARCHAR(10),
                stage VARCHAR(20),
                exam_type VARCHAR(20),
                province VARCHAR(50),
                subject VARCHAR(20),
                year INTEGER,
                doc_kind VARCHAR(20),
                status VARCHAR(30) DEFAULT 'pending',
                converted_path TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_status ON graphrag_documents(status);
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_hash ON graphrag_documents(file_hash);
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_province ON graphrag_documents(province);
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_subject ON graphrag_documents(subject);
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_year ON graphrag_documents(year);
            CREATE INDEX IF NOT EXISTS idx_graphrag_docs_exam ON graphrag_documents(exam_type);

            CREATE TABLE IF NOT EXISTS graphrag_chunks (
                id SERIAL PRIMARY KEY,
                doc_id INTEGER REFERENCES graphrag_documents(id),
                chunk_index INTEGER,
                text TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                token_count INTEGER,
                embedding_id VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_graphrag_chunks_doc ON graphrag_chunks(doc_id);

            CREATE TABLE IF NOT EXISTS graphrag_index_jobs (
                id SERIAL PRIMARY KEY,
                index_name VARCHAR(50) NOT NULL,
                status VARCHAR(30) DEFAULT 'pending',
                total_docs INTEGER DEFAULT 0,
                processed_docs INTEGER DEFAULT 0,
                failed_docs INTEGER DEFAULT 0,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                error_message TEXT,
                config JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_graphrag_jobs_status ON graphrag_index_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_graphrag_jobs_name ON graphrag_index_jobs(index_name);

            CREATE TABLE IF NOT EXISTS graphrag_query_logs (
                id SERIAL PRIMARY KEY,
                query_text TEXT NOT NULL,
                index_name VARCHAR(50),
                method VARCHAR(20),
                response_summary TEXT,
                citations JSONB DEFAULT '[]',
                duration_ms INTEGER,
                user_email VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_graphrag_query_time ON graphrag_query_logs(created_at);
            -- M-5/P10: 脱敏新增列（幂等，兼容既有表）
            ALTER TABLE graphrag_query_logs ADD COLUMN IF NOT EXISTS query_hash VARCHAR(64);
            ALTER TABLE graphrag_query_logs ADD COLUMN IF NOT EXISTS query_length INTEGER;
            ALTER TABLE graphrag_query_logs ADD COLUMN IF NOT EXISTS user_email_hash VARCHAR(64);
            CREATE INDEX IF NOT EXISTS idx_graphrag_query_email_hash ON graphrag_query_logs(user_email_hash);

            CREATE TABLE IF NOT EXISTS exam_source_files (
                id SERIAL PRIMARY KEY,
                exam_paper_id INTEGER,
                doc_id INTEGER REFERENCES graphrag_documents(id),
                file_type VARCHAR(20),
                file_path TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        conn.commit()
        cursor.close()
        print("GraphRAG 表初始化完成")
    # M-5/P10: 服务启动即处理存量（清理超期 + 历史行脱敏回填）。
    cleanup_old_query_logs()
    migrate_query_logs_pii()


def get_pending_jobs(index_name: str = None):
    with get_db() as conn:
        cursor = get_cursor(conn)
        if index_name:
            cursor.execute(
                "SELECT * FROM graphrag_index_jobs WHERE index_name = %s ORDER BY created_at DESC",
                (index_name,)
            )
        else:
            cursor.execute("SELECT * FROM graphrag_index_jobs ORDER BY created_at DESC")
        rows = cursor.fetchall()
        cursor.close()
        return rows


def create_job(index_name: str, total_docs: int, config: dict = None):
    import json
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO graphrag_index_jobs (index_name, status, total_docs, config)
            VALUES (%s, 'pending', %s, %s)
            RETURNING id
        """, (index_name, total_docs, json.dumps(config) if config else '{}'))
        job_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        return job_id


def update_job_status(job_id: int, status: str, processed: int = None, failed: int = None, error: str = None):
    with get_db() as conn:
        cursor = conn.cursor()
        updates = ["status = %s", "updated_at = NOW()"]
        params = [status]
        if processed is not None:
            updates.append("processed_docs = %s")
            params.append(processed)
        if failed is not None:
            updates.append("failed_docs = %s")
            params.append(failed)
        if error:
            updates.append("error_message = %s")
            params.append(error)
        if status == 'running':
            updates.append("started_at = NOW()")
        if status in ('completed', 'failed'):
            updates.append("completed_at = NOW()")

        params.append(job_id)
        cursor.execute(f"""
            UPDATE graphrag_index_jobs SET {', '.join(updates)} WHERE id = %s
        """, tuple(params))
        conn.commit()
        cursor.close()


def log_query(query_text: str, index_name: str, method: str, response_summary: str = None,
              citations: list = None, duration_ms: int = None, user_email: str = None):
    """写入查询日志（M-5/P10：原文不入库）。

    - query_text 列落「脱敏预览」，另存 query_hash / query_length 供检索质量分析；
    - user_email 列恒为 NULL，邮箱只以 user_email_hash（HMAC）形式落库。
    """
    import json
    masked_preview, query_hash, query_length = mask_query_text(query_text)
    email_hash = hash_user_email(user_email)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO graphrag_query_logs
            (query_text, index_name, method, response_summary, citations, duration_ms,
             query_hash, query_length, user_email_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (masked_preview, index_name, method, response_summary,
              json.dumps(citations) if citations else '[]', duration_ms,
              query_hash, query_length, email_hash))
        conn.commit()
        cursor.close()
    # 写入时顺带清理超期行；清理失败不能影响本次写入已经完成的事实，但必须可见。
    try:
        cleanup_old_query_logs()
    except Exception:
        logger.exception("[GraphRAG PII] 写入后清理超期查询日志失败（本次写入已成功）")


def cleanup_old_query_logs(retention_days: int = None) -> int:
    """删除超过保留期的查询日志，返回删除行数。

    保留期默认 QUERY_LOG_RETENTION_DAYS（30 天）。>0 时按 created_at 删除；
    <=0 视为「不清理」（返回 0 并告警），避免误配成负数导致全表被删。
    """
    days = QUERY_LOG_RETENTION_DAYS if retention_days is None else int(retention_days)
    if days <= 0:
        logger.warning("[GraphRAG PII] 保留期配置为 %s 天，跳过清理（拒绝全表删除）", days)
        return 0
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM graphrag_query_logs WHERE created_at < NOW() - make_interval(days => %s)",
            (days,),
        )
        deleted = cursor.rowcount
        conn.commit()
        cursor.close()
    if deleted:
        logger.info("[GraphRAG PII] 清理超期查询日志: 删除 %d 行 (保留期 %d 天)", deleted, days)
    return deleted


def migrate_query_logs_pii() -> dict:
    """存量脱敏（幂等）：仅处理 query_hash IS NULL 的历史行。

    对历史行回填 query_hash/query_length，把 query_text 改写为脱敏预览，
    将 user_email 清空并回填 user_email_hash。
    """
    with get_db() as conn:
        cursor = get_cursor(conn)
        cursor.execute(
            "SELECT id, query_text, user_email FROM graphrag_query_logs WHERE query_hash IS NULL"
        )
        rows = cursor.fetchall()
        migrated = 0
        failed = 0
        for row in rows:
            try:
                preview, query_hash, query_length = mask_query_text(row["query_text"])
                email_hash = hash_user_email(row["user_email"])
                cursor.execute("""
                    UPDATE graphrag_query_logs
                    SET query_text = %s, query_hash = %s, query_length = %s,
                        user_email = NULL, user_email_hash = %s
                    WHERE id = %s
                """, (preview, query_hash, query_length, email_hash, row["id"]))
                migrated += 1
            except Exception:
                failed += 1
                logger.exception("[GraphRAG PII] 存量行 id=%s 脱敏失败（该行保持原状，待重试）", row["id"])
        conn.commit()
        cursor.close()
    if migrated or failed:
        logger.info("[GraphRAG PII] 存量查询日志脱敏: 成功 %d 行, 失败 %d 行", migrated, failed)
    return {"migrated": migrated, "failed": failed}


def get_doc_stats():
    with get_db() as conn:
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT
                status,
                COUNT(*) as count
            FROM graphrag_documents
            GROUP BY status
        """)
        rows = cursor.fetchall()
        cursor.close()
        return {r['status']: r['count'] for r in rows}


def get_docs_for_indexing(index_name: str, limit: int = None):
    """获取指定索引需要处理的文档"""
    from .config import INDEXES
    filter_sql = INDEXES.get(index_name, {}).get("filter", "")
    with get_db() as conn:
        cursor = get_cursor(conn)
        where = "status = 'converted'"
        if filter_sql:
            where += f" AND {filter_sql}"
        sql = f"SELECT * FROM graphrag_documents WHERE {where} ORDER BY id"
        if limit:
            sql += f" LIMIT {limit}"
        cursor.execute(sql)
        rows = cursor.fetchall()
        cursor.close()
        return rows
