# API Domain

The API follows a three-layer routing hierarchy: **Module aggregators** → **Route files** → **Handler functions**. All endpoints are mounted under `/api/` behind Express middleware for security, authentication, error handling, and versioning.

## Routing Architecture

### Layer 1: Module Aggregator (`api/modules/index.js`)

The single entry point that mounts all domain routers:

```js
router.use('/tutor',       tutorRoutes)       // /api/tutor/*
router.use('/exam',        examRoutes)        // /api/exam/*
router.use('/rag',         ragRoutes)         // /api/rag/*
router.use('/srs',         srsRoutes)         // /api/srs/*
router.use('/vision',      visionRoutes)      // /api/vision/*
router.use('/analytics',   analyticsRoutes)   // /api/analytics/*
router.use('/gamification', gamificationRoutes) // /api/gamification/*
router.use('/auth',        authRoutes)        // /api/auth/*
router.use('/user',        userRoutes)        // /api/user/*
router.use('/trends',      trendsRoutes)      // /api/trends/*
```

### Layer 2: Module Sub-routers (`api/modules/*/routes.js`)

Each module file delegates to route files in `api/routes/`. Example (`api/modules/tutor/routes.js`):

```js
router.use('/agent',  tutorAgentRouter)    // → /api/tutor/agent/*
router.use('/loop',   learningLoopRouter)  // → /api/tutor/loop/*
router.use('/graph',  knowledgeGraphRouter) // → /api/tutor/graph/*
```

### Layer 3: Route Files (`api/routes/*.js`)

These define concrete endpoints with middleware and handlers.

## Core Middleware Stack

All requests pass through these middleware (in order, defined in `server.js`):

| Middleware | Source | Purpose |
|---|---|---|
| `securityHeaders` | `api/middleware/security.js` | CSP, X-Frame-Options, HSTS |
| CORS | `cors` package | Configurable `ALLOWED_ORIGINS` |
| `bodySizeLimiter` | `api/middleware/security.js` | Adaptive limits: 1MB default, 50MB for vision, 5MB for batch |
| `xssSanitizer` | `api/middleware/security.js` | Sanitize request bodies |
| `xssDetector` | `api/middleware/security.js` | Log/detect XSS attempts |
| `csrfProtection` | `api/middleware/security.js` | CSRF token checks |
| `loggerMiddleware` | `api/core/logger.js` | Request/response logging |
| `versionMiddleware` | `api/middleware/versioning.js` | `X-API-Version` header handling (currently v1.0.0 only) |
| `authMiddleware` | `api/core/auth.js` | JWT Bearer token verification (applied per-route) |
| `auditMiddleware` | `api/middleware/security.js` | Audit logging for sensitive actions |

### Error Handling

Custom error classes (`api/middleware/errorHandler.js`):

- `ValidationError` (400)
- `AuthError` (401)
- `PermissionError` (403)
- `NotFoundError` (404)
- `BusinessError` (400)

All uncaught errors route to the global `errorHandler` middleware, returning structured JSON:
```json
{ "errorCode": "AUTH_TOKEN_EXPIRED", "errorType": "AUTH", "statusCode": 401, "details": "..." }
```

## Key Route Files

### AI Core Routes

| Route File | Path | Purpose |
|---|---|---|
| `api/routes/tutor-agent.js` | `/api/tutor/agent/*` | **Tutoring inference** — orchestrates full Hybrid RAG pipeline (A+B+C). Endpoints: `POST /chat`, `POST /stream-chat` |
| `api/routes/rag-search.js` | `/api/rag/search/*` | **Vector RAG** — question embedding, semantic similarity, multi-vector search. Endpoints: `POST /ingest`, `POST /similar`, `POST /multi-vector` |
| `api/routes/learning-loop.js` | `/api/tutor/loop/*` | **Feedback engine** — mastery delta + ripple propagation. Endpoints: `POST /feedback`, `POST /batch`, `GET /mastery` |
| `api/routes/srs-engine.js` | `/api/srs/*` | **Spaced repetition** — SM-2 review scheduling. Endpoints: review generation |
| `api/routes/vision-parse.js` | `/api/vision/*` | **Vision RAG** — image → Qwen-VL → structured data → validate → ingest. Endpoint: `POST /parse` |
| `api/routes/knowledge-graph.js` | `/api/tutor/graph/*` | **Knowledge graph** — stats, sync, Cypher search. Endpoints: `GET /stats`, `POST /sync`, `GET /search` |
| `api/routes/graphrag.js` | `/api/rag/graphrag/*` | **GraphRAG proxy** — forwards to internal Python service (:8100) |

