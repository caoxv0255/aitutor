# MEASURE-REPORT — PageFlip v1.0 全站滚轮离散翻页

任务：Landing Page 全站滚轮离散翻页（PageFlip）— 完整规格 v1.0
被测文件：`docs/design/hero.html`（唯一线上改动）
测试脚本：`verify-sections.spec.js`（门禁）、`verify-pageflip.spec.js`（B1–B12）
采集时间：2026-09-17
环境：Linux 6.8.0 / Chromium（Playwright 1.61.1, chromium-1228）/ 1440×900 dark（B8、B11 为 390×844）
测量方式：全部为 Playwright 自动化数值断言。本报告不含"看起来/目测/应该没问题"类表述，所有结论均可由脚本复现。

---

## 0. 总判定

| 项 | 结果 |
|---|---|
| 前置门禁 A1–A4（1920×1080 / 1440×900 / 1280×800） | **PASS** |
| B1–B12 | **12 / 12 PASS** |
| 全量套件 | **13 passed (1.1m)**，0 failed |
| 运行中 console error | **0**（B9） |
| 遗留未修问题 | 无（见 §7 已知限制） |

复现命令：

```bash
cd /home/flaskappuser/Desktop/NewDisk_2T/aitutor
PF=docs/design/_e2e-screenshots/pageflip-v1
export PF_DIR=$PWD/$PF
NODE_ENV=development npx playwright test --config=$PF/playwright.config.js
```

> 注意：必须从 `aitutor/` 运行。`aitutor/node_modules` 与 `new_fastapi.git/aitutor/webapp/node_modules` 各装了一份 `@playwright/test` 1.61.1，从 webapp 运行会让 spec 从 aitutor 解析、runner 从 webapp 解析，报 "two different versions"。

---

## 1. Phase 0：旧方案删除（规格 §一）

删除清单与验证：

| # | 删除对象 | 结果 |
|---|---|---|
| 1 | `.hero-track` 包裹层（div + CSS） | 已删 |
| 2 | `.hero` 的 `position: sticky` 及整段 v3.3 `@media (min-width:881px)` 块 | 已删 |
| 3 | 全部 `--p` / `--copy-*` / `--phone-*` 相关 CSS 与 JS | 已删 |
| 4 | scroll/rAF 进度计算 IIFE（v3.3.1，约 130 行） | 已删 |
| 5 | `.page-body` 包裹层及其 `z-index`/实心背景 cover 逻辑 | 已删 |
| 6 | `@media (prefers-reduced-motion)` 内的 v3.3 残留规则 | 已删（保留基础减弱动效规则） |

死代码残留检查（约束性注释除外）：

```
$ grep -n "hero-track\|--p\|runway" docs/design/hero.html
（无匹配 —— hero::after 仅出现在一条历史注释中）
```

`id="hero"` 从 `.hero-track` 移回 `<header class="hero">`（页元素本身即锚点目标）。

---

## 2. Step 0：Section 清单（规格 §二）

| 顺序 | selector | id | 内容概要 | 备注 |
|---|---|---|---|---|
| 1 | `header.hero` | `hero` | 封面：标题 / CTA / 信任行 / 手机视觉 | 原为 `<header>`，非 `<section>`（见 §6.3） |
| 2 | `section.section--cream` | `features` | 8 大功能 | |
| 3 | `section.section` | `loop` | 学习闭环 8 步 | |
| 4 | `section.section` | `cta` | 最终转化 | **新增 id**（原本无 id，hash 同步需要） |

- 顺序 = DOM 顺序 = 翻页顺序。
- **footer 并入第 4 页末尾**（规格默认规则）：`<footer class="footer">` 已从顶级节点移入 `#cta` 内部，不单独成页。这是本轮唯一涉及信息架构的默认决策，已按规格执行。
- `<nav class="nav">` 不计入页；保持 `position: sticky`，`z-index: 50` 高于全部页（页 z-index 最高 3），不受翻页影响。
- 4 个页元素均加 `data-page` 属性。

---

## 3. Step 1：前置门禁（规格 §三）

