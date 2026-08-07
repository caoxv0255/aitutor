# F3 Slice 3 Retrospective

> 第三个 F3 migration slice (wrong-book.html, Hybrid Shell Adapter)。
> 验证 F3 模板**横向可复用** (不只是 Dashboard Shell 复用), 并固化 4 个可复用架构模式。
> 不是开发文档, 是 **migration playbook + reusable architecture case**。

| 项 | 值 |
|---|---|
| 日期 | 2026-08-07 |
| 状态 | 完成 + 浏览器验证通过 (mock + client mastery filter 全闭环) |
| Phase 1 commit | `34e9acda` (wrong service + mock contract) |
| Step 2 commit | `d3435602` (list migration, Hybrid Shell Adapter 首次验证) |
| Step 3 commit | `03839814` (filter/pagination/tutor interaction) |
| 验证环境 | `python3 -m http.server 9001 --directory ai-tutor-frontend` + mock |
| 配套规则更新 | `CLAUDE.md` (Phase 2 commit d3435602 已记录, 表格未动 — 见 §6) |
| 配套 retro 升级 | 本文档 v1 — Hybrid Shell Contract 固化 + 5 个可复用模式 |

---

## 1. 目标

把 `useAsyncResource` + `ErrorBoundary` + Hybrid Shell 接入 `wrong-book.html` 作为 F3 第二个 **Shell Adapter** 验证 (Slice 1/2 是 Dashboard Shell), 证明:

> F3 模板**横向可复用** 到非 Dashboard Shell 的 page, 同时**新增可复用架构模式** (filter state / event delegation / mastery derive / active button / refetch 闭环).

并暴露 / 固化 6 个 contract / pattern 给后续 slice (tutor, vision, review, exam-simulation) 复用.

---

## 2. 固化的 6 个 Contract / Pattern (本 Slice 价值核心)

### 2.1 Hybrid Shell Contract (新)

**Rule**: sidebar 在 `<main class="flex">` 内层, 用 `flex-1` 让位, **不**需要 page-level ml offset.

```
Dashboard Shell (Slice 1/2)              Hybrid Shell (Slice 3 NEW)
─────────────────────────                ──────────────────────────
<body>                                  <body>
  <aside fixed w-60>                      <main class="flex">
    ...sidebar...                            <aside class="fixed md:sticky">
  </aside>                                    ...sidebar...
                                             </aside>
  <section lg:ml-60 md:ml-[72px]>          <div class="flex-1 min-w-0"> ← 自然让位
    ...content...                              ...content...
  </section>                                </div>
                                           </main>
                                         </body>
```

**Why**: wrong-book 的 sidebar 是 `<main>` 内层 aside + `flex-1` 让位 (跟 dashboard 的全局 fixed sidebar 不同). F3 第一次非 Dashboard Shell, 必须新 contract.

**Lesson**: 第一次想用 `lg:ml-60 md:ml-[72px]` (惯性), 验证后才发现不需要. **看 DOM 结构决定**, 不是看 page name.

**Fixed in**: d3435602 (无 fix commit, 一次过).

**未来延后**: 等 2-3 个 page 都用 Hybrid Shell 时, 抽 `.ait-hybrid-shell` 公共类 (现在 1 个 page 不足定 contract).

### 2.2 Filter State Contract (新 — 可复用)

**Rule**: 单 `filterState` 对象 + 闭包 fetcher + `refetch()` 触发. 不引入 React/Vue 状态层.

```js
const filterState = { subject: null, difficulty: null, mastery: null, page: 1, limit: 20 };
const listRes = useAsyncResource(() => wrong.getQuestions(filterState));
// 改 state + refetch:
filterState.subject = 'math';
filterState.page = 1;
listRes.refetch();
```

**Why**: 单对象易 trace, 闭包懒读 state 解决 `refetch` 时机问题, 不引入新依赖.

**Lesson**: 多个 `let currentSubject; let currentPage;` 分散变量后期易不同步. Slice 3 一次性单对象.

**Reuse**: tutor (筛选 history) / mastery (筛选 mastery distribution) / review (筛选报告) / exam-simulation (筛选 paper).

### 2.3 Event Delegation Contract (新 — 可复用)

