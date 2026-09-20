# CRITICAL-AUDIT — Hero v3.3「封面化 + 滚动淡出翻页」

> ⚠️ **本文 §0–§10 记录的 v3.3 / v3.3.1 方案已全部废弃删除**（2026-09-17）。
> 当前线上实现为 **PageFlip v1.0（全站滚轮离散翻页）**，删除清单、规格矛盾处理与实测数据见 **§11**。
> §0–§10 保留仅作历史备查，其中的 `--p` / `.hero-track` / `.page-body` 等已不存在于代码中。

> 审计对象：`docs/design/hero.html`（v3.2 → v3.3）
> 审计时间：2026-09-17 18:30–18:35 HKT
> 审计方式：Playwright 真实浏览器度量（1440×900 dark 为主用例），非人工目测
> 截图目录：`docs/design/_e2e-screenshots/hero-v33/`

---

## 0. 总结论

> **本文件已更新到 v3.3.1**（硬性 2 修订版）。v3.3 的原始记录保留在 §1–§9，
> 其 §5.1 报出的「整屏空白窗口」缺陷在 v3.3.1 已被**消除**。

| 项目 | v3.3.1 结果 |
|---|---|
| 验收 4 状态（跑道 30% / 70% / 结束+300） | **4 / 4 通过** |
| 硬性规则 1、3、4、5、6 | **5 / 5 通过** |
| **硬性 2（修订版）R2a / R2b / R2c / R2d** | **4 / 4 通过** |
| 方案约束（禁 wheel 劫持 / 禁 fullPage.js / 禁 snap mandatory） | **3 / 3 遵守**（机器校验） |
| 回归（light / mobile-dark / reduced-motion / 断点 880·881） | **全部通过** |
| 控制台错误 | **0** |
| 规格内部矛盾 | **1 处**（§2：速率 0.6 vs 缩放 0.95，仍未解），§1 已随 R2b 消解 |
| 体验缺陷 | **0**（§5.1 已修复，见 §10） |

---

## 10. v3.3.1 修订记录（硬性 2）

### 10.1 规则变更

旧硬性 2「p<1 时下一节零像素」废弃，改为 R2a–R2d。
**这条修订正好修掉了 v3.3 的 §5.1 缺陷**：旧规则要求下一节在 p<1 时完全不可见，
而 p 只覆盖 hero 的 60svh 跑道，导致 p=1 之后还有 967px 行程里屏幕是空的。

### 10.2 根因与修法（一行改动）

v3.3 的病根不是 CSS，是 **p 的归一化区间太短**：

```
v3.3 :  p = scrollY / (trackH − heroH)      → p 只覆盖 540px，p=1 时下一节还在下方 967px
v3.3.1: p = scrollY / pageBodyDocTop        → p 覆盖 1507px，p=1 恰是「下一节贴到视口顶」
```

结构（sticky hero + 160svh 跑道 + 实心 page-body）**一行未动**，只改了 p 的定义与分层曲线。
改完后 hero 与 page-body 在整段过渡里**始终以 hero-track 底边为首尾分界**，
所以结构上不可能出现未覆盖横带 —— 这是 R2c 成立的几何原因，不是靠调参凑出来的。

### 10.3 实测（1440×900 dark）

| 规则 | 要求 | 实测 | 判定 |
|---|---|---|---|
| R2a | 首像素进入视口的 p ∈ [0.3, 0.6] | 进入前 scrollY 604 → `top 903.4`（未进入）；进入后 scrollY 610 → `top 897.4`（已进入）；**p = 0.4029** | ✅ |
| R2b | p=1 时 page-body 顶边 == 视口顶边，误差 ≤2px | scrollY 1507 → `page-body.top = 0.4px`，**误差 0.4px** | ✅ |
| R2c | 任意滚动位置无全宽空白横带 | 采样 25 处，**累计未覆盖行 = 0**；hero→page-body 接缝最大裸露 **0.0px**；像素扫描出的背景色行段全部落在 `#features` / `#loop` 的内容区留白，**无一段落在 hero 区间** | ✅ |
| R2d | p<1 时 hero opacity > 0 | p = 0.2 / 0.4 / 0.6 / 0.8 / 0.9 / 0.95 / 0.99 / 0.9991 全区间两层 opacity 均 > 0（最小 8.1e-7） | ✅ |

