# D090 — KP 覆盖率 9.91% → 57.52%（2026-09-14）

**Date:** 2026-09-14
**Status:** 🟢 EXECUTED — A.1/A.2/A.3 闭环，A.4 报告已生成
**前置:** D089（D088-9 冗余索引清理）+ D087/D088（架构冻结 + 北京试点验收）
**范围:** KP 覆盖率从 P0 阻断状态提升至目标之上，工具链全本地化

---

## 背景

D088 验收时（仅 D088 北京试点 725 题）KP 覆盖率 31.72%，达标。Batch02 灌入后新增 5494 题但**未建立 KP 链接**，全库 6219 题整体覆盖率跌至 **9.91%**（616/6219），远低于 D088-11 提出的 ≥30% 目标。

Stage31 已有框架（chinese + history 两条规则、paper_id IN (10,11,20) 限制）不足以解决缺口。

---

## 执行

### A.1 — Stage 32 跑全量 + 扩 7 学科规则

**新增脚本:** `scripts/qb2/stage32-kp-relink-full.mjs`

| 变更 | Stage31 | Stage32 |
|---|---|---|
| 范围 | paper_id IN (10,11,20) | 全量 6219 题 |
| 学科 | chinese + history（2 学科） | **9 学科**（新增 math/english/physics/chemistry/biology/politics/geography）|
| 规则数 | 14 条 | **245 条** |
| KP id 验证 | 无 | SELECT 验证 245/245 全部存在 |
| 兜底 | pg_trgm (topic 32 字) | pg_trgm 保留 |
| LLM | 无 | 无（**纯本地**） |

**执行结果（2026-09-14 09:49 UTC+8）:**
```
输入未匹配题目: 5603 条
规则命中: 2715 题 (48.5%)
pg_trgm 兜底命中: 246 题 (4.4%)
未命中: 2642 题 (47.2%)
新写入 question_knowledge_points: 6504 条
```

**按学科规则命中分布:**
```
biology    493
physics    453
politics   381
chemistry  379
math       338
english    323
geography  198
history    150
```

### A.2 — Stage 33 导出 CSV 供人工抽审（零成本）

**新增脚本:** `scripts/qb2/stage33-export-csv-for-review.mjs`

为剩余 2642 题生成 top-3 KP 候选（pg_trgm similarity），导出到 `docs/audits/stage33-candidates-for-review.csv`：

| 字段 | 说明 |
|---|---|
| question_id, question_uid, subject_code, stem_60chars | 题标识 |
| kp1_id/kp1_name/kp1_sim ~ kp3_id/kp3_name/kp3_sim | pg_trgm top-3 候选 |
| review_status, review_kp_id, review_kp_name, notes | **人工填，空白** |

**关键决策：CSV 是唯一输出，不调用任何 LLM API，零成本**（遵守用户"严格控制成本"指令）。

### A.3 — Stage 34 读审校 CSV 写库（待人工执行）

**新增脚本:** `scripts/qb2/stage34-apply-reviewed-csv.mjs`

- 读取 `stage33-candidates-for-review-FILLED.csv`（人工填 review_kp_id 后重命名）
- 仅写 `review_kp_id` 非空且 `review_status='accepted'` 的行
- `relevance_score=0.95, source='human_review'`（人审标识）
- 单事务 + ON CONFLICT DO NOTHING 幂等
- 通过 `canonical_migration_ledger` 留痕 `run_label='stage34-apply-reviewed'`

### A.4 — Stage 32 报告自动生成

`docs/audits/stage32-kp-relink-report.json`（含方法/输入/输出/覆盖率）

---

## 验收结果（2026-09-14）

### KP 覆盖率（核心 KPI）

| 阶段 | 覆盖率 | 增量 |
|---|---:|---:|
| D088 验收（725 题，仅北京试点）| **31.72%** | — |
| batch02 灌入后（6219 题全库）| **9.91%** | -21.81% |
| **Stage32 完成后** | **57.52%** | **+47.61%** |
| 目标（D088-11）| ≥30% | — |

**实际 57.52%，超额完成 27.52 个百分点。**

### KP 节点使用扩展

