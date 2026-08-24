# AI Tutor 前端视觉设计指南

> **目的**: 给后续 AI agent / 开发者提供清晰的设计规范参考，避免在 24+ 个 F3 页面中重新发明轮子。
> **最后更新**: 2026-08-24 (D071)
> **状态**: 设计 token 完整，部分组件类 dormant，主要靠 Tailwind 4 utility class

---

## 1. 视觉系统总览

AI Tutor 前端基于 3 层架构：

| 层 | 资产 | 状态 | 适用 |
|---|---|---|---|
| L1 Design Tokens | `assets/css/tokens.css` | ✅ 完整 | 颜色/字体/阴影/间距/圆角 CSS 变量 |
| L2 Tailwind 4 | `<style>@theme inline {...}` | ✅ 完整 | 页面 95% 用 Tailwind utility class |
| L3 .ait-* 组件类 | `assets/css/aitutor.css` | ⚠️ 局部 | 21+ 页基本不用，仅 dashboard + mastery 用 3 处 |

**当前模式**: L1 (token) → L2 (Tailwind utility) 直接生成样式。L3 (.ait-*) 是 dormant。

---

## 2. Design Tokens (L1) — 完整可用

### 颜色 (5 个色系)

| 色系 | 50 | 100 | 200 | 300 | 400 | 500 (主) | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| **primary** (品牌红) | `#fff1f1` | `#ffe0e0` | `#ffc5c5` | `#ffa0a0` | `#f36b6b` | **`#d71920`** | `#b8151b` | `#941218` | `#7a1014` | `#660f13` |
| **blue** (辅助蓝) | `#eff6ff` | `#dbeafe` | `#bfdbfe` | `#93c5fd` | `#60a5fa` | `#2563eb` | `#1d4ed8` | `#1e40af` | `#1e3a8a` | `#172554` |
| **success** (绿) | `#ecfdf5` | ... | | | | `#059669` | | | | |
| **warning** (黄) | `#fffbeb` | ... | | | | `#f59e0b` | | | | |
| **error** (红) | `#fef2f2` | ... | | | | `#ef4444` | | | | |

**语义别名** (推荐用)：
- `--primary` / `--primary-hover` / `--primary-foreground`
- `--background` / `--foreground` / `--surface` / `--surface-dim`
- `--border` / `--ring` / `--muted` / `--muted-foreground`

### 字体

- 显示字体：`DM Sans` + `Noto Sans SC` (中英混排)
- 正文字体：`Noto Sans SC` + `DM Sans`
- 等宽：`DM Sans` monospace

### 阴影 (5 级)

| Token | 用途 |
|---|---|
| `--shadow-1` | 卡片静态 (`0 1px 2px rgba(0,0,0,.06)`) |
| `--shadow-2` | 卡片 hover (`0 4px 8px -2px rgba(0,0,0,.10)`) |
| `--shadow-3` | 浮动元素 (`0 8px 24px -8px rgba(0,0,0,.18)`) |
| `--shadow-4` | 模态框 (`0 16px 40px -12px rgba(0,0,0,.24)`) |
| `--shadow-5` | 覆盖层 (`0 24px 60px -20px rgba(0,0,0,.30)`) |

### 圆角 (4 级)

- `--radius-sm`: `8px` (按钮、tag)
- `--radius-md`: `14px` (输入框、card)
- `--radius-lg`: `16px` (大卡片)
- `--radius-pill`: `9999px` (胶囊)

### 间距 (8 级 4px grid)

- `--space-1`: `4px` 至 `--space-8`: `64px`

### Sizing

- 按钮: `--size-button-sm: 32px` / `--size-button-md: 40px` / `--size-button-lg: 48px`
- 输入框: `--size-input-height: 40px`
- 图标: `--size-icon-sm: 16px` / `--size-icon-md: 24px` / `--size-icon-lg: 32px`

---

## 3. Tailwind 4 Utility Class (L2) — 主流使用方式

### 品牌色 Tailwind class

```html
<!-- 主红 -->
class="bg-primary-500 text-white"
class="text-primary-500"
class="border-primary-200"

<!-- 浅红背景 + 深红文字 (tag 用) -->
class="bg-primary-50 text-primary-700"

<!-- 成功/警告/错误/信息 同模式 -->
class="bg-success-50 text-success-700"
class="bg-warning-50 text-warning-500"
class="bg-error-50 text-error-500"
class="bg-info-50 text-info-500"
```

### Surface + Border 系统

```html
class="bg-surface"           <!-- 白底 -->
class="bg-surface-secondary" <!-- 浅灰底 -->
class="bg-surface-tertiary"  <!-- 更深灰 -->
class="text-foreground"      <!-- 主文字 -->
class="text-foreground-secondary" <!-- 次文字 -->
class="border-border-light"  <!-- 浅边框 -->
class="border-border"        <!-- 标准边框 -->
```