> R2c 的判据说明：`未覆盖行 = 视口内不属于 nav ∪ hero ∪ page-body 的行数`。
> 这是精确判据（不依赖颜色阈值），能直接否掉 v3.3 的缺陷形态。
> 像素扫描仅作旁证 —— 单纯统计「整行是背景色」会把 section 的正常 padding 误判为空白带
> （实测 `#loop` 背景透明，其留白行与页面底色同色），故按 section 归属后才作为结论。

### 10.4 分层曲线（p 语义变更后重新标定）

| 分层 | 位移 | opacity | 跑道 30% (p=0.287) | 跑道 70% (p=0.669) |
|---|---|---|---|---|
| 文案 rate 1.0 | `−40px × min(1, p/0.55)` | `(1−p)^2` | **0.509** / −20.8px | 0.110 / −40px |
| 手机 rate 0.6 | `+24px × 0.6p`，`scale 1−0.05×0.6p` | `(1−p)^0.65` | **0.803** / +4.1px / 0.991 | 0.488 / +9.6px / 0.980 |

- 跑道 30%：文案已明显上移淡出 ✅、手机 **0.803 ≈ 80% 可见** ✅
- 跑道 70%：hero **残影 13.3% < 20%** ✅、8 大功能标题已进入（top 499 / 标题 616）✅
- 跑道结束+300：hero `visibility:hidden`，**残影 0%**，且与「`.hero{display:none}`」截图**逐字节一致** ✅

### 10.5 其它

- 锚点：nav「9 学科」由 `#subjects` 改为 **`#hero`**；`id="hero"` 移到 `.hero-track`
  （非 sticky，文档位置固定）—— sticky 元素作锚点目标时浏览器落点不可控。
- Rule 6 复测：`#features` → top **67.4**、`#loop` → **67.1**、`#hero` → **67.4**，均紧贴 nav 下沿（nav 67px）✅
- 回归：reduced-motion（hero `relative`、跑道归零、两层 opacity=1）、light
  （跑道 30% 下 p=0.2866 / 文案 0.509 / 手机 0.803）、mobile 390（`relative`，文档流不变）、
  断点 880=`relative` / 881=`sticky` ✅
- 控制台错误 **0**

### 10.6 仍未解决

**§2 的「速率 0.6 vs 缩放 0.95」**：rate 0.6 折算下手机位移终点 = 24×0.6 = **14.4px**、
缩放终点 = **0.97**（非 0.95）。该矛盾与 R2a–R2d 无关，v3.3.1 未处理，仍待决策。


---

## 1. 关键发现：「跑道」有两种读法，且原规格自相矛盾

规格里同时存在两条互相排斥的要求：

- **硬性规则 2**：下一节（8 大功能）在 hero 完全淡出前**不得露出任何像素**
- **验收第 3 条**：`scrollY = 跑道 70%` 时 **8 大功能标题已进入**

### 几何证明

```
nav(67) ┬
        │ hero-track 160svh = 1440px
100svh ─┼─ hero 钉住区（sticky, 900px）
        │
        │ 可滚动跑道 = 1440 − 900 = 540px   ← p 在此区间 0→1
        │
160svh ─┴─ #features 起始（文档 Y = 1507）
```

- `#features` 出现在视口的充要条件：`scrollY > 1507 − 900 = 607`
- 若「跑道」= **可滚动段（540px）**：跑道 70% → `scrollY = 378` → `p = 0.70`，此时 `#features.top = 1129` **远离视口**，标题不可能进入 → **违反验收第 3 条不可能达成**
- 若「跑道」= **`.hero-track` 整体（1440px）**：跑道 70% → `scrollY = 1008` → `p = 1.0`（钳制），`#features.title.top = 616` **已在视口内** ✅

### 采用读法

**跑道 = `.hero-track` = 100svh + 60svh = 160svh**，与约束原文「跑道高度 = 100svh + 60svh」的字面定义一致。
这是**唯一能让 4 项验收同时成立**的读法，且硬性规则 2 仍然满足：

| 读法 | 验收 1 | 验收 2 | 验收 3 | 验收 4 | 硬性 2 |
|---|---|---|---|---|---|
| 跑道 = 540px 滚动段 | ✅ | ✅ | **❌ 几何不可能** | ✅ | ✅ |
| **跑道 = 160svh（已采用）** | ✅ | ✅ | **✅** | ✅ | ✅ |