规格称 `verify-sections.spec.js` 为「既有」文件。**实测该文件在磁盘与 git 历史中均不存在**（全盘 `find` 无匹配；`git log --all --name-only` 无记录；`docs/design/_e2e-screenshots/` 下只有 `hero-v33/`）。本文件由本轮**新建**，见 §6.1。

门禁结果（`verify-sections.spec.js`，A2/A3 逐档逐页实测）：

| 视口 | A3 横向 `<br>doc.scrollWidth ≤ innerW` | hero | features | loop | cta | A2 判定 |
|---|---|---|---|---|---|---|
| 1920×1080 | 1920 ≤ 1920 ✅ | 1080−1080 = 0 | 722−722 = 0 | 465−465 = 0 | 604−604 = 0 | **PASS** |
| 1440×900 | 1440 ≤ 1440 ✅ | 900−900 = 0 | 722−722 = 0 | 465−465 = 0 | 604−604 = 0 | **PASS** |
| 1280×800 | 1280 ≤ 1280 ✅ | 800−800 = 0 | 0 | 0 | 0 | **PASS** |

最小视口 800px 下最大页内容 722px → 全部页在翻页模式下可达，无不可达内容。

**门禁达成前修掉了一个真实缺陷**：hero 初始 `scrollHeight − clientHeight = +63px`（三档恒定）。根因是 `.hero::after` 装饰 blob 的 `bottom:-60px`——Chrome 的 `scrollHeight` 把伪元素的溢出计入宿主元素。实测 `overflow:hidden` / `overflow:clip` / `contain:paint` / `clip-path:inset(0)` **均无效**（仍为 +61）。解法：把两个 blob 从 `.hero::before/::after` 改为 hero 内专用装饰层 `.hero-blobs > i`（`position:absolute; inset:0; overflow:hidden`，`aria-hidden="true"`）。裁切边界与原设计完全相同（同为 hero 的 padding box），视觉零改动，溢出被关在装饰层内不再计入 `.hero`。

---

## 4. B 系列逐条数值（规格 §七）

| # | 断言 | 实测数值 | 判定 |
|---|---|---|---|
| **B1** | wheel(+120) 后 700ms | `index 0→1`；`opacity` 页1 = **0**、页2 = **1**；`scrollY = 0`（恒为 0）；`hash = "#features"`；`preventDefault = true` | **PASS** |
| **B2** | 转场 600ms 内连发 5 次 wheel | `indexBefore 0 → indexAfter 1`，**offset = 1**（无跳页） | **PASS** |
| **B3** | PageDown / PageUp / Home / End | PageDown → **1**；PageUp → **0**；Home → **0**；End → **3**（last） | **PASS** |
| **B4** | nav「功能」点击 | 落点 `activeId = features`，`opacity = 1`；全程 `maxOpacitySum = 0.9999995`（60 帧采样）⇒ **无空白帧**（任一时刻至少一页 opacity>0） | **PASS** |
| **B5** | 全部相邻页两两转场，每场 600ms 窗口 rAF ≥ 30 帧 | 空闲对照 `[36,36,36]`（均值 36）；转场 `[36,36,37,37,37,32]`，**min = 32 ≥ 30**；`layoutDelta = [0,0,0,0,0,0]`；`recalcDelta = [0,0,0,0,0,0]`；`layoutMs = [0,0,0,0,0,0]`；LoAF 长动画帧 **0 条** | **PASS** |
| **B6** | 禁用 JS | `pageflip-on` 不存在；文档高 2758px（文档流）；wheel 后 `scrollY = 600` 可滚动；4 页 `opacity = [1,1,1,1]` | **PASS** |
| **B7** | prefers-reduced-motion | `preventDefault = false`（未被劫持）；`scrollY = 300` 正常变化；无 `pageflip-on` 类 | **PASS** |
| **B8** | viewport 390×844 | 无 `pageflip-on`；`docH = 4736` = 基线 `baselineDocH = 4736`（精确相等）；4 页 `opacity = 1`、`position = relative`、`visibility = visible` | **PASS**（判据经修订，见 §6.4） |
| **B9** | 全程 console | `errorCount = 0`，`errors = []` | **PASS** |
| **B10** | 第 1 页上滚 / 最后页下滚 | 第 1 页上滚后 `index = 0`（不变）；最后页下滚后 `index = 3`（不变，total 4）；`residualClasses = []`；`is-animating = false` | **PASS** |
| **B11** | 第 3 页 → resize 390×844 | `indexBeforeResize = 2`；resize 后 `pageflip-on = false`、`is-animating = false`、`residualClasses = []`；`docHeight = 4736`（文档流恢复）；wheel 后 `scrollY = 400`；4 页 `opacity = [1,1,1,1]` ⇒ **无 opacity:0 卡死** | **PASS** |
| **B12** | 带 `#features` 直接加载 | `index = 1`（features 页）；`activeId = features`；`scrollY = 0`；`hash = "#features"`；`opacities = [0,1,0,0]` | **PASS** |