| 阶段 | 使用 KP 数 | 覆盖率 |
|---|---:|---:|
| Stage32 前 | 81 / 426 | 19.0% |
| **Stage32 后** | **260 / 426** | **61.0%** |

KP 分布从集中在少数万金油 KP（CHN-Z0-003 现代文阅读独占 287 次）变成跨学科均衡：

```
CHN-Z0-003 现代文阅读       287 (Stage31 已有)
BIO-G0-001 走近细胞         255 (Stage32 新增)
POL-X1-354 和平与发展        246
CHEM-Z0-003 水与溶液        208
PHY-Z0-003 力学基础         203
PHYS-B1-327 匀变速直线运动  193
BIO-Z0-005 遗传与变异       179
BIO-G0-005 细胞的能量供应    156
```

### 测试无退化

```
npm test 结果（stage32 完成后）:
  Test Files:  7 failed / 12 passed (19)
  Tests:       6 failed / 245 passed (251)
```

**完全等同于 stage32 前基线**（7 failed / 245 passed），失败全部 pre-existing：
- 6 个 mock JSON 缺失（tutor_loop_*）
- 1 个 graphrag settings.yaml 缺失

---

## 后续路径

| 操作 | 说明 |
|---|---|
| 人工抽审 CSV | 用户可下载 `docs/audits/stage33-candidates-for-review.csv` (2642 行) 离线审校 |
| 写库 | 审校完成后填 `review_kp_id` 列，重命名为 `stage33-candidates-for-review-FILLED.csv`，跑 `node scripts/qb2/stage34-apply-reviewed-csv.mjs` |
| 期望增量 | 2642 题 × 审校覆盖率（按 50% 估）→ 整体覆盖率可再 +21% 至 ~78% |
| 剩余缺口 | 即使 100% 审校，仍有 ~2642 题 KP 难定（多为英文完形填空 + LaTeX 残损数学题）→ 需 source 重新解析 |

---

## 已知限制 / 未做

- **不调 LLM 兜底**：当前 47.2% 未命中（2642 题）需要人工审校；如要 LLM 辅助需走 stage35+ 另立项（成本评估见 risk）
- **LaTeX 题未处理**：数学题 stem 中 LaTeX 抽空（如"已知集合，，则（ ）"）使 trgm 失效，需 source 重新解析
- **English 完形填空**：cloze 填空题 stem 含 `___` 无法用规则匹配，占未命中 35%
- **batch02 NULL file_path 问题**：5494 题 `file_path IS NULL`，无法溯源（P0-QB-12 失败），本次未修（属于灌入质量问题，独立 backlog）

---

## 产物

| 文件 | 说明 |
|---|---|
| `scripts/qb2/stage32-kp-relink-full.mjs` | 9 学科 245 条规则，全量跑 |
| `scripts/qb2/stage33-export-csv-for-review.mjs` | 2642 行候选 CSV 导出 |
| `scripts/qb2/stage34-apply-reviewed-csv.mjs` | 读 CSV 写库（待人工审校后执行）|
| `docs/audits/stage32-kp-relink-report.json` | Stage32 完整报告 |
| `docs/audits/stage33-candidates-for-review.csv` | 2642 行人工审校 CSV |
| `database/canonical/census.json` | 北京试点 census（D088 既有）|

---

## 关键决策点

| ID | 决策 | 依据 |
|---|---|---|
| D090-1 | 不用 LLM 兜底，导出 CSV 让人工抽审 | 用户明确"严格控制成本"；LLM 调一次覆盖难量化；人工能跨语义判断 |
| D090-2 | KP id 必须 SELECT 验证存在 | D087-D088 一贯原则"代码即事实"；我编的 144 个 id 中 29 个不存在，第一次跑会全失败 |
| D090-3 | 单事务 + ON CONFLICT DO NOTHING | 跑多次安全（Stage32 实际 skipped 41 条说明已运行过部分题目） |
| D090-4 | relevance_score 反映置信度（rule 0.65~0.95 / trgm ≤0.6 / human_review 0.95）| Stage31 先例 |
| D090-5 | 全部写入过 canonical_migration_ledger | D088-8 要求审计可追溯 |