> 副作用：状态的「中途感」被压缩——验收要求的前两个滚动点在 p=0.80 / p=1.00。
> 为此额外补拍了 `p = 0.25 / 0.50 / 0.70` 三个真实中途状态（见 §3 表下半），
> 以证明分层是连续渐变而非突变。

---

## 2. 关键发现：「速率 1.0 / 0.6」与「缩放 0.95」不能同时字面成立

规格原文：*文案 translateY 上移 40px 速率 1.0，手机下移 24px + 缩放 0.95 速率 0.6*

若把「速率」直译为**位移速度倍率**（手机 = 文案的 0.6 倍），则手机在跑道末只能走完 60%：

```
手机 translateY 终点 = 24 × 0.6 = 14.4px   （≠ 24）
手机 scale 终点      = 1 − 0.05 × 0.6 = 0.97 （≠ 0.95）
```

两者不可兼得：要么速率 0.6 成立而 24px/0.95 不达，要么反过来。

**已实现方案（可解释且全部实测可查）**：

| 分层 | 位移速率 | 位移终点 | opacity 曲线 | 跑道 30% 实测 |
|---|---|---|---|---|
| 文案 | 1.0（线性走满） | −40px ✅ | `1 − p` | opacity **0.200** / Y **−32px** |
| 手机 | 0.6（滞后 40%） | +14.4px（标称 24 × 0.6） | `1 − p⁸`（明显更慢） | opacity **0.832** / Y +11.52px / scale 0.976 |

- 手机位移与缩放**严格按 rate 0.6 折算**（滞后 = 纵深）
- 手机 opacity 采用 `1 − p⁸`，以满足验收「跑道 30% 处手机仍 ~80% 可见」→ 实测 0.832 ✅
- **未达成**的标称值仅 `scale 0.95`（实到 0.97），原因是 rate 0.6 的折算；已在 §6 记为待决策项

---

## 3. 验收实测数据（1440×900 dark）

跑道 1440px / 钉住 900px / 可滚动跑道 540px

### 必过 4 状态

| # | 状态 | scrollY | p | 文案 opacity / Y | 手机 opacity / Y / scale | hero 残影 | #features 标题 | 截图 |
|---|---|---|---|---|---|---|---|---|
| 1 | scrollY = 0 | 0 | 0.0000 | **1.000** / 0px | **1.000** / 0px / 1.000 | 46%（满幅） | 未进入（正确） | `state1-scrollY0.png` |
| 2 | 跑道 30% | 432 | 0.8000 | **0.200 / −32px** | **0.832** / +11.52px / 0.976 | 22.9% | 未进入（硬性 2） | `state2-runway30.png` |
| 3 | 跑道 70% | 1008 | 1.0000 | 0.000 / −40px | 0.000 / +14.4px / 0.97 | **0%** | **已进入 (top 616.6)** | `state3-runway70.png` |
| 4 | 跑道结束+300 | 1740 | 1.0000 | 0.000 / −40px | 0.000 / +14.4px / 0.97 | **0%** | 完全填充 | `state4-runway-end+300.png` |

逐条对照：

- ✅ **状态 1** hero 完整、两层 opacity 均为 1
- ✅ **状态 2** 文案「已明显上移淡出」（0.200 + 上移 32px，走完 80% 行程）；手机「仍 ~80% 可见」（实测 **0.832**）
- ✅ **状态 3** hero 残影 **0% < 20%**；8 大功能标题 top = 616.6 → **已进入视口**
- ✅ **状态 4** hero 完全不可见；`page-body.bottom = 1557.8 > 视口 900` → **无空白缝隙**

### 像素级证明（状态 4）

```
state4 截图  vs  「给 #hero 加 display:none」截图  →  逐字节完全一致 ✅
```
即：状态 4 下 hero **一个像素都没有渲染**，且 hero 的存在不影响任何布局。这比「残影 <20%」的阈值断言更强。

### 补充：真实中途状态（证明分层，不是整体一起透明）

| p | scrollY | 文案 op / Y | 手机 op / Y / scale | 两层差值 |
|---|---|---|---|---|
| 0.25 | 135 | 0.750 / −10px | 1.000 / +3.6px / 0.9925 | 0.250 |
| 0.50 | 270 | 0.500 / −20px | 0.996 / +7.2px / 0.985 | 0.496 |
| 0.70 | 378 | 0.300 / −28px | 0.942 / +10.08px / 0.979 | 0.642 |

