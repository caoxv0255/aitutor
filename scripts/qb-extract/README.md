# qb-extract — 原卷原子化提取流水线

> P1 交付物 · 2026-09-17 · 状态: **dry-run (未写任何数据库表)**

把 `database/incoming/` 下的 **1634 份高考原卷**（`.doc` / `.docx`，9 学科 × 2008-2025）
重新解析为**原子化题目**（题干 / 选项 / 答案 / 解析 + 公式与图片载体），产出可审计的
JSON 产物与覆盖率报告，供后续 P2 灌入 `public.exam_questions` 使用。

---

## 一、为什么需要这条流水线（根因）

库内现有 6219 题的 `stem` 大面积空洞（如 `已知集合，，则（    ）`）、选项正文全空
（只剩 `A. B. C. D.`）、`latex_formulas` / `image_descriptions` / `raw_image_path`
全 0、`question_formulas` 0 行、`question_images` 601 行路径在磁盘上不存在。

实测根因（2026-09-17，北京2024数学卷为证）：

| 事实 | 证据 |
|---|---|
| 原卷是健康的 | `database/incoming/gaokao` **1634 份 / 1.6 GB**，1596 份文件名带「解析卷」= 题干+答案+解析齐全 |
| **公式载体是 OLE 对象** | 公式存成 MathType / Equation 3.0 的 `<w:object>`，内嵌 `<v:imagedata r:id>` 指向 `.wmf`。该卷 **698 个**，而 OMML `<m:oMath>` = **0** |
| 老流水线只认浮动图 | 只扫 `<a:blip>`（该卷仅 12 个），698 个公式全丢 → `stem` 出现空洞 |
| 现有 6219 题来源是矿渣 | 来自 `database/question-bank/*/content.md`（LLM 抽取的 markdown，审计实测 **71.1% 是 `undefined`**），不是原卷 |
| `database.tar` 指望不上 | 尾部截断；`asset_inventory` 2134 张 QUARANTINED、1975 张 PNG CRC 损坏；且其 `assets/img_*` 命名体系与题库引用体系不连通 |

**结论**：题型 / 答案 / 解析 / 公式一直在原卷里，只是从未被正确读取。

---

## 二、流水线

```
Stage 01  01-convert-docs.py   .doc ──libreoffice──> .docx (cache, 幂等续跑)
Stage 02  02-extract.py        .docx ──qbx.py──────> 原子题目 JSON + 媒体 + 报告
```

### 目录

```
database/preflight/qb-extract/
├── docx-cache/            # Stage 01 产物: <exam_level>/<subject>/<year>/<name>.docx
├── lo-profile/            # 每 worker 独占的 libreoffice profile (避免锁争用)
├── convert-manifest.json  # Stage 01 运行报告
└── out/                   # Stage 02 产物 (dry-run 全部落这里)
    ├── papers/<...>/*.json    # 每份卷一个: identity + 全部原子题目 + 统计
    ├── media/<subject>/<year>/<sha2>/<sha256>.<ext>   # 内容寻址, 全局去重
    ├── paper-index.jsonl      # 卷级索引 (每次从 papers/ 重建, 幂等)
    ├── report.json            # 机器可读汇总
    └── REPORT.md              # 人读汇总 (分学科/分年份/低覆盖清单)
```

### 命令

```bash
# Stage 01: .doc → .docx (1137 份; 497 份原生 .docx 无需转换)
python3 scripts/qb-extract/01-convert-docs.py --dry-run      # 只统计
python3 scripts/qb-extract/01-convert-docs.py --workers 4    # 全量转换
python3 scripts/qb-extract/01-convert-docs.py --limit 20     # 限量

# Stage 02: 原子化提取 (严格 dry-run, 不碰数据库)
python3 scripts/qb-extract/02-extract.py --dry-run           # 列工作集
python3 scripts/qb-extract/02-extract.py --workers 5         # 全量
python3 scripts/qb-extract/02-extract.py --no-media          # 跳过媒体落盘 (快 2-3x)
python3 scripts/qb-extract/02-extract.py --subjects math,physics
python3 scripts/qb-extract/02-extract.py --force             # 忽略已有产物重跑
```

两个 Stage 都可**中断续跑**：Stage 01 比对 mtime 跳过已转换的；Stage 02 跳过已存在的产物 JSON。
Stage 02 的 `--dry-run` / `--force` 之外的行为是「增量补齐」——所以在 Stage 01 跑的过程中先跑
Stage 02 是安全的，等 `.doc` 全转换完再跑一次即可补齐剩余部分。

---

## 三、解析器设计（`qbx.py`）

### 3.1 段落遍历必须走 XML 树，不能用正则

