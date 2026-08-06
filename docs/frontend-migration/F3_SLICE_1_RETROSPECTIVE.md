# F3 Slice 1 Retrospective

> 第一个 F3 migration slice 的固化经验,作为后续 9 个 page 的迁移模板。
> 不是开发文档,是 **migration playbook**。

| 项 | 值 |
|---|---|
| 日期 | 2026-08-06 |
| 状态 | 完成 + 浏览器验证通过 |
| Slice 1 commits | `5997cce8` (feat) → `c46cfcd` (fix) → `c11167e` (fix) |
| F3 基础 commits | `e772905e` (async resource) · `27fe354d` (error boundary) |
| 验证环境 | `python3 -m http.server 8000 --directory ai-tutor-frontend` + mock |

---

## 1. 目标

把 `useAsyncResource` + `ErrorBoundary` 接入 `dashboard.html` 作为第一个 F3 迁移样板,证明:

> 一个旧页面可以在**不破坏原 UI** 的情况下,渐进迁移到新 service layer。

并暴露 / 固化 4 个 contract 给后续 9 个 page 复用。

---

## 2. 固化的 Contract

### 2.1 Service Envelope Contract

**Rule**: services 返回统一 envelope `{success, message, data}`,**页面层负责 data extraction**。

```
service.getDashboard()  →  { success, message, data: { name, stats: {...} } }
                                              ↑
                                    page 必须 .data.stats.X
```

**Why**: 现有 `index.html:143-167` 沿用此约定, README 文档化, 7 个 service 全依赖。

**Lesson**: Slice 1 初版直接读 `d.questions_solved` (跳过 envelope), 静态分析已暴露 TypeError 风险。

**Fixed in**: `c46cfcd`

---

### 2.2 Sidebar Shell Contract

**Rule**: 所有 F3 页面顶层 content 必须预留 sidebar offset。

```
desktop (≥1024px):  lg:ml-60    (240px, sidebar w-60)
tablet  (≥768px):   md:ml-[72px] (72px,  sidebar 折叠)
mobile  (<768px):   0           (sidebar hidden)
```

**Why**: 旧 dashboard 的 sidebar 是 `position: fixed; w-60`,任何 `<body>` 直接子的 content 都会被左侧 240px 覆盖。

**Lesson**: Slice 1 把 `<section>` 注入 `<body>` 直接子,没加 offset,导致 4 个 stat 卡片中的最左 1 个 + badge 被切。

**Fixed in**: `c11167e`

**未来 (延后)**: 当 4-5 个 page 都有同样 offset class,抽 `.ait-page-shell` 公共类。**不现在做**。

---

### 2.3 Mock Convention

**Rule**: services 调 `request(..., { mockName: 'X' })` 自动走 mock,JSON 路径固定。

```
mock JSON 路径:  assets/js/api/mock/{mockName}.json
client.js       →  request() lazy check getMockEnabled() → loadMock()
USE_MOCK.js     →  getMockEnabled() 优先级:
                  URL ?mock=true  >  localStorage aitutor.useMock  >  default false
```

**Lesson**: Slice 1 强制 `setUseMock(true)`,因为 :3002 backend 未起; mock 数据可让 page 在无后端下完整验收。

---

### 2.4 Async Resource Pattern

**Rule**: 用 `useAsyncResource(() => service.x())` 替代 `fetch + setLoading + setError + setData` 三件套。

```js
const res = useAsyncResource(() => user.getDashboard());
res.subscribe(({ data, loading, error }) => {
  if (error)   { /* log [Slice1] type/code/status; show 加载失败 */ }
  if (loading) { /* show — / 加载中 */ }
  if (data)    { /* render 真实数据 */ }
});
```

配合 `mountErrorBoundary()` 全局兜底 render error。

**Source**: `e772905e` (hook) + `27fe354d` (boundary)。

---

## 3. Verification Pattern

每个 F3 slice **必须** 通过这 3 层验证:

| 层 | 检查项 |
|---|---|
| **Browser** | `?mock=true` 可加载 · service contract 正确 (e.g. `res.data.X`) · console 0 error · 原页面 UI **不回归** |
| **Network** | mock JSON HTTP 200 · `request(..., { mockName })` 的 name 与文件一致 |
| **Git** | 一个 slice 一个 checkpoint commit · **不混入** 旧 frontend 改动 · commit message 反映 contract 修复 |

**Pass 门槛**: 3 层都通过 + 浏览器截图存 `.hermes/cache/screenshots/`。

---

## 4. Lessons Learned

### 已解决

- **Envelope mismatch** (`c46cfcd`): service 返回 envelope,page 直读字段 → 改 `res.data.X`
- **Sidebar offset** (`c11167e`): body 直接子被 fixed sidebar 覆盖 → 加 `lg:ml-60 md:ml-[72px]`

### 延后

- **`.ait-page-shell` 抽象**: 等 4-5 个 page 都有同 offset 模式再抽,不预先
- **Component 抽取**: stat card / weak-points list 是 candidate, 但 1 个 page 不足以定 contract
- **Loading state 视觉规范**: 当前 `—` 占位符 OK, 但 loading 状态太短不可见, 后续考虑 skeleton

---

## 5. Non-goals

**不要**做 (本 slice 范围内):

- ❌ 改 `client.js` 拆信封 — 会破坏 7 service 现有调用
- ❌ 重写 dashboard 1300 行 — 不在 Slice 1 范围
- ❌ 抽 `.ait-page-shell` — 数据点不足
- ❌ 改 design token / CSS variables
- ❌ amend 已 push 的 commit — 远端 push 保留控制

---

## 6. Next Step

**Slice 2** 候选: `tutor.html` (AI 导师) 或 `wrong-book.html` (错题本)。

执行时:

1. 套用本 retro 4 个 contract
2. 复用 `e772905e` / `27fe354d` 已有 hook + boundary
3. 走 Verification Pattern 3 层检查
4. 一个 slice 一个 commit, **不混入** 旧 frontend

**Push 策略**: F3 Slice 1 完整 (含 retro doc) 后,**一次 push** 到 3 remote,不每修一个 bug 就同步。
