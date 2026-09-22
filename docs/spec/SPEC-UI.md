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
| 字体 | `--font-display`（DM Sans + Noto Sans SC）、`--font-body`（Noto Sans SC + DM Sans）、`--font-num`（JetBrains Mono）、`--font-serif`（Noto Serif SC · 作文/引言） | **PM-BRIEF §B.2 字体层级（2026-09-21 用户拍板，取代 hero 的 Baloo 2/Comic Neue）**；全部自托管（CJK 按 unicode-range 分片 210 个 / 11MB，浏览器按需加载），禁止回退 Google Fonts CDN |
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

## 5.5 组件标准（2026-09-21 固化 · 唯一真相源）

**标准文件**：`frontend-v2/assets/css/system.css` —— 从 `hero.html`（用户指定的风格基准）内联样式中**原样抽取**（39381 字符 / 127 规则）。
**信息架构权威**：`docs/design/PM-BRIEF.md` §B.1/§F.11（页面树 v2 · 16 路由）与 §F.4（每页 4 状态具体内容）—— 空态文案、页面清单以它为准。
**加载顺序**（每页必须一致）：`fonts.css` → `system.css` → `app.css`

- `fonts.css`：自托管字体（DM Sans / Noto Sans SC / Noto Serif SC / JetBrains Mono；CJK 分片 210 个 / 11MB），禁止改回 Google Fonts CDN
- `system.css`：**标准件**（视觉，单一真相源；改视觉只改这里）
- `app.css`：页面层（状态机、表单、列表；**只做布局适配，不得改标准件外观**）

### 5.5.1 页面骨架（所有页统一）

```
body
├── nav.nav > .container.nav__inner > .brand + .nav__links > .nav__link* , .nav__cta
├── header.hero.hero--app > .hero-blobs(i×3) + .container > .hero__copy
│      .eyebrow(.eyebrow__dot) · h1.hero__title · p.hero__sub
│      .hero__ctas > .cta-primary / .cta-secondary · .trust > .trust__item > b.trust__b
├── #state-region   （六态面板；必须是 body 直接子元素，全宽区块才能铺满）
│      section.state[data-state] > .section(.section--cream) > .container
├── nav.tabbar（≤767px：首页/错题/拍照·中央凸起/复习/我的；桌面隐藏）
└── footer.footer > .container
```

**覆盖范围**（2026-09-22，同日更新接管页数）：20 个接管页**全部**为标准骨架 ——
清单以 `server.js` 的 `DEFAULT_NEW_TREE_PAGES` 为真相源：
login / register / photo-solve / wrong-book / review-session / mastery / dashboard /
practice-hub / essay / learning-path / onboarding / notifications / settings / subject-picker /
knowledge-star / predictive-paper / subject-detail / state-library / learning-journey / subject-exam。
此前只有 dashboard 是样板 —— 那次"全量铺开"只补了
字体/暗色/tabbar，壳没换，所以观感仍是旧页；这次是真迁，痕迹在
`server.js` 的接管清单与 `check-ui-standard.mjs` 的 `MIGRATED` 清单里（人工维护，不是口头约定）。
剩下 5 个原型页是已知欠账，门禁只记 backlog 不计失败
（hero / landing / error-404 / practice-hub-v2 / teacher-dashboard，见
`check-new-tree-routing.mjs` 的 `NOT_TAKEN_OVER` 清单；
`pwa-photo.html` / `vision-result.html` 已于 2026-09-22 删除 —— 被 photo-solve 取代，见 PLAN 批次 5）。

### 5.5.2 标准件目录

| 组件 | 必需结构 | 用途 |
|---|---|---|
| 区块 | `.section` / `.section--cream` + 内层 `.container` | 全宽交替背景，节奏来源 |
| 区块头 | `.section__eyebrow` + `.section__title` + `.section__sub` | 每块统一开场 |
| KPI 卡 | `.float-card.float-card--static` > `.float-card__icon` + `__body`(`__num` + `__sub`) | 指标（静态变体取消绝对定位） |
| 步骤条 | `.loop.loop--auto` > `.loop__step` > `.loop__icon` + `.loop__num` + `.loop__lbl` | 今日任务等有序列 |
| 内容卡 | `.features.features--auto` > `.feature` > `.feature__icon` + `__num` + `__title` + `__desc` | 知识点/学科等卡片网格 |
| 行动区 | `.final-cta` > `.final-cta__inner` > `__title`/`__sub`/`__row`(btn)/`__note` | 页尾收束 |
| 按钮 | `.cta-primary`（主）/ `.cta-secondary`（次） | ⚠️ 弃用旧 `.btn`，新页一律用标准件 |
| 图标 | 内联 SVG（24×24，stroke=currentColor） | **禁止 emoji 当图标** |
| 底部 Tab | `.tabbar` > `.tabbar__item`×5(`aria-current`) + `.tabbar__item--raise`（拍照中央凸起） | 移动端主导航（PM-BRIEF B.2）；≤767px 显示，桌面隐藏 |
| 公式 | `.formula`（行内）/ `.formula--block`（独立，可横向滚动）；容器 `.formula-list` | 由**自托管 KaTeX 0.18.7**（`assets/vendor/katex/`，MIT，仅 woff2，604KB）渲染；**禁止改回 CDN** |
| 长内容区 | `.results-scroll`（≤767px 限高 62vh + `overflow-y:auto` + `overscroll-behavior:contain`） | 解析结果可上下滑动；容器带 `tabindex="0"` + `role="region"` + 焦点环（键盘可达，PM-BRIEF F.5） |
| 桌面导航 | `.nav` > `.nav__inner` > `.brand` + `.nav__links` + `.nav__cta` | 移动端 links 隐藏 |

