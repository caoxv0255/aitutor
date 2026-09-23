"""M-5 / P10 GraphRAG 查询日志脱敏与保留期验证。

无 pytest 依赖，直接用项目 venv 运行：
    .venv/bin/python graphrag_service/tests/test_query_log_pii.py

所有数据都写在独立的临时 schema（graphrag_pii_test_<pid>）里，跑完 DROP，
不触碰生产 graphrag_query_logs。
"""
import hashlib
import hmac
import os
import sys
import unittest
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

# 固定测试盐，保证哈希可复现；必须在导入 db 之前设置。
os.environ.setdefault("GRAPHRAG_PII_SALT", "unit-test-salt")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BASE_DIR / ".env")

TEST_SCHEMA = f"graphrag_pii_test_{os.getpid()}"
TEST_SALT = os.environ["GRAPHRAG_PII_SALT"]


def _build_test_dsn() -> str:
    base = os.getenv("DATABASE_URL")
    if not base:
        raise RuntimeError("DATABASE_URL 未配置，无法运行测试")
    sep = "&" if urllib.parse.urlparse(base).query else "?"
    options = urllib.parse.quote(f"-c search_path={TEST_SCHEMA}")
    return f"{base}{sep}options={options}"


from graphrag_service import db  # noqa: E402


class QueryLogPiiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg2

        cls.prod_url = os.getenv("DATABASE_URL")
        admin = psycopg2.connect(cls.prod_url)
        admin.autocommit = True
        with admin.cursor() as cur:
            cur.execute(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE')
            cur.execute(f'CREATE SCHEMA "{TEST_SCHEMA}"')
        admin.close()

        db.DATABASE_URL = _build_test_dsn()
        db.init_graphrag_tables()

    @classmethod
    def tearDownClass(cls):
        import psycopg2

        admin = psycopg2.connect(cls.prod_url)
        admin.autocommit = True
        with admin.cursor() as cur:
            cur.execute(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE')
        admin.close()

    def setUp(self):
        with db.get_db() as conn:
            cur = conn.cursor()
            cur.execute("TRUNCATE graphrag_query_logs RESTART IDENTITY")
            conn.commit()
            cur.close()

    def _fetch(self, sql, params=()):
        with db.get_db() as conn:
            cur = db.get_cursor(conn)
            cur.execute(sql, params)
            rows = cur.fetchall()
            cur.close()
            return rows

    # ---- 1. 纯函数：脱敏 + 截断 + 哈希稳定 ----
    def test_mask_query_text_redacts_truncates_and_hashes(self):
        raw = "我的邮箱是 a.b@example.com 手机 13800138000 身份证 11010519491231002X 请帮我讲解"
        preview, qhash, qlen = db.mask_query_text(raw)
        self.assertNotIn("a.b@example.com", preview)
        self.assertNotIn("13800138000", preview)
        self.assertNotIn("11010519491231002X", preview)
        self.assertIn("[email]", preview)
        self.assertIn("[phone]", preview)
        self.assertIn("[id]", preview)
        self.assertLessEqual(len(preview), db.QUERY_TEXT_PREVIEW_CHARS)
        # 哈希基于归一化全文，长度是归一化后的字符数
        normalized = db._WS_RE.sub(" ", raw).strip()
        self.assertEqual(qhash, hashlib.sha256(normalized.encode()).hexdigest())
        self.assertEqual(qlen, len(normalized))
        # 同文不同空白 → 同哈希
        self.assertEqual(db.mask_query_text("a  b")[1], db.mask_query_text(" a b ")[1])

    # ---- 2. 写入即脱敏 ----
    def test_log_query_persists_masked_row(self):
        db.log_query(
            query_text="联系我 zhang.san@corp.cn 或 13912345678 讲讲二次函数",
            index_name="subject_math",
            method="local",
            response_summary="答案摘要",
            citations=["1", "2"],
            duration_ms=123,
            user_email="Zhang.San@corp.cn",
        )
        rows = self._fetch(
            "SELECT query_text, user_email, user_email_hash, query_hash, query_length, citations "
            "FROM graphrag_query_logs"
        )
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertNotIn("zhang.san@corp.cn", r["query_text"])
        self.assertNotIn("13912345678", r["query_text"])
        self.assertIsNone(r["user_email"], "user_email 列必须为 NULL")
        expected = hmac.new(TEST_SALT.encode(), b"zhang.san@corp.cn", hashlib.sha256).hexdigest()
        self.assertEqual(r["user_email_hash"], expected)
        self.assertEqual(len(r["query_hash"]), 64)
        self.assertGreater(r["query_length"], 0)
        self.assertEqual(r["citations"], ["1", "2"])

    # ---- 3. 保留期：超期行被清，未超期保留 ----
    def test_cleanup_removes_only_expired(self):
        with db.get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO graphrag_query_logs (query_text, method, query_hash, created_at) "
                "VALUES ('旧问题', 'local', 'h-old', NOW() - make_interval(days => %s))",
                (db.QUERY_LOG_RETENTION_DAYS + 5,),
            )
            cur.execute(
                "INSERT INTO graphrag_query_logs (query_text, method, query_hash) "
                "VALUES ('新问题', 'local', 'h-new')"
            )
            conn.commit()
            cur.close()

        deleted = db.cleanup_old_query_logs()
        self.assertEqual(deleted, 1, "应只删除超期的那一行")
        remaining = self._fetch("SELECT query_text FROM graphrag_query_logs")
        self.assertEqual([r["query_text"] for r in remaining], ["新问题"])

        # 保留期 <=0 必须拒绝清理（保护性行为）
        self.assertEqual(db.cleanup_old_query_logs(retention_days=0), 0)
        self.assertEqual(len(self._fetch("SELECT 1 FROM graphrag_query_logs")), 1)

    # ---- 4. 存量回填 + 幂等 ----
    def test_migrate_backfills_legacy_and_is_idempotent(self):
        with db.get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO graphrag_query_logs (query_text, method, user_email) "
                "VALUES ('我是 lisi@old.com 电话 13700001111', 'local', 'lisi@old.com')"
            )
            conn.commit()
            cur.close()

        result = db.migrate_query_logs_pii()
        self.assertEqual(result, {"migrated": 1, "failed": 0})
        r = self._fetch(
            "SELECT query_text, user_email, user_email_hash, query_hash, query_length "
            "FROM graphrag_query_logs"
        )[0]
        self.assertNotIn("lisi@old.com", r["query_text"])
        self.assertNotIn("13700001111", r["query_text"])
        self.assertIsNone(r["user_email"])
        self.assertEqual(
            r["user_email_hash"],
            hmac.new(TEST_SALT.encode(), b"lisi@old.com", hashlib.sha256).hexdigest(),
        )
        self.assertEqual(len(r["query_hash"]), 64)

        # 幂等：再跑一次不再迁移
        self.assertEqual(db.migrate_query_logs_pii(), {"migrated": 0, "failed": 0})

    # ---- 5. 读取方（字段消费）未被破坏 ----
    def test_reader_columns_still_work(self):
        db.log_query("读取方回归", "gaokao_all", "explain", duration_ms=50)
        rows = self._fetch(
            "SELECT id, query_text, index_name, method, response_summary, duration_ms, "
            "created_at FROM graphrag_query_logs ORDER BY created_at DESC"
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["query_text"], "读取方回归")
        self.assertEqual(rows[0]["method"], "explain")
        self.assertEqual(rows[0]["duration_ms"], 50)
        self.assertIsNotNone(rows[0]["created_at"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
