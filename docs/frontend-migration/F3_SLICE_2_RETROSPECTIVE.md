# F3 Slice 2 Retrospective

> 第二个 F3 migration slice (mastery.html, Dashboard Shell Adapter)。
> 验证 F3 模板**可复制**,而不是重新设计。

| 项 | 值 |
|---|---|
| 日期 | 2026-08-06 |
| 状态 | Phase 1 feat 完成 + 浏览器验证通过, **零 fix commit** |
| Slice 2 commits | `f6f587a` (feat) |
| F3 Slice 1 commits | `5997cce8` (feat) · `c46cfcd` (fix envelope) · `c11167e` (fix layout) |
| F3 基建 | `e772905e` (async resource) · `27fe354d` (error boundary) |
| 验证环境 | `python3 -m http.server 9000 --directory ai-tutor-frontend` + mock |
| 配套 retro 升级 | `104700cc` (F3 retro v1.1 — Page Shell Adapter Contract) |

---

## 1. 目标

把 mastery.html 接入 F3 data layer,**完整复用 Slice 1 模板** (Dashboard Shell Adapter),证明:

> F3 不是单页面实验,而是**可复制的迁移模式**。

具体目标:

- 接入 6 个 knowledge services (mastery / map / points / profile / suggestions / kpDetail)
- 复用 dashboard Slice 1 的 envelope / hook / boundary / shell 模式
- 不修改 `client.js` / `services/` / mastery 现有静态 UI
- 一次过 (无 fix commit)

---

## 2. F3 Contract 复用验证

Slice 1 retro 固化的 4 个 contract 在 mastery 全部**一次过**:

| Contract (Slice 1 §) | mastery 验证 |
|---|---|
| **Service Envelope** (§2.1) | 6 mock 全部 `{success, data}` 信封, `data.data.X` 解包正确, 0 字段名错配 |
| **Mock Convention** (§2.3) | 6 mock JSON HTTP 200, `request(..., { mockName })` name 与文件一致 |
| **useAsyncResource** (§2.4) | 6 resource hook subscribed, 三态 (loading / error / data) 全部处理 |
| **ErrorBoundary** (§2.4) | `mountErrorBoundary()` 一次, console 0 error, render fallback 未触发 |
| **Shell Adapter A** (retro v1.1) | Dashboard Shell 100% 复用, 0 layout fix |

> **关键信号**: Slice 1 需要 2 个 fix commit (envelope + layout), Slice 2 **零 fix**。
> 这意味着 F3 contract 模式已经**稳定**,后续 slice 不应再出现 envelope / Shell A 错配。

---

## 3. Shell Adapter A — Dashboard Shell 复用

mastery.html 已经具备 Dashboard Shell 完整结构 (line 581 sidebar + line 664 `lg:ml-60 md:ml-[72px]` wrapper),跟 dashboard.html 字面相同。

**这次不需要任何 layout 改动** — F3 section 注入到 content wrapper 内部,使用 `ait-page` class,继承外层偏移。

**对比 Slice 1 教训**:

| 项 | dashboard Slice 1 | mastery Slice 2 |
|---|---|---|
| sidebar 在哪 | `<main>` 内层 (line 671) | `<main>` 内层 (line 581) |
| ml-60 wrapper | 内层 (line 754) | 内层 (line 664) |
| F3 section 注入位置 | `<body>` 直接子 | content wrapper 内部 |
| 需要 `lg:ml-60` 吗? | ✅ 需要 (c11167e fix) | ❌ 不需要 (wrapper 已给) |
| 整体 layout fix | 1 commit (c11167e) | 0 commit |

**结论**: Dashboard Shell Adapter 可复用, 后续 dashboard / mastery / 类似 page 都不需要 layout fix。

---

## 4. Verification Pattern 验证

| 层 | 检查项 | 结果 |
|---|---|---|
| **Browser** | `?mock=true` 加载 · 6 service contract 正确 · console 0 error · 原 UI 不回归 | ✓ pass (3 stat cards + 2 suggestions + 4 原始 section 完整) |
| **Network** | 6 mock JSON HTTP 200 · service path 与 mockName 一致 | ✓ pass |
| **Git** | 1 slice 1 checkpoint commit · 不混入 dashboard 改动 · 不动 service / client / tests | ✓ pass (`f6f587a` 单 commit) |

---

## 5. Lessons Learned

### 已解决 (跟 Slice 1 比)

- ✅ **No envelope fix needed**: 6 mock 全部信封一致, `data.data.X` 模式已固化
- ✅ **No layout fix needed**: Dashboard Shell Adapter 已有 ml-60 偏移
- ✅ **No mock creation**: 6 mock JSON 在 F2 时代已就位, mastery 直接复用
- ✅ **No new infrastructure**: 7 services / 1 hook / 1 boundary 全在 Slice 1 已建好

### 新发现

- **页面大小 ≠ F3 复杂度**: mastery 1224 行 (含 Cytoscape 图谱 + 详情面板, 视觉比 dashboard 更复杂), F3 集成只 +114 行 (跟 dashboard +93 行相近)。F3 模板是**数据层替换**, 不碰 UI 复杂度。
- **Service count 不是问题**: 6 service 并行 mock 请求, 同步加载, < 100ms 可见。
- **Console-only 验证足够**: `map` / `profile` / `kpDetail` 这 3 个 service 不渲染 DOM, 只 `console.log` 输出, 同样验证 envelope 路径, 同样 pass。
- **Dashboard Shell 内部注入点优于 body 注入**: 这次把 section 放进 content wrapper 内部, 比 dashboard 的 body 注入更"内聚" (跟 page UI 同区), 不再需要 ml-60 fix。**未来 Shell A page 都按这个 pattern 走**。

### 延后 (跟 Slice 1 同样)

- 图谱数据驱动 (Cytoscape 实例化时序 — 用户已警告, 不在 Slice 2 范围)
- Service envelope 自动拆解 (refactor, 会破坏 7 service 现有调用)
- 抽 `.ait-page-shell` (现在 2 page 都用 Dashboard Shell, 仍不足定 contract)

---

## 6. Non-goals

- ❌ 改 `client.js` 拆信封
- ❌ 改 mastery.html 的 Cytoscape 图谱渲染 (静态 OK, 不数据驱动)
- ❌ 改 `services/` / `hooks/` / `components/` 已有代码
- ❌ 改 design token / mastery 4 个静态 section
- ❌ 抽公共 component (mastery 跟 dashboard 没共享 component, 仍分叉)

---

## 7. Next Step

**Phase 2: Shell Adapter 多样化** (见 Slice 1 retro §3 表格)

| Adapter | Page | 难度 | 风险 | 推荐 |
|---|---|---|---|---|
| **Hybrid Shell** | wrong-book | 🟡 中 | `fixed md:sticky` 混合模式, 不同宽度, 需新 contract | **首选** |
| **Workspace Shell** | tutor | 🔴 高 | SSE / chat / formula, 核心产品页 | 延后 |
| **Immersive Shell** | vision, review | 🔴 高 | 无 sidebar, 全屏 UX, 改动基础 layout | 延后 |

**优先 wrong-book (Hybrid Shell)** 的理由:

- 风险最低(数据展示类, 不含 chat / SSE)
- 提前解决 Shell C contract, 避免 Shell B/D 探索时被 C 阻塞
- 验证 Dashboard Shell 之外第一个新 adapter 的可行性

如果 wrong-book 顺利, Shell Adapter 表格从 4 个扩到 5 个 (Dashboard×2 / Hybrid×1 / Workspace×1 / Immersive×2), 后续 slice 可根据需要选。