---

## 5. 性能：B5 掉帧的定位与修复（核心验收）

### 5.1 首轮实测：涉及 hero 的两场转场掉帧

初次实测转场帧数为 `[25,37,37,37,37,22]`，低于阈值 30 的两场恰好是 **0→1（离开 hero）与 1→0（回到 hero）**。

对照实验（每档 6 场转场，600ms 窗口采样 rAF）：

| 档 | 改动 | 0→1 | 1→0 | <30 场次 |
|---|---|---|---|---|
| C | 原样（对照） | 21 | 21 | 2/6 |
| A | `.hero-blobs` 完全 `display:none` | 21 | — | 2/10 |
| B | 去掉 `filter: blur(40px)` | 23 | — | 2/10 |
| D | 全局去 `backdrop-filter` | 28 | 31 | 1/6 |
| E | D + 去全部 `filter` | 36 | 36 | **0/6** |
| F | D + 去全部 `box-shadow` | 35 | 34 | **0/6** |

A/B 与 C 完全一致 ⇒ 装饰 blob 及其模糊**不是**原因；D 显著改善但不彻底 ⇒ `backdrop-filter` 是主因之一。

### 5.2 根因

**全屏交叉淡入淡出时，`backdrop-filter` 需要每帧重新采样并模糊背后正在变化的整屏内容**（Chromium 已知性能陷阱）。本项目有两处：

1. `.nav { backdrop-filter: blur(16px) }` —— 位于所有页之上，转场全程每帧重算；
2. `.float-card { backdrop-filter: blur(12px) }` —— 位于 hero 内。

再加 hero 合成层自身的两处 `filter: blur()`（40px / 60px）使光栅化成本叠加。

### 5.3 修复（3 处，全部仅作用于 `.pageflip-on`，移动端/减弱动效不受影响）

| 对象 | 原 | 改 | 视觉影响 |
|---|---|---|---|
| `.float-card` | `backdrop-filter: blur(12px)` | 删除 | **零**。其 `background: var(--surface)` 实测为 `#ffffff`(浅) / `#161922`(深)，100% 不透明，背后无内容可模糊，该滤镜本就是冗余装饰 |
| `.nav` | `backdrop-filter: blur(16px)` + 78% 透明背景 | 删除滤镜，背景提到 92% 不透明 | 保留毛玻璃观感，仅不透明度补偿 |
| `.hero-blobs i` | `filter: blur(40px)` + `transparent 70%` | 去滤镜，渐变停靠点加宽到 `transparent 92%` | 见下方像素量化 |
| `.visual::before` | `filter: blur(60px)` + `transparent 70%` / 中点 38% | 去滤镜，`transparent 92%` / 中点 30% | 见下方像素量化 |

**视觉影响像素量化**（动画冻结在 `currentTime = 7350ms` 同一相位，1440×900 dark 同机同参数截图后逐像素比对）：

| 指标 | 数值 |
|---|---|
| 总像素 | 1,296,000 |
| 有差异像素（>0/255） | 241,098 = 18.603% |
| 差异 >2/255 | 131,634 = 10.157% |
| 差异 >8/255 | **35 = 0.003%** |
| 最大通道差 | **9/255（3.5% 量程）** |
| 平均差（仅非零像素） | 3.33/255（1.3%） |
| 最大差异区域 | x[105,116] y[115,126]（12×12 像素） |

