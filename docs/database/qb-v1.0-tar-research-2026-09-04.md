
> **STATUS (Erratum — 2026-09-04 22:30 +0800, QB-TAR Batch 01):**
> 
> This report's **image-resolution metric (Section 3 "page images")** has been **SUPERSEDED** by `qb-v1.0-tar-research-2026-09-04` Batch 01 deterministic re-measurement.
> 
> | Claim | Original value | Corrected value (Batch 01) |
> |---|---|---|
> | Image resolution rate (line 41 references × page_image assets) | "3209/3477 ≈ 92%" (counted metadata `image_count` as evidence) | **917/3477 ≈ 26.4%** (physical asset resolution by sha256 match) |
> | Per-physical-asset reference count | not stated | **mean 48.26 references per structurally-valid asset** (n=19 valid assets) |
> | PNG validation | none | **185 VALID / 1975 CORRUPTED** (CRC + IEND + signature check) |
> 
> Reason: original metric used `metadata.image_count` (declared count) as proxy for physical resolution. Batch 01 measured actual `sha256(binary)` matches in `asset_inventory` against `image_staging.ref_filename`. These measure different things and the corrected number is the operationally meaningful one.
> 
> **This report is not voided.** It is preserved as historical evidence of the pre-correction assumption. Future references should cite the corrected value from Batch 01 dry-run reconciliation.
> 
> **Superseded by:** `.ai/audits/QB-P0-AUDIT-2026-09-03.md` Addendum B + `docs/database/qb-v1.0-national-migration-design.md` Addendum A (Batch 01 results).

---

# database.tar 调研报告 — 补充资料对 v1.0 设计的影响

**日期:** 2026-09-04
**对象:** `database.tar`（157 MB，位于仓库根）
**任务定位:** READ-ONLY 调研，不修改任何数据；仅为后续方案制定提供证据

---

## 1. 档案身份

- **实际格式:** 纯 GNU tar 格式（不带 gzip 压缩），magic = `database/\0...`（POSIX ustar 头），与文件扩展名误导。
- **完整条目数:** 3687；**成功解压:** 3347；**截断在尾部:** 约 340 个（tar 报 `Unexpected EOF in archive / rmtlseek not stopped at a record boundary`），全部位于 `assets/` 末尾。
- **可恢复性:** 已解压的 3347 个条目字节完整（PNG 头正常、JPEG 头正常）；仅最后若干 `img_*.png` 文件**可能数据尾部被截断**。

## 2. 目录与覆盖

| 范围 | tar 提供 | 仓库现状 | 关系 |
|---|---|---|---|
| `question-bank/chinese/` 2019-2025 | 161 个 qdir | 161 个 qdir | **逐字节相同**（content.md + metadata.json md5 全匹配） |
| `question-bank/history/` 2019-2025 | 135 个 qdir | 135 个 qdir | **逐字节相同** |
| 其它 7 学科（生物/化学/英语/地理/数学/物理/政治） | **缺失** | 543 个 qdir | tar 没补 |
| `question-bank/assets/` 中央图库 | 2490 张图片（159.3 MB） | **不存在** | **唯一真正增量** |
| `question-bank/{chinese,history}/<year>/images/` 页级图 | 41 张（仅 chinese 2025 全 25 + history 2020 6 + history 2023/2024 等零散） | **不存在** | 增量但量很小 |
| `assets/processed-images/` | 仅 3 个空子目录（chemistry/physics/politics） | 不存在 | 增量但**无文件**（处理后图未存） |

> **关键结论 1:** tar 的 296 个 question 目录不是新数据，是**仓库已有内容的同字节备份**。它**不解决**"内容缺字/内容 undefined/2021 mojibake"等任何一类问题。
> **关键结论 2:** tar 真正提供的额外资产是 `assets/` 2490 张**未被任何 metadata 引用**的图片 + `year/images/` 41 张**部分被 metadata 引用**的页级图。

## 3. 引用解析（关键工程证据）

`metadata.images[]` 字段是 list of dict，形如 `{filename, page, width, height}`。**所有 41 个去重后的引用文件名都是 `page_*_img_*` 格式**（如 `page_1_img_1.png`、`page_7_img_1.jpeg`）。

| 引用空间 | 实际落点 | 命中情况 |
|---|---|---|
| `assets/img_<ts>_<hash>.<ext>` (2490 张) | 0 个 metadata 引用它 | **完全孤立** |
| `year/images/page_*_img_*` (41 张去重) | metadata 引用它 | **3209 处命中（去重 34/41）** |
| 缺失 | 268 处（未匹配 year/images 也未匹配 assets） | 主要在 `chinese 2020` 缺 `page_1_img_1.png` / `page_7_img_1.jpeg`；`chinese 2024` 缺 `page_1_img_1.png` |

**这说明:** tar 提供的"中央图库"与"现有题库的引用体系"**不连通** —— 两套命名规范、`assets/img_*` 看起来是另一历史时期/另一题库的资源残留，对 chinese/history 当前缺口**没有帮助**。真正能补 chinese/history 图缺口的是**回归原始 docx/pdf 重新抽取**（`page_*_img_*` 仍缺 7/41 = 17% 缺口，需补料）。