文案与手机**在任何时刻都不同步**（位移方向相反、速率不同、opacity 曲线不同），满足「禁止整体一起透明」。截图：`mid-p025.png` / `mid-p05.png` / `mid-p07.png`

---

## 4. 硬性规则逐条核验

| # | 规则 | 实测 | 判定 |
|---|---|---|---|
| 1 | Hero 内容一屏预算（900px 内完整容纳；放不下先砍文案行数与 chips 间距，CTA + 信任行优先） | 内容块 **269.9 → 829.9**，视口 900 → 完整容纳。明细：eyebrow 300.8–332 / title 356–502.3 / sub 522.3–611.4 / **CTA 643.4–691.4** / **信任行 723.4–744.2** / chips 768.2–799.4 / 视觉 269.9–829.9 | ✅ **无需砍文案** |
| 2 | 下一节在 hero 完全淡出前不得露出任何像素 | 边界实测 `scrollY = 539`（p=0.9981，尚未到 1）时 `#features.top = 968.4 ≥ 视口 900` → **零像素** | ✅ |
| 3 | 淡出分层：文案 40px@1.0 / 手机 24px@0.6 + 缩放，禁整体一起透明 | 见 §2、§3；每层独立 transform + 独立 opacity 曲线 | ✅（`scale 0.95` 见 §2 说明） |
| 4 | p ≥ 1 → `visibility:hidden`；`prefers-reduced-motion` 关全部动效 | `p=1` 时 `visibility: hidden` + `pointer-events: none`；reduced-motion 下 hero 回到 `position:relative`、跑道高 = hero 高、两层 opacity 均 = 1 | ✅ |
| 5 | ≤880px 完全回退普通文档流（v3.2 mobile 布局不变） | 880px：`position: relative`，无跑道（track = hero 高）；881px：`sticky`，跑道 540；390×844 mobile：`relative`，全页文档流 | ✅ |
| 6 | 校准 scroll-padding-top，nav 锚点落点正确 | `scroll-padding-top: 67px`（= 动态测得的 nav 高）；实测点击 nav「功能」→ `scrollY = 1440`，`#features.top = 67.4`，**紧贴 nav 下沿不遮挡** | ✅ |

### 方案约束（机器校验，非注释）

| 约束 | 证据 |
|---|---|
| 禁 wheel 劫持 | 全文 `wheel` 仅出现 2 次，均在约束注释里；**无 `addEventListener('wheel')`**。实测 `mouse.wheel(0,600) → scrollY 600`、`(0,-600) → 0`、`PageDown → 728`，原生滚动与键盘滚动均可用且可逆 |
| 禁 fullPage.js | 全文 `fullpage` 仅出现 2 次，均为注释；无任何该库引用 |
| 禁 scroll-snap mandatory | `getComputedStyle(html).scrollSnapType === 'none'` 且 body 同为 `none`；全文**无任何 `scroll-snap-*` 属性声明** |
| 结构要求 | 实测 `body > [nav, #heroTrack, .page-body, script]`；`#heroTrack` 包含 `#hero`；`.page-body` 包含 `#features #loop section footer` |
| 层级要求 | `nav z-index 50 > .page-body z-index 2 > .hero-track z-index 0`；`.page-body` 背景实心 `rgb(10,11,16)`（dark）/ `#fffbf8`（light） |

---

## 5. ⚠️ 未达标项 / 体验缺陷（需决策）

### 5.1 淡出后存在「整屏空白窗口」—— 最高优先级

**现象**：`p` 到达 1（`scrollY = 540`）后 hero 立即 `visibility:hidden`，但它的盒子仍占满 100svh。此时下一节 `#features` 还在视口下方 967px 处。

```
scrollY 540  → 视口下方 833px 全是纯背景色（除 nav 外整屏空白）
scrollY 1008 → 上方仍有 432px 空白（即验收状态 3 截图里的深色带）
scrollY 1507 → 空白收敛到 0
```

即：**淡出完成后有约 967px 的滚动行程里，视口上部是空的**。

