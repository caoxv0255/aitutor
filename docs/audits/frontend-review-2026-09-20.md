# aitutor 前端现状评审（2026-09-20）

**视角**：资深前端 + 产品经理双视角
**范围**：运行时真实可达的全部前端（不是磁盘上的目录清单）
**方法**：HTTP 实测 + jsdom DOM/CSSOM 审计 + 静态解析；参考 `ui-ux-pro-max` 的 8 类判据
**工具**：`ui-ux-pro-max`（设计判据）；`browsing` skill（Chrome/CDP，实际受阻见 §0）

---

## 0. 诚实边界：浏览器实测受阻，哪些结论测不到

按 `browsing` skill 启动了 Chrome（headless，CDP 直连 9333），**Chrome 在本机无法完成任何网络请求** —— 包括 `localhost:3002` 与外网：

```
### http://localhost:3002/api/health
  REQ http://localhost:3002/api/health      ← 请求已发出
  navigate: timeout Page.navigate           ← 永远没有 RESP / FAIL
  EVAL-TIMEOUT timeout Runtime.evaluate     ← 渲染进程随后僵死
### http://example.com/                       ← 外网同样挂
  REQ http://example.com/ … navigate: timeout
### data:text/html,<h1>hi</h1>                ← 不联网的页面一切正常
  navigate sent / loadEvent=load / eval ok / screenshot ok
```
排除项：非沙箱运行（一样）、`--no-proxy-server`（一样）、`--single-process`（直接崩）、换端口/换 profile（一样）。
**结论**：本机 Chrome 的出站网络被环境级阻断，与页面本身无关。

因此本次**没有真实渲染截图**，以下三类结论**未验证**，不作为判据：
1. 真实布局与视觉还原（是否有重叠/错位）
2. 触控目标尺寸（需 layout，jsdom 无 getBoundingClientRect）
3. 颜色对比度实测、真实首屏耗时（LCP/TTFB）

能测的都测了：HTTP 状态/体量/UA 分流、参考文档 `/index.html`；DOM 结构、`<title>/<h1>/lang/viewport`、img alt、input label、emoji、内联样式；CSS 文本解析（token/hex/`!important`/`@media`/`:focus`/`prefers-reduced-motion`）。

> 复现命令见 §7。原始 JSON 在 `/tmp/fe-audit/dom_*.json`（会话临时）。

---

## 1. 版本：产品没有「单一版本事实源」

| 载体 | 值 | 问题 |
|---|---|---|
| `package.json` | `1.0.0` | 后端包版本，前端无版本号 |
| `docs/MILESTONES.md` | 最高 `v0.7.0`，`v1.0.0` = TBD | 与 `1.0.0` **不一致**，且完全未含 9 月前端工作 |
| `.ai/status/version.yaml` | `2026-08-18`、`cwd=/home/cx/aitutor`、`head=eb0db181`、146 commits | **陈旧且是另一台机器**；本机已是 `6fe9e0d` |
| PWA 静态资源 | 手工查询串 `?v=5`（`styles.css?v=5`、`app.js?v=5`） | 手工缓存破坏 |
| Service Worker | `CACHE_NAME = 'ai-tutor-v8'` | 第三套版本号，与 `?v=5` 无关联 |

**判定**：同时存在 **三条互不相干的版本线**，没有任何一处能回答「线上前端是哪个版本」。这对 PM 是致命项：无法对应发布、无法回滚定位。

---

## 2. 技术栈：四套前端 + 零构建，且主力页把样式引擎挂在 CDN 上

### 2.1 运行时真实可达的四个变体