`<w:p>` 的段落里含 `<w:pPr>`（其中又有 `<w:tabs>`、`<w:spacing>` 等），
用 `<w:p[ >].*?</w:p>` 匹配会被这些内层标签污染，切出半截 XML。必须用
`ElementTree` 按文档顺序遍历，遇到 `w:t` 取文字、`v:imagedata` 记公式位置、
`a:blip` 记图片位置。

### 3.2 答案的四种排布（都支持）

| 排布 | 例 | 处理 |
|---|---|---|
| 逐题内联 | `【答案】A` / `【解析】` / `【详解】` | 行内锚点路由 |
| 卷末集中答案区 | `…选择性考试生物·答案` 之后整块 | 定位区块 → 按题号解析 → 回填 |
| 答案区在头部 | `参考答案与试题解析` 在前、题目在后 | 同上，但**不屏蔽正文** |
| 学科网五段式 | `考点：/专题：/分析：/解答：/点评：` + 正文里 `故答案选D．` | 解析段锚点 + 从解析正文反推答案 |
| 紧凑答案串 | `1\`5. CBAAB   6~10.CDBCB   11~13.DBA` | 专用展开器（支持 `1-5`/`6~10`/`21.B`） |

### 3.3 布局策略自动择优（关键设计）

各卷的答案排布差异极大，用单一锚点规则会陷入「修一个坏一个」的地鼠效应。
`candidate_layouts()` 给出全部合理候选（`inline` / `tail` / `answer_only`），
`extract_paper()` 每个都真跑一遍，用质量分择优：

```
score = 0.35·答案覆盖 + 0.15·解析覆盖 + 0.10·选项覆盖 + 0.10·题型已知率 + 0.30·严格可用率
```

例：英语陕西2014 的「内联【答案】」既可能是正文内联（语文广东2011），也可能是
卷末集中答案区的逐题标记 —— 靠锚点无法区分，只能靠实测覆盖度裁决（该卷 `tail`
策略 49 答案 vs `inline` 策略 1 答案，择优器正确选中 `tail`）。

### 3.4 题号锚点

题号**单调递增**即视为新题；另允许 `n == 1` 重启（部分卷子的大题/答案区会重新编号）。
早先只在「+1 或 +3 以内」接受新题号，实测把英语陕西2014 从 52 题压成 5 题。

### 3.5 媒体：内容寻址 + 全局去重

媒体按 `sha256` 落盘到 `media/<subject>/<year>/<sha2>/<sha256>.<ext>`，
同一公式在多题出现只存一份（公式重复率高，省大量空间与 inode）。
题目里保留 `⟦F:rId⟧`（公式）/ `⟦IMG:rId⟧`（图片）位置标记，与 `media_stored` 数组对应。

**Web 展示**：`.wmf` 浏览器不能直接显示。已实测两条可行路径：
1. `libreoffice --convert-to html` 会把 OLE 公式**按原位渲染成内联 GIF、尺寸正确**
   （北京2024数学卷 711 个 `<img>`）—— 推荐，一次拿到全部公式图且无需处理裁剪
2. `libreoffice --convert-to png` 单个 `.wmf`，但输出是 A4 画布（794×1123），需额外 `-trim`

---

## 四、公式 / 图片的 VLM 理解（`04-vlm-formulas.py`）

### 4.1 路线决策（实测依据）

| 方案 | 实测结果 | 结论 |
|---|---|---|
| 逐张 WMF → `libreoffice --convert-to png` → VLM | **80 张里 55 张渲染成全白空画布**（像素全 255）。MathType/Equation3.0 的 OLE 公式脱离文档上下文后渲染失败 | ❌ 作废 |
| 整份 docx → HTML → VLM | 北京2024数学卷 **496 张图里 495 张有内容**（公式中位 96×43，插图 946×787），尺寸已正确、无需裁剪 | ✅ 采用 |

HTML 路线还有两个额外收益：
1. **保留段落结构** → 每个公式都能拿到**上下文文字**（`Object1` 的上下文是 `1. 已知集合 ， ，则 （ ）`），
   既能把公式挂回正确题号，也能提升 VLM 识别准确率
2. 公式（`name="ObjectN"`）与插图（`name="ImageN"`）天然区分，可分别用不同提示词与模型

### 4.2 实测识别质量（北京2024数学卷，qwen3-vl-flash）