### 通用卡片模式

```html
<div class="p-5 rounded-2xl bg-surface border border-border-light
            shadow-[0_1px_2px_rgba(0,0,0,0.04)]
            hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
  ...
</div>
```

### 渐变 Hero 模式

```html
<section class="relative overflow-hidden rounded-3xl
                bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700
                text-white p-8 lg:p-12
                shadow-[0_8px_24px_-8px_rgba(215,25,32,0.4)]">
  <!-- 内容 -->
</section>
```

---

## 4. .ait-* 组件类 (L3) — 已建但基本 dormant

### 现状 (2026-08-24)

- **dashboard.html**: 3 处 (`.ait-stat-num` × 4 + `.ait-card` × 1 + `.ait-badge` × 3)
- **mastery.html**: 3 处 (`.ait-stat-num` × 3 + `.ait-card` × 1 + `.ait-badge` × 1)
- **其他 22+ 页面**: 0 处

### 为什么 dormant

- Tailwind 4 utility class 表达力够用，开发快
- .ait-* 类大多 1:1 对应 Tailwind utility，没记忆优势
- 部分 .ait-* 类（如 .ait-stat-num）针对"加载/空/错误"状态机，对 dashboard/mastery 这种"有数据加载"的页面才有价值

### 何时用 .ait-*

| 场景 | 推荐 | 原因 |
|---|---|---|
| 普通卡片 | ❌ Tailwind | `.ait-card` ≈ `p-5 rounded-2xl bg-surface border` |
| 普通按钮 | ❌ Tailwind | `.ait-btn-primary` ≈ `bg-primary-500 text-white px-4 py-2 rounded-md` |
| Stat 数字（带 loading/empty/error 状态） | ✅ `.ait-stat-num` | 内置 4 种状态 `.empty / .loading / .error` + shimmer 动画 |
| 通用空状态 | ✅ `.ait-empty` | 内置 icon + title + desc 三段布局 |
| 加载骨架 | ✅ `.ait-skeleton` | 内置 shimmer 动画，无需手写 keyframes |
| Dev slice 验证卡片 | ✅ `.ait-card` | 跟 dashboard Slice 1/2 风格一致 |

### .ait-stat-num 4 种状态

```html
<div class="ait-stat-num empty">—</div>      <!-- 数据缺失 -->
<div class="ait-stat-num loading">68</div>   <!-- shimmer 动画 -->
<div class="ait-stat-num">68</div>           <!-- 有数据 -->
<div class="ait-stat-num error">加载失败</div> <!-- 错误 -->
```

JS 切换:
```js
el.className = `num ait-stat-num ${state}`;
// state: 'empty' | 'loading' | '' | 'error'
```

---

## 5. Shell Adapter 4 个 (D071 全绿)

| Shell | 页面 | 布局 | 状态 |
|---|---|---|---|
| **Dashboard** | dashboard, mastery | `<aside fixed w-60>` + page offset `lg:ml-60 md:ml-[72px]` | ✅ |
| **Hybrid** | wrong-book | `<main class="flex">` 内层 `<aside fixed md:sticky>` + `<div flex-1>` | ✅ Slice 3 |
| **Workspace** | tutor | 3-region: header + `<div flex>` + `<aside>` + `<main flex-1>` | ✅ Slice 4.4 |
| **Immersive** | vision, review | 单列 `flex-col`, 无 sidebar | ✅ D071 |

**为什么 4 个 Shell**: UX 决策，不强制统一 (CLAUDE.md 红线)。

---

## 6. 已知视觉模式 (从 24 页提取)

### Stat Card (Dashboard 第二行)
```html
<div class="p-5 rounded-2xl bg-gradient-to-br from-white to-surface-secondary
            border border-border-light
            shadow-[0_1px_2px_rgba(0,0,0,0.04)]
            hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
  <div class="flex items-start justify-between mb-3">
    <div class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-{color}-50 text-{color}-500">
      <i data-lucide="icon-name" class="w-[18px] h-[18px]"></i>
    </div>
    <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-success-50 text-success-500 text-[11px] font-semibold">
      <i data-lucide="trending-up" class="w-3 h-3"></i>+12%
    </span>
  </div>
  <div class="text-3xl font-bold text-foreground whitespace-nowrap leading-none">1,248</div>
  <div class="mt-1.5 text-sm text-foreground-secondary truncate">总练习题数</div>
</div>
```