| 变体 | 入口 | 页面 | 技术栈 | 样式来源 | 外部 CDN |
|---|---|---|---|---|---|
| **PWA** `public/` | 移动端 UA → `/` | 2 html | 原生 ESM SPA（`src/app.js`）+ SW + manifest；vendor 自托管 | 单一 `styles.css` | 无（自托管 katex/marked/purify）✓ |
| **F3** `ai-tutor-frontend/` | 桌面 UA → `/`（`SERVE_F3=true`） | **40** | 原生 ESM，无框架 | **38/40 依赖 `@tailwindcss/browser@4.3.1` (jsdelivr) 运行时编译** | jsdelivr + unpkg |
| **legacy** `frontend/` | 桌面 `/index.html` | 36 | 原生 | 外链 CSS + token | 无 |
| **design-v2** `docs/design/` | `/v2`、`:8090` | **1**（`hero.html` 65KB） | 原生 | 内联 38KB `<style>` | Google Fonts + unpkg + jsdelivr |

- **零构建**：`package.json` 无 `build`，无 react/vue/next（`node_modules/vite` 只是 vitest 的传递依赖）。
- 前端**无组件/交互单测**；只有 `tests/contract.test.js`（service×mock 契约）与 Playwright e2e —— 也就是说 40 个 F3 页面的**行为没有回归网**。

### 2.2 三个反直觉的实测事实

**(a) F3 的主力页面不加载仓库自己的 CSS。** `assets/css/` 有 8 个文件 71KB（含 `tokens.css` 10.9KB、`aitutor.css` 15.1KB），但：

```
index.html         linked=0   tailwindCDN=1   assets/css 引用=0
dashboard.html     linked=0   tailwindCDN=1   assets/css 引用=0
mastery.html       linked=0   tailwindCDN=1   assets/css 引用=0
wrong-book.html    linked=0   tailwindCDN=1   assets/css 引用=0
tutor.html         linked=1   tailwindCDN=1   assets/css 引用=1
```
`index/dashboard/mastery/wrong-book` 直接 0 外链 CSS —— 它们的样式 = 内联 `<style id="theme-vars">` + Tailwind CDN 工具类。

**(b) `theme-vars` 里装的是 JSON，不是 CSS。** F3 页头是：
```html
<style id="theme-vars">
{ "color": { "primary": { "aitutor-primary-900": { "hex": "#660f13", "opacity": "1" }, … } } }
```
设计 token 以 JSON 数据岛形式塞进 `<style>`，需要运行时再转成 CSS 变量。

**(c) 样式引擎本身来自第三方 CDN。** `38/40` 页 `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.1/…">` + Lucide 图标同源 CDN。含义：**F3 的样式在首屏依赖于境外 CDN 可用**。对一个面向国内 K-12 的产品，这是可用性红线（jsdelivr/unpkg 在国内长期不稳定），且 **SW 的离线缓存覆盖不到跨域资源**（见 §3 R1）。

---

## 3. 风险（每条都有机械证据）

### R1 · PWA 的 Service Worker 作用域是 `/`，会把 F3 一并缓存并 cache-first 供旧页（最严重）

`public/sw.js` 注册于 `/`（`navigator.serviceWorker.register('/sw.js')`），fetch 策略是：

| 路径 | 策略 |
|---|---|
| `/api/` | Network-First |
| `/src/` | Network-First |
| **其他一切** | **Cache-First**（`caches.match` 命中即返回，不发网络） |

后果：用户一旦在移动端访问过 `/`（拿到 PWA + SW），SW 便接管**同源全部请求**，包括 `/f3/pages/*.html`、`/f3/assets/*.css|js`。于是：

- F3 页面/资源走 **cache-first**，长期返回旧版本；
- 而 `server.js` 恰恰为 F3 专门设了 `Cache-Control: no-cache, no-store, must-revalidate`，注释写明是为了修 P0.1「ESM browser cache stickiness」——**这个修复被 SW 绕过了**（SW 命中缓存时不关心响应头）。
- 缓存淘汰只靠手工改 `ai-tutor-v8` 常量。

### R2 · F3 首屏样式依赖境外 CDN（38/40 页）

见 §2.2(c)。叠加 R1：SW 不缓存跨域，离线时 F3 直接没有样式引擎。

### R3 · PWA 的游客提示条引用了不存在的 CSS 类 → 必然错渲染