| 位置 | 上下文 | VLM 输出 |
|---|---|---|
| Q1 Object1-3 | `1. 已知集合 ， ，则 （ ）` | `M = \{x\mid -4<x\leq 1\}` / `N = \{x\mid -1<x<3\}` / `M \cup N =` |
| Q1 选项 | `A. B. / C. D.` | `\|x\|-4<x<3`、`\|x\|-1<x\leq 1`、`\{0,1,2\}`、`\|x\|-1<x<4` |
| Q2 详解 | `【详解】由题意得` | `z = i(i-1) = -1-i` |
| 插图 | （物理散点图） | 语义：`图2包含两个散点图：左图横轴为t/s…数据点呈下降趋势；右图横轴为t/s，纵轴为v，数据点呈上升趋势`<br>图中文字：`y, t/s, O, 图2` |

**交叉验证**：库内 Q2 答案 = `C` = `-1-i`，与 VLM 读出的解析完全一致。

### 4.3 模型选择

经 `vlm-model-bench.py` 对比（`qwen3-vl-plus` / `qwen3-vl-flash` / `qwen-vl-ocr-latest`）：
三者输出内容基本一致，但 **flash 快 3-4 倍**（0.32s vs 1.4s），**统一用 `qwen3-vl-flash`**。

> 准确率度量的坑：用「LaTeX 回渲 + 逐像素 IoU」评估时，即使公式完全读对，分数也只有 ~0.3 ——
> 因为原图是 MathType 位图、回渲是 matplotlib 字体，**字形差异**被算成了误差。
> 该指标只有**相对排序**有效（同一 LaTeX 自比 1.0 / 近似 `\frac{a}{c}` 0.51 / 无关 0.06）。
> 绝对准确率请以 §4.2 那种「原文上下文 vs VLM 输出」并排核对为准。

### 4.4b 空白图前置过滤

语料里有一部分空图（只剩水印/纯白），送去 VLM 只会返回「图中为空白，无任何可见元素」，
纯浪费调用。`04-vlm-formulas.py` 内置了像素级前置过滤：

```
墨迹像素 <= 20  →  判为空白, 不发起 VLM 调用, 直接写 {blank: true, ink_pixels: N}
```

**阈值依据（用 8724 条已有 VLM 结果做验证集，VLM 严格判定空白 96 条）**：

| 指标 | 值 |
|---|---|
| precision | **0.989** |
| recall | **0.917** |
| 误杀非空白 | 1 / 600（该图 `ink=0`，实际就是空图 —— 是 VLM 判错，不是过滤器误杀） |
| 非空白图墨迹下界 | 55 px（所以 20 的门槛很安全） |

**用「绝对墨迹像素数」而不是「占比」**：小尺寸公式图的总像素本来就少，占比会误判。
读不了的文件当非空白处理（交给 VLM 判），不误杀。

**实测全库空白率仅 1.0%（550 / 56158 个 media-html 文件）** ——
过滤是纯收益（零误杀、省 550 次调用 ≈ 0.27M token），但**别指望它省大钱**：
这个语料的空图比例很低。真正的成本大头是 3.5 万个有效插图与公式。

跑验收测试：

```bash
python3 scripts/qb-extract/test-blank-filter.py 10
```

输出三段：① 分类器 precision/recall（离线，不占网络）② 全库空白率扫描
③ N 卷端到端（挑未被处理过的卷子，对比有无过滤的调用量）。

### 4.4c 两个必须知道的踩坑（都实测过）

**① 端点有硬性并发上限（实测约 12），超出时返回 HTTP 400 —— 不是 429。**
这个结论是从三组数据对出来的：

| 场景 | 并发 | 失败率 |
|---|---|---|
| 单独调用（无并发负载） | 1 | **0%**（同一张图稳定返回正确结果） |
| 主任务 | 12 worker | **0.83%**（125 / 14975） |
| 我的测试脚本 与 12 worker 主任务同时跑 | 13+ | **100%**（17 / 17 全是 400） |

即：并发贴着上限时偶发 400；一旦超过上限，新来的请求被整体拒掉。
所以 —— **并发取 8，留出余量**；报错必须重试（退避后负载下降即可成功）。

`vlm_call` 因此必须：**4xx 也重试**（4 次，指数退避 + 抖动），
并且**把错误体读出来** —— 否则日志里只有 `HTTP Error 400: Bad Request`，无法定位。

> 失败项不写结果文件，所以**下一轮会自动重跑**（sha256 缓存天然自愈），不会永久丢数据。

**② 阶段 A（docx→HTML）不能用 `i % html_workers` 分配 worker。**
这与 `01-convert-docs.py` 里那个 profile 争用是同一个 bug：
不同批次落到同一个 LibreOffice profile 时，`soffice` 的 profile 锁互相阻塞，
**表现为静默失败**（`docx_to_html` 返回 None，被跳过，不报错）。
实测后果：1634 份只渲染出 **1068 份（65%）**，剩余 566 份无声无息地没有 HTML，
于是它们的媒体也永远不会进 VLM —— 34.6% 的语料静默丢失。
必须**按 worker 分片**（`items[i::workers]`，每人独占 `html{i}` profile），并显式打印失败数。

