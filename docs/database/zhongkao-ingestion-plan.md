# 中考题库接入方案

> 状态: **方案待批准** · 2026-09-17 · 前置: 高考部分已 100% 覆盖（1634/1634 卷, 36894 题）
> 关联: `scripts/qb-extract/README.md`（既有流水线设计）、skill `exam-paper-atomic-extraction`

---

## 一、语料现状（实测）

**位置**: `hermes_pack/zhongkao/2025年全国各地中考真题汇总（完整版）/`

| 项 | 数值 |
|---|---|
| 省/市级目录 | **32** |
| 学科目录 | **421** |
| 文件总数 | **1008** |
| 体积 | **2.4 GB** |
| 文件类型 | **515 pdf** · 246 zip · 132 rar · 45 docx · 32 jpg · 11 mp3 · 8 txt · 4 png · 2 doc |

覆盖 Top: 四川 107 / 江苏 100 / 山东 98 / 广东 96 / 湖南 61 / 吉林 46 / 河南 40 / 黑龙江 38 …

### 决定路线的关键事实

**❌ 515 份 PDF 全部是扫描图，没有文本层。**
抽 6 份实测：前 3 页提取文字均为 **0 字**，每页 3-6 张位图。
→ `pdfplumber` / `pymupdf` 文本提取**全部无效**，必须走**图像理解**。

**❌ 246 个 zip 里装的也基本都是扫描 PDF**（抽样 4 个：3 个 .pdf + 1 个目录名条目）。
且存在 **GBK 文件名乱码**（`2025─Ω╒≥╜¡╩╨╓╨┐╝...` 实为 `2025年镇江市中考历史真题（含答案）`）——
zip 中文名按 CP437 解码是常见历史遗留，解包时必须做编码回退。

**⚠️ 132 个 rar 无法解包**：`unrar`/`unar`/`7z` **均未安装**，`rarfile` 库未装。
`bsdtar` 可用，但对 rar5 支持不确定，需实测。

**⚠️ 学科词表要扩**（421 个学科目录去重后）：
`数学 39 / 语文 37 / 英语 36 / 物理 35 / 化学 34 / 生物 32 / 道法 31 / 地理 31 / 历史 31`
另需处理：`道德与法治`（= 道法别名）、`科学`、`生地会考`（生物+地理合卷）、`文科综合`。

**⚠️ 目录名有营销噪声污染**：出现「持续更新，保存文件夹更新自动提醒」「黑龙江绥化市中考真题答案持续更新，保存文件夹更新自动提醒」等被当成学科名的条目；还有把城市名（`连云港`/`青岛`/`长沙市`）放成学科层的情况。→ 需要一层目录归一化。

**⚠️ provinces 表的中考省份码只有 13 个**（beijing_zhongkao / chengdu_zhongkao / chongqing_zhongkao / guangzhou_zhongkao / hangzhou_zhongkao / jinan_zhongkao / nanjing_zhongkao / shanghai_zhongkao / shenyang_zhongkao / shenzhen_zhongkao / tianjin_zhongkao / wuhan_zhongkao / xian_zhongkao），而语料有 **32 个省/市** → 需要补省市码。

---

## 二、与高考路线的关键差异

| 维度 | 高考（已完成） | 中考（本方案） |
|---|---|---|
| 载体 | `.doc`/`.docx`（OLE / OOXML） | **扫描 PDF 图片** + zip/rar 包裹 |
| 解析器 | `ElementTree` 走 XML 树 + OLE 公式对象定位 | **VLM 页面理解**（图像→结构化题目） |
| 公式 | MathType OLE → WMF → docx→HTML 渲染 → VLM 转 LaTeX | 与题干同在图里，一次调用同时产出 |
| 答案 | 卷末集中 / 逐题内联 / 紧凑串 | 同页或后续页，靠 VLM 一次读出 |
| 定位 | 题号锚点切段 | 靠 VLM 输出结构化 JSON |

