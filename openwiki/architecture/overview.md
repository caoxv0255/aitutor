# Architecture Overview

AI Tutor implements a **Hybrid RAG Triad** — three complementary retrieval/reasoning schemes that work together to provide intelligent, personalized tutoring for Chinese Gaokao and Zhongkao exam preparation.

## Hybrid RAG Triad (方案A / 方案B / 方案C)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Interface                                │
│   PC MPA (frontend/)  ←→  PWA SPA (public/)  ←→  Redesign (redesign/)│
└─────────────────────────────┬───────────────────────────────────────┘
                              │ SSE / REST
┌─────────────────────────────┼───────────────────────────────────────┐
│                   Express.js Backend (server.js)                     │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ 方案A: AGE Graph  │  │ 方案B: pgvector   │  │ 方案C: LLM Reason  │ │
│  │ Knowledge Graph   │  │ Semantic Search   │  │ Tutor Agent + SRS  │ │
│  │ (Cypher queries)  │  │ (cosine sim)      │  │ (anti-jump guard)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬───────────┘ │
│           │                     │                      │             │
│  ┌────────┴─────────────────────┴──────────────────────┴──────────┐ │
│  │              Data Flywheel (api/routes/learning-loop.js)        │ │
│  │  Feedback → Mastery Delta → Ripple Effect → Graph Update →     │ │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Vision RAG (api/routes/vision-parse.js)                      │  │
│  │  Photo → Qwen-VL → Structured Data → Validate → Ingest        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │       PostgreSQL 16 (single instance)  │
          │  Relational Tables + AGE (graph) + pgvector (vectors)  │
          └───────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  GraphRAG Python   │
                    │  Service (:8100)   │
                    └───────────────────┘
```

### Scheme A — Knowledge Graph (Apache AGE)

**Source files:** `api/routes/knowledge-graph.js`, `scripts/sync-obsidian-to-age.js`, `api/routes/graphrag.js`

- **Graph database**: Apache AGE extension on PostgreSQL, graph name `knowledge_graph`
- **Nodes**: `KnowledgePoint` with properties `id`, `name`, `subject`, `module`, `difficulty`, `content`
- **Edges**: `DEPENDS_ON` — prerequisite/successor relationships derived from Obsidian `[[wiki-link]]` syntax
- **Source of truth**: Markdown files in `database/knowledge-points/` (9 subject directories)
- **Sync pipeline**: `scripts/sync-obsidian-to-age.js` reads Markdown, parses YAML frontmatter, extracts wiki-links, executes MERGE Cypher queries in batches of 100
- **Pre-built graphs**: Cypher seed files in `database/graphify-gaokao-knowledge/` for immediate loading
- **Hybrid enhancement**: `api/routes/graphrag.js` proxies to the Python GraphRAG service for enhanced graph-query answers

### Scheme B — Vector RAG (pgvector)

**Source files:** `api/routes/rag-search.js`, `services/embedding.js`

- **Vector store**: pgvector extension on PostgreSQL, `rag_questions` and `question_vectors` tables
- **Embedding models**: `text-embedding-v3` (DashScope, 1536-dim) or `text2vec-base-chinese` (local, 768-dim)
- **Search modes**:
  - `searchSimilarQuestions()` — cosine similarity on single question embedding (threshold ≥0.7)
  - `searchMultiVector()` — weighted combination of 4 vectors (Question/Stem/Knowledge/Answer)
- **Ingestion**: `ingestQuestion()` embeds question text on-the-fly and stores in pgvector
- **Hallucination guard**: Vision pipeline validates extracted knowledge points exist in graph before ingesting

### Scheme C — LLM Reasoning

**Source files:** `api/routes/tutor-agent.js`, `services/llm.js`

- **Default model**: `qwen-plus` (¥0.80/1M tokens)
- **Fallback chain**: `qwen-plus` → `qwen-turbo` → `deepseek-chat`
- **Budget control**: Per-feature daily caps (e.g., chat ¥50/day, diagnosis ¥5/day, paper generation ¥2/day)
- **Anti-jump guard**: Blocks questions on topics whose prerequisites have mastery < 60%
- **Streaming**: SSE-based streaming for tutor chat responses, rendered via `tutor-stream.js` and `katex-stream.js` on the frontend
- **JSON mode**: All LLM responses are structured JSON for reliable parsing

## Data Flywheel (Learning Loop)

**Source file:** `api/routes/learning-loop.js`

The learning loop creates a continuous improvement cycle:

1. **Student answers a question** related to knowledge point K
2. **Feedback is recorded**: `CORRECT_NO_HINT: +15`, `CORRECT_WITH_HINT: +10`, `INCORRECT: -20`
3. **Mastery score** for K is updated (clamped to [0, 100])
4. **Ripple effect**: Small deltas propagate through the dependency graph:
   - Prerequisite nodes: `+2`
   - Successor nodes: `-5`
5. **All writes** happen in a single PostgreSQL transaction

## SRS Engine (Spaced Repetition)

**Source file:** `api/routes/srs-engine.js`

Implements an SM-2 algorithm variant for daily review scheduling:

- `priority = (1 - mastery) × 0.6 + overdue_factor × 0.4`
- EF (Easiness Factor) update with `MIN_EF = 1.3`
- Generates "today's must-review" list per student

## Vision RAG Pipeline

**Source file:** `api/routes/vision-parse.js`

1. Student uploads exam/wrong-question image (max 10MB)
2. Qwen-VL-Max extracts text, LaTeX formulas
3. System infers: subject, difficulty, question_type, knowledge_point_id
4. **Validation**: checks inferred knowledge point exists in AGE graph — no hallucinated new nodes
5. On success, calls `ingestQuestion()` for vector storage

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Three-scheme RAG (graph + vector + LLM) | Graph provides curriculum structure, vectors provide semantic similarity, LLM provides reasoning — each covers different failure modes |
| Single PostgreSQL instance | Simpler operations than multi-DB; AGE and pgvector run as extensions |
| JSONB for exam question data | Flexible per-subject metadata (physics_structure, chemistry_structure, math_structure) without schema migration per subject |
| Static HTML/JS frontend (no build step) | Zero-compile deployment; PWA service worker handles caching |
| Pure CSS design tokens | Consistent theming without a CSS framework; dark/light mode via CSS custom properties |