`public/index.html`：
```html
<div id="guest-data-banner" class="hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 text-center">
```
但 `public/styles.css` 里这些类**一个都没有**（`bg-amber-50`→0、`text-amber-800`→0、`px-4`→0、`.hidden`→0），页面也**没有加载 Tailwind**。
尤其 `.hidden` 未定义 ⇒ 该提示条**不会隐藏**，会在 JS 填充文案前就显示成一个空条。

### R4 · 三套品牌色互不相同

| 载体 | 值 |
|---|---|
| `public/manifest.json` `theme_color` | `#007aff`（iOS 蓝） |
| `public/manifest.json` `background_color` | `#f2f2f7` |
| `public/index.html` `theme-color`（light） | `#d71920`（D093 红） |
| F3 `theme-vars` primary-500 | D093 红系（`#d71920` 一族） |

同一个 PWA 的 manifest 与页面自报两种主题色；D093 确立的红系没有回灌到 manifest。

### R5 · 页面级重复：F3 `index.html` 与 `dashboard.html` 字节完全相同

```
7d8ffd655802  ai-tutor-frontend/pages/index.html     80819 B
7d8ffd655802  ai-tutor-frontend/pages/dashboard.html 80819 B
```
同 md5、同字节数。两份 80KB 单文件页面完全一致，改一处必然漏一处。

### R6 · `/` 与 `/index.html` 对同一设备分发不同应用

```
桌面 UA → /            → 7d8ffd655802 = F3 index.html        （D-Bug-D 迁移后的目标）
桌面 UA → /index.html  → 87f996cd69f0 = legacy frontend/index.html
```
按「legacy 已冻结、301 到 F3」的策略（`server.js:228-234`），桌面 `/index.html` **仍在发 legacy 页面**，与策略矛盾。用户手输 `.html` 就进了旧站。

### R7 · `/v2` 只在源码态可用，容器里必然"未挂载"

`/v2` 由 `server.js` 从 `DESIGN_V2_DIR`（默认 `docs/design`）挂载，且启动日志会打印 `[v2] 已挂载 / [v2] 未挂载`。而 `.dockerignore` 第 60 行排除了 `docs/` ⇒ **Docker 镜像里没有 `docs/design/hero.html`**，容器中的 `/v2` 走 `未挂载` 分支。同时该目录的 html 已在 2026-09-20 被判定为「本地设计产物」并 gitignore。结论：`/v2` 是**本机/源码态专属**，不是一个可发布变体。

---

## 4. 完整度与用户体验（机械可测部分）

### 4.1 体量与规模

| 树 | html | js | css | 总 LOC |
|---|---|---|---|---|
| `public`（PWA） | 2 | 15 | 2 | 6,141 |
| `frontend`（legacy） | 36 | 16 | 9 | 18,041 |
| `ai-tutor-frontend`（F3） | 40 | 44 | 8 | 28,686 |
| `docs/design`（v2） | 24（运行时只用 1） | 4 | 0 | 24,749 |

### 4.2 可访问性与交互（jsdom 实测，10 个入口）

| 页面 | lang | viewport | img/无alt | input/无label | emoji | emoji控件 | 内联style属性 | `:focus` | `!important` | hex色 | token | `reduced-motion` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F3 index/dashboard | zh-CN | ✓ | 0/0 | 0/0 | 1 | 0 | 138 | 0 | 0 | 0 | 0 | 0 |
| F3 mastery | zh-CN | ✓ | 0/0 | 0/0 | 2 | 0 | 89 | 0 | 0 | 0 | 0 | 0 |
| F3 essay | zh-CN | ✓ | 0/0 | 0/0 | **24** | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| F3 tutor | zh-CN | ✓ | 0/0 | **2/2** | 7 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |
| legacy login | zh-CN | ✓ | 0/0 | **2/2** | 9 | **2** | 0 | 3 | 19 | 151 | 20 | 0 |
| legacy dashboard | zh-CN | ✓ | 1/1 | 5/5 | 19 | **11** | 22 | 12 | 21 | 198 | 35 | 2 |
| v2 hero | zh-CN | ✓ | 0/0 | 0/0 | 8 | 0 | 9 | 0 | 0 | 0 | 0 | 0 |