即：改动仅使两处氛围光的柔和渐变发生 ≤9/255 的扩散，无结构性变化。

### 5.4 修复后复测

| 项 | 修复前 | 修复后 |
|---|---|---|
| 转场帧数 | `[25,37,37,37,37,22]` | `[36,36,37,37,37,32]` |
| 最低帧数 | 22 | **32**（≥30） |
| <30 场次 | 2/6 | **0/6** |
| LoAF 长动画帧 | 1 条（52.7ms） | **0 条** |
| `layoutDelta` / `recalcDelta` | — | 全 **0** / 全 **0** |

`layoutDelta` 与 `recalcDelta` 全为 0 是比帧数更强的确定性证据：**6 场转场全程未触发任何布局或样式重算**，转场纯由合成器承担（仅 opacity + transform）。

---

## 6. 规格矛盾与处理（规格 §九要求记录）

### 6.1 `verify-sections.spec.js` 不存在，且 A1/A4 无定义

规格称其「既有」（v3.2 随全 section 满屏化交付，断言 A1–A4），并要求 Step 1 先跑它。实测**磁盘无此文件、git 无历史记录**。

处理：按规格给出的 A2/A3 定义新建该文件并补齐 A1/A4。**A1/A4 的定义是本轮自拟的**，规格未给出：

- A1 = 每个页元素有唯一 id（hash 同步的前提，规格 §二 要求）
- A4 = 每页内容高度 ≤ 100svh（翻页模式下「内容可达」的充分判据）

### 6.2 「v3.2 已完成全 section min-height:100svh 满屏化」与文件不符

实测只有 `.hero` 有 `min-height:100svh`（L153）；三个 `<section>` 只有 `.section { padding: 80px 0 }`，自然高 722 / 465 / 604px，**均未满屏**。这不阻塞翻页——翻页模式下 `position:fixed; height:100svh` 会把它们拉伸为满屏。

由此产生一个**需用户决策的视觉后果**：翻页模式下内容在 100svh 内顶部对齐，短内容页下方留白（1440×900 下 features 页留白 178px、loop 页 435px、cta 页 296px）。规格 CSS 未含居中规则，故未擅自添加。若需垂直居中，加一条即可：

```css
.pageflip-on [data-page] { display: flex; flex-direction: column; justify-content: center; }
```

### 6.3 `section[data-page]` 与真实 DOM 冲突（已修，影响正确性）

规格 CSS/JS 均用 `section[data-page]`，但**第 1 页是 `<header class="hero">` 而非 `<section>`**。按规格原文实现后，hero 既不被样式接管、也不进状态机页列表，**整页从第 2 页起算**：B1/B2/B3/B10/B11 全部差一位，B4 的 hash 不更新（因目标页已是"当前页"而走提前返回）。

处理：选择器改为标签无关的 `[data-page]`（CSS 与 JS 各一处），语义与规格一致（"页元素"），并覆盖 hero。若坚持 `section[data-page]`，等价做法是把 hero 的标签改成 `<section>`；本轮选择前者以免改动地标语义。

### 6.4 B8「与 v3.2 mobile 基线逐字节一致」不可满足

两个独立原因：

1. **`docs/design/hero.html` 未纳入 git**（`git status` 显示 `??`），无法从版本历史取回 v3.2 基线；可用的最近基线是 `hero-v33/regression-mobile-dark-390x844.png`（改动前所摄）。该基线为 **fullPage、deviceScaleFactor=2**，PNG 尺寸 780×9472 → CSS 像素高 4736（B8 的 `baselineDocH` 即由此得出）。
2. 页面含 `blob-float` **无限动画**（14s / 18s infinite），两次截图的动画相位不可能相同 ⇒ 字节必然不同。任何"逐字节一致"断言对动画页面都不可满足。

处理：把 B8 改为**可满足且更强的判据组合**——
- 硬断言 `pageflip-on` 不存在；
- `docH == 4736` 与基线**精确相等**（布局无回归）；
- 4 页 `opacity=1` / `position=relative` / `visibility=visible`（无卡死态）；
- 并保存 `screenshots/b8-mobile-current.png` 供人类复核。