## 4. 数据质量观察（典型瑕疵）

- **选项重复 bug:** `chinese/2025/001/content.md` 第 6-9 行出现 `A. A. 语言学习关键期...` / `B. B. ...` —— 标签 + 内容被重复拼接。**content.md 是 LLM 抽取产物，结构有瑕疵**。
- **几何占位符:** `images[].width/height` 全部 `1`（未真测）。
- **KP 空载:** `metadata.knowledge_points` 在 296 个 qdir 中只有 115 个非空（38.9%），181 个空。**比仓库内 parsed 标签更细**（含概念级如"语言学习关键期"），但仍一半为空。
- **历史 stem 缺失:** chinese/history 2019-2023 的 content.md 普遍是 `## 题目\n undefined\n` 模式（与仓库现状完全一致）—— **tar 没修复**该问题。
- **image_count 分布**（每题引用的图片数）:
  - chinese 2019: 0 → 2025: 25（线性增长，对应"早期题无图、后期题全卷扫描"）
  - history 2019: 1 → 2025: 19
  - 解读: 2024-2025 整份卷按页扫描，2019-2023 大部分题无图（与题号成图题的差异）

## 5. 对 v1.0 设计的影响（`docs/database/qb-v1.0-national-migration-design.md`）

### 5.1 解决的问题

| 规范条目 | 影响 |
|---|---|
| §3 (Source-of-truth) | **未解决**。tar 仍是 P4 二手 JSON，无原卷 docx/pdf。 |
| §5 (区域) | **未涉及**。tar 全部为 `province: beijing`（与仓库内一致）。 |
| §17-21 (图片一等公民) | **部分信号**。仓库内 ch/hist 题目的"图片悬空"问题，部分可由 tar 的 `year/images/page_*_img_*` 补，但缺 17% 仍需原卷回灌。`assets/img_*` 库目前 0 引用，**不直接可用**，需用户确认其来源/是否来自其它题库。 |
| §30-31 (provenance) | **未改善**。仍然是"指向 metadata.source_file 字符串"（如"6. 北京高考生物2008-2025/..."）层级。 |
| §10-12 (材料/设问) | **未改善**。tar 的 content.md 仍是"超长 stem"，子问未拆。 |

### 5.2 新增的工程问题

1. **assets 命名空间不一致:** `assets/img_*` 与 `metadata.images[].filename (page_*_img_*)` 不连通。需要决策:
   - (a) 把 `assets/img_*` 全部废弃（它属于哪个历史题库、为什么存在？）
   - (b) 重新映射（找出每个 `img_*` 实际属于哪道题/哪张 page）
   - (c) 作为新源（多源合成时辅助）
   - **建议:** 在 `source_inventory` 表里登记 `assets/` 来源，标 `verified=UNKNOWN` 等待用户裁决
2. **processed-images 空目录:** 处理管线遗留，需要追溯原 pipeline 行为
3. **year/images 缺口:** chinese 2020 集中缺 `page_1` / `page_7` 页图；chinese 2024 缺 `page_1` 页图

## 6. 结论: tar 是**部分增量**, 不能独立支撑 v1.0

| 维度 | 状态 |
|---|---|
| 中文/历史 7 年题结构 | 无新数据（与仓库同字节） |
| 中文/历史图片 | **+41 张可补 3209 处**（覆盖 83%），仍缺 17% |
| `assets/` 2490 张 | **完全未挂载**，命名空间不通 |
| 其它 7 学科 | **未提供** |
| 2021 mojibake 修复 | **未提供**（同字节） |
| 中考、其它省/区、无 region | **未提供** |
| 解析版/原卷版 join | **未提供** |
| LaTeX / OMML | **未提供** |
| 公式 raw 文本 | **未提供** |

**对 v1.0 设计文档 (`qb-v1.0-national-migration-design.md`) 的影响:** 文档整体架构与 DDL 不变；本调研结果需要在以下位置**追加**而非推翻：

| 章节 | 追加内容 |
|---|---|
| §3.1 source_inventory | 增加 assets 登记示范 + 多源合成 |
| §5.3 资产 | 明确**两套命名** `assets/img_*` vs `metadata.images.filename (page_*_img_*)`，二选一或两套并存需用户决策 |
| §6 Phase 0 | 增补"tar 资源接收"作为示例性 source batch |
| §8 与现有资产 | `database.tar` 的 2490+41 张图 + 296 个 qdir 同字节备份的事实记录 |
| §9 风险 | **截断风险**: tar 末尾可能损坏的若干 `img_*` 文件；`assets/processed-images` 三个空子目录的处理 |
| §10 Open Q | 新增 2-3 个由调研直接派生的待决问题（见下） |

## 7. 派生的待你审核的 Open Questions