读法（对照 `ui-ux-pro-max` 判据）：

- **CRITICAL-2 触控/交互**：`legacy dashboard` 有 11 个**可交互控件用 emoji 当图标**；`F3 essay` 24 处 emoji（`h1` 就是 `📝 作文批改`）。判据 `no-emoji-icons` 明确禁止。
- **CRITICAL-1 可访问性**：`F3 tutor` 2 个输入无 label、`legacy login` 2 个、`legacy dashboard` 5 个（aria 覆盖：F3 2~5 个，v2 **0** 个）。全站无 `<label for>` 兜底的输入存在。
- **MEDIUM-6 动效**：`prefers-reduced-motion` 全站仅 `legacy dashboard` 出现 2 次，其余 9 个入口为 **0**。
- **MEDIUM-5/7 一致性与 token 化**：`legacy` 用外链 CSS 且 token 可用（20~35 个），但仍有 **151~198 个硬编码 hex** 与 **19~21 处 `!important`**；F3 则**完全没有 token 化的外链 CSS**（0），靠内联 + CDN。
- 反例（做得对的）：**全部入口都有 `viewport`**；`PWA` 自托管 vendor 库、有 manifest/SW/`theme-color` light+dark 两套；`D093` 设计系统 demo 页**显式**给出了 normal/hover/active/disabled/focus 状态矩阵与「对比度 ≥4.5:1」要求（见 `docs/audits/design-system-1-light-normal.png`）——**设计规范存在，但没有落到主力页**。

### 4.3 产品口径的完整度问题

- **重复实现**：60 个不同页名里 **34 个在 ≥2 棵树里重复**（`legacy ∩ F3` = 31，`F3 ∩ design` = 8，`legacy ∩ design` = 5，`PWA ∩ F3` = 1）；`index`≡`dashboard` 更是字节级重复。
- **v2 名不副实**：作为"第 4 个前端变体"，运行时只有 1 张 hero 落地页（65KB），却有 24 个 html 躺在目录里。
- **PWA 覆盖率低**：`public/` 只有 2 个 html，移动端 `/` 只发一个 SPA 壳 + `mastery-dashboard.html`，其余 40 个 F3 页面在移动端无对应实现（移动端不是"另一个入口"，是"另一个产品"）。

---

## 5. 优化方向（按 收益/成本 由高到低）

| # | 方向 | 成本 | 收益 | ROI |
|---|---|---|---|---|
| **1** | **SW 作用域收口**：`/sw.js` 改为只拦截 PWA 自己的路径（或把 SW 注册作用域收到 `/src/` 级别的专用前缀），并把 F3 前缀显式排除在 fetch 之外 | 0.5–1h | 消除「旧 F3 长期驻留」，恢复 `no-store` 生效 | ★★★★★ |
| **2** | **修 PWA 游客提示条**：给 `styles.css` 补那段所需工具类，或把 `class` 改回项目自己的类名（`hidden` 必须有定义） | 15min | 修掉一个必然错渲染的元素 | ★★★★★ |
| **3** | **F3 去 CDN 化**：把 Tailwind 预编译成一份本地 CSS（或改用仓库已有 `assets/css/*`），Lucide 图标本地化 | 0.5–1d | 国内可用性 + 离线能力 + 去掉境外依赖 | ★★★★★ |
| **4** | **统一品牌色与版本号**：manifest `theme_color` 对齐 D093 红；建立单一 `前端版本` 来源（如 `frontend/VERSION` 一处生成 `?v=` 与 SW `CACHE_NAME`） | 0.5d | PM 可定位发布；终端视觉一致 | ★★★★☆ |
| **5** | **`/index.html` 归一到 F3**：桌面 `/index.html` 301 → `/f3/pages/index.html`，与 `/` 一致；legacy 只保留 301 | 15min | 消除"手输 .html 进旧站" | ★★★★☆ |
| **6** | **去重 `index.html` ≡ `dashboard.html`**：保留其一，另一处 301/软链 | 15min | 去掉 80KB 双份维护 | ★★★★☆ |
| **7** | **F3 补 token 层**：把 `theme-vars` 的 JSON 数据岛收敛为构建期/启动期生成的 CSS 变量文件，主力页真正外链它 | 1–2d | 让 D093 规范落到产品页 | ★★★☆☆ |
| **8** | **a11y 基线**：给无 label 的输入补 `label/aria-label`；交互控件去 emoji；补 `prefers-reduced-motion` | 1–2d | 合规 + 可用性 | ★★★☆☆ |
| **9** | **前端回归网**：为 F3/PWA 加最小 Playwright 冒烟（页面可加载 + 关键元素存在 + 无 console error） | 2–3d | 40 页无网 → 有网 | ★★★☆☆ |
| **10** | **决定 v2 去留**：`/v2` 本机专属且不入镜像，要么升级为正式变体（搬出 `docs/`、进镜像、补页面），要么摘掉路由 | 决策 + 0.5d | 去掉一个"看着存在其实不发布"的变体 | ★★☆☆☆ |