**Rule**: 1 个 listener per filter group + `closest()` 找目标 button. 不给每个 button 单独绑 onclick.

```js
document.getElementById('wb-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter-*]');
  if (!btn) return;
  // dispatch by data-filter-{type}
});
```

**Why**: future render / filter 后 button 会重新生成, 单 listener 不会丢. 代码量 O(1) 而非 O(n).

**Reuse**: 任何 dynamic list page (review 筛选, mastery 切换, vision 历史).

### 2.4 Mastery Derive Pattern (新 — 可复用)

**Rule**: 派生状态在 **page layer**, 不进 service / backend / mock.

```js
function deriveMastery(row) {
  if (!row.is_correct) return 'unmastered';
  return row.difficulty >= 3 ? 'reviewing' : 'mastered';
}
```

**Why**:
- backend 不支持 mastery 参数 (POST/PUT 都没 mastery 字段)
- service 也不知道 mastery 是什么 — 那是 UI 概念
- mock 字段稳定 (`is_correct` + `difficulty`), 派生规则纯函数易测

**Lesson**: 一开始想放 service, D15 决策后保持 page layer. backend 加 `mastery` 字段 = 跨域耦合.

**Reuse**: review 页"未复习题目", mastery 页"未掌握知识点", exam 页"答错题目".

### 2.5 Active Button Toggle Pattern (新 — 可复用)

**Rule**: `classList.remove(...active + inactive classes)` + `classList.add(...new set)`. 不解析 class string.

```js
function setFilterActive(type, value) {
  document.querySelectorAll('[data-filter-' + type + ']').forEach((btn) => {
    const isActive = ...;
    btn.classList.remove('bg-primary-500', 'text-white', 'font-medium',
                         'bg-surface-secondary', 'text-foreground-secondary', 'hover:bg-surface-secondary',
                         'bg-surface-tertiary', 'text-foreground', 'hover:bg-surface-tertiary');
    if (isActive) {
      if (type === 'subject') btn.classList.add('bg-primary-500', 'text-white', 'font-medium');
      else btn.classList.add('bg-surface-tertiary', 'text-foreground', 'font-medium');
    } else {
      btn.classList.add('bg-surface-secondary', 'text-foreground-secondary', 'hover:bg-surface-secondary');
    }
  });
}
```

**Why**:
- 不依赖 Tailwind class 字符串 regex 替换 (脆弱)
- 不引入 CSS `:has()` 新 contract (跟 Slice 1 retro "F3 是数据层替换" 原则一致)
- DOM anchor 稳定 (Step 2 已加 `data-filter-*`)

**Reuse**: 任何 toggle button group (mastery page 难度切换, review 页排序方式).

### 2.6 Matched / Total Display Pattern (新 — 可复用)

**Rule**: backend filter (subject/difficulty) → pagination info 不变; client filter (mastery) → header summary 显示 `X / Y`.

```js
if (summaryTotal) {
  summaryTotal.textContent = filterState.mastery
    ? visible.length + ' / ' + total    // client filter: matched/total
    : String(total);                     // backend filter: plain total
}
```

**Why**:
- backend `pagination.total` 是**数据全集** (fact, 不能因 UI filter 改)
- client filter 是**视图子集** (view mode)
- 用户需要区分"我看到的是过滤结果"vs"数据库总量"

**Reuse**: review 页 (按周/月筛选 → "X / Y 篇报告"), exam 页 (按学科筛选 → "X / Y 套试卷").

---

## 3. Page Shell Adapter Contract (更新)

F3 migration 包含两层:

### Layer 1: Data Integration Contract (全局, 跟 Slice 1/2 一致)

适用所有 page:
- Service Envelope (Slice 1 §2.1)
- Mock Convention (Slice 1 §2.3)
- useAsyncResource (Slice 1 §2.4)
- ErrorBoundary (Slice 1 §2.4)
- Contract Test (Slice 1 §4)

**Slice 3 新增 (Layer 1 范围内的 reusable pattern)**:
- Filter State Contract (本 Slice §2.2)
- Event Delegation Contract (本 Slice §2.3)
- Matched/Total Display Pattern (本 Slice §2.6)

### Layer 2: Shell Adapter (页面选一)

每个 page 必须选一个 layout adapter, **不强制全局 shell**:

