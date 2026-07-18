# AI Tutor (智启AI导师) — Quickstart

**AI Tutor** is a Hybrid RAG-powered intelligent tutoring system for China's Gaokao (高考) and Zhongkao (中考) exams. It combines knowledge graphs (Apache AGE), vector retrieval (pgvector), and LLM reasoning (DashScope / DeepSeek) to deliver a complete learning loop: photo-based question capture → AI explanation → mastery tracking → spaced repetition review.

## What This Wiki Covers

This documentation describes the **aitutor** repository — a Node.js/Express backend with three parallel frontends (PC multi-page, PC redesign, PWA mobile SPA), a PostgreSQL/Apache AGE/pgvector data layer, and a Python GraphRAG microservice.

## Key Capabilities

| Capability | Description |
|---|---|
| **Hybrid RAG Tutoring** | Three-scheme architecture: graph traversal (AGE), vector search (pgvector), LLM reasoning (DashScope) |
| **Vision RAG** | Upload exam/wrong-question images → Qwen-VL parsing → auto-ingest into knowledge graph |
| **Spaced Repetition (SRS)** | SM-2 algorithm variant for daily review scheduling based on mastery scores |
| **Learning Feedback Loop** | Answer feedback → mastery delta → ripple effect through knowledge dependencies |
| **Province-Specific Exams** | Per-province Gaokao/Zhongkao data with trend analysis across 23+ provinces |
| **Personalized Paper Generation** | AI-generated exam papers targeting individual weak knowledge points |
| **PWA Mobile App** | Full standalone Progressive Web App with camera capture, offline-ready service worker |
| **Multi-Subject Coverage** | 9 subjects: Chinese, Math, English, Physics, Chemistry, Politics, Biology, History, Geography |

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js ≥22 (ES Modules), Python 3.12 |
| **Backend Framework** | Express.js |
| **Database** | PostgreSQL 16 + Apache AGE (graph) + pgvector (vectors) |
| **AI Models** | DashScope (qwen-plus, qwen-vl-max, text-embedding-v3), DeepSeek |
| **Frontend (PC)** | Vanilla JS, CSS Custom Properties (Design Tokens), Cytoscape.js |
| **Frontend (Mobile)** | PWA SPA, iOS Design Language, ES Modules |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **Deployment** | Docker Compose, systemd, Nginx reverse proxy |
| **CI/CD** | GitHub Actions (test matrix, lint, docker build) |

## Repository Structure

```
aitutor/
├── api/                          # Express.js backend
│   ├── core/                     # Database, auth, swagger, task worker
│   ├── handlers/                 # ~35 business logic handlers
│   ├── routes/                   # Router files (Hybrid RAG, SRS, vision)
│   ├── modules/                  # Module aggregator routers
│   ├── middleware/                # Security, error handling, versioning
│   └── utils/                    # Response helpers, prompts, validators
├── services/                     # LLM service, embedding service
├── frontend/                     # PC multi-page frontend + redesign
├── public/                       # PWA mobile SPA
├── scripts/                      # Data import, migration, analysis tools
├── tests/                        # Vitest + Playwright test suites
├── database/                     # SQL init scripts, seed data, graph files
├── graphrag_service/             # Python FastAPI GraphRAG microservice
├── deploy/                       # systemd units, Nginx config, setup
└── docs/                         # User guide, PM bridge doc, test reports
```

## Quick Start (Development)

### Prerequisites
- Node.js ≥22
- PostgreSQL 16 + Apache AGE + pgvector extensions
- A DashScope API key (Aliyun)

### Setup
```bash
# 1. Clone and install
git clone <repo>
cd aitutor
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, DASHSCOPE_API_KEY

# 3. Initialize database
createdb ai_tutor
# Run scripts/database/init/*.sql for extensions, partitions, tuning
node scripts/import-provinces.js

# 4. Start server
npm start   # → http://localhost:3002
```

### Common Tasks
```bash
npm test              # Vitest unit test suite
npm run lint          # ESLint
npm run format        # Prettier formatting
npm run sync          # Sync Obsidian knowledge → Apache AGE
npm run sync:obsidian # Sync knowledge points to AGE graph
```

## Documentation Sections

| Section | Description |
|---|---|
| [Architecture](/openwiki/architecture/overview.md) | Hybrid RAG Triad, data flow, component interaction |
| [API Domain](/openwiki/api/overview.md) | Routing layers, handlers, middleware, LLM & embedding services |
| [Frontend](/openwiki/frontend/overview.md) | Three frontend architectures, routing, design system |
| [Data Layer](/openwiki/data-layer/overview.md) | PostgreSQL, Apache AGE graph, pgvector, GraphRAG service |
| [Operations](/openwiki/operations/overview.md) | Deployment, Docker, CI/CD, systemd, monitoring |
| [Testing](/openwiki/testing/overview.md) | Unit tests, E2E tests, coverage areas, known gaps |

## Backlog

| Area | Source | Reason Deferred |
|---|---|---|
| **Script inventory & catalog** | `/scripts/` (90+ scripts) | Scripts are diverse and self-documenting; catalog needed only when operationalizing |
| **Dotfiles & configs** | `.env.example`, `eslint.config.js`, `.prettierrc` | Standard tooling; documented where non-standard patterns exist |
| **Obsidian knowledge vault** | `/obsidian_/`, `/database/knowledge-points/` | Internal data format; documented at data-layer level but deep vault structure deferred |
| **Architecture review docs** | `/architecture-review/` | Contains ad-hoc review notes; needs triage before documenting |
| **Design library** | `/.design_library/` | Contains design mockup assets; referenced in frontend docs but deep content deferred |
| **AI model cost/usage tracking** | `/services/llm.js` budget system | Documented at high level; detailed cost analysis deferred |