### Subject Card (首页学科 grid)
```html
<a href="math-exam.html" class="block p-5 rounded-2xl bg-surface border border-border-light
                                  hover:border-border hover:shadow-md transition-all">
  <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-500 mb-3">
    <span class="text-base font-bold">数</span>
  </div>
  <h3 class="text-sm font-bold text-foreground">数学</h3>
  <p class="text-xs text-foreground-secondary mt-1">选择 · 多选 · 填空 · 解答 · 压轴</p>
  <p class="text-[11px] text-foreground-muted mt-1">150分 · 120分钟</p>
</a>
```

### Login Hero (左侧品牌区)
```html
<div class="hidden lg:flex lg:w-1/2 bg-surface-dark relative overflow-hidden flex-col justify-between p-12 xl:p-16">
  <!-- gradient 装饰 -->
  <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-500/20 blur-[120px]"></div>
  <div class="absolute bottom-0 -right-24 w-[420px] h-[420px] rounded-full bg-primary-500/10 blur-[100px]"></div>
  <div class="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-info-500/10 blur-[80px]"></div>
  <!-- 几何装饰 -->
  <div class="absolute top-20 right-20 w-16 h-16 rounded-2xl border border-white/10 rotate-12"></div>
  ...
  <!-- Grid pattern overlay -->
  <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px); background-size: 40px 40px;"></div>
  <!-- 内容 -->
</div>
```

---

## 7. 视觉打磨的"红线"

按 CLAUDE.md + D071：
1. **不要**改主色 `#d71920` (品牌色已冻结)
2. **不要**使用非 token 颜色 (避免 `bg-red-500` 这种 Tailwind 默认色)
4. **不要**混合 4 种 Shell Adapter (每个 page 选一种)
5. **不要**去掉 .ait-* 类的 dormant 资产 (.ait-stat-num / .ait-empty / .ait-skeleton 仍有用)
6. **必须**保留 `<html class="light">` (不要用 dark mode，没适配)
7. **必须**用 `bg-surface` / `text-foreground` 等语义化 token，不用 `bg-white` / `text-black`

---

## 8. 视觉验证工具

### Playwright 截图 (M3 视觉反馈闭环基建)

```bash
# 跑全 24 F3 页面截图
AITUTOR_BASE=http://localhost:3002 node scripts/headed-tests/run-all.mjs

# 仅验证 navator 高亮
AITUTOR_BASE=http://localhost:3002 node scripts/headed-tests/check-nav-active.mjs
```

### 截图画廊

`frontend/dev/runs/<runId>/manifest.json` + `frontend/dev/screenshots/<runId>/*.png`

可视化: `frontend/dev/headed-gallery.html` (浏览器打开看多 run 对比)

### 视觉审查清单 (人工)

每次打磨新页面 / 改 CSS 后:
- [ ] Hero 区域主色未改 (`bg-primary-500` 系列)
- [ ] 文字层级清晰 (display / h1 / h2 / body / caption)
- [ ] 间距用 4px grid (`space-1` ~ `space-8`)
- [ ] 卡片圆角统一 (`rounded-2xl` / `rounded-xl`)
- [ ] Hover 状态有 transition (`transition-all` / `transition-shadow`)
- [ ] 没有内联 style (除了 font-family)
- [ ] 没有 raw color (`#xxx` / `rgb()`)

---

## 9. 后续视觉打磨路线图

### 高 ROI (建议做)

1. **Dashboard 4 KPI 卡片的空数据 graceful degradation** (line 430-490 区域)
   - 当前 4 KPI 数字硬编码 / 显示"—"
   - 改用 `.ait-stat-num empty / loading / error` 状态机
2. **Mastery 顶部"× 知识点不存在"错误** (mastery.html 底部)
   - 改用 `.ait-empty` 组件
3. **Wrong-book 空状态** (wrong-book.html)
   - 当前图标用红色 "×" 语义混乱
   - 改用 `.ait-empty` + 友好图标

### 中 ROI

4. **设计系统抽取**: 把 Tailwind 重复模式抽到 .ait-* 组件类
5. **统一 dark mode** (D-NNN 提案): `.dark` class 已存在但未启用
6. **微交互**: page transition / skeleton loader

### 低 ROI

7. 重新设计 Hero (已经是生产级)
8. 加更多 hover 动画 (transform translateY)
9. 改字重 / 字号 (DM Sans 已经是品牌字体)

---

## 10. 参考资料

- CLAUDE.md §样式体系
- .ai/architecture/frontend.md (4 Shell Adapter)
- .ai/decisions/D071-f3-nav-fix-and-visual-loop.md (本次基建)
- docs/frontend-migration/ (F3 迁移 retrospectives)
- ai-tutor-frontend/assets/css/tokens.css (L1)
- ai-tutor-frontend/assets/css/aitutor.css (L3)