**根因（几何必然，非实现 bug）**：
`硬性 2`（下一节 p<1 不得露面） + `硬性 4`（p≥1 才 hidden） + `跑道 = 160svh` 三者联立，必然使
「hero 消失时刻」比「下一节填满屏幕时刻」早 `160svh − 100svh + nav ≈ 967px`。

**注**：验收状态 4 要求的「无空白缝隙」是满足的（`page-body.bottom 1557.8 > 900`，且与 hero 移除后逐字节一致）。
本条针对的是**状态 3 与状态 4 之间**未被任何验收条目覆盖的中间区间。

**可选修法（均不触碰禁用方案，但都需你决定）**：
1. **缩短跑道**：`160svh → 120svh`（100 + 20），空白窗口从 967px 压到 ~427px。代价：偏离「跑道 = 100svh + 60svh」的字面约束。
2. **p≥1 后让 `.page-body` 上移补位**（真正的「翻页」）：引入第二个进度 `q = clamp((scrollY − runway)/X)`，`p≥1` 才生效，因此不违反硬性 2。代价：改动 `.page-body` 的定位模型，属于「换实现」范畴，需你同意。
3. **保持现状**：接受这段「封面淡出 → 下一页推上来」的留白，视其为刻意的翻页节奏。

**我按规格原文实现，未擅自修**（规格明确「不许换方案」）。请你选 1 / 2 / 3。

### 5.2 `scale 0.95` 未字面达成

实测终点 `scale 0.97`（= 1 − 0.05 × 0.6，由 rate 0.6 折算而来）。若要字面 0.95，需放弃「位移也按 0.6 折算」或把缩放单独设为 rate 1.0。见 §2。

---

## 6. 回归验证

| 场景 | 结果 | 截图 |
|---|---|---|
| light 1440×900（首屏 + 跑道 30%） | 跑道 540；p@30% = 0.8000；文案 0.200 / 手机 0.832 —— 与 dark 一致 | `regression-light-1440x900.png`、`regression-light-runway30.png` |
| mobile 390×844 dark（全页） | hero `position: relative`，跑道高 = hero 高（1274），两层 opacity = 1 —— v3.2 移动端布局保持 | `regression-mobile-dark-390x844.png` |
| `prefers-reduced-motion: reduce` | hero 回 `position: relative`，跑道 900 = hero 高，两层 opacity = 1 —— **全部动效关闭** | `regression-reduced-motion.png` |
| 断点 880px（≤880 应回退） | `position: relative`，track = hero 高 1160 | — |
| 断点 881px（应启用） | `position: sticky`，跑道 540 | — |
| 控制台错误 | **0 条** | — |

---

## 7. 实现摘要

| 文件 | 改动 |
|---|---|
| `docs/design/hero.html` | +2 层包裹（`.hero-track` / `.page-body`）、+1 个类名（`.hero__copy`）、+65 行 CSS（`@media (min-width:881px)`）、+25 行 reduced-motion 覆盖、+97 行 JS（IIFE） |

**结构与机制**

```
body
├── nav                       z-index 50  （sticky，永远在最上）
├── .hero-track  #heroTrack   z-index 0   height:160svh   跑道
│   └── .hero  #hero          position:sticky top:0 100svh
│       └── .hero__inner
│           ├── .hero__copy   ← 分层 1（rate 1.0）
│           └── .visual       ← 分层 2（rate 0.6）
└── .page-body                z-index 2   background:var(--bg) 实心
    └── #features / #loop / final-cta / footer
```

- 进度：`p = clamp01(scrollY / (trackH − heroH))`，`scroll` + `resize` 监听均为 `{ passive: true }`，`requestAnimationFrame` 节流（同一帧内多次滚动只算一次）
- 计算集中在 JS，CSS 只消费自定义属性（`--copy-y / --copy-o / --phone-y / --phone-s / --phone-o / --p`）—— CSS 无 `pow()`，曲线必须在 JS 侧算
- `--nav-h` 由 JS 实测 nav 高度写入 `documentElement`，同时驱动 `scroll-padding-top` 与 hero 的顶部内边距
- 断点/无障碍切换通过 `matchMedia().addEventListener('change')` 实时生效，无需刷新

---

## 8. 基线对比（v3.2 → v3.3）

