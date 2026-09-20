# 公式可见性根治 — 治理前后对比报告 (2026-09-19)

> 路线图 P2b 残留（公式可见）的收官。提交 `5f3aa69`（代码）+ 本次全量渲染。
> 脚本 `31-render-formula-assets.py`；迁移无（复用 036 的 `media_refs`，增 `png_rel`）。

## 一、为什么不是"桥接"，而是"根治"

公式 token 是 `⟦F:rId⟧` → 资产是 **wmf/emf（浏览器不可渲染）**。
先试过"桥接 04 的 HTML/VLM 产物"（HTML 图已正确渲染、VLM 有 latex 99.7%），但四种对齐假设实测均**不可靠**：

| 对齐假设 | 命中率 |
|---|---|
| HTML item → 题目（`para_idx` 落在题的 `para_index` 区间） | 96.3% ✅（仅题级） |
| token → 具体公式图：逐次出现顺序 | 13.3% |
| token → 具体公式图：题内计数 | 题 34.6% / token 19.5% |
| token → 具体公式图：distinct 数 | 33.3% |

根因：**两条通道没有共同主键**（qbx 按 `rId`，libreoffice HTML 只有 `Object1..N`+sha）。
在无主键处猜绑定 = 可能错公式，违反本项目「错答案比错公式更糟 / 宁可不改」。

**根治 = 不做任何对齐**：直接在 token **自带的 wmf sha** 上渲染 PNG。
`token → wmf sha → PNG` 天然 1:1，`wmf sha` 已在 `media_refs`（P2b 产物）里。

## 二、治理前（Before）

| 指标 | 实测 |
|---|---|
| 公式 ref 总数（active，media_refs） | **57968** |
| 其中**可渲染**（原生 png/jpg/bmp） | **523（0.9%）** |
| 不可渲染（wmf/emf，浏览器看不了） | **57445（99.1%）** |
| wmf **图片** ref（figure kind） | 8109（同样不可渲染） |
| 读端表现 | 公式 =「［公式］」标记（P2b 后）或裸 token（P2b 前）；无公式本体 |

## 三、治理后（After）

| 指标 | Before | After |
|---|---|---|
| 公式 ref 可渲染 | 523（0.9%） | **57753（97.6%）** |
| — 经渲染 PNG（`/qb-media-png/…`） | 0 | **57230** |
| — 原生可渲染 | 523 | 523 |
| 公式 ref 不可渲染 | 57445 | **1402（2.4%）** |
| — 资产缺失（`asset_absent`） | — | **1187** |
| — 空白/转换失败 | — | **215** |
| wmf 图片 ref 可渲染 | 0 | **7149** |
| 有 `png_rel` 的题 | 0 | **5571** |
| distinct wmf/emf 渲染 | — | **46522/47044 = 98.9%**（ok 45366 + skip 1156；blank 522） |
| `/qb-media-png` 路由 | 无 | 有（内容寻址，immutable） |
| 读端 | 标记 | `<img src="/qb-media-png/…" source="rendered">` |

> **口径说明（2026-09-19 复核后修正）**：上表分母是**库内全量**（active 题逐条
> `media_refs` 展开）59155 条公式 ref，故可渲染率 = 57753/59155 = **97.6%**。
> 初版写「99.6%」用的是**脚本日志口径** 57968（按卷去重，且把 1187 条 `asset_absent`
> 排除在分母之外）——57753/57968 = 99.63%。两个数字都对，但分母不同；
> **对外一律用 97.6%（库内全量口径）**，否则会漏掉「1187 条因 docx 缺该 media 而根本无法渲染」这一事实。
> 复核方式：`psql` 对 `exam_questions.media_refs` 做 `jsonb_each` 统计（2026-09-19）。
> 同口径图片：figure ref 58454，可渲染 54903（7149 渲染 + 47754 原生），不可渲染 3551
> （资产缺失 2584 + wmf/emf 未渲染 967）。

**机制**：`31-render-formula-assets.py` 从 `media_refs` 收 distinct wmf/emf（47044），
用 ImageMagick `convert -density 200 -background white -alpha remove -flatten` 渲染到
`out/media-png/<sha[:2]>/<sha>.png`（内容寻址、幂等），空白/失败**显式记录**；
`--apply` 回填 `media_refs.png_rel`（写前备份、值未变不更新）。读端 `questionTables.js`
有 `png_rel` 时优先渲染 PNG（`source='rendered'`）；`server.js` 挂 `/qb-media-png`。

**踩坑**：临时文件必须保留 `.png` 扩展名 —— ImageMagick 按扩展名推断输出格式，
`.part` 会写出非法 PNG（曾导致 200/200 被误判空白）。

## 四、验证
- `08-acceptance.py`：**G1–G17 = 17 PASS / 0 FAIL**
- `vitest`：**50 failed / 361 passed / 3 skipped**（与任务前基线一致）
- 读端抽样：`F:rId6` → `/qb-media-png/80/809c…png`，`renderable:true, source:rendered`
- 安全扫描（`5f3aa69`）：0 findings，门禁 pass（subprocess 非 shell=True、static 无穿越、路径受 sha 控制）
- 资产落盘（2026-09-19 复核）：`media_refs.png_rel` distinct **46522** 条，**磁盘缺失 0**
- 读端富化（真实数据跑 `enrichQuestionsWithTables`）：题 116952 → `⟦F:rId6⟧` 富化为
  `/qb-media-png/80/809c…png`，`renderable:true, source:rendered`
- **运行实例（2026-09-19 复核后重启）**：旧 3002 实例启动于 09-18 07:22（早于本提交），
  `/qb-media` 与 `/qb-media-png` 实测均 404 → 已在 3005 起探针实例冒烟通过后才切回 3002；
  现 `GET /qb-media-png/<sha路径>` → **200 image/png**，`/qb-media/<rel_path>` → **200**

## 五、诚实边界（残留）
1. **1187 条公式 ref 资产缺失**（`asset_absent`：docx 内无该 rId 的 media，或文件不在 `out/media`）
   → 无源可渲染，只能降级为「［公式］」标记。这是占比最大的一类（2.0%），初版把它排除在
   分母外才得出 99.6%，见上文口径说明。
2. **215 条真空白/转换失败**（distinct 522 张）→ 同样降级为标记，不伪造。
3. **OMML（483 题**，active、stem/解析/答案任一含 `⟦OMML`）仍是内联文本（`⟦OMML:x⟧` → 文本 x）；
   可确定性转 latex（pandoc 2.9 可用），单列后续。（初版写 324 题，为治理前口径。）
4. **VLM latex 明确不采用**：token 级绑定不可靠（≤20%），采用会引入错公式；若将来要 latex（KaTeX 高清），需先让 04 产出带 rId 的映射（管线改造）。
5. 渲染质量取决于 ImageMagick 对 MathType wmf 的保真度；极端复杂公式可能不如 VLM 渲染图，但**身份正确**优先。

## 六、路线图状态
- P2b 多模态读端：图片已渲染；**公式可见性本轮闭环（可渲染率 97.6%，库内全量口径）**。
- 剩余：P6 生产接线、P3 options（256 题）、P5 归属、P4 丢表、英语 KP / 答案缺口。
