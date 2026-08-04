# P3 RAG Ingest Pipeline (Ollama + pgvector)

> 1,711 schema v5 JSON → pgvector `rag_questions` 表 (Ollama nomic-embed-text 768 dim).
> 2026-08-04 上线, 替代原 DashScope 1536 dim 路径.

## 1. 架构

```
[schema v5 JSON]              [Ollama]              [pgvector]
  1,711 files     →  getEmbedding()  →  INSERT INTO  →
  /home/cx/aitutor    nomic-embed-text   rag_questions
  database/         768 dim            vector(768)
  rag_build/*.json                    ivfflat index

[search]
  embedding <=>  → top-K  →  frontend
  cosine distance    similar questions
```

## 2. 决策 (为什么 P3 不是 E1/E2)

| 方案 | 问题 | 决策 |
|---|---|---|
| **E1 公共 DashScope** | 用户没公共 key, 给的 Maas workspace key 锁死 workspace | ✗ |
| **E2 公共 + Maas 混合** | Maas workspace 权限只允许 qwen3.7-max/plus chat, embedding 全 403 | ✗ |
| **A2 修 LiteLLM + 本地** | 3 个变量同时解决 (LiteLLM unhealthy + Ollama + dim), 调试空间大 | ✗ |
| **A1 build 自定义 AGE+pgvector 镜像** | 15-20 min build, 跟 pgvector ingest 强耦合 | ✗ (留 v0.6) |
| **B 官方 pgvector 镜像** | 5 min 拉镜像 + vector(768) 表 | ✓ (Step 0) |
| **P3 Ollama nomic-embed-text** | 137MB 本地模型, Windows 已有 Ollama | ✓ (Step 1) |

## 3. 决策要素

- **Schema v5 真实字段** (不是猜): `paper.questions[].stem` (主题), `paper.questions[].sub_questions[].stem` (子题), `paper.metadata.{year,region,subject}` (元数据), `q.quality` 是 dict 不是 difficulty
- **维度 768**: Ollama nomic-embed-text 默认输出, 跟 schema 1536 不兼容, 改 dim 是单点改动
- **content_hash dedup**: SHA-256 of stem, ON CONFLICT DO UPDATE 跳过重复题
- **进度跟踪**: `rag_ingest_progress` 表 (file_name, status, questions_count, error), resume 用
- **失败重试**: 单题失败 (Ollama 500/OOM) 不影响其他题, 打印前 3 个错

## 4. 启动 (4 步, 10 min)

### Step 0: 启 pgvector 容器
```bash
make start-pgvector
# 或: docker run -d --name pgvector-test -p 5433:5432 \
#   -e POSTGRES_USER=zhiqui -e POSTGRES_PASSWORD=*** -e POSTGRES_DB=zhiqui_review \
#   -v pgvector-test-data:/var/lib/postgresql/data pgvector/pgvector:pg15
```

### Step 1: 跑 migration
```bash
docker cp database/migrations/005_rag_questions.sql pgvector-test:/tmp/005.sql
docker exec pgvector-test psql -U zhiqui -d zhiqui_review -f /tmp/005.sql
```

### Step 2: 装 Ollama 模型 (Windows 端)
```powershell
ollama pull nomic-embed-text   # 137MB, 1-2 min
ollama list                    # 确认 nomic-embed-text 在
```

### Step 3: 跑 ingest
```bash
make ingest-pgvector-dry    # 5 文件 dry-run 验证
make ingest-pgvector        # 全量 1,711 文件, ~18 min
```

## 5. 验证