| 指标 | v3.2 | v3.3 |
|---|---|---|
| hero position | relative | sticky（PC） |
| 文档多出的滚动行程 | 0 | 540px（跑道） |
| 1440×900 `scrollHeight − clientHeight` | 62px | 63px（均为装饰 blob，`overflow:hidden` 已裁切） |
| 真实内容占位 | 269.9–817.4（560px 块） | 269.9–829.9（形态一致，仅重心随 padding 调整） |
| 导航锚点被遮挡 | 无 scroll-padding（依赖 v3.2 的 88px 首屏 padding） | `scroll-padding-top: 67px`，落点 top = 67.4 |

> 基线提示：`scrollHeight − clientHeight` 从来不是内容溢出指标（v3.2 就有 62px，来自 `.hero::before/::after` 两个装饰 blob）。
> 判断「一屏是否放得下」必须按内容元素测量，本次审计用的就是后者。

---

## 9. 截图索引

目录：`docs/design/_e2e-screenshots/hero-v33/`

| 文件 | 内容 |
|---|---|
| `state1-scrollY0.png` | 必过 1：scrollY = 0，hero 完整 |
| `state2-runway30.png` | 必过 2：跑道 30%，文案已淡化上移、手机仍亮 |
| `state3-runway70.png` | 必过 3：跑道 70%，hero 零残影、8 大功能标题进入 |
| `state4-runway-end+300.png` | 必过 4：跑道结束 +300，内容连续无缝隙 |
| `rule2-boundary-p0998.png` | 硬性 2 边界：p = 0.998 时下一节零像素 |
| `rule6-anchor-jump.png` | 硬性 6：nav「功能」锚点落点 |
| `mid-p025.png` / `mid-p05.png` / `mid-p07.png` | 补充：真实中途分层状态 |
| `regression-light-1440x900.png` / `regression-light-runway30.png` | light 回归 |
| `regression-mobile-dark-390x844.png` | mobile 回归（全页） |
| `regression-reduced-motion.png` | reduced-motion 回归 |
| `measurements.json` | 全部原始度量值 |

复现命令（度量脚本已随截图一起保存）：

```bash
cd /home/flaskappuser/Desktop/NewDisk_2T/aitutor
node docs/design/_e2e-screenshots/hero-v33/measure-hero.mjs
# 依赖该项目自带的 @playwright/test 1.61.1；脚本内 URL 指向 http://127.0.0.1:8090/hero.html
# 换成线上地址只需改脚本顶部 URL 常量
```

---

# 11. PageFlip v1.0 — 全站滚轮离散翻页（取代 v3.3 / v3.3.1）

采集时间 2026-09-17。完整数值见 `_e2e-screenshots/pageflip-v1/MEASURE-REPORT.md`；本节记录**决策、删除清单与规格矛盾**。

## 11.1 删除清单（规格 §一 Phase 0）

| # | 删除对象 | 状态 |
|---|---|---|
| 1 | `.hero-track` 包裹层（DOM + CSS） | 已删 |
| 2 | `.hero` 的 `position: sticky` + 整段 v3.3 `@media (min-width:881px)` 块 | 已删 |
| 3 | 全部 `--p` / `--copy-*` / `--phone-*` CSS 与 JS | 已删 |
| 4 | scroll/rAF 进度计算 IIFE（v3.3.1，约 130 行） | 已删 |
| 5 | `.page-body` 包裹层及其 `z-index` / 实心背景 cover 逻辑 | 已删 |
| 6 | `prefers-reduced-motion` 块内的 v3.3 残留规则 | 已删（保留基础减弱动效规则） |

残留检查：`grep -n "hero-track\|--p\|runway" docs/design/hero.html` → 无匹配（`hero::after` 仅存于一条历史注释）。
`id="hero"` 从 `.hero-track` 移回 `<header class="hero">`。

删除后页面回到 v3.2 基线结构（普通文档流），移动端 CSS 未引用任何被删/被搬动的选择器（已 grep 确认）。

## 11.2 Step 0 section 清单

| 顺序 | selector | id | 内容概要 |
|---|---|---|---|
| 1 | `header.hero` | `hero` | 封面：标题 / CTA / 信任行 / 手机视觉 |
| 2 | `section.section--cream` | `features` | 8 大功能 |
| 3 | `section.section` | `loop` | 学习闭环 8 步 |
| 4 | `section.section` | `cta` | 最终转化（**新增 id**） |