### 5.5.3 判据（机械可查 → 由 `check-ui-standard.mjs` 强制）

1. 样式加载顺序为 fonts → system → app
2. 无内联 `<style>`、无境外请求（`googleapis`/`jsdelivr`/`unpkg`）
3. 六态面板齐备（认证页 5 态例外）
4. 交互元素有 `:focus-visible` 覆盖（skill CRITICAL：focus-states）
5. 文字用色不得绕过 token：`--brand-text`（暗色下品牌红 #d71920 仅 3.38:1，不合格）
6. 微交互时长 ≤300ms（`--dur-fast: 200ms`）
7. 焦点环 = 红色 outline 3px（PM-BRIEF F.5）
8. 字体层级 = PM-BRIEF §B.2（DM Sans / Noto Sans SC / Serif SC / JetBrains Mono）
9. 移动端 ≤767px 有 `.tabbar` 且 `.nav__links` 隐藏
10. 不使用已淘汰的 `.wrap` / `.topbar` 骨架
11. 底部 Tab **恰好 1 份**（2026-09-22 修：脚本重复执行曾让 6 页各挂两份 `<nav class="tabbar">`，
    同为 `position: fixed` 会叠在一起）；认证页（login/register）**不得有** Tab
    —— 由同一次修复加进门禁，射程是 frontend-v2 全部接管页

### 5.5.4 公式渲染约定（KaTeX 自托管）

**路径约定**

- 自托管目录：`frontend-v2/assets/vendor/katex/`（MIT，`LICENSE` 与产物同目录）
- 引入位置：`katex.min.css` 放 `<head>`（在 fonts → system → app **之后**）；
  `katex.min.js` 放 `</body>` 前的**第一个** script（必须先于 ui.js / api.js / 页面脚本，
  否则页面脚本执行时 `window.katex` 还没挂上，公式会静默退回原文）
- 字体：`katex.min.css` 用相对路径 `fonts/KaTeX_*.woff2` 引用，与 CSS 同目录、一起入库
  （20 个 woff2 + css + js + LICENSE ≈ 604KB），`/assets/v2` → `frontend-v2/assets` 的
  静态映射覆盖整个目录，无需额外路由
- **禁止改回 CDN**（jsdelivr / unpkg / googleapis）：审计 R2 要求零境外请求，
  `check-ui-standard.mjs` 会拦这三类域名
- 升级方式：整体替换本目录（产物 + fonts + LICENSE），改完跑
  `node tests/frontend/photo-solve-states.test.mjs`（KaTeX 节点数断言会兜底）
- ⚠️ 版本现状：vendor 是 **0.18.7**，而 `package.json` 的 npm 依赖 `katex` 仍是 0.16.33。
  页面只用 vendor 这一份，两者不一致是已知债；升级时以 vendor 为准

**定界符规则**（`photo-solve.js` 的 `renderMixed` / `renderFormula`）

| 输入 | 判定 | 输出 |
|---|---|---|
| `$...$` | 行内 | `<span class="formula">`，`displayMode: false`，随文排 |
| `$$...$$` | 独立 | `<span class="formula formula--block">`，`displayMode: true`，独占一行、可横向滚动 |
| 其余文本 | 无公式 | `document.createTextNode`，**永不 innerHTML** |

- 扫描正则 `/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g`：`$$` 分支在前，否则 `$$x$$` 会被
  误判成空的行内式
- 渲染选项固定：`throwOnError: false`、`trust: false`（禁 `\href` / `\url` / `\includegraphics`）、
  `strict: false`、`maxExpand: 1000`（防恶意宏展开把页面卡死）
- 渲染失败或 KaTeX 未加载 → **退回原文**，不静默丢内容
- 题干取 `raw_text` 优先于 `full_content`：后者 = `raw_text` + `【公式】` + 公式原文，
  直接用会把公式抄两遍（2026-09-22 实测）。公式统一由 `latex_formulas` 单独渲染进 `.formula-list`
- 已知缺口 **G13**（SPEC-DATA）：后端 `raw_text` 目前**不带** `$` 定界符，只有 `latex_formulas`
  带；因此题干正文里的公式暂按纯文本显示 —— 后端补上定界符后前端无需再改

**结果区滚动（`.results-scroll`）**

- 结构：`<div class="results-scroll" tabindex="0" role="region" aria-label="…">`
  包住 `.results` + `.failed-list`
- ≤767px：`max-height: 62vh` + `overflow-y: auto` + `overscroll-behavior: contain`
  （滚动不穿透到 body）+ `-webkit-overflow-scrolling: touch`
- ≥768px：`max-height: none`，随整页滚动 —— 避免"页面里还有一个页面"的双重滚动条
- 可访问性：`overflow` 容器默认不可聚焦，故给 `tabindex="0"` + `role="region"` + 焦点环，
  否则键盘用户拿不到被裁掉的内容（PM-BRIEF F.5）

---

## 6. 未验证项（诚实边界）

本机 Chrome 出网被环境级阻断（见 `docs/audits/frontend-review-2026-09-20.md` §0），
因此**以下三类结论目前没有证据，不得写成"已通过"**：

1. 真实布局与视觉还原（是否有重叠/错位）
2. 触控目标**实测**尺寸（jsdom 无布局引擎，`getBoundingClientRect` 不可用）
3. 颜色对比度与真实首屏耗时（LCP/TTFB）

要闭环这三项，需要一台能联网的浏览器环境（本地或有头 CI），
在此之前的验收表述只能是"静态规则已落地，渲染层未验证"。
