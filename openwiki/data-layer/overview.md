# Data Layer

The system uses a **single PostgreSQL 16 instance** with two extension-based augmentations: Apache AGE for graph traversal and pgvector for vector similarity search.

## Database Architecture

```
┌───────────────────────────────────────────────────────────┐
│                 PostgreSQL 16 (Single Instance)            │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────────┐│
│  │ Relational Tables    │  │ Extensions                  ││
│  │ (~15 tables)         │  │                             ││
│  │                      │  │  Apache AGE (graph)         ││
│  │ users, subjects      │  │  │                          ││
│  │ exam_papers          │  │  ├── knowledge_graph        ││
│  │ exam_questions       │  │  │   ├── KnowledgePoint     ││
│  │ question_knowledge_  │  │  │   └── DEPENDS_ON         ││
│  │  points              │  │  │                          ││
│  │ wrong_questions      │  │  pgvector                   ││
│  │ reports              │  │  │                          ││
│  │ practice_records     │  │  ├── rag_questions          ││
│  │ exam_sessions        │  │  └── question_vectors       ││
│  │ task_queue           │  │                             ││
│  │ provinces            │  ├── pg_trgm                   ││
│  │ knowledge_points     │  ├── btree_gin                 ││
│  │ personalized_papers  │  └──                           ││
│  │ similar_questions    │                                 ││
│  │ province_knowledge_  │                                 ││
│  │  stats               │                                 ││
│  └─────────────────────┘  └─────────────────────────────┘│
└───────────────────────────────────────────────────────────┘
```

## Connection Management

**Source:** `api/core/db.js`

- `pg.Pool` with `DATABASE_URL` environment variable
- Max pool size: **20** connections
- Min idle: **2** connections
- Idle timeout: **30s** (recycle idle connections)
- Connection timeout: **8s**
- Statement timeout: **30s** (global protection against slow queries)
- Application name: `aitutor-api` (visible in `pg_stat_activity`)
- TCP keepalive: every 10 seconds (prevents firewall drops)
- Pool warning: logged when queue exceeds **5** waiting connections

## Relational Tables

### Core Domain Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | email, password (bcrypt), grade, province, exam_level | Auth & student profile |
| `subjects` | code, name, category, sort_order | 9 subjects: math, chinese, english, physics, chemistry, politics, biology, history, geography |
| `exam_papers` | province_code, year, subject, exam_level, difficulty_avg | Paper metadata |
| `exam_questions` | paper_id, stem, options, answer, analysis, difficulty, `physics_structure` (JSONB), `chemistry_structure` (JSONB), `math_structure` (JSONB), has_image, has_formula | Core question table — rich per-subject JSONB columns |
| `question_knowledge_points` | question_id, knowledge_point_id, relevance_score | M:N bridge between questions and knowledge points |
| `knowledge_points` | id (PK VARCHAR), subject, name, subtopics, difficulty, frequency | Relational copy of knowledge points (also exists in graph) |

### Learning & Progress Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `wrong_questions` | user_email, subject_code, knowledge_point_id, error_category, error_types (JSONB) | Error tracking with auto-analysis |
| `reports` | user_email, subject_code, score, data (JSONB) | Diagnostic reports |
| `practice_records` | user_email, question_id, is_correct, time_spent_ms, session_id | Practice history |
| `exam_sessions` | id, user_email, subject, accuracy, score, correct_count | Exam attempt tracking |
| `personalized_papers` | user_email, subject, data (TEXT/JSON) | AI-generated personalized exams |
| `similar_questions` | report_id, user_email, data (JSONB) | Similar question storage |

### Infrastructure Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `task_queue` | user_email, image_data, status, retry_count | Async image-processing queue |
| `provinces` | code, name, exam_type, paper_type, region | Exam region configuration |
| `province_knowledge_stats` | province_code, year, subject, knowledge_point_id, frequency, avg_difficulty | Per-province statistics |

### Partitioning

`exam_questions_partitioned` uses **range partitioning by `year`** (2019–2026 + default partition). Each partition holds one year's questions for efficient time-range query pruning.

**Source:** `database/init/02-partitions.sql`

### Performance Tuning

**Source:** `database/init/03-performance.sql`

- `shared_buffers = 2GB`
- `work_mem = 64MB`
- `effective_cache_size = 4GB`
- `synchronous_commit = off` (performance over durability for analytics workloads)
- 5s slow query logging threshold
- Helper view: `v_exam_questions_recent` (last 3 years)
- Helper function: `get_questions_by_year_range(years)`
- Diagnostics: `analyze_slow_queries()`

## Apache AGE Knowledge Graph

### Graph Schema