### Business Logic Handlers (`api/handlers/`)

| Handler | Path | Purpose |
|---|---|---|
| `login.js`, `register.js` | `/api/auth/*` | Authentication (email/password, guest login, password reset) |
| `user-profile.js`, `user-initialize.js` | `/api/user/*` | Profile management, onboarding, province/subject selection |
| `exam-papers.js`, `exam-questions.js` | `/api/exam/*` | Exam CRUD, question management |
| `exam-session.js` | `/api/exam/*` | Exam session lifecycle, anti-cheat (cut-screen detection) |
| `generate-paper.js` | `/api/exam/*` | AI-powered personalized paper generation (21KB — most complex handler) |
| `wrong-questions.js` | `/api/user/*` | Wrong question tracking with auto-analysis |
| `knowledge-points.js`, `knowledge-profile.js` | `/api/analytics/*` | Knowledge point mastery |
| `learning-path.js`, `study-plan.js` | `/api/analytics/*` | Personalized learning path generation |
| `adaptive-difficulty.js` | `/api/analytics/*` | Dynamic difficulty adjustment |
| `gamification.js` | `/api/gamification/*` | Badges, points, streaks (10KB) |
| `class-analysis.js`, `province-trends.js` | `/api/trends/*` | Analytics: class performance, province trends |
| `provinces.js`, `subjects.js` | `/api/trends/*` | Reference data: provinces, subjects, exam levels |
| `proxy.js` | `/api/proxy/*` | General-purpose AI API proxy |

## Service Layer

### LLM Service (`services/llm.js`)

The central AI orchestration layer. Key behaviors:

- **Model registry**: Maps logical model names (e.g., `qwen-plus`) to API configs including provider, cost/token, and endpoint
- **Fallback chain**: Each model has an ordered fallback list. If the primary model fails (rate limit, timeout, budget exhausted), the next model is tried
- **Budget tracking**: In-memory daily counters per feature. `checkBudget()` estimates token cost before calling; rejects if over budget
- **Streaming**: `streamChat()` returns a ReadableStream for SSE-based responses
- **Multi-modal**: `callVL()` handles vision model requests with base64 image data

### Embedding Service (`services/embedding.js`)

- **Modes**: Local (`text2vec-base-chinese`, 768-dim on `localhost:8000`) or Remote DashScope (`text-embedding-v3`, 1536-dim)
- **Batch limits**: 32 for local, 25 for remote
- **Functions**: `getEmbedding(text)` for single text, `getBatchEmbeddings(texts)` for arrays

### Task Worker (`api/core/taskWorker.js`)

Background async task processor:

- Polls `task_queue` table for pending tasks
- Exponential backoff retry: 5s → 15s → 45s
- Stale task recovery: tasks older than 5 minutes are retried
- LLM fallback: on repeated failure, attempts cheaper model
- Used primarily for async image processing pipeline

## API Response Contract

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "meta": { "total": 100, "page": 1, "limit": 50 }
}
```

Error responses use enumerated codes from `api/utils/errorCodes.js` (30+ codes across AUTH, VALIDATION, BUSINESS, SYSTEM types).

## Security & Hardening

- **JWT_SECRET**: Validated at startup (≥32 chars, checked against common defaults). Process exits if invalid.
- **Rate limiting**: Three tiers — auth (20/15min), proxy (10/min), general API (60/min)
- **Body size limits**: Adaptive per endpoint type
- **SQL injection**: All queries use parameterized `$N` placeholders (explicitly enforced)
- **XSS defense**: DOMPurify sanitization, XSS detector for logging
- **Audit trail**: Sensitive actions logged with user email and detail context