另：B8 基线本应为 v3.2，但只能取到 v3.3.1 时期的截图。二者移动端渲染应当一致——v3.3 引入的 `.hero-track` / `.page-body` 包裹层，其 CSS 全部位于 `@media (min-width:881px)` 内，在 ≤880px 下是惰性元素；本轮已将这些包裹层删除。该推断未经独立验证（无法取回 v3.2 文件），**列为已知不确定性**。

### 6.5 B5 帧数采样：修掉一个测量自身缺陷

首版采样用 `window.__stop = false` 复位计数器，会把**上一轮已停止的 rAF 循环重新唤醒**，多轮计数叠加。实测空闲窗口因此报出 36 / 74 / 108 帧（60 / 123 / 180 fps）的"环境抖动"，实为 1 / 2 / 3 个循环在并行计数。

改为 generation token 隔离（每轮自增 `__gen`，回调只认自己的 generation）后，环境空闲稳定为 **36 ± 1 帧 / 600ms = 60fps**。

> 该缺陷若不修，B5 会以虚高的数字"通过"，属规格 §十 禁止的「数值无意义」。现所有采样均在真实转场窗口内完成：rAF 循环先启动，再派发 wheel，再精确等待 600ms。

### 6.6 B7 需用真实滚轮事件

合成 `WheelEvent` 不会触发浏览器实际滚动，故"scrollY 是否变化"必须用 `page.mouse.wheel()` 测；`preventDefault` 则由合成事件读取（监听器会主动调用）。两者分开测量。

### 6.7 其它实现细节偏离

- `done()` 中加了 150ms `setTimeout` 冷却（规格 §五 补充要求 3 授权："实测若触控板惯性导致连翻，在 done() 内再加 150ms setTimeout(unlock)"）。未加会因 `transitionend` 在 600ms 触发而 `S.lock` 过早释放。
- `enter()` 的初始页回退值与规格一致（无 hash 时取 0）。
- 键盘映射加了输入框守卫（`INPUT/TEXTAREA/SELECT` 时不拦截）——本页无表单元素，实测无影响。
- nav 锚点接管：`a[href^="#"]` 的 click 在 `pageflip-on` 且桌面时 `preventDefault` 转 `jumpTo()`；移动端保持原生锚点行为。

---

## 7. 已知限制

1. **`height: 100svh` 下的内容顶部对齐**：见 §6.2，非缺陷，是规格 CSS 的既定行为，待用户决定是否居中。
2. **B8 的基线代际**：见 §6.4，基线取自 v3.3.1 时期截图；「v3.3.1 移动端 == v3.2 移动端」这一推断无法独立验证。
3. **帧数绝对值的环境依赖**：本机空闲上限 36 帧/600ms（60fps）。B5 的"≥30"在此环境下等价于"≤6 帧丢失"。阈值按规格未做任何调整。
4. **触控板手感**（阈值 50 / 锁窗 750ms）为数值验收测不出的参数，需人工体验确认——按规格末条提醒，此项留给用户。

---

## 8. 交付物

| 文件 | 说明 |
|---|---|
| `docs/design/hero.html` | 唯一线上改动：删 v3.3/v3.3.1 + PageFlip v1.0 + 3 处性能修正 |
| `verify-pageflip.spec.js` | B1–B12 可复现脚本 |
| `verify-sections.spec.js` | 门禁 A1–A4（本轮新建，见 §6.1） |
| `playwright.config.js` | 验收配置（1440×900 dark，workers=1） |
| `capture-sections.mjs` | per-section 截图脚本 |
| `MEASURE-REPORT.md` | 本文件 |
| `screenshots/section-{1..4}-{hero,features,loop,cta}.png` | 4 张 1440×900 主动激活态（供人类复核，不作为完成依据） |
| `screenshots/b8-mobile-current-fullpage.png` | 390×844 全页现状（B8 佐证，fullPage + dsf=2，与基线同参数） |
| `docs/design/CRITICAL-AUDIT.md` | 已追加本轮段落 |
