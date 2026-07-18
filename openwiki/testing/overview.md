# Testing

Two-tier testing strategy: **Vitest** for unit/static analysis, **Playwright** for browser E2E tests.

## Test Framework Config

### Vitest (`vitest.config.js`)

```js
{ environment: 'node', globals: true }
```

Coverage provider: `@vitest/coverage-v8`, scope: `api/**/*.js`, exclusions: `swagger.js`, `seed-provinces.js`

Commands:
```bash
npm test              # vitest run
npm run test:watch    # vitest (watch mode)
npm run test:coverage # vitest run --coverage
```

### Playwright (`playwright.config.cjs`)

- Test dir: `./tests`, pattern: `*.test.cjs`
- Base URL: `http://localhost:3001` (served via `python -m http.server`)
- Single worker, Chromium only
- Retries: 2 on CI
- Traces on first-retry, screenshots on failure, video on failure

## Unit Tests (Vitest)

### Test Files

| File | Size | Coverage Area | Approach |
|---|---|---|---|
| `api/p1-business-logic.test.js` | 15.6 KB | taskWorker retry, questions pagination, reports CRUD, register admin logic, graphrag detection | Static analysis (fs + string matching) |
| `api/p2-ai-capability.test.js` | 18.3 KB | LLM parser helpers, prompts, subjectMap, task_metrics schema | Static analysis + runtime imports |
| `api/p3-ux-alignment.test.js` | 14.6 KB | PWA memory leak (cleanupPage), adaptive difficulty math | Static analysis + runtime imports |
| `api/p4-education-deepening.test.js` | 16.2 KB | 200+ knowledge points, subject combinations, province combos | Static analysis + runtime imports |
| `api/p5-engineering.test.js` | 13.5 KB | CI/CD pipeline validation, response format validation | Static analysis |
| `api/auth.test.js` | 4 KB | JWT auth middleware (validateJWTSecret, missing/default secret) | Runtime import |
| `api/user-api.test.js` | 9.2 KB | user-initialize validation (grade codes, province codes, subjects) | Runtime import |
| `api/proxy.test.js` | 3.4 KB | LLM proxy handler (rejects GET, requires API key) | Runtime import |
| `api/reset-password.test.js` | 2.6 KB | Password reset flow validation | Runtime import |
| `api/db-and-json.test.js` | 1.9 KB | PostgreSQL Pool usage (no SQLite), JSON.parse try-catch | Static analysis |

### Notable Patterns

1. **Static analysis majority**: Most test files use `fs.readFileSync(sourceFile)` + string matching (`.toContain()`) instead of importing modules. This means tests verify source structure, not runtime behavior.

2. **Runtime tests**: Only `auth.test.js`, `proxy.test.js`, `reset-password.test.js`, and parts of `p2/p3/p4` actually import and execute modules at runtime.

3. **Phase-based organization**: Tests are organized as `p1` through `p5` reflecting development phases:
   - p1: Core business logic
   - p2: AI capabilities
   - p3: UX alignment
   - p4: Education deepening
   - p5: Engineering excellence

## E2E Tests (Playwright)

| File | Pages Tested | Key Assertions |
|---|---|---|
| `index.test.cjs` | Homepage | Title, logo, navbar links, province selector |
| `login.test.cjs` | Login | Tab switching (phone vs password), form validation, error messages |
| `tutor.test.cjs` | AI Tutor Chat | Title, back button, subject selection, clear/new-chat buttons |
| `dashboard.test.cjs` | Dashboard | Breadcrumb, greeting, summary cards (4), KPI cards (4) |

E2E tests use the **redesigned pages** served from `ai-tutor-frontend/` directory (HTTP server on port 3001).

## Coverage Areas

| Area | Unit Coverage | E2E Coverage | Gap |
|---|---|---|---|
| Authentication | Auth middleware, password reset | Login page UI | No full login flow test |
| Hybrid RAG (Tutor Agent) | — | Tutor chat UI | No AI response validation |
| Vector Search (pgvector) | — | — | **Not tested** (CI uses SQLite) |
| Knowledge Graph (AGE) | String checks for Cypher | — | **Not tested** (CI uses SQLite) |
| SRS Engine | — | — | **Not tested** |
| Vision RAG (Image Parse) | — | — | **Not tested** |
| Exam Simulation | Question pagination | Dashboard cards | No full exam flow test |
| Wrong Questions | — | — | **Not tested** |
| Reports | CRUD structure checks | — | No report generation flow |
| Admin | Register admin logic | — | No admin panel test |
| Province Trends | — | — | Known to be broken (test-report.md) |
| Task Worker | Retry mechanism | — | No async pipeline test |
| PWA/SW | Memory leak (cleanupPage) | — | No service worker test |

## Known Testing Limitations

1. **SQLite ≠ PostgreSQL in CI**: The CI pipeline uses SQLite instead of the full PostgreSQL+AGE+pgvector stack. Graph and vector features are untestable in CI.

2. **Static analysis false positives**: String-matching tests can pass even when runtime behavior is broken. Example: checking for `IMPORT { Pool }` passes if the line exists, even if the import is broken.

3. **No integration tests**: No test exercises the full request → routing → middleware → handler → database → response pipeline.

4. **No test database**: Tests operate against the filesystem and source code, not a dedicated test database instance.

5. **No contract tests**: API response shapes are verified through source-code string matching, not through actual HTTP responses.

## Test Commands

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Lint check
npm run lint

# Format check
npm run format:check
```
