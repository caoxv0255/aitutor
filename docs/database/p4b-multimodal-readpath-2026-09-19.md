# P2b 多模态读端可达 — 治理前后对比报告 (2026-09-19)

> 路线图第 1 项（按「影响面 ÷ 风险」排序的最高杠杆项）。
> 提交 `d04c0ad`；迁移 `036_question_media_refs.sql`；回填 `30-backfill-media-refs.py`。

## 一、治理前（Before）

**症状**：`qbx` 抽题时把图片/公式替换成占位符，但**从未持久化 rId→资产 的映射**，
读端也没有任何展开器 → 这些占位符**原样显示给用户**。

| 指标 | 实测 | 出处 |
|---|---|---|
| 任一字段含裸 ⟦IMG:⟧/⟦F:⟧/⟦OMML⟧ 的 active 题 | **14790（占 36609 的 40%）** | 库内实测 |
| — stem 里含 | 11021 | 同上 |
| — analysis 里含 | 8264 | 同上 |
| — options / answer 里含 | 3969 / 1466 | 同上 |
| 已有媒体资产文件 | 88464 个（`out/media`，**文件都在**） | 文件系统 |
| 媒体资产表（无读端消费者） | `question_images` 72337 / `question_formulas` 11039 行 | api/ 零查询 |
| rId → 资产 的持久映射 | **无** | 05-ingest 写的是「按题顺序列表」，无 rId |
| `/qb-media` 静态路由 | **无** | server.js |

即：**资产在磁盘上齐全，但没有任何一条链路把 token 连回资产**。

## 二、做了什么（机制）

1. **migration 036**：`exam_questions.media_refs JSONB`（键 = `"kind:rId"`，值 =
   `{kind, sha256, ext, rel_path, latex?}` 或 `{missing}`）；幂等 + 部分 GIN 索引。
2. **回填 `30-backfill-media-refs.py`**：重跑 `extract_paper` 取每题 `q['media']`，
   直接由 docx 内 `word/media/*` 算 sha256 → `rel_path`（与 `qbx.store_media` 同口径）；
   **rid→资产是整份 docx 全局关系**，故建卷级 map 按 token 查，不做题号对齐
   （题号一卷内可重复）；公式再查 `out/vlm/<sha>.json` 取 latex。默认 dry-run + 备份 + 幂等。
3. **读端**：
   - `api/services/questionTables.js` 增 `enrichQuestionsWithMedia`（返回 `media`：
     `{token,kind,url,renderable,latex?,missing?}`），并让既有的表格富化函数一并调用；
   - `server.js` 挂 `/qb-media` → `database/preflight/qb-extract/out/media`（内容寻址，immutable）；
   - `ai-tutor-frontend/assets/js/utils/placeholder-render.js` 渲染 `<img>` / latex / OMML 文本；
   - `exam-pdf.js` / `paperGenerator.js` 纯文本出口用 `placeholderToText` 兜底；
   - `question-bank.html` 详情/列表接入（列表显示 `[图]/[式]` 标记，不切断 token）。

## 三、治理后（After）

| 指标 | Before | After |
|---|---|---|
| 裸 token 直达读端（任一字段） | 14790 题 | **0 题**（全部经 media_refs 富化；解析不到降级为「［图片］/［公式］」，绝不显示 ⟦…⟧） |
| 有 rId→资产 映射的题 | 0 | **14706（99.4%）** |
| 回填的资产引用（ref） | 0 | **117609**（图片 **55870** / 公式 57968 / 显式缺失 3771） |
| 资产文件缺失 | — | **0**（117609 ref 中 0 个 `asset_absent` 由文件缺失引起） |
| `/qb-media` 静态路由 | 无 | 有 |
| 图片可渲染 | 否 | 是（`<img src="/qb-media/<rel_path>">`） |
| 公式（有 latex） | 否 | 渲染 latex |
| 公式（无 latex） | 裸 token | 「［公式］」标记 |
| G1–G17 验收 | 17 PASS | **17 PASS / 0 FAIL** |
| vitest | 50F/361P/3S | **50F/361P/3S（基线，无回归）** |

**覆盖**：1450/1460 卷、14706/14790 题（99.4%）已拿到确定性映射；剩余 84 题带 token
但无法回填（无 docx / media 列表缺该 rId），读端降级为标记，不显示裸 token。

**渲染器单测**（DOM stub）：`图⟦IMG:rId2⟧式⟦F:rId9⟧latex⟦F:rId8⟧o⟦OMML:x+y⟧` →
`<img src=/qb-media/x.jpeg>` + `［公式］` + `span.latex` + `span(文本)`，**无裸 token**。

## 四、诚实边界（残留，未解决）

1. **公式 latex 命中 0**：VLM 缓存 `out/vlm/<sha>.json` 按 **HTML 渲染图**（gif/png）
   的 sha 建键，与 docx 内 **wmf** 的 sha **不同源** → 直接查表 0 命中。
   需用 `out/html/<卷>.json` 的 `para_idx` / `question_number` 把「HTML 图 ↔ wmf」
   再对一次才能拿 latex。故本轮公式降级为「［公式］」——**去掉了裸 token，但没显示公式本体**。
2. **wmf/emf 不可浏览器渲染**：即使给出资产 URL 也只能下载，不能内联；`out/render` 的
   公式 PNG 仅 80 张（03-render-media 未全量跑）→ 若走「渲染图」路线需先补跑。
3. 84 题未覆盖（见上）。

## 五、对总体 gap 的影响

此项把「多模态读端不可达」从 **40% 题** 降到 **0 裸 token**：
- 图片（占 ref 47%）**已实际渲染**；
- 公式（占 ref 53%）**去掉裸 token**，但仍是占位标记 —— 真正的「公式可见」需解决 (1)(2)。

**下一步建议**（路线图剩余）：
1. **P6 生产接线**（让后续变更自动生效）；
2. **P2b 残留**：公式 latex 对齐（用 `out/html` 再对一次）+ `03-render-media` 补跑；
3. **P3 options 治理**（256 题，硬伤）；
4. P5 归属 / P4 丢表；英语 KP / 答案缺口另立项。
