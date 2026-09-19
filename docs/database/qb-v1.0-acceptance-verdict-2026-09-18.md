# QB v1.0 验收裁决记录（2026-09-18）

> 状态: **已裁决，按序执行中**
> 适用范围: `scripts/qb-extract/`（P1–P7 管线）产出的 1634 卷 / 35262 题入库批次
> 依据: `docs/database/qb-v1.0-national-migration-design.md` §6–§7（P0–P8 / G1–G17）
> 前置事实: `logs/qb-coverage-20260918-160207.json` —— G1–G17 中 16 PASS / 1 PARTIAL（G11）

原则：**不允许「没法测」被写成「通过」**。本轮所有裁决都只在「有机械判据」的范围内下结论，
规范未给阈值的项一律**仅记基线、不回卡**。

---

## 1. G11 公式（唯一 PARTIAL → 结案口径）

| # | 议题 | 裁决 |
|---|---|---|
| ① | 「关键公式」定义 | **操作化定义**：math / physics / chemistry / biology 四学科中，stem / options / answer / analysis 内被管线公式检测器提取的**全部公式 span** 即为关键公式，**不做语义筛选** |
| ② | 方案 B（OMML 结构比对） | **不做**，记入 backlog |
| ③ | 达标线 | 可渲染率 **≥99.5% 为硬闸门**（实测 99.81%，通过）；残留 5 条逐条建工单、**不硬修**，列入 v1.0 known-issues |

### ① 理由

可复现、可辩护。语义筛选（"重要公式才判"）需引入人判，不可审计 —— 与本管线
「布尔式代理指标」的既往教训（见 `g11-threshold-proposal.md` §2.4）同源，禁止重蹈。

### ② 理由

方案 A（可渲染口径）的 99.81% 已满足 v1.0 发布要求。方案 B 的唯一增量价值是
**为 F2 判级提供辩护**，属增强项而非发布必需项。其前置风险（OMML↔VLM 公式按题号+顺序配对
的配对率未知）不值得为 v1.0 承担。

### ③ 闸门归属

`scripts/qb-extract/20-formula-gate.py` 已实现且带独立复验（翻标记骗不过）。
达标线以**可渲染率**表述，不复用规范里定义缺失的 F0–F3 判级。

**残留 5 条**（不硬修，理由：修后会变成更坏的东西）：

```
#160394  {"latex":"bar{bar{bar{...        VLM 循环产物, 结构不可复原
#160817  {"latex":"\\Delta \\text{ }...   JSON 外壳 (74×\text{ })
#161046  \log_{b}^{x}_{...                双下标, 修后仍非法
#161226  \alpha \boxempty \beta = ...     \boxempty 为臆造命令
#162522  {"latex": "\\frac{\\vec{A}u...   JSON 外壳 (长 \! 串)
```

---

## 2. G8 / G12 无阈值项 —— 记基线，不回卡

认可 `08-acceptance.py`「报实测值、不自造达标线」的处理。将实测值写入规范补编，
作为 **v1.0 基线**；**本次不回卡**，今后迁移以此为闸门。

| Gate | 基线阈值 | 本批实测 | 判定 |
|---|---|---:|---|
| G8 客观题可判率 | **≥90%** | 91.1%（21250/23335） | 基线记录 |
| G12 KP 覆盖率（rule 源） | **≥40%** | 43.1%（15204/35262） | 基线记录 |

> G12 已知缺口（**既有数据造成，非本批引入**）：既有 `llm_b2` 行引用注册表外 kp_id 6387 条
> （桥接表仅 426 条而旧数据有 1363 个 id）。英语 0% 覆盖因 KP 词表无 ENG 单元。

---

## 3. LLM 补答案（2034 条，盲测 83.3%）

盲测依据: `docs/database/llm-answer-validation.md`（deepseek-v3.2，300 题，源答案独立于模型）

### 3.1 总原则

**LLM_PROPOSED 永不参与判分。** 答案的"存在"与"可信"是两个维度，不得合并。

### 3.2 分级展示

| 盲测准确率 | 处理 |
|---|---|
| **≥70% 学科**（biology 94.1 / physics 90.9 / politics 90.7 / math 88.2 / history 87.5 / chemistry 81.2 / english 76.0） | 答案位展示，**带「AI 补·未核验」徽标** |
| **<70% 学科**（chinese 57.1 / geography 68.2） | **不占答案位**；原值仅存 provenance 字段，供 tutor 侧参考 |

