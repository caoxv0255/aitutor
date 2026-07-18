# Frontend

The project contains **three coexisting frontend architectures**, reflecting an incremental migration from a traditional multi-page application → redesigned multi-page → a full SPA Progressive Web App.

## Architecture Comparison

| Aspect | PC MPA (`/frontend/`) | PC Redesign (`/frontend/redesign/`) | PWA SPA (`/public/`) |
|---|---|---|---|
| **Routing** | Pseudo-SPA (router.js + pushState + full page loads) | Same router pattern | True SPA (in-memory page state) |
| **Theme** | Light-first | Dark-mode-first | iOS dark/light aware |
| **Target** | Desktop browser | Desktop browser | Mobile (standalone PWA) |
| **State** | URL-based, localStorage | URL-based | `App` class + localStorage |
| **Bundle** | Static HTML + JS (no build) | Static HTML + JS | ES modules (no build) |
| **Key files** | `router.js`, `components.js`, `exam-mode.js` | Redesigned pages | `app.js` (54KB), `context.js`, `aiService.js` |

## PC MPA (`/frontend/`)

### How Routing Works (`frontend/assets/js/router.js`)

The "Smart Router" provides SPA-like navigation over static HTML files:

1. **Route map**: `ROUTES` object maps `data-dom-id` attributes to `.html` files
2. **Tab routes**: `TAB_ROUTES` for bottom tab bar navigation
3. **Navigation**: `navigateTo(href)` calls `window.history.pushState()`, then sets `window.location.href` after 300ms delay
4. **Loading UX**: Shows spinner overlay during navigation
5. **Error handling**: Dead link detection with friendly error messages; toast notifications (success/error/info/warning)

### Key Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing/hero page with province selector, trend carousel, policy banners |
| `login.html` / `register.html` | Authentication with guest mode |
| `dashboard.html` | Main user dashboard |
| `{subject}-exam.html` | Subject-specific exam simulation (6 subjects: 语文, 数学, 英语, 物理, 化学, 政治) |
| `{subject}-report.html` | Post-exam reports per subject |
| `wrong-book.html` | Wrong question book, filterable by subject |
| `question-explainer.html` | AI-powered question explanation |
| `personalized-paper.html` | AI-generated personalized exam |
| `learning-path.html` | Visual learning roadmap |
| `province.html` / `zhongkao.html` | Province-specific exam info |
| `methodology.html` | Teaching methodology description |
| `sample-report-{parent,student,teacher}.html` | Sample report views |

## PC Redesign (`/frontend/redesign/`)

A dark-mode-first redesign with expanded pages:

| New Page | Purpose |
|---|---|
| `onboarding.html` | First-time user onboarding flow |
| `photo-search.html` | Photo-based question search entry |
| `knowledge-profile.html` | Knowledge graph / mastery profile visualization |
| `study-plan.html` | AI study plan generator |
| `trends-analysis.html` | Performance trend analytics |
| `ai-tutor-chat.html` | Redesigned AI chat interface |

The redesign uses **inline design tokens** (`<style id="theme-vars">`) rather than loading a separate `tokens.css`, and features an expanded color palette (50–900 scale per color).

## PWA Mobile SPA (`/public/`)

A standalone Progressive Web App that mimics a native iOS application.

### PWA Config
- **Display**: `standalone` (full-screen, no browser chrome)
- **Theme**: `#007aff` (iOS blue)
- **Orientation**: `portrait`
- **Icons**: 8 sizes from 72×72 to 512×512

### Service Worker (`public/sw.js`)
- Cache name: `ai-tutor-v8`
- **Cache-First** for static assets (HTML, CSS, vendor libs)
- **Network-First** for `/api/` endpoints (cache fallback)
- **Network-First** for `/src/` JS files (ensures latest code)
- `skipWaiting()` for immediate activation

### SPA Architecture (`public/src/app.js`)

The `App` class manages all pages via `this.currentPage` string:

- **Pages**: login, register, resetPassword, menu, provinceSelect, camera, crop, solution, taskQueue, taskDetail, wrongbook, subjectQuestions, detail, reports, reportDetail, photoPicker
- **Lifecycle**: `cleanupPage()` clears timers, abort controllers, and DOM listeners on every render to prevent memory leaks
- **Rendering**: Each page generates HTML via switch-statement template strings

### Key Modules

| Module | Path | Size | Purpose |
|---|---|---|---|
| `app.js` | `src/app.js` | 54.6 KB | Main SPA controller, all page renders |
| `context.js` | `src/utils/context.js` | 10.9 KB | Auth, user state, localStorage persistence |
| `aiService.js` | `src/services/aiService.js` | 16.2 KB | AI API calls (solving, chat, analysis) |
| `cropper.js` | `src/components/cropper.js` | 7.2 KB | Image crop UI for camera capture |
| `katex-stream.js` | `src/js/katex-stream.js` | 10.1 KB | Streaming LaTeX rendering |
| `mastery-graph.js` | `src/js/mastery-graph.js` | 15.2 KB | Knowledge mastery visualization (Cytoscape.js) |
| `tutor-stream.js` | `src/js/tutor-stream.js` | 6.7 KB | Streaming AI tutor response handler |

## Design System

### PC Frontend (`frontend/assets/css/`)

| File | Purpose |
|---|---|
| `tokens.css` | Design tokens (CSS custom properties: `--aitutor-primary-*`, `--aitutor-blue-*`, 50–900 scale) |
| `style.css` | Main stylesheet (25.6 KB) |
| `components.css` | Reusable component styles |
| `enhancements.css` | Extra UI enhancements |
| `router.css` | Router toast/loading/error styles |
| `brand.css` | Brand-specific overrides |

### PWA Mobile (`public/styles.css`)

iOS 18-inspired design system (34.9 KB):
- System color palette (`--system-blue`, `--gray-50` … `--gray-900`)
- Dark mode via `prefers-color-scheme`
- System font stack (`-apple-system`, `SF Pro`)

## Key Patterns

1. **Stream-based AI rendering**: `tutor-stream.js` + `katex-stream.js` handle SSE streaming responses, rendering Markdown and LaTeX in real-time using `marked.min.js` + `katex.min.js` + `purify.min.js`

2. **Photo capture pipeline**: Multiple entry points (QR scanner, camera, photo picker, cropper) feed into the Vision RAG backend

3. **Memory leak prevention**: PWA `cleanupPage()` clears all timers, abort controllers, and event listeners on each page transition

4. **Subject raw data**: `/frontend/_data/` contains large `.txt` files per subject (数学: 233KB, 英语: 815KB) for exam content generation

5. **Data-driven subject templates**: Subject exam/report pages follow `{subject}-exam.html` / `{subject}-report.html` naming convention