> 教训：这类「静默跳过」比报错危险得多。凡是返回 None / 空集合被跳过的分支，
> 都要统计并打印出来对账（`成功 N / 总数 M`），否则覆盖率缺口没人发现。

### 4.4d 选项切分：两种形态都要认（实测把粘连率从 19.31% 打到 0.03%）

症状：一道题的四个选项全被塞进 A（`A: 上图所示过程…B. 细胞的…C. 核仁…D. 核糖体…`）。
根因有**两个**，要分别修：

**形态 1 —— 每行一个选项。** 源文档里 `A. …` / `B. …` / `C. …` 各占一段。
旧规则「首锚点必须是 A，否则需 ≥2 个锚点」是为**题干区**防误判设计的，
却被选项续行区共用 —— 于是孤零零的 `B. …`（只有 1 个锚点、又不是 A）被判成
「非选项行」，走 else 分支**拼接到上一选项**上。

**形态 2 —— 标签紧贴前文。** `A. startB. have startedC. startedD. had started`
（A 选项正文直接续上 `B.`）。旧正则 `(?<![0-9A-Za-z])([A-D])\s*[.．、]` 的前瞻断言
把紧跟拉丁字母的 `B./C./D.` 全部拦掉，只剩 A 锚点 → 整行并进 A。

**现在的做法**：候选正则为 `([A-D])\s*[.．、]`（**去掉前瞻断言**），
再**只保留构成 A→B→C→D 严格递增序列的锚点**（`_anc()`）。
序列过滤天然排除词内字母（`rRNA`/`DNA` 后无点号，即使有也会被序列规则剔除），
同时吃到紧贴前文的标签。判定规则则按区域分开：
题干区仍从严（必须 A 且靠行首），选项区从宽（行首单个 B/C/D 即新选项）。

**实测（1634 卷全量，同口径对比）：**

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 选项粘连 (B/C/D 挤进 A) | 4121 / 21338 = **19.31%** | 6 / 21190 = **0.03%** |
| 选项齐全 (ABCD 俱全) | 10234 = **47.96%** | 19137 = **90.31%** |
| 总题数 | 36894 | **37056**（+162，原本被粘连吞掉的题切出来了） |
| 有答案 / 有解析 | 55.22% / 70.25% | 55.19% / 70.18%（持平） |
| 严格可用 (题干+答案+解析) | 19056 | 19135（+79） |
| 分学科粘连率 | 生物 40.3% / 化学 32.4% / 语文 28.3% / 英语 23.2% | **全部 0.00–0.12%，无一学科变差** |

> 注意：**严格可用率几乎没动**（51.65% → 51.64%）。因为该指标要求题干+答案+解析，
> 而选项不属于它。这次修的是**选项完整度**（47.96% → 90.31%），
> 下一步的瓶颈在答案（55.2%）与解析（70.2%）。

量化脚本：`measure-quality.py`（`--save` 存基准 / `--compare` 出对比表，含分学科）。

### 4.5 产出与缓存

```
out/html/<exam_level>/<subject>/<year>/<name>.json   每卷: 公式/图片清单 + 上下文 + 归属题号
out/media-html/<sha2>/<sha256>.<ext>                 内容寻址的公式/图片本体
out/vlm/<sha256>.json                                VLM 结果缓存 (latex / semantic / reading / tokens)
out/vlm-index.jsonl                                  全库 VLM 结果索引
```

图片按 **sha256 全局去重**（同一公式在全库只调用一次 VLM），结果按 sha256 缓存 —— **重跑零成本**。

```bash
python3 scripts/qb-extract/04-vlm-formulas.py --dry-run
python3 scripts/qb-extract/04-vlm-formulas.py --limit 5 --max-calls 40
python3 scripts/qb-extract/04-vlm-formulas.py --workers 12 --html-workers 3
python3 scripts/qb-extract/vlm-model-bench.py /tmp/htm2 10 'qwen3-vl-flash,qwen3-vl-plus'
```

**凭据**：`~/.secrets/aliyun_maas_key` + `~/.secrets/aliyun_maas_base`（600 权限，不在仓库内）。
端点 `https://llm-ecz0dfm8sux9p8y6.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`（253 个模型可选）。

### 4.5 映射到库表