**最该先做的两件**：**1** 和 **2** —— 都是小时级、且都是「用户已经在受影响」的问题（R1 让用户看旧页面，R3 让提示条一直露着）。

---

## 6. 一句话结论

**产品力在 F3，工程力在 PWA，但两者都没有被"保护"起来**：F3 的样式引擎挂在境外 CDN 上、且被 PWA 的 Service Worker 用 cache-first 覆盖（`no-store` 白加）；PWA 自己有一个必然会错渲染的提示条、品牌色与 manifest 不一致；而版本、token、设计规范三样都"有文件、没落地"。**当务之急不是重做设计，而是把已存在的正确做法（自托管资源、D093 规范、no-store 策略）真正接通到主力页面。**

---

## 7. 复现命令

```bash
# 入口与 UA 分流
for u in / /f3/pages/index.html /index.html /login.html /v2/ ; do
  printf "%-28s %s\n" "$u" "$(curl -s -A 'Mozilla/5.0 (X11; Linux x86_64)' "http://localhost:3002$u" | md5sum | cut -c1-12)"
done
curl -s -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' http://localhost:3002/ | md5sum   # = public/index.html
md5sum ai-tutor-frontend/pages/index.html ai-tutor-frontend/pages/dashboard.html       # 同 md5

# F3 的 CDN 依赖与无外链 CSS
cd ai-tutor-frontend/pages
for f in index.html dashboard.html mastery.html wrong-book.html; do
  echo "$f linked=$(grep -c 'rel=\"stylesheet\"' $f) twCDN=$(grep -c 'tailwindcss/browser' $f)"; done
grep -rl 'assets/css/' *.html | wc -l          # 26 / 40

# PWA 提示条缺类
for c in bg-amber-50 text-amber-800 px-4 '\.hidden'; do printf "%s=%s " "$c" "$(grep -cE "$c" public/styles.css)"; done

# Service Worker 策略
sed -n '28,66p' public/sw.js                   # /api/ 与 /src/ 之外 → cache-first
grep -n 'CACHE_NAME' public/sw.js              # ai-tutor-v8

# 品牌色
grep -o '"theme_color": *"[^"]*"' public/manifest.json
grep -o 'content="#[0-9a-fA-F]*" media="(prefers-color-scheme: light)"' public/index.html

# v2 只在源码态
grep -n 'DESIGN_V2_DIR' server.js ; grep -n '^docs/' .dockerignore

# DOM/CSSOM 审计（本报告 §4.2 数据）
node /tmp/fe-audit/dom-audit.mjs http://localhost:3002/f3/pages/dashboard.html f3_dashboard
```

> 未验证项（浏览器网络被阻断，无真实渲染）：布局/视觉还原、触控目标尺寸、对比度实测、LCP/TTFB。
