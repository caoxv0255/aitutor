"""GraphRAG 服务数据库层"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


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
    import json
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO graphrag_query_logs
            (query_text, index_name, method, response_summary, citations, duration_ms, user_email)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (query_text, index_name, method, response_summary,
              json.dumps(citations) if citations else '[]', duration_ms, user_email))
        conn.commit()
        cursor.close()


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