| Adapter | Pages | Sidebar pattern | Page offset |
|---|---|---|---|
| **Dashboard Shell** ✅ | dashboard, mastery | `fixed w-60` global | `lg:ml-60 md:ml-[72px]` |
| **Hybrid Shell** ✅ NEW | wrong-book | `fixed md:sticky` 内层 aside | `flex-1` 自然让位 |
| Workspace Shell | tutor (pending) | self-contained aside | inside flex `<main>` |
| Immersive Shell | vision, review (pending) | 无 sidebar | 单列 `flex-col` |

### Slice 1 / 2 / 3 验证范围

- **Slice 1**: Dashboard Shell (dashboard.html) ✅ — 2 fix commits
- **Slice 2**: Dashboard Shell (mastery.html) ✅ — 0 fix commit (复用 Slice 1)
- **Slice 3**: **Hybrid Shell (wrong-book.html) ✅ — 0 fix commit** (新 adapter 一次过)

### 为什么是 adapter 不是 contract

- Contract = 全局强制 (所有 page 必须遵循)
- Adapter = 局部选择 (每个 page 选一个)
- Shell 4 种差异源自**产品 UX 决策** (chat workspace 需要 2 列, photo capture 需要沉浸, dashboard 需要 sidebar 导航, wrong-book 需要 sidebar + sticky 移动端 bar)
- **Hybrid Shell 是 4 种 UX 中"中等复杂度"的代表** — sidebar + content + mobile bar 三件套

### 未来 page 增加, 可能加新 adapter

可能加 `FullscreenShell` (沉浸 + 浮动按钮) / `PrintShell` (PDF 报告打印). 这是健康的.

---

## 4. Verification Pattern (跟 Slice 1/2 完全对齐)

每个 F3 slice **必须** 通过 3 层验证:

| 层 | 检查项 | Slice 3 结果 |
|---|---|---|
| **Browser** | `?mock=true` 加载 · envelope 正确 · console 0 error · UI 不回归 | ✅ 8 cards 渲染 / 0 error / 原 sidebar + mobile bar 不动 |
| **Network** | mock JSON HTTP 200 · `request(..., { mockName })` name 与文件一致 | ✅ wrong_questions.json 200 / mockName `wrong_questions` |
| **Git** | 1 slice N checkpoint commits · 不混入其他 page 改动 · commit message 反映 contract 修复 | ✅ 3 commits (Phase 1 / Step 2 / Step 3) · 单 page 修改 · message 含 verified + deferred |

**Pass 门槛**: 3 层都通过 + 浏览器截图存 `.hermes/cache/screenshots/`。

**Slice 3 特有验证**:
- Mastery filter client derive 验证 (mock 下唯一可完整验证的 filter)
- Subject/Difficulty filter 仅验证 visual + state (mock 静态不模拟后端过滤 — 见 §5 Lesson)
- Tutor href 含 qid (`tutor.html?qid=q_2024_math_bj_05`)

---

## 5. Lessons Learned

### 已解决

- **Envelope mismatch**: Slice 1 retro 教训, Slice 3 一次过 (mock schema 严格 mirror backend `questions.js:51-72` row shape)
- **Hybrid Shell contract**: 第一次非 Dashboard Shell, 一次过 (0 fix commit) — 跟 Slice 2 验证 Dashboard Shell 一次过 (0 fix) 同等信号
- **CRLF 行尾**: Python 文本模式写入导致 LF 化, 显式 `content.replace("\n", "\r\n")` 恢复 — 后续 Python 改 HTML 脚本统一加这一步
- **Mock 静态 vs backend filter**: 第一次 mock 不模拟 backend filter 暴露. 决策: mock 是 static fixture, 不模拟 filter (跟 Slice 1/2 一致), subject/difficulty filter 仅验证 visual + state, mastery filter 完整验证 (client derive)

### 延后 (跟 Slice 1/2 同样)

- **`.ait-hybrid-shell` 抽象**: 等 2-3 个 page 都用 Hybrid Shell 再抽, 不预先 (现在 1 个 page 不足定 contract)
- **`.ait-filter-bar` 抽象**: 等 3-4 个 page 都有 filter UI 再抽 component (现在 wrong-book 一个, mastery / review / exam 各有不同 filter)
- **Mock 动态化**: 当前 mock 静态, 未来需要"mock-by-param" 时再扩展 client.js `loadMock()` 加 query 过滤
- **Step 4 (Hybrid Shell fix)**: 跳过, 0 fix commit