### 3.3 CONFLICT 103 条

一律按 **MISSING_SOURCE** 处理并建工单，**两个值都不采纳**。
理由：冲突态下无法判定哪一方正确，采纳任一方都是把噪声写成事实。

### 3.4 落地要求

- 规则写入 migration，并在 ledger 留痕（`canonical_migration_ledger`）
- 前端徽标**后续单独派单**，不阻塞本轮

---

## 4. 执行顺序（用户指定）

1. ✅ 提交 `scripts/qb-extract/` + `docs/database/` 文档（含本记录）
2. ✅ kill libreoffice 死进程 —— 2026-09-18 复查：PID 1523706 已不存在，`ps` 无 soffice/oosplash 残留，无需处理
3. ✅ 写 G11 决策文档 —— `.ai/decisions/D093-g11-formula-gate-criteria.md`（已含 §1①②③）
4. ✅ LLM 答案分级 migration + ledger 留痕 —— 2026-09-19 执行完毕
   - `database/migrations/029_llm_answer_grading.sql`：
     chinese(57.1%) / geography(68.2%) 的 LLM 值撤出答案位转存 `answer_provenance`；
     ≥70% 学科只把学科实测准确率写进 provenance（答案位与 `LLM_PROPOSED` 不变）；
     CONFLICT 逐条作废转 `MISSING_SOURCE` + 建 `issue_tickets` 工单；ledger 记 BEGIN/ANSWER_GRADED/COMMIT。
   - 幂等（各段靠改前状态守卫，重跑 0 行）；离线校验：在 `education` 库搭桩跑通三条路径并
     验证「连跑两遍第二遍全 0」，全部 ROLLBACK。回滚语句见该文件 §7。
   - **实测**: §2=0 行（两科本就没有 LLM 答案写入 —— 补答案阶段已按学科排除）、§3=2034 行、
     §4=103 行、§5=103 工单；重跑全 0。CONFLICT 清零，MISSING_SOURCE 7500→7603。
4b. ✅ D093 §3 判据落地（此前只改文档注释，代码未改）—— `20-formula-gate.py` 改可渲染率判据
     （`--min-rate` 默认 0.995，保留独立复验 + 标记漂移 warning），`08-acceptance.py` G11 段同步。
     实测 99.95%；双向验证 `--min-rate 1.0` → FAIL / exit 1。
4c. ✅ `030_formula_known_issue_tickets.sql` —— K1 残留 5 条逐条建工单（不硬修）。
5. ✅ 复跑 G1–G17 确认无回归 —— **PASS 17 / PARTIAL 0 / FAIL 0**
   （基线 16 PASS / 1 PARTIAL）。G8② 91.1%→90.9%（029 直接后果，仍 ≥90% 基线阈值）；
   G11 PARTIAL→PASS（判据落地，残留仍是 5 条）。
   收官报告: `docs/database/qb-v1.0-final-report-2026-09-19.md`

**顺序理由**：43k 题已在库而管线无版本保护，是当前唯一不可逆风险点 —— 代码入库优先于一切文档工作。

---

## 5. v1.0 known-issues（随本轮确立）

| # | 问题 | 状态 |
|---|---|---|
| K1 | 5 条不可渲染公式（方案 A 口径，见 §1③） | 工单已建（`030`，×5），不硬修 |
| K2 | G11 方案 B（OMML 结构比对）未做 | backlog `G11-PLAN-B` |
| K3 | 既有 `llm_b2` 引用注册表外 kp_id 6387 条 | 既有缺口，另案 |
| K4 | 英语 KP 覆盖 0%（词表无 ENG 单元） | 待词表扩充 |
| K5 | LLM 补答案约 16.7% 错误率 | 已按 §3 分级隔离，永不判分 |
| K6 | CONFLICT 103 条 | 已转 MISSING_SOURCE + 103 工单待人工裁决 |

> 收官状态见 `docs/database/qb-v1.0-final-report-2026-09-19.md`。

---

*产出脚本：`scripts/qb-extract/`（01–20）；验收：`08-acceptance.py`；
公式闸门：`20-formula-gate.py`；答案闸门：`11-answer-gate.py`。*