- **Graph name**: `knowledge_graph`
- **Labels**: `KnowledgePoint` (nodes), `DEPENDS_ON` (edges)
- **Node properties**: `id` (VARCHAR PK), `name`, `subject`, `module`, `difficulty`, `content` (first 500 chars)
- **Edge direction**: prerequisite → successor

### Source of Truth

**Obsidian Markdown vault** in `database/knowledge-points/`:

```
database/knowledge-points/
├── 数学/           # Math — functions, geometry, probability...
├── 语文/           # Chinese — classical poetry, reading...
├── 英语/           # English — grammar, vocabulary, reading...
├── 物理/           # Physics — mechanics, electromagnetism...
├── 化学/           # Chemistry — elements, reactions...
├── 政治/           # Politics — philosophy, economics...
├── 生物/           # Biology — cells, genetics...
├── 历史/           # History — Chinese history, world history...
└── 地理/           # Geography — physical, human...
```

Each `.md` file contains:
- **YAML frontmatter**: `id`, `name`, `subject`, `module`, `difficulty`
- **Body**: `[[wiki-link]]` syntax for dependency relationships
- **Content**: Explanation text (first 500 chars stored in graph node)

### Sync Pipeline

**Source:** `scripts/sync-obsidian-to-age.js`

1. Recursively scan `database/knowledge-points/` for `.md` files
2. Parse YAML frontmatter (using `yaml` npm package)
3. Extract `[[wiki-links]]` from body text
4. Execute parameterized Cypher via `ag_catalog.cypher()` — `MERGE` each node + `DEPENDS_ON` edges
5. Batch size: 100, idempotent (MERGE prevents duplicates)

### Pre-built Cypher Graphs

`database/graphify-gaokao-knowledge/` contains pre-generated Cypher files:

| File | Size | Content |
|---|---|---|
| `graph.cypher` | 5.7 KB | Root → Subject → Document hierarchy |
| `graph_detailed.cypher` | 3.8 MB | Full detailed knowledge graph |
| `graph_optimized.cypher` | 5.6 MB | Optimized (deduplicated) version |
| `structured_knowledge.json` | 1.5 MB | Structured knowledge data |
| `textbook_knowledge.json` | 2.9 MB | Textbook-derived knowledge |
| `metadata.jsonl` | 1.9 KB | Index metadata |

### Cypher Query Pattern

```cypher
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('knowledge_graph', $$
    MATCH (a:KnowledgePoint {id: $source})-[:DEPENDS_ON]->(b:KnowledgePoint)
    RETURN b.id, b.name, b.difficulty
$$) AS (id agtype, name agtype, difficulty agtype);
```

## pgvector Vector Store

### Tables

- `rag_questions`: question_id, question_text, embeddings_updated_at
- `question_vectors`: question_id, embedding (vector(1536) or vector(768)), vector_type (question/stem/knowledge/answer)

### Embedding Models

| Mode | Provider | Model | Dimensions | Batch Limit |
|---|---|---|---|---|
| Remote (default) | DashScope | `text-embedding-v3` | 1536 | 25 |
| Local | text2vec | `shibing624/text2vec-base-chinese` | 768 | 32 |

### Search Modes

**Similarity search** (`api/routes/rag-search.js`):
- `searchSimilarQuestions()`: Cosine similarity on single embedding, threshold ≥ 0.7
- `searchMultiVector()`: Weighted combination of 4 embedded vectors (Question 0.4 + Stem 0.2 + Knowledge 0.25 + Answer 0.15)

## GraphRAG Python Service

**Source:** `graphrag_service/`

A separate FastAPI microservice on `127.0.0.1:8100` (internal only).

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check + available index stats |
| `POST` | `/api/graphrag/query` | General GraphRAG query (local/global/drift/basic methods) |
| `POST` | `/api/graphrag/explain` | Explain a question with graph context |
| `POST` | `/api/graphrag/similar` | Find similar questions |
| `POST` | `/api/graphrag/reindex` | Trigger index rebuild |

### Index Selection

Queries route to the appropriate index based on subject/province:

- `gaokao_all` — default (all Gaokao subjects)
- `zhongkao_beijing` — Beijing Zhongkao
- `subject_math`, `subject_chinese` — per-subject
- `province_beijing` — Beijing Gaokao

## Subject Mapping

**Source:** `api/utils/subjectMap.js`

Bidirectional maps between subject codes and Chinese names:

```js
SUBJECT_MAP = {
  math: '数学', chinese: '语文', english: '英语',
  physics: '物理', chemistry: '化学', politics: '政治',
  biology: '生物', history: '历史', geography: '地理'
}
```

Plus `KEYWORD_MAP` mapping knowledge-point IDs (e.g., `MATH-001`) to Chinese keyword arrays for fuzzy matching and auto-detection.