| 产物字段 | 目标列 |
|---|---|
| `latex`（公式） | `exam_questions.latex_formulas` / `formula_semantics` |
| `semantic` + `reading`（插图） | `image_descriptions` / `semantic_description` |
| 媒体 sha256 + 相对路径 | `question_images.file_path` / `asset_uri` / `status` |

---

## 五、安全边界

| 约束 | 状态 |
|---|---|
| 不写 `public.exam_questions` / `exam_papers` / `question_knowledge_points` / 任何核心表 | ✅ 只读 |
| 不写 `qb_recovery.*` | ✅ |
| 不修改 `database/incoming/`（只读源） | ✅ |
| 写入范围 | 仅 `database/preflight/qb-extract/` |
| 可重跑 | ✅ 中间产物比对 mtime / 已存在即跳过 |
| 可审计 | ✅ 每卷产物含 `identity` / `doc_kind` / `strategy_score` / `stats` |

---

## 五、当前实测覆盖率

见 `database/preflight/qb-extract/out/REPORT.md`（全量跑完后为该文件真值）。

对标基线（同一批卷）：

| 指标 | 库内现状 (6219 题) | qb-extract |
|---|---|---|
| 严格可用率（题干≥20字＋有答案＋题型已知） | **9.2%** | 见 REPORT.md |
| 答案覆盖 | 42% | 见 REPORT.md |
| 解析覆盖 | 41% | 见 REPORT.md |
| 公式 / 图片载体 | **0**（`question_formulas` 0 行） | 见 REPORT.md |
| `question_type='unknown'` | 88.4% | 见 REPORT.md |

### 已知调优待办

- **纯答案卷**（文件名带「答案卷」或全文仅答案，如 化学海南2018 / 语文浙江2016）本身不含题干，
  需与其「原卷」配对（全库仅 10 份答案卷，影响面小）
- **语文类长材料题**的小问拆分与答案定位
- 部分老卷（2008-2012）题干残缺严重，`REPORT.md` 的「低覆盖卷」清单是调优队列

---

## 六、与 P2（灌入）的衔接

`paper-index.jsonl` 提供的 `(year, province, subject, paper_type, exam_level)` 是
匹配 `public.exam_papers` 的键；`questions[].number` 匹配 `exam_questions.question_number`。
注意库内 `(year, province, subject, question_number)` 有 101 个歧义键，
**必须带 `paper_type` 才是全库唯一**（加 `paper_type` 后歧义 0）。

P2 写入必须：单事务 + `canonical_migration_ledger` 留痕 + 幂等 + 先出 dry-run 对账报告。

---

## 八、别踩的坑

1. **不要用正则切 `w:p`** —— 会吃到 `<w:pPr>` 里的标签，切出半截 XML。必须走 `ElementTree` 树遍历。
2. **libreoffice 每个并发 worker 必须独占自己的 `-env:UserInstallation` profile。**
   用 `i % workers` 给批次贴 worker id 再并发提交会让不同批次落到同一 profile，
   soffice profile 锁互相阻塞，实测吞吐从 **240 掉到 8 文件/分钟**。正确做法是**按 worker 分片**。
3. **只杀 `soffice.bin` 会让 `oosplash` 立刻重生一个 soffice 重试同一个文件**，表现为
   「永远卡在同一批」。必须**先杀 oosplash 再杀 soffice.bin**。见 `kill-lo.py`。
   配套措施：批超时要短（120s，不要 900s）、批失败后**逐文件重试**隔离坏文件、
   永久失败清单落盘（`convert-failed.json`）让下次直接跳过。
4. **`pkill -f 'soffice'` / `pkill -f 'lo-profile'` 会杀掉你自己** —— 若当前命令行里含同样字符串，
   `pkill -f` 会匹配到调用者自身。改用 `scripts/qb-extract/kill-lo.py`（按**可执行文件路径前缀**匹配）。
5. **目录结构是 `<exam_level>/<subject>/<year>/`**（`gaokao`/`zhongkao` 在前），
   按目录反推学科时必须跳过 `exam_level` 层，否则 `subject` 会变成 `gaokao`。
6. **答案区定位不要预先否决候选** —— 交给质量分择优，见 §3.3。
7. **libreoffice 导出的 HTML 里 `<img src>` 是 URL 编码的**（中文变百分号编码），
   取路径前必须 `urllib.parse.unquote`；且 `name` 属性可能在 `src` 之前，正则不能写死属性顺序。
8. **不要用单张 WMF 转 PNG 喂 VLM** —— 见 §4.1，大部分会渲染成全白空画布。走 docx→HTML。
9. **评估公式识别准确率不要只看逐像素 IoU** —— 跨渲染器的字形差异会淹没误差，见 §4.3 的说明。