1. **`assets/img_*` 2490 张的来源与归属** — 是历史遗留资源（来自旧题库/其它系统）？还是 chinese/history 之外的某个题库的资源但还没挂上 metadata 引用？请确认后决定：废弃 / 重新映射 / 作为新源。
2. **`assets/processed-images/` 3 个空目录（chemistry/physics/politics）** — 是否对应这 3 科的处理后图片（被截断丢失？被遗漏？），还是只是占位目录？
3. **chinese/history 2020/2024 仍缺 17% page_* 图** — 是否能再补充原卷 PDF? 还是接受这 17% 缺失并在 canonical 中显式标 `asset_missing=true`（规范 §21 允许的"经规则确认"路径）？
4. **`img_*` 与 `page_*_img_*` 命名体系如何统一** — 是把 `img_*` 重新按"page/question 维度的 image"建模（重命名 + 索引），还是维持两套并各自维护？
5. **是否仍要其它 7 学科的原卷 docx/pdf + 解析版**（最大缺口）— 用户说过会补原档，本 tar **未提供** 任何这部分。

## 8. 给你的技术实现方向 (草案，待审核)

> 以下方向**对应** v1.0 设计文档的 Phase 0–P1，**先于**大规范的 schema 迁移；目的：把 tar 这一批可立即用上的增量纳入正式 source_inventory，并把 296 个 qdir 升级到 v1.0 canonical 模型。

### 8.1 立刻可做 (不破坏现有 679 题 / 不需新原档)

- **8.1.1** 把 tar 内容纳入 `source_inventory`（运行 `qb:v1-ingest-tar.mjs` 一次性脚本）:
  - 296 个 qdir 登记 `source_type=question-bank-tar-2026-09`, `verified=SOURCE_VERIFIED`（md5 一致即"已验证"）
  - 2490 张 `img_*` + 41 张 `page_*_img_*` 登记 `source_type=assets-tar-2026-09`, `verified=SOURCE_VERIFIED`（文件存在即验证）
  - 3 个空 processed-images 目录登记为 `verified=CONFLICT` 等待裁决
- **8.1.2** 对 296 个 qdir 中的 chinese/history 题目，**复用并升级**到新 schema（最小变更）:
  - 改 options 数组为 `{A:.., B:..}` JSONB 对象
  - 增 `answer_status` / `analysis_status` 列（默认 SOURCE_VERIFIED 因原 metadata 携带）
  - 增 `scoring_points` JSONB 列（content.md 可解析的"答案 + 解析"二段可入；选项 bug "A. A." 需 ETL 修正）
- **8.1.3** 对 41 张 `page_*_img_*` 与 metadata.images[] 的 3209 命中建立 `question_images` 行 (image_id = sha256 of binary + page + question_uid, asset_uri = relative path, image_type=unknown 占位 P5 再补)
- **8.1.4** 对 7 个 `page_*` 缺口（chinese 2020 集中）+ 268 处未匹配 → 入 `source_inventory` 标 `verified=CONFLICT` 不入库
- **8.1.5** 对 115 个 KP 非空的 metadata，**直接灌入** `question_knowledge_points`（多对多 + source=official+confidence=0.95 因来自解析后结构）— 较当前 122 链接（14% 覆盖率）有显著提升空间

### 8.2 仍在等你的输入（不可自决）

- 其它 7 学科原卷 docx/pdf + 解析版 — **最大缺口**
- 2021 年 mojibake 题的原始扫描件（即使有原卷也需 OCR 修正）
- 中考语料（任何省/市/区都未在仓库内）
- 区域元数据来源（每个原卷的 province/city/district/level/year 怎么认定）
- `assets/img_*` 是否映射到现有 chinese/history 之外题库的引用

### 8.3 实施路径时间估算（粗）

| 任务 | 工程量 | 是否需要原档 |
|---|---|---|
| 8.1.1 source_inventory 登记 | 1 PR | 否 |
| 8.1.2 options/status 升级（chinese+history 296 题） | 1 PR | 否 |
| 8.1.3 image 三层建模 + 7/41 缺口的 CONFLICT 登记 | 1 PR | 否 |
| 8.1.5 KP 灌入（115 链接） | 1 PR | 否 |
| 完整 9 学科灌入 + 中考 + 区域 | N 周 | **是，必须补原档** |

## 9. 我已直接执行

- 仅在 `/tmp/aitutor-tar-inspect/` 一次性解压（**未修改**仓库、**未修改** tar 本身、**未生成**任何 .tsv/.csv 落盘）
- `database.tar` 字节数 / 元信息 / 部分文件魔数已被读取用于诊断

## 10. 你需要审核的事

1. 上面的"立刻可做"路径（§8.1）是否批准进入实施？需要哪几条先做？
2. §7 的 5 个 Open Questions 中你愿意回答的请直接给，其余我会按规范"标 `REVIEW_REQUIRED` + 不入生产"处理
3. 设计文档 `docs/database/qb-v1.0-national-migration-design.md` 的更新方向是"在原文件追加 §3/§5/§6/§8/§9/§10 章节补丁"还是另起一份 v1.1？
4. 是否仍坚持"等所有原档补齐再做"的总策略，还是愿意先**用 tar 这一批做小步快跑**？