```bash
# 1. 端到端 embedding (Node)
EMBEDDING_PROVIDER=ollama node scripts/test_embedding.mjs
# 期望: ✓ getEmbedding OK, dim=768

# 2. db 统计
psql -h localhost -p 5433 -U zhiqui -d zhiqui_review -c "
  SELECT
    count(*) AS total_qs,
    count(DISTINCT source_paper_id) AS papers,
    count(DISTINCT source_subject) AS subjects
  FROM rag_questions;
"
# 期望: ~17k 题, 1,711 paper, 9-10 学科

# 3. similarity search (Python)
python3 -c "
import psycopg2
conn = psycopg2.connect(host='localhost', port=5433, user='zhiqui', password='***', database='zhiqui_review')
cur = conn.cursor()
cur.execute('''
  SELECT id, content, 1 - (embedding <=> (SELECT embedding FROM rag_questions WHERE id=22)) AS sim
  FROM rag_questions WHERE id != 22
  ORDER BY embedding <=> (SELECT embedding FROM rag_questions WHERE id=22) LIMIT 5;
''')
for r in cur.fetchall():
    print(f'  sim={r[2]:.4f}  {r[1][:60]}...')
"
```

## 6. Embedding 切换 (3 provider)

`services/embedding.js` + `.env.example` 支持 3 种 embedding provider:

| Provider | Endpoint | Model | Dim | 适用 |
|---|---|---|---|---|
| `local` | `http://localhost:8000/v1` | `shibing624/text2vec-base-chinese` | 768 | sentence-transformers server |
| **`ollama`** (P3) | `http://localhost:11434` | `nomic-embed-text` | 768 | **本地 Ollama, 当前默认** |
| `remote` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `text-embedding-v3` | 1536 | 阿里云 DashScope |

切换方法: `.env` 设 `EMBEDDING_PROVIDER=ollama` (或 local/remote).

## 7. 表 schema

```sql
-- 微观向量检索表 (1,711 schema v5 → 题目级 vector)
CREATE TABLE rag_questions (
  id              SERIAL PRIMARY KEY,
  content         TEXT NOT NULL,
  content_hash    VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 of stem (dedup)
  embedding       vector(768),                    -- Ollama nomic-embed-text
  knowledge_point_id VARCHAR(50),                 -- 后续从 KP map 关联
  subject_code    VARCHAR(20),                   -- math / physics / ...
  difficulty      INTEGER,                        -- 1-5, schema v5 无, 后续推
  question_type   VARCHAR(30),                   -- choice / composite / sub_question / fill_or_answer
  source_paper_id VARCHAR(255),                  -- schema v5 file name
  source_year     INTEGER,                       -- paper.metadata.year
  source_region   VARCHAR(50),                   -- paper.metadata.region
  source_subject  VARCHAR(50),                   -- paper.metadata.subject (中文)
  metadata        JSONB,                          -- {question_id, options, answer, analysis, source, quality}
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
);

-- 进度跟踪 (resume 用)
CREATE TABLE rag_ingest_progress (
  id              SERIAL PRIMARY KEY,
  file_name       VARCHAR(255) NOT NULL UNIQUE,
  file_hash       VARCHAR(64),
  questions_count INTEGER,
  status          VARCHAR(20),                    -- pending / in_progress / done / failed
  error           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- ivfflat 向量索引 (10K+ 后用)
CREATE INDEX idx_rag_questions_embedding ON rag_questions
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## 8. 已知问题 / 后续

- **Ollama 500 单题失败** (英语长 stem / 政治试卷): 1/10000 量级, 单题 skip 不影响
- **shared_materials 不入库**: 长材料走 GraphRAG (已 ingest), 不重复存 rag_questions
- **difficulty 字段空**: schema v5 没这字段, 后续从 `quality.confidence` 推
- **knowledge_point_id 字段空**: 后续从 KP map (knowledge_points) 反查关联
- **ivfflat 索引未激活**: 数据 < 10K 时 ivfflat recall 低, HNSW 或顺序扫更好. 10K+ 后再创建
- **A2 (LiteLLM 修)** 和 **A1 (AGE+pgvector 自定义镜像)** 留 v0.6

## 9. 关联文档

- [MILESTONES.md](./MILESTONES.md) - v0.5.0-dev 基线
- [gaokao_paper_mapping.md](./gaokao_paper_mapping.md) - 高考用卷映射 v0.1
- [frontend-migration/SPEC.md](./frontend-migration/SPEC.md) - F2 Service Layer (待写)
- `services/embedding.js` - 3 provider 实现
- `api/core/db.js` - vector(768) schema