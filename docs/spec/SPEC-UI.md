# SPEC-UI · 新主前端树的视觉与响应式规范（草稿）

**状态**：草稿 · 2026-09-21 建立（Q1「一套响应式」定案后）
**适用范围**：`frontend-v2/` 全部页面
**判据**：每条规则都应能被 `tests/frontend/responsive-baseline.test.mjs` 或 grep 机械核对；
无法机械核对的部分（触控实测 / 对比度 / 首屏耗时）在本文件 §6 明确标为**未验证**

---

## 1. 断点（唯一真相源：`assets/css/app.css` 顶部注释块）

| 档位 | 范围 | 规则 |
|---|---|---|
| 桌面 | ≥ 1024px | 默认样式；容器 `max-width: 760px`（表单页 440px） |
| 平板 | 768–1023px | 容器与卡片内边距收窄 |
| 手机 | ≤ 767px | 单列；工具条/操作区堆叠；按钮全宽；触控目标 ≥ 44px |
| 小屏 | ≤ 480px | 字号下调一级；缩略图 84px；表单间距收窄 |

实现方式：**桌面优先**（`max-width` 查询），与既有代码一致。
**新页面必须复用这四档，不得自造断点。**

### 1.1 全局防溢出

- `html { -webkit-text-size-adjust: 100% }` —— 防 iOS 横屏字号突变
- `body { overflow-wrap: anywhere }` —— 长公式/长英文串不得撑破容器
- `img, canvas, video { max-width: 100%; height: auto }`

---

## 2. 设计 token（`app.css` `:root`）

| 组 | 变量 | 备注 |
|---|---|---|
| 品牌 | `--brand-red #d71920`、`--brand-red-dark`、`--brand-red-50/100` | D093 红系 |
| 学科色 | `--ch-orange/red/purple/blue/green/cyan/amber/lime/pink` | 9 学科 |
| 表面 | `--bg #fffbf8`、`--surface`、`--surface-2`、`--ink/ink-2/ink-3`、`--line`、`--line-soft` | 暖米底 + 深墨字 |
| 字体 | `--font-display`（Baloo 2→系统）、`--font-body`（Comic Neue/Noto Sans SC→系统）、`--font-num` | **不引 Google Fonts**；堆叠里保留名字以便本机已装时命中 |
| 形状 | `--r-sm/md/lg/xl/pill` | |
| 阴影 | `--shadow-clay`、`--shadow-soft` | claymorphism 双层 |

**明文禁止**：引入 `fonts.googleapis` / `unpkg` / `jsdelivr`；页面内联 `<style>` 块。

---

## 3. 组件清单（复用，不得每页重写）

| 组件 | 类名 | 用途 |
|---|---|---|
| 容器 | `.wrap` | 页面主容器（含响应式内边距） |
| 顶栏 | `.topbar` + `.eyebrow` | 返回链接 + 栏目名 |
| 卡片 | `.card` / `.q-card` / `.state-card` | clay 卡片三态 |
| 状态区 | `.state` + `[data-state]` + `.is-on` | 六态互斥（由 `ui.js` 驱动） |
| 按钮 | `.btn` / `.btn-ghost` / `.btn-danger` / `.btn-block` | 主/次/危险/全宽 |
| 标签 | `.tag` / `.stat-chip` | 元信息与统计 |
| 表单 | `.form-card` `.form-stack` `.form-field` `.form-hint` `.form-error` `.form-alt` | 认证类页面 |
| 列表工具 | `.toolbar` `.pager` `.results` `.q-head` `.q-body` `.q-analysis` `.q-meta` `.q-actions` | 列表类页面 |
| 投放区 | `.dropzone` `.thumbs` `.thumb` | 拍照/上传类页面 |
| 骨架 | `.skeleton` `.skeleton--w70/50/90` | 加载态 |

---

## 4. 无障碍底线（每页必须）

1. 所有输入控件有 `<label for>`（不得只靠 placeholder）
2. 状态区有 `aria-live="polite"`
3. 图标不使用 emoji 作为交互元素的唯一标识
4. `prefers-reduced-motion: reduce` 有降级（已在 `app.css` 统一处理）
5. 主要按钮触控目标 ≥ 44px（`.btn { min-height: 44px }` 在 ≤767px 生效）
6. 输入控件 `font-size: 16px`（防 iOS 聚焦时自动放大）

---

## 5. 验证方式

| 规则 | 怎么验 |
|---|---|
| 断点存在 | `grep -c "@media" assets/css/app.css`，且四档齐全 |
| 无境外依赖 / 无内联样式 | `grep -c "googleapis\|jsdelivr\|unpkg"`、`grep -c "<style"` |
| viewport 声明 | 每页 `<meta name="viewport" ... width=device-width>` |
| 触控目标 / 输入字号 | `.btn { min-height: 44px }`、输入 16px（静态可查） |
| 以上全部 | `node tests/frontend/responsive-baseline.test.mjs` |

---

## 6. 未验证项（诚实边界）

本机 Chrome 出网被环境级阻断（见 `docs/audits/frontend-review-2026-09-20.md` §0），
因此**以下三类结论目前没有证据，不得写成"已通过"**：

1. 真实布局与视觉还原（是否有重叠/错位）
2. 触控目标**实测**尺寸（jsdom 无布局引擎，`getBoundingClientRect` 不可用）
3. 颜色对比度与真实首屏耗时（LCP/TTFB）

要闭环这三项，需要一台能联网的浏览器环境（本地或有头 CI），
在此之前的验收表述只能是"静态规则已落地，渲染层未验证"。