- **footer 并入第 4 页末尾**（规格默认规则）：`<footer>` 已移入 `#cta` 内部，不单独成页。这是本轮唯一的信息架构决策。
- `<nav>` 不计入页，保持 `position: sticky`、`z-index: 50` > 页最高 `z-index: 3`。

## 11.3 门禁发现：伪元素的溢出会污染 scrollHeight

门禁要求每页 `scrollHeight − clientHeight ≤ 0`。hero 初始为 **+63px**（三档恒定）。

根因：`.hero::after` 装饰 blob 的 `bottom:-60px` —— **Chrome 的 `scrollHeight` 会把伪元素的溢出计入宿主元素**。实测以下手段**全部无效**（仍为 +61）：

| 手段 | 结果 |
|---|---|
| `overflow: hidden` → `overflow: clip` | ✗ |
| `contain: paint` | ✗ |
| `clip-path: inset(0)` | ✗ |

唯一可行解：把两个 blob 从 `.hero::before/::after` 改为 hero 内专用装饰层 `.hero-blobs > i`（`position:absolute; inset:0; overflow:hidden`，`aria-hidden="true"`）。**裁切边界与原设计完全相同**（同为 hero 的 padding box），视觉零改动，溢出被关进装饰层后不再计入 `.hero`。

门禁最终结果：**A1–A4 在 1920×1080 / 1440×900 / 1280×800 三档 × 4 页全 PASS**（最小视口 800px 下最大页内容 722px）。

## 11.4 规格矛盾与处理（7 条）

| # | 矛盾 | 处理 |
|---|---|---|
| 1 | 规格称 `verify-sections.spec.js` 为「既有」（v3.2 交付，断言 A1–A4）；实测**磁盘与 git 历史中均不存在** | 按规格给出的 A2/A3 定义新建该文件；**A1/A4 的定义系本轮自拟**（A1 = 每页有唯一 id；A4 = 每页内容高 ≤ 100svh） |
| 2 | 规格称「v3.2 已完成全 section min-height:100svh 满屏化」；实测只有 `.hero` 有 `100svh`，三个 section 自然高 722/465/604px | 不阻塞（翻页模式下 `height:100svh` 会拉伸）。但产生视觉后果——短内容页顶部对齐、下方留白；规格 CSS 无居中规则，**未擅自添加**，待用户决策 |
| 3 | 规格 CSS/JS 用 `section[data-page]`，但**第 1 页是 `<header>`** | 选择器改为标签无关的 `[data-page]`（CSS + JS）。按规格原文实现会导致 hero 不被接管、整页从第 2 页起算（B1/B2/B3/B10/B11 全部差一位、B4 的 hash 不更新） |
| 4 | B8 要求与 v3.2 mobile 基线**逐字节一致** | **不可满足**：① `hero.html` 未纳 git（无 v3.2 可取）；② 页面含 `blob-float` 无限动画，两次截图相位不可能相同。改为：硬断言无 `pageflip-on` + `docH == 4736`（与基线精确相等）+ 4 页无卡死态，并留存截图供人类复核 |
| 5 | B5 帧数采样 | 首版采样有**测量自身缺陷**：`__stop=false` 复位会唤醒上一轮 rAF 循环，计数叠加（空闲窗口虚报 36/74/108）。改 generation token 隔离后环境空闲稳定 36±1 帧/600ms = 60fps |
| 6 | B7「wheel 不被 preventDefault」 | 合成 `WheelEvent` 不会触发真实滚动，"scrollY 是否变化"必须用 `page.mouse.wheel()` 单独测 |
| 7 | `done()` 的锁释放时机 | 按规格 §五补充要求 3 加 150ms 冷却；否则 `transitionend` 在 600ms 触发后 `S.lock` 过早释放，触控板惯性会连翻 |

## 11.5 性能：B5 掉帧的根因与修复

首测转场帧数 `[25,37,37,37,37,22]`，低帧恰好是**涉及 hero 的两场**（0→1、1→0）。

对照实验定位（每档 6 场，600ms 窗口采样）：

| 档 | 改动 | 0→1 | 1→0 | <30 |
|---|---|---|---|---|
| C | 对照 | 21 | 21 | 2/6 |
| A | `.hero-blobs` 完全隐藏 | 21 | — | 2/10 |
| B | 去 `filter: blur(40px)` | 23 | — | 2/10 |
| D | 全局去 `backdrop-filter` | 28 | 31 | 1/6 |
| E | D + 去全部 `filter` | 36 | 36 | **0/6** |
| F | D + 去全部 `box-shadow` | 35 | 34 | **0/6** |

