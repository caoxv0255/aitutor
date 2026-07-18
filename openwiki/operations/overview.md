# Operations

## Deployment Options

### Docker Compose (Recommended)

**Source:** `docker-compose.yml`

Three services managed together:

| Service | Build | Port | Health Check | Dependencies |
|---|---|---|---|---|
| `app` | `Dockerfile` | ${PORT} (default 3000) | `GET /api/health` | db, redis |
| `db` | `Dockerfile.db` | ${DB_PORT} (default 5432) | `pg_isready` | — |
| `redis` | `redis:7-alpine` | ${REDIS_PORT} (default 6379) | `redis-cli ping` | — |

Environment variables required:
- `JWT_SECRET` — Min 32 chars, no common defaults
- `DATABASE_URL` — PostgreSQL connection string
- `DASHSCOPE_API_KEY` — Aliyun DashScope key
- `DEEPSEEK_API_KEY` — DeepSeek key (optional fallback)

Start with:
```bash
docker compose up -d
```

### Docker Images

**`Dockerfile`** (app):
- Base: `node:22-slim`
- Installs python3, make, g++ for native npm dependencies
- `npm ci --omit=dev` (production only)
- Runs as `node` user (non-root)
- Healthcheck via `fetch('http://localhost:3000/api/health')`

**`Dockerfile.db`** (database):
- Base: `postgres:15-bookworm`
- Builds Apache AGE v1.5.0 from source (git clone + make install)
- Builds pgvector v0.7.0 from source
- Copies `database/init/` SQL scripts as Docker entrypoint init scripts
- Configures `shared_preload_libraries='age,vector'`

### Systemd Services

**Source:** `deploy/`

Two systemd services for production Linux deployment:

**`uibe-tutor.service`** (main app):
- Port: 3002
- User: `flaskappuser`
- Working directory: `/home/flaskappuser/Desktop/NewDisk_2T/new_fastapi.git/aitutor`
- Restart: on-failure
- Logs to `logs/aitutor.log`

**`uibe-graphrag.service`** (GraphRAG Python):
- Port: 8100
- Uvicorn server for `graphrag_service.main:app`
- Memory limit: 4GB
- CPU quota: 200%
- Restart: always

### Nginx Reverse Proxy

**Source:** `deploy/uibe.conf`

- Proxies `/api/*` to `127.0.0.1:3002` (upstream: `tutor_server`)
- SSL via Cloudflare origin certificate (TLS 1.2/1.3)
- Static files served from `…/aitutor/public` with 7d client cache
- `client_max_body_size 50M` (for photo uploads)
- HTTP → HTTPS redirect
- Security headers: X-Frame-Options, X-Content-Type-Options, XSS-Protection
- Timeouts: all 120s

### Setup Script

**Source:** `deploy/setup.sh`

```bash
# Creates database, copies Nginx config, installs systemd service
bash deploy/setup.sh
```

## CI/CD Pipeline

**Source:** `.github/workflows/ci.yml`

Three-stage pipeline:

### 1. Test (`test` job)
- Runs on: push to `main`/`dev`, PR to `main`
- Matrix: Node.js 18, 20, 22
- Service: SQLite (`keinos/sqlite3:latest`) — lightweight CI DB
- Steps: `npm ci` → `npm run lint --if-present` → `npm test`
- Coverage artifact (Node 22 only)

### 2. Security (`security` job)
- Needs: `test`
- Runs: `npm audit --audit-level=moderate || true` (non-blocking)

### 3. Docker Build (`docker` job)
- Needs: `test`
- Runs on: **main branch only**
- Docker Buildx with GitHub Actions cache
- Tag: `aitutor:${{ github.sha }}`
- **No registry push** — build only

### OpenWiki Update (`openwiki-update.yml`)

Separate workflow for automated documentation updates via OpenWiki.

## Environment Configuration

**Source:** `.env.example`

```env
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_tutor
JWT_SECRET=<min 32 characters>
JWT_EXPIRES_IN=7d
DASHSCOPE_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:3002,https://aitutor.uibe.online
NODE_ENV=development
```

### OpenWiki Config

Additional environment variables for the OpenWiki documentation system:

```env
OPENWIKI_X_ACCESS_TOKEN=...    # X/Twitter connector
OPENWIKI_NOTION_MCP_ACCESS_TOKEN=...  # Notion connector
TAVILY_API_KEY=...              # Web search connector
OPENWIKI_SLACK_USER_TOKEN=...   # Slack connector (search:read scope)
```

## Operational Concerns

### Known Issues

| Issue | Source | Details |
|---|---|---|
| **Trend API not loaded** | `docs/test-report.md` | `/api/province-trends/:code` — route not properly mounted, needs server restart |
| **PWA serving issue** | `docs/test-report.md` | `/app` path may not serve PWA correctly (Nginx config) |
| **No DB migration tool** | `CLAUDE.md` | Schema auto-created in `db.js` init — no version-controlled migrations |
| **Static analysis tests** | `tests/architecture` | Most Vitest tests use `fs.readFileSync` + string matching instead of runtime imports — can produce false positives |
| **CI uses SQLite ≠ production PostgreSQL** | `.github/workflows/ci.yml` | CI doesn't test AGE or pgvector features |

### Production Hardening

1. **Secrets management**: Docker Compose uses plain env vars — use Docker secrets or a vault in production
2. **Hardcoded paths**: Systemd services have absolute paths to `/home/flaskappuser/Desktop/NewDisk_2T/...` — not portable
3. **GraphRAG memory**: 4GB limit + 200% CPU may OOM under concurrent load
4. **synchronous_commit=off**: Performance optimization but increases data loss risk on crash
5. **No rate limiting on Nginx**: Only Express-level rate limiting; Nginx could add IP-based throttling
6. **No Docker registry push**: CI builds but doesn't publish images

### Monitoring

- PostgreSQL: `pg_stat_activity` shows `aitutor-api` application name
- Slow queries: logged at 5s threshold (configured in `03-performance.sql`)
- Pool warnings: logged when pool queue exceeds 5 connections
- LLM budgets: in-memory daily counters per feature (resets on server restart)