### 新发现

- **Filter State closure vs hooks 边界**: Slice 3 没用 React-style hooks, 直接闭包读 state 对象, 反而更清晰 (无 useState/useEffect 心智负担). vanilla JS 模式下**单对象 + 闭包是 F3 推荐的 state pattern**
- **Mastery derive rule 易测试**: `deriveMastery(row)` 是纯函数, 不依赖任何外部状态, 单测覆盖 4 行即可. 后续如果 mastery rule 改变 (e.g. 加入 "时间衰减" 维度), 只改 page 层这个函数, 不影响 service/backend/mock
- **CRLF/LF 在 WSL 环境的隐性成本**: 每次用 Python 改 HTML 都要修一次行尾. 后续如果项目增加更多 HTML 修改, 考虑 pre-commit 加行尾 normalize hook (跟 `.gitattributes` 配合)

---

## 6. Non-goals

**不要**做 (本 slice 范围内):

- ❌ 改 `client.js` 拆信封 — 会破坏 7 service 现有调用
- ❌ 改 wrong.js 增字段 — envelope 已固化
- ❌ 改 backend / `api/handlers/questions.js` — Slice 3.2 deferred
- ❌ 改 mock 模拟 backend filter — mock 静态已确认
- ❌ 抽 `.ait-hybrid-shell` 公共类 — 数据点不足
- ❌ 抽 `.ait-filter-bar` component — page 间 filter 形态差异大
- ❌ 改 `CLAUDE.md` Shell Adapter 表格 (虽然 Hybrid Shell 已 validated) — 等 Workspace / Immersive 也验证后再统一更新, 避免频繁改项目规则文件
- ❌ 改 `MILESTONES.md` / `PLAN.md` — Slice 3 checkpoint 一起更新 (后续 PR)
- ❌ 加 Contract Test `wrong.test.js` — R1 范围外, Slice 3.2 或单独 PR
- ❌ amend 已 push 的 commit — 远端 push 保留控制 (当前 Slice 3 全 local)

---

## 7. 可复用架构清单 (本 Slice 价值)

| Pattern | 适用 page | 复杂度 |
|---|---|---|
| **Hybrid Shell** | tutor, review, exam-simulation (有 sidebar + 移动端 bar) | 🟡 中 |
| **Filter State** | tutor (history), review (按周/月), mastery (按维度), exam (按学科) | 🟢 低 |
| **Event Delegation** | 任何 dynamic list page | 🟢 低 |
| **Mastery Derive (page layer)** | review, mastery, exam | 🟢 低 |
| **Active Button Toggle** | 任何 toggle group (排序方式, 视图模式) | 🟢 低 |
| **Matched/Total Display** | review, exam (任何 backend filter + client view mode 组合) | 🟢 低 |
| **cardTemplate function** | tutor (chat history card), review (report card), vision (upload card) | 🟢 低 |

---

## 8. Next Step

**Slice 3.2 (deferred)**: wrong.deleteQuestion / wrong.markMastered + Contract Test
- 写操作 + optimistic update + error rollback + confirmation modal
- 不是 R1 范围, 单独 PR / 单独 commit

**F3 后续 slice 推荐顺序**:
1. **F3 Slice 4**: `tutor.html` (Workspace Shell + SSE + chat history) — 最高风险, 最复杂, 留到最后
2. **F3 Slice 5**: `vision.html` (Immersive Shell) — 独立 Epic, 可跟主线并联
3. **F3 Slice 6**: `review.html` (Immersive Shell) — 跟 Slice 5 一起 batch
4. **F3 Slice 7**: `exam-simulation.html` — 跟 review/mastery 共享 Filter State pattern

**CLAUDE.md 更新 (单独 commit, 后续 PR)**:
- Page Shell Adapter 表格更新: `Hybrid pending` → `Hybrid ✅`
- F3 Migration Rules 章节新增 Slice 3 链接

**retro 风格不变**: 后续 Slice (4/5/6/7) 各写独立 retro, 引用本 Slice 的 reusable patterns (§2.2 - §2.6) 不重复解释.