**结论**：中考不能复用高考的解析器主体，但**可以复用**：
- 媒体内容寻址去重（sha256）
- VLM 调用层（重试 / 缓存 / 并发 / JSON 解析容错）—— 已在 `04-vlm-formulas.py` 验证
- 质量分择优思想（页面切分方案之间择优）
- 四层验收指标（答案/解析/选项/严格可用率）
- dry-run + 对账 + ledger 留痕的写入纪律

---

## 三、分阶段实施

### P0 · 解包与归一化（0.5 天，无外部依赖）

1. **解包器** `05-unpack-zhongkao.py`
   - zip：`zipfile` + **GBK 文件名回退**（`name.encode('cp437').decode('gbk')` 试探，失败再退回原名）
   - rar：先试 `bsdtar -xf`；失败则装 `unrar`（`apt-get install unrar` 需 sudo）或用 `rarfile` + unrar
   - 产物落到 `database/incoming/zhongkao/<省>/<市>/<学科>/`，**不覆盖已有**
   - 幂等：已解包目录跳过
2. **目录归一化** `06-normalize-zhongkao-dirs.py`
   - 剔除营销噪声目录名（正则匹配「持续更新」「自动提醒」「保存文件夹」等）
   - 从任意层级抽取省/市/学科（学科词表见下），其余层级丢弃
   - 输出 `paper-index.csv`：`文件路径 → (省, 市, 学科, 年份, 载体类型)`
3. **学科词表**（映射到 `exam_questions.subject_code` 的 9 科 + 扩展）
   ```
   语文→chinese  数学→math  英语→english  物理→physics  化学→chemistry
   生物→biology  地理→geography  历史→history
   道法|道德与法治|政治→politics
   科学→science(新)  生地会考→biology+geography(合卷, 需拆)  文科综合→(需定)
   ```
4. **province_code 补充**：为 32 个省/市补 `*_zhongkao` 码到 `provinces` 表（需你确认命名规则：
   省统一考用 `xx_zhongkao`，市级单考用 `xx_zhongkao` 是否够？还是需要 `xx_city_zhongkao`？）

**验收**：解包出 N 份 PDF/docx，`paper-index.csv` 覆盖 32 省，无未分类文件。

### P1 · 扫描 PDF → 页面图 → VLM 结构化（1-1.5 天，核心）

5. **PDF 页面渲染** `07-pdf-to-pages.py`
   - 依赖：`pip install pymupdf`（无文本层也能渲染），或系统 `pdftoppm`（poppler-utils）
   - 输出：`out/zk-pages/<paper-hash>/p01.png`（150-200 DPI 平衡清晰度与体积）
   - 内容寻址去重：同一页多次出现（zip 与目录重复）只渲染一次
6. **VLM 页面理解** `08-vlm-page-parse.py`
   - 复用 `04-vlm-formulas.py` 的调用层（重试/缓存/并发/JSON 容错）
   - 提示词（一次调用产出一页的全部题目，省 token）：
     ```json
     {"questions":[
       {"number":1,"type":"choice|fill|solve","stem":"...","options":{"A":"...","B":"...","C":"...","D":"..."},
        "answer":"B","analysis":"...","sub_questions":[{"label":"（1）","text":"...","answer":"..."}],
        "formulas":["LaTeX..."],"has_figure":true,"figure_desc":"..."}
     ]}
     ```
   - 模型：`qwen3-vl-plus`（页面级理解比 flash 稳；单页 token 多，值得用 plus）
   - **跨页合并**：一题跨页（材料题）需按题号续接
   - 缓存键：页图 sha256
7. **跨页/跨文件去重**：同一份卷子出现在多个 zip/目录 → 按 (省, 市, 学科, 年份, 首题题干 hash) 去重

**验收**：抽 30 份卷子人工核对，题干/选项/答案准确率 ≥ 85%；产出结构化 JSON。

### P2 · 灌入（0.5 天，与高考共用）