A/B 与 C 完全一致 ⇒ 装饰 blob 不是原因；D 显著改善但不彻底 ⇒ **`backdrop-filter` 是主因**。

**根因**：全屏交叉淡入淡出时，`backdrop-filter` 需每帧重新采样并模糊背后正在变化的整屏内容（Chromium 已知性能陷阱）。本项目有两处：`.nav`（`blur(16px)`，位于所有页之上）与 `.float-card`（`blur(12px)`，在 hero 内）；再接上 hero 自身两处 `filter: blur()`（40px/60px）使光栅化成本叠加。

**修复**（3 处，全部仅在 `.pageflip-on` 下生效，移动端/减弱动效不受影响）：

| 对象 | 改动 | 视觉影响 |
|---|---|---|
| `.float-card` | 删 `backdrop-filter` | **零**。其背景 `var(--surface)` 实测为 `#ffffff`/`#161922`，100% 不透明，背后无内容可模糊，该滤镜本就是冗余装饰 |
| `.nav` | 删滤镜，背景 78% → 92% 不透明 | 保留毛玻璃观感，仅不透明度补偿 |
| `.hero-blobs i` / `.visual::before` | 删 `filter: blur()`，渐变停靠点 70% → 92% | 已像素量化，见下 |

**视觉影响量化**（动画冻结于 `currentTime=7350ms` 同相位、1440×900 dark、逐像素比对）：

- 差异 >8/255 的像素：**35 个 / 1,296,000 = 0.003%**
- 最大通道差：**9/255（3.5% 量程）**；平均差（仅非零像素）：3.33/255

**修复后**：转场 `[36,36,37,37,37,32]`，min **32 ≥ 30**，**0/6 掉帧**；`layoutDelta` 全 0、`recalcDelta` 全 0、LoAF 长动画帧 **0 条**。

> `layoutDelta`/`recalcDelta` 全 0 是比帧数更强的确定性证据：6 场转场全程**未触发任何布局或样式重算**，转场纯由合成器承担。

## 11.6 验收结果

| 项 | 结果 |
|---|---|
| 前置门禁 A1–A4（3 档 × 4 页） | PASS |
| B1–B12 | **12/12 PASS** |
| 全量套件 | **13 passed (1.1m)** |
| console error | 0 |
| Step 6.2 webapp E2E 14 case | **14 passed ×8 连续** |
| Step 6.3 线上 smoke（`aitutor.uibe.online/v2/hero.html`） | HTTP 200；`pageflip-on`；4 页；初始 hero；滚轮后 idx=1、`opacity=[0,1,0,0]`、`hash=#features`、`scrollY=0`；**console 0 错误** |

**Step 6.2 附带修复**：Case I（刷新 /dashboard）长期约 1/3 概率间歇失败。实测探针证实「失败时刷新前捕获到的响应数 = 0」，即捕获对象正确，问题在读取时机——`reload` 期间 CDP 资源被回收，`Network.getResponseBody` 报 `No resource with given identifier found`，被 `.catch(() => null)` 静默吞掉。改为**页面内挂钩 XHR**（`addInitScript` 每次导航都执行，刷新后读到的日志只属于新文档）。修复前 9 次跑 3 次失败，修复后 **8/8 通过**。

## 11.7 已知限制

1. 翻页模式下 `height:100svh` 内容顶部对齐，短内容页下方留白（1440×900 下 features 178px / loop 435px / cta 296px）。规格 CSS 无居中规则，待用户决策（加一行 flex 居中即可）。
2. B8 基线取自 v3.3.1 时期截图；「v3.3.1 移动端 == v3.2 移动端」的推断（依据：被删包裹层的 CSS 全在 `min-width:881px` 内）**未经独立验证**——无法取回 v3.2 文件。
3. 帧数阈值的环境依赖：本机空闲上限 36 帧/600ms，B5 的「≥30」等价于「≤6 帧丢失」。阈值按规格**未做任何调整**。
4. 触控板手感（阈值 50 / 锁窗 750ms）为数值验收测不出的参数，需人工体验确认。
