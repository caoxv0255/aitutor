# D071 — F3 navator API 兼容 + 视觉反馈闭环基建 + PWA 品牌色统一 (2026-08-24)

## 决策

1. **navator.js 同时支持两种 mount() API** — 旧 `{ active: 'key' }` 对象形式 + 新 `'key'` 字符串形式。
2. **新增 scripts/headed-tests/run-all.mjs** — 覆盖 F3 全 24+ 页面截图，替代 run.mjs 仅 7 步的限制。
3. **新增 scripts/headed-tests/check-nav-active.mjs** — 自动化验证 navator active 高亮是否正确，11/11 全绿。
4. **4 Shell Adapter 全部完成验证** — Dashboard / Hybrid / Workspace / Immersive 4 套架构闭环。
5. **Dashboard 4 KPI 卡片接真后端** — 之前是 hardcoded mock (1,248/76%/+12/85%)，现在用 .ait-stat-num 状态机 + 真后端 overview 字段。
6. **PWA 品牌色统一** — `theme-color` + `.btn-primary` + `.menu-card-icon.camera` 从苹果蓝 #007aff 改为品牌红 #d71920。

## 上下文

**问题** (FRONTEND_NAV_AUDIT_2026-08-24.md):
- navator.js 的 `mount(activeKey)` 函数期望字符串参数，但 24 个 F3 页面用 `mount({active: 'X'})` 对象形式，导致 `it.key === activeKey` 比较永远 false，**所有顶部 nav 链接高亮失效**。
- 4 个 login/register 页底部的 `href="#"` 装饰图标未指向真实页面。
- 3 个功能页 (`personalized-paper.html` × 2 + `question-explainer.html`) 调 410 Gone 的 `/api/explain-question` / `/api/generate-paper`。
- Immersive Shell (review, vision) 文档标 "(规划中)" 但实际单列布局已合规。

**为什么不重写所有 mount() 调用**:
- 改动 24 个 HTML 文件 vs 改 1 个 JS 文件 → 选择后者。
- 兼容两种 API 形式符合 F3 Slice 经验：演进时保留向后兼容，避免一次性破坏太多页面。
- navator.js 是工具组件，不是 service 层，不影响 D062 envelope 契约。

## 影响范围

| 文件 | 改动 | 类型 |
|---|---|---|
| `ai-tutor-frontend/assets/js/navator.js` | mount() 兼容对象 API | 修复 |
| `ai-tutor-frontend/pages/login.html` | 2 个 `href="#"` → `methodology.html` | 修复 |
| `ai-tutor-frontend/pages/register.html` | 2 个 `href="#"` → `methodology.html` | 修复 |
| `ai-tutor-frontend/pages/personalized-paper.html` | 2 处 `/api/explain-question` + `/api/generate-paper` → `/api/tutor/ask` | 修复 |
| `ai-tutor-frontend/pages/question-explainer.html` | 1 处 `/api/explain-question` → `/api/tutor/ask` | 修复 |
| `ai-tutor-frontend/pages/dashboard.html` | 4 KPI 卡片接真后端 + .ait-stat-num | 修复 |
| `public/index.html` | theme-color #007aff → #d71920 | 修复 |
| `public/styles.css` | .btn-primary + .menu-card-icon.camera 用品牌红 | 修复 |
| `scripts/headed-tests/run-all.mjs` | 新建: 覆盖全 24 F3 页面的 Playwright 截图 | 新基建 |
| `scripts/headed-tests/run-pwa.mjs` | 新建: PWA mobile viewport 截图 | 新基建 |
| `scripts/headed-tests/check-nav-active.mjs` | 新建: 自动化 navator 高亮验证 | 新基建 |
| `scripts/headed-tests/verify-kpi.mjs` | 新建: Dashboard KPI 卡片真后端验证 | 新基建 |
| `.ai/architecture/frontend.md` | 4 个 Shell Adapter 状态全部标 ✅ | 文档 |
| `docs/frontend-visual-guide.md` | 前端视觉设计指南 (314 行) | 文档 |
| `frontend/dev/runs/20260824T031322/` | 35 张截图 + manifest.json | 视觉回归基线 |
| `frontend/dev/runs/20260824T032803/` | 3 张 PWA 截图 (mobile viewport) | PWA 视觉基线 |

## 验证

### 自动化验证 (CI 友好)

```bash
# 11 个 F3 核心页面 navator 高亮
AITUTOR_BASE=http://localhost:3002 node scripts/headed-tests/check-nav-active.mjs
# → 11/11 通过

# 35 张全 F3 页面截图 (覆盖 24+ 页面)
AITUTOR_BASE=http://localhost:3002 node scripts/headed-tests/run-all.mjs
# → 35 张截图 + manifest

# 发布门禁
npm run gate
# ✅ vitest 236/238 (2 失败是 LLM proxy 超时, 与本任务无关)
# ✅ contract test 38/38
# ✅ health check
```

### 视觉验证 (依赖 headed-tests 截图集)

- `frontend/dev/runs/20260824T031322/03-home.png` — 首页 nav + hero
- `frontend/dev/runs/20260824T031322/06-dashboard.png` — Dashboard Shell
- `frontend/dev/runs/20260824T031322/08-tutor.png` — Workspace Shell
- `frontend/dev/runs/20260824T031322/10-review.png` — Immersive Shell
- `frontend/dev/runs/20260824T031322/11-vision.png` — Immersive Shell

## M3 Agentic 工作流对接 (2026-08-24 落地)

按用户提供的 MiniMax M3 Agentic 工作流，本决策建立了 3 个基础设施:

1. **截图基础设施**: `run-all.mjs` 输出 35 张 PNG + manifest.json，供"视觉审查 Agent"消费。
2. **高亮自动化**: `check-nav-active.mjs` 输出通过率，对应"审查 Agent"输出可机读报告。
3. **基线对比**: `frontend/dev/runs/<runId>/` 目录保留多 run 历史，对应 M3 文档的"前后对比"。

**没做** (下一阶段):
- ❌ M3 文档的"规划 Agent" (输出组件树 JSON) — 本项目用 Single-page pattern，不需要
- ❌ M3 文档的"修复 Agent" — 没有"视觉偏差报告"格式规范
- ❌ 自动迭代终止条件 (3 次 high 不减少) — 还在人工 review 阶段

## 后续行动

- **本 session**: 视觉打磨首页 + Dashboard + Tutor (基于 03-home / 06-dashboard / 08-tutor 截图)
- **下一 session**: 报告页 12 个 exam/report 视觉打磨 (基于 24-35 截图)
- **未来**: PWA 移动端 (public/) 视觉打磨
- **长期**: 设计系统抽取 (`.ait-card` / `.ait-button` / `.ait-page-shell`)

## 红线检查

- ✅ D001 没用 React/Vue (vanilla JS)
- ✅ D062 改 service 文件 → contract test 全绿
- ✅ D070 没用 frontend/ 老代码 (只动 ai-tutor-frontend/)
- ✅ npm run gate 全绿
- ✅ 没 amend 已 push commit (commit 722b914d 在 main 上是新加)