8. 复用高考的 P2 流程：dry-run 对账报告 → 你审核 → 单事务写 `exam_papers` + `exam_questions` + `question_images` + ledger 留痕 + 幂等 + 可回滚
9. 中考卷子的 `exam_level='zhongkao'`，`province_code` 用新补的码

**验收**：严格可用率报表；`exam_level='zhongkao'` 的卷/题数与语料对齐。

---

## 四、成本与工期

| 阶段 | 工期 | 依赖 |
|---|---|---|
| P0 解包归一化 | 0.5 天 | 无（rar 需装 unrar，可能要 sudo） |
| P1 页面 VLM | 1-1.5 天 | `pymupdf` 或 poppler |
| P2 灌入 | 0.5 天 | P1 完成 + 你批准 dry-run |
| **合计** | **2-2.5 天** | |

**VLM 调用量估算**（这是主要成本项）：
- 515 PDF × 平均 6 页 ≈ **3100 页**；加上 zip/rar 解出的 PDF，估计 **5000-8000 页**
- 单页约 1500-2500 token（页面图 + 结构化输出）→ **约 1000-2000 万 token**
- 按 `qwen3-vl-plus` 计费需你确认单价；也可先用 `qwen3-vl-flash` 试跑 30 页对比质量再定
- 有 sha256 缓存，**重跑零成本**

> 先例参考：高考的 27k 公式图共调用约 3243+ 次（`qwen3-vl-flash`，均 485 tok），
> 中考是**页面级**调用，单次 token 高得多但次数少得多（页 vs 公式）。

---

## 五、风险与待决

| 风险 | 影响 | 缓解 |
|---|---|---|
| **扫描件质量参差**（歪斜/低分辨率/手写批注） | VLM 识别错误 | 抽 30 页先验；必要时提高 DPI 或前置纠偏 |
| **rar 解不开** | 132 个包（约 13% 语料）不可用 | 装 `unrar`（需 sudo）；或用 `bsdtar` 实测；最坏标为待补 |
| **`生地会考` 合卷** | 一页含生物+地理两科 | VLM 提示词要求按学科分段，或拆为两条记录 |
| **目录噪声 + 城市层级混乱** | 元数据错位 | P0 归一化 + 人工抽检 20 条 |
| **答案与题目不同页/不同文件** | 答案覆盖率低 | VLM 提示词显式要求「如有答案一并提取」；跨页合并 |
| **中考省份码命名** | 影响可寻址性 | **需你定命名规则**（见 P0-4） |

### 需要你拍板

1. **rar 怎么办**：装 `unrar`（要 sudo 密码已被 Hermes 拦截，需你手动执行 `sudo apt-get install unrar-free`）／先用 `bsdtar` 试／先跳过这 132 包？
2. **中考省份码命名**：32 个省/市的 `province_code` 规则？（现有高考用 `beijing`，中考用 `beijing_zhongkao`；市级单考如「深圳市中考」是用 `shenzhen_zhongkao` 还是 `guangdong_shenzhen_zhongkao`？）
3. **先试跑多少页**：建议先用 `flash` 试 30 页看质量与成本，再决定全量用 plus 还是 flash —— 同意否？
4. **`生地会考` / `文科综合` / `科学`**：这三类怎么建模（拆成两科？单独 subject_code？）

---

## 六、建议执行顺序

```
P0 解包 + 归一化 (0.5天)  →  产出 paper-index.csv + 解包文件
      ↓
P1-a 页面渲染 + flash 试跑 30 页 (2h)  →  你看质量、定模型
      ↓
P1-b 全量页面 VLM (1天, 后台跑)  →  结构化 JSON
      ↓
P2 dry-run 对账报告  →  你审核  →  灌入
```

---

**未经你批准，本方案不写任何数据库表。** P0/P1 产物全部落在
`database/preflight/qb-extract/`（中考可另起 `database/preflight/zk-extract/`